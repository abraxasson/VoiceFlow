from pyloid.tray import TrayEvent
from pyloid.utils import get_production_path, is_production
from pyloid.serve import pyloid_serve
from pyloid import Pyloid
import sys

from PySide6.QtCore import QObject, Signal, Qt, QTimer, QRect
from PySide6.QtWidgets import QWidget
from PySide6.QtGui import QScreen

from server import server, register_onboarding_complete_callback, register_data_reset_callback, register_window_actions, register_download_progress_callback, register_visualizer_style_callback, register_popup_drag_callback
from app_controller import get_controller
from services.logger import setup_logging, get_logger

# Setup logging first thing
setup_logging()
log = get_logger("window")


# ============================================================================
# Thread-safe signal emitter for cross-thread UI updates
# ============================================================================
class ThreadSafeSignals(QObject):
    """Emits signals that can be connected to slots running on the main thread."""
    recording_started = Signal()
    recording_stopped = Signal()
    transcription_complete = Signal(str)
    amplitude_changed = Signal(object)
    visualizer_style_changed = Signal(str)


# Global signal emitter instance (created after QApplication)
_signals: ThreadSafeSignals = None


def init_signals():
    """Initialize the signal emitter - must be called after QApplication is created."""
    global _signals
    _signals = ThreadSafeSignals()


# ============================================================================
# Single Instance Check (Issue #4: Multiple tray icons)
# ============================================================================
# Windows mutex-based single instance check as backup to Pyloid's single_instance
# This prevents multiple tray icons when Pyloid's check fails or app crashes
_instance_mutex = None

def ensure_single_instance():
    """Ensure only one instance of VoiceFlow runs at a time using Windows mutex."""
    global _instance_mutex

    if sys.platform != 'win32':
        return True  # Only implement Windows mutex for now

    try:
        import ctypes
        from ctypes import wintypes

        # Windows API constants
        ERROR_ALREADY_EXISTS = 183

        # Create a named mutex
        kernel32 = ctypes.windll.kernel32
        mutex_name = "VoiceFlow_SingleInstance_Mutex"

        _instance_mutex = kernel32.CreateMutexW(None, False, mutex_name)

        if kernel32.GetLastError() == ERROR_ALREADY_EXISTS:
            log.warning("Another instance of VoiceFlow is already running")
            # Try to focus the existing instance by finding its window
            try:
                user32 = ctypes.windll.user32
                hwnd = user32.FindWindowW(None, "VoiceFlow")
                if hwnd:
                    # Show and bring to foreground
                    SW_RESTORE = 9
                    user32.ShowWindow(hwnd, SW_RESTORE)
                    user32.SetForegroundWindow(hwnd)
                    log.info("Focused existing VoiceFlow window")
            except Exception as e:
                log.warning("Could not focus existing window", error=str(e))
            return False

        log.info("Single instance check passed - mutex acquired")
        return True

    except Exception as e:
        log.error("Single instance check failed", error=str(e))
        return True  # Allow running if check fails


# Check for existing instance before proceeding
if not ensure_single_instance():
    log.info("Exiting - another instance is running")
    sys.exit(0)

# Initialize app
# Reverting OpenGL attribute to standard
# from PySide6.QtCore import Qt, QCoreApplication
# QCoreApplication.setAttribute(Qt.AA_ShareOpenGLContexts)

app = Pyloid(app_name="VoiceFlow", single_instance=True, server=server)

app.set_icon(get_production_path("src-pyloid/icons/icon.png"))
app.set_tray_icon(get_production_path("src-pyloid/icons/icon.png"))

# Initialize thread-safe signals for cross-thread UI updates
# Must be done after Pyloid creates QApplication
init_signals()

# Initialize controller
controller = get_controller()

# Store reference to popup window
popup_window = None


def show_dashboard():
    app.show_and_focus_main_window()


def open_settings():
    app.show_and_focus_main_window()
    # Tell frontend to navigate to settings tab
    send_main_window_event('navigate', {'path': '/dashboard/settings'})


# Tray setup
app.set_tray_actions({
    TrayEvent.DoubleClick: show_dashboard,
})

