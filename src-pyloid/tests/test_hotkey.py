import pytest
from services.hotkey import HotkeyService


class TestHotkeyService:
    def test_initial_state_not_running(self):
        """Hotkey service starts in non-running state."""
        service = HotkeyService()
        assert service.is_running() == False

    def test_start_changes_state_to_running(self):
        """Starting the service changes state to running."""
        service = HotkeyService()
        service.start()

        assert service.is_running() == True

        # Cleanup
        service.stop()

    def test_stop_changes_state_to_not_running(self):
        """Stopping the service changes state back to not running."""
        service = HotkeyService()
        service.start()
        service.stop()

        assert service.is_running() == False

    def test_start_twice_is_idempotent(self):
        """Starting twice doesn't cause issues."""
        service = HotkeyService()
        service.start()
        service.start()  # Should not error

        assert service.is_running() == True

        # Cleanup
        service.stop()

    def test_stop_without_start_is_safe(self):
        """Stopping without starting doesn't cause issues."""
        service = HotkeyService()
        service.stop()  # Should not error

        assert service.is_running() == False

    def test_set_callbacks(self):
        """Can set activation and deactivation callbacks."""
        service = HotkeyService()

        activated = []
        deactivated = []

        def on_activate():
            activated.append(True)

        def on_deactivate():
            deactivated.append(True)

        # Should not raise
        service.set_callbacks(
            on_activate=on_activate,
            on_deactivate=on_deactivate,
        )

    def test_callbacks_are_optional(self):
        """Service works without callbacks set."""
        service = HotkeyService()
        service.start()

        # Should not raise when no callbacks are set
        import time
        time.sleep(0.1)

        service.stop()
