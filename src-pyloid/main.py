from pyloid.tray import TrayEvent
from pyloid.utils import get_production_path, is_production
from pyloid.serve import pyloid_serve
from pyloid import Pyloid
import sys

from PySide6.QtCore import QObject, Signal, Qt, QTimer, QRect
from PySide6.QtWidgets import QWidget
from PySide6.QtGui import QScreen

from server import server, register_onboarding_complete_callback, register_data_reset_callback, register_window_actions, register_download_progress_callback
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
    amplitude_changed = Signal(float)


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
    # Frontend will handle showing settings tab via URL hash or event


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

# Popup dimensions for different states
POPUP_IDLE_WIDTH = 110
POPUP_IDLE_HEIGHT = 18
POPUP_ACTIVE_WIDTH = 280
POPUP_ACTIVE_HEIGHT = 86

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


def resize_popup(width: int, height: int):
    """Resize and reposition popup window."""
    global popup_window
    if popup_window is None:
        return

    try:
        # Resize the window
        popup_window.set_size(width, height)

        # Ensure stay-on-top is maintained after resize
        # Also prevent resizing and make non-focusable to reduce blinking
        qwindow = popup_window._window._window
        qwindow.setWindowFlags(
            Qt.FramelessWindowHint |
            Qt.WindowStaysOnTopHint |
            Qt.Tool |
            Qt.WindowDoesNotAcceptFocus
        )
        # Re-apply translucent background (required after setWindowFlags)
        qwindow.setAttribute(Qt.WA_TranslucentBackground, True)
        # Prevent window resizing
        qwindow.setFixedSize(width, height)
        qwindow.show()

        # Position AFTER show — setWindowFlags resets position on Windows
        popup_x = _screen_x + (_screen_width - width) // 2
        popup_y = _screen_y + 16
        qwindow.move(popup_x, popup_y)
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

            # CRITICAL: Enable translucent background on the window widget
            # This is required for proper transparency on Windows in production
            qwindow.setAttribute(Qt.WA_TranslucentBackground, True)

            # CRITICAL: Set background color BEFORE loading URL
            # Qt WebEngineView requires this order to avoid black/white background
            webview.page().setBackgroundColor(QColor(0, 0, 0, 0))

            # Load the URL
            if is_production():
                url = pyloid_serve(directory=get_production_path("dist-front"))
                popup_window.load_url(f"{url}#/popup")
            else:
                popup_window.load_url("http://localhost:5173#/popup")

            # Set window flags for stay-on-top and no taskbar icon
            # WindowDoesNotAcceptFocus prevents stealing focus and reduces blinking
            qwindow.setWindowFlags(
                Qt.FramelessWindowHint |
                Qt.WindowStaysOnTopHint |
                Qt.Tool |  # Prevents taskbar icon
                Qt.WindowDoesNotAcceptFocus  # Prevents focus stealing and blinking
            )

            # Prevent window resizing (Issue #2)
            qwindow.setFixedSize(POPUP_IDLE_WIDTH, POPUP_IDLE_HEIGHT)

            # Show the window
            popup_window.show()

            # Position AFTER show — setWindowFlags resets position on Windows
            popup_x = _screen_x + (_screen_width - POPUP_IDLE_WIDTH) // 2
            popup_y = _screen_y + 16
            qwindow.move(popup_x, popup_y)
            log.info("Popup window created and shown",
                     x=popup_x, y=popup_y,
                     monitor_offset_x=_screen_x, monitor_offset_y=_screen_y)

            # Send initial idle state after a brief delay to ensure page is loaded
            def send_initial_state():
                send_popup_event('popup-state', {'state': 'idle'})
                log.debug("Sent initial idle state to popup")

            QTimer.singleShot(200, send_initial_state)
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
    # Resize to active size for recording
    resize_popup(POPUP_ACTIVE_WIDTH, POPUP_ACTIVE_HEIGHT)
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
    # Resize back to idle size
    resize_popup(POPUP_IDLE_WIDTH, POPUP_IDLE_HEIGHT)
    send_popup_event('popup-state', {'state': 'idle'})

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

def _on_amplitude_slot(amp: float):
    """Slot: Actual amplitude handler - runs on main thread via signal."""
    # Send to popup if it exists
    send_popup_event('amplitude', amp)
    # Also send to main window (for onboarding mic test)
    send_main_window_event('amplitude', amp)

def on_amplitude(amp: float):
    """Called from audio thread - emits signal to main Qt thread."""
    if _signals:
        _signals.amplitude_changed.emit(amp)


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

# Connect thread-safe signals to their slot handlers
# Qt.QueuedConnection ensures slots run on the main thread
_signals.recording_started.connect(_on_recording_start_slot, Qt.QueuedConnection)
_signals.recording_stopped.connect(_on_recording_stop_slot, Qt.QueuedConnection)
_signals.transcription_complete.connect(_on_transcription_complete_slot, Qt.QueuedConnection)
_signals.amplitude_changed.connect(_on_amplitude_slot, Qt.QueuedConnection)

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