app.set_tray_menu_items([
    {"label": "Open Dashboard", "callback": show_dashboard},
    {"label": "Settings", "callback": open_settings},
    {"label": "Quit", "callback": app.quit},
])


# Recording popup window management
import json
from PySide6.QtCore import QTimer
from PySide6.QtGui import QColor, QCursor
from PySide6.QtWidgets import QApplication

# Popup dimensions
POPUP_IDLE_WIDTH = 110
POPUP_IDLE_HEIGHT = 18
# Active sizes per visualizer style
POPUP_PILL_W = 490    # multiwave and bar (460 SVG + 16 padding + margin)
POPUP_PILL_H = 110
POPUP_RING_W = 155    # ring (148 SVG + margin)
POPUP_RING_H = 155


def get_popup_dims(style: str) -> tuple:
    """Return (width, height) for the given visualizer style."""
    if style == "ring":
        return (POPUP_RING_W, POPUP_RING_H)
    return (POPUP_PILL_W, POPUP_PILL_H)  # multiwave, bar, or unknown

# Screen info cache (for active monitor)
_screen_x = 0        # Monitor X offset
_screen_y = 0        # Monitor Y offset
_screen_width = 1920
_screen_height = 1080


def get_active_monitor_info():
    """Get the monitor where the cursor is currently located (for multi-monitor support)."""
    global _screen_x, _screen_y, _screen_width, _screen_height
    try:
        # Get cursor position to determine active monitor
        cursor_pos = QCursor.pos()

        # Find the screen containing the cursor
        screen = QApplication.screenAt(cursor_pos)
        if screen is None:
            # Fallback to primary screen
            screen = QApplication.primaryScreen()

        if screen:
            geometry = screen.geometry()
            _screen_x = geometry.x()
            _screen_y = geometry.y()
            _screen_width = geometry.width()
            _screen_height = geometry.height()
            log.info("Active monitor detected",
                     x=_screen_x, y=_screen_y,
                     width=_screen_width, height=_screen_height,
                     screen_name=screen.name())
        else:
            # Ultimate fallback
            _screen_x = 0
            _screen_y = 0
            _screen_width = 1920
            _screen_height = 1080
            log.warning("No screen detected, using defaults")
    except Exception as e:
        log.error("Failed to get active monitor info", error=str(e))


def get_screen_info():
    """Get and cache screen dimensions (legacy function, now uses active monitor)."""
    get_active_monitor_info()


def _popup_qwindow():
    """Return the raw QMainWindow for the popup, or None."""
    if popup_window is None:
        return None
    try:
        return popup_window._window._window
    except Exception:
        return None


def show_popup(width: int, height: int):
    """Size and move the popup into view. Window stays 'shown' off-screen to avoid flicker."""
    qw = _popup_qwindow()
    if qw is None:
        return
    try:
        # Determine target position
        target_x, target_y = None, None
        saved = controller.settings_service.get_settings()
        if saved.popup_x is not None and saved.popup_y is not None:
            saved_rect = QRect(saved.popup_x, saved.popup_y, width, height)
            on_screen = any(
                screen.geometry().intersects(saved_rect)
                for screen in QApplication.instance().screens()
            )
            if on_screen:
                target_x, target_y = saved.popup_x, saved.popup_y
        if target_x is None:
            # Default: center-top of active monitor
            target_x = _screen_x + (_screen_width - width) // 2
            target_y = _screen_y + 16

        # Resize then move — no hide/show cycle, renderer stays warm
        qw.setFixedSize(width, height)
        qw.show()  # no-op if already visible; safety net for very first call
        qw.move(target_x, target_y)
    except Exception as e:
        log.error("Failed to show popup", error=str(e))


def resize_popup(width: int, height: int):
    """Resize popup keeping its current position (style change while recording)."""
    qw = _popup_qwindow()
    if qw is None:
        return
    try:
        current_pos = qw.pos()
        qw.setFixedSize(width, height)
        qw.move(current_pos)  # keep wherever user has placed it
    except Exception as e:
        log.error("Failed to resize popup", error=str(e))


def init_popup():
    """Initialize the recording popup."""
    global popup_window
    log.debug("init_popup called")

    try:
        if popup_window is None:
            # Get active monitor info (where cursor is) for multi-monitor support
            get_active_monitor_info()

            # Create window with idle size initially
            # frame=False makes it frameless, transparent=True enables transparency
            popup_window = app.create_window(
                title="Recording",
                width=POPUP_IDLE_WIDTH,
                height=POPUP_IDLE_HEIGHT,
                frame=False,
                transparent=True,
            )

            # Access internal Qt objects for transparency setup
            qwindow = popup_window._window._window
            webview = popup_window._window.web_view

            # CRITICAL: Set background color BEFORE loading URL
            webview.page().setBackgroundColor(QColor(0, 0, 0, 0))

            # Load the URL
            if is_production():
                url = pyloid_serve(directory=get_production_path("dist-front"))
                popup_window.load_url(f"{url}#/popup")
            else:
                popup_window.load_url("http://localhost:5173#/popup")

            # Set window flags for stay-on-top and no taskbar icon
            qwindow.setWindowFlags(
                Qt.FramelessWindowHint |
                Qt.WindowStaysOnTopHint |
                Qt.Tool |
                Qt.WindowDoesNotAcceptFocus
            )

            # CRITICAL: Re-apply AFTER setWindowFlags — setWindowFlags resets this attribute
            qwindow.setAttribute(Qt.WA_TranslucentBackground, True)
            webview.page().setBackgroundColor(QColor(0, 0, 0, 0))

            qwindow.setFixedSize(POPUP_IDLE_WIDTH, POPUP_IDLE_HEIGHT)

            # Show off-screen so page loads (required for Qt WebEngine) but user never sees it
            popup_window.show()
            qwindow.move(-32000, -32000)  # far off-screen — transparent window, never visible
            log.info("Popup window created (off-screen init)")

            # After page loads: send idle state, install drag filter, park off-screen
            # (Never truly hide — keeping the window "shown" off-screen prevents the
            # Qt WebEngine renderer from suspending, which eliminates the flash/flicker
            # that happens when hiding and re-showing causes a re-render.)
            def on_page_loaded():
                # Re-apply transparent background (dev mode webview may reset it)
                try:
                    webview.page().setBackgroundColor(QColor(0, 0, 0, 0))
                except Exception:
                    pass
                send_popup_event('popup-state', {'state': 'idle'})
                _install_popup_drag_filter()
                try:
                    qwindow.move(-32000, -32000)
                    log.debug("Popup parked off-screen after initial load")
                except Exception as e:
                    log.error("Failed to park popup off-screen", error=str(e))

            QTimer.singleShot(1200, on_page_loaded)

            # Install popup move event filter for position persistence
            _install_popup_move_filter(qwindow)
        else:
            log.debug("Popup window already exists, skipping creation")
    except Exception as e:
        log.error("Failed to initialize popup", error=str(e))

def send_popup_event(name, detail):
    """Send event to popup window using Pyloid's invoke method."""
    global popup_window
    if popup_window:
        try:
            popup_window.invoke(name, detail)
        except Exception as e:
            log.error("Failed to send popup event", event=name, error=str(e))

def _on_recording_start_slot():
    """Slot: Actual recording start handler - runs on main thread via signal."""
    log.info("Recording started")
    style = controller.get_settings().get("visualizerStyle", "multiwave")
    w, h = get_popup_dims(style)
    show_popup(w, h)
    send_popup_event('popup-state', {'state': 'recording'})

def on_recording_start():
    """Called from hotkey thread - emits signal to main Qt thread."""
    if _signals:
        _signals.recording_started.emit()

def _on_recording_stop_slot():
    """Slot: Actual recording stop handler - runs on main thread via signal."""
    log.info("Recording stopped - processing")
    # Keep active size during processing
    send_popup_event('popup-state', {'state': 'processing'})

def on_recording_stop():
    """Called from hotkey thread - emits signal to main Qt thread."""
    if _signals:
        _signals.recording_stopped.emit()

def _on_transcription_complete_slot(text: str):
    """Slot: Actual transcription complete handler - runs on main thread via signal."""
    log.info("Transcription complete", text_length=len(text))
    send_popup_event('popup-state', {'state': 'idle'})
    qw = _popup_qwindow()
    if qw is not None:
        try:
            qw.move(-32000, -32000)  # park off-screen instead of hiding (avoids renderer suspend)
        except Exception as e:
            log.error("Failed to park popup off-screen", error=str(e))

def on_transcription_complete(text: str):
    """Called from transcription thread - emits signal to main Qt thread."""
    if _signals:
        _signals.transcription_complete.emit(text)

def send_main_window_event(name, detail):
    """Send event to main window using Pyloid's invoke method."""
    global window
    if window:
        try:
            window.invoke(name, detail)
        except Exception as e:
            log.error("Failed to send main window event", event=name, error=str(e))

def _on_amplitude_slot(data):
    """Slot: Actual amplitude handler - runs on main thread via signal."""
    # Send to popup if it exists
    send_popup_event('amplitude', data)
    # Also send to main window (for onboarding mic test)
    send_main_window_event('amplitude', data)

def on_amplitude(data):
    """Called from audio thread - emits signal to main Qt thread."""
    if _signals:
        _signals.amplitude_changed.emit(data)


def _on_visualizer_style_slot(style: str):
    """Slot: runs on main Qt thread via signal."""
    send_popup_event('visualizer-style', {'style': style})
    qw = _popup_qwindow()
    if qw is not None and qw.isVisible():
        w, h = get_popup_dims(style)
        resize_popup(w, h)
        log.info("Popup resized for new visualizer style", style=style, w=w, h=h)

def on_visualizer_style_changed(style: str):
    """Called from RPC thread - emits signal to main Qt thread."""
    if _signals:
        _signals.visualizer_style_changed.emit(style)


# ---- Popup position persistence ----
_popup_pos_timer: QTimer = None
_popup_move_filter = None


def _save_popup_pos():
    """Debounced: save popup position after drag."""
    qw = _popup_qwindow()
    if qw is None:
        return
    try:
        pos = qw.pos()
        # Ignore off-screen sentinel position used when popup is "hidden"
        if pos.x() < -1000 or pos.y() < -1000:
            return
        controller.settings_service.save_popup_position(pos.x(), pos.y())
        log.debug("Popup position saved", x=pos.x(), y=pos.y())
    except Exception as e:
        log.error("Failed to save popup position", error=str(e))


class _PopupMoveFilter(QObject):
    def eventFilter(self, obj, event):
        from PySide6.QtCore import QEvent
        if event.type() == QEvent.Type.Move:
            if _popup_pos_timer:
                _popup_pos_timer.start(600)
        return False


class _PopupDragFilter(QObject):
    """Event filter that initiates native drag on mouse press anywhere on the popup."""
    def eventFilter(self, obj, event):
        from PySide6.QtCore import QEvent
        if event.type() == QEvent.Type.MouseButtonPress:
            if event.button() == Qt.LeftButton:
                do_start_popup_drag()
                return True  # consume the event
        return False


_popup_drag_filter = None

def _install_popup_move_filter(qwindow):
    global _popup_pos_timer, _popup_move_filter, _popup_drag_filter
    _popup_pos_timer = QTimer()
    _popup_pos_timer.setSingleShot(True)
    _popup_pos_timer.timeout.connect(_save_popup_pos)
    _popup_move_filter = _PopupMoveFilter()
    qwindow.installEventFilter(_popup_move_filter)

def _install_popup_drag_filter():
    """Install drag filter on the popup's webview so mouse press initiates native drag."""
    global _popup_drag_filter
    if popup_window is None:
        return
    try:
        webview = popup_window._window.web_view
        _popup_drag_filter = _PopupDragFilter()
        webview.installEventFilter(_popup_drag_filter)
        # Also install on the webview's focusProxy (where Qt WebEngine really routes input)
        focus_proxy = webview.focusProxy()
        if focus_proxy:
            focus_proxy.installEventFilter(_popup_drag_filter)
        log.debug("Popup drag filter installed")
    except Exception as e:
        log.error("Failed to install popup drag filter", error=str(e))


# ---- Popup drag (Win32 native) ----
def do_start_popup_drag():
    """Initiate native OS window drag via Win32 PostMessage."""
    import sys
    if sys.platform != 'win32':
        return
    qw = _popup_qwindow()
    if qw is None:
        return
    try:
        import ctypes
        hwnd = int(qw.winId())
        ctypes.windll.user32.ReleaseCapture()
        WM_NCLBUTTONDOWN = 0x00A1
        HTCAPTION = 2
        ctypes.windll.user32.PostMessageW(hwnd, WM_NCLBUTTONDOWN, HTCAPTION, 0)
    except Exception as e:
        log.error("Popup drag failed", error=str(e))


def on_onboarding_complete():
    """Called when user completes onboarding - hide main window, show popup."""
    global window
    log.info("Onboarding complete - initializing popup")
    # Hide the main window (user can reopen via tray)
    if window:
        window.hide()
    # Initialize the popup directly (QTimer doesn't work reliably from async RPC context)
    init_popup()


def hide_popup():
    """Hide the popup window (used when returning to onboarding)."""
    global popup_window
    log.debug("Hiding popup window")
    if popup_window:
        try:
            popup_window.hide()
            popup_window.close()
            popup_window = None
            log.info("Popup window hidden and destroyed")
        except Exception as e:
            log.error("Failed to hide popup", error=str(e))


def on_data_reset():
    """Called when user resets all data - show main window, hide popup."""
    global window
    log.info("Data reset - returning to onboarding")
    # Hide the popup
    hide_popup()
    # Show the main window for onboarding
    if window:
        window.show()
        try:
            qwindow = window._window._window
            qwindow.showMaximized()
        except Exception as e:
            log.error("Could not maximize window", error=str(e))


def send_download_progress(event_name: str, data: dict):
    """Send download progress events to the main window."""
    send_main_window_event(event_name, data)


# Register callbacks
register_onboarding_complete_callback(on_onboarding_complete)
register_data_reset_callback(on_data_reset)
register_download_progress_callback(send_download_progress)
register_visualizer_style_callback(on_visualizer_style_changed)
register_popup_drag_callback(do_start_popup_drag)

# Connect thread-safe signals to their slot handlers
# Qt.QueuedConnection ensures slots run on the main thread
_signals.recording_started.connect(_on_recording_start_slot, Qt.QueuedConnection)
_signals.recording_stopped.connect(_on_recording_stop_slot, Qt.QueuedConnection)
_signals.transcription_complete.connect(_on_transcription_complete_slot, Qt.QueuedConnection)
_signals.amplitude_changed.connect(_on_amplitude_slot, Qt.QueuedConnection)
_signals.visualizer_style_changed.connect(_on_visualizer_style_slot, Qt.QueuedConnection)

# Set UI callbacks
controller.set_ui_callbacks(
    on_recording_start=on_recording_start,
    on_recording_stop=on_recording_stop,
    on_transcription_complete=on_transcription_complete,
    on_amplitude=on_amplitude,
)

# Initialize controller (load model, start hotkey listener)
controller.initialize()


# Check if onboarding is complete
settings = controller.get_settings()
onboarding_complete = settings.get("onboardingComplete", False)
log.info("Startup", onboarding_complete=onboarding_complete)

# Get Screen Info for main window
get_screen_info()


# Window Control Functions
def minimize_main_window():
    if window:
        window.hide()

def toggle_maximize_main_window():
    if window:
        qwin = window._window._window
        if qwin.isMaximized():
            qwin.showNormal()
        else:
            qwin.showMaximized()

def close_main_window():
    # Instead of quitting, we hide to tray if onboarding is done
    if window:
        window.hide()

# Register these actions with the server so RPC can call them
register_window_actions(minimize_main_window, toggle_maximize_main_window, close_main_window)


# Main window setup
if is_production():
    url = pyloid_serve(directory=get_production_path("dist-front"))
    # Revert to standard frame, no transparency to fix crash
    window = app.create_window(title="VoiceFlow", frame=True, transparent=False, dev_tools=False)
    # try:
    #     window._window.web_view.page().setBackgroundColor(QColor(0, 0, 0, 0))
    # except Exception as e:
    #     error(f"Failed to set transparent background: {e}")
    window.load_url(url)
else:
    # Dev: Standard Frame
    window = app.create_window(title="VoiceFlow", dev_tools=False, frame=True, transparent=False)
    # try:
    #     window._window.web_view.page().setBackgroundColor(QColor(0, 0, 0, 0)) 
    # except Exception as e:
    #     error(f"Failed to set transparent background: {e}")
    window.load_url("http://localhost:5173")

# Window sizing: set minimum, restore saved geometry or use 80% default
MIN_WINDOW_WIDTH = 800
MIN_WINDOW_HEIGHT = 600

try:
    qwindow = window._window._window
    qwindow.setMinimumSize(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT)

    saved = controller.settings_service.get_settings()
    restored = False

    if (saved.window_width is not None and saved.window_height is not None
            and saved.window_x is not None and saved.window_y is not None):
        # Validate the saved geometry is on an available screen
        saved_rect = QRect(saved.window_x, saved.window_y, saved.window_width, saved.window_height)
        on_screen = any(
            screen.geometry().intersects(saved_rect)
            for screen in QApplication.instance().screens()
        )
        if on_screen:
            w = max(saved.window_width, MIN_WINDOW_WIDTH)
            h = max(saved.window_height, MIN_WINDOW_HEIGHT)
            qwindow.resize(w, h)
            qwindow.move(saved.window_x, saved.window_y)
            restored = True
            log.info("Window geometry restored", width=w, height=h, x=saved.window_x, y=saved.window_y)

    if not restored:
        target_width = max(int(_screen_width * 0.8), MIN_WINDOW_WIDTH)
        target_height = max(int(_screen_height * 0.8), MIN_WINDOW_HEIGHT)
        qwindow.resize(target_width, target_height)
        log.info("Window geometry default", width=target_width, height=target_height)

except Exception as e:
    log.error("Failed to set window size constraints", error=str(e))


# Debounced geometry saver — persists size/position 500ms after last change
_geometry_save_timer = QTimer()
_geometry_save_timer.setSingleShot(True)

def _save_geometry():
    try:
        qwin = window._window._window
        geo = qwin.geometry()
        # Only save when window is in a normal (non-minimized, non-maximized) state
        if not qwin.isMinimized() and not qwin.isMaximized():
            controller.settings_service.save_window_geometry(
                geo.width(), geo.height(), geo.x(), geo.y()
            )
            log.info("Window geometry saved", width=geo.width(), height=geo.height(),
                     x=geo.x(), y=geo.y())
    except Exception as e:
        log.error("Failed to save window geometry", error=str(e))

_geometry_save_timer.timeout.connect(_save_geometry)


class WindowGeometryFilter(QObject):
    """Event filter that persists geometry on resize/move and hides to tray on minimize."""
    def eventFilter(self, obj, event):
        from PySide6.QtCore import QEvent
        if event.type() in (QEvent.Type.Resize, QEvent.Type.Move):
            _geometry_save_timer.start(500)
        elif event.type() == QEvent.Type.WindowStateChange:
            if obj.isMinimized():
                # Hide to tray instead of minimizing to taskbar
                QTimer.singleShot(0, window.hide)
        return False

try:
    _geo_filter = WindowGeometryFilter()
    window._window._window.installEventFilter(_geo_filter)
except Exception as e:
    log.error("Failed to install geometry event filter", error=str(e))


if onboarding_complete:
    # Start minimized - user can open via tray icon
    log.info("Onboarding already complete - hiding window and scheduling popup init")
    window.hide()
    # Initialize popup after a short delay
    QTimer.singleShot(500, init_popup)
else:
    # Show maximized for onboarding experience
    window.show()
    log.info("Showing onboarding window")
    # Don't initialize popup during onboarding

app.run()

# Cleanup on exit
controller.shutdown()
