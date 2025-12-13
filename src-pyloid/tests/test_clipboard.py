import pytest
from services.clipboard import ClipboardService


class TestClipboardService:
    def test_copy_to_clipboard(self):
        """Can copy text to clipboard."""
        service = ClipboardService()
        test_text = "Hello, World!"

        service.copy_to_clipboard(test_text)

        # Verify by getting clipboard content
        result = service.get_clipboard()
        assert result == test_text

    def test_get_clipboard_returns_string(self):
        """Get clipboard returns a string."""
        service = ClipboardService()
        service.copy_to_clipboard("test")

        result = service.get_clipboard()

        assert isinstance(result, str)

    def test_copy_empty_string(self):
        """Can copy empty string to clipboard."""
        service = ClipboardService()

        service.copy_to_clipboard("")
        result = service.get_clipboard()

        assert result == ""

    def test_copy_multiline_text(self):
        """Can copy multiline text to clipboard."""
        service = ClipboardService()
        multiline = "Line 1\nLine 2\nLine 3"

        service.copy_to_clipboard(multiline)
        result = service.get_clipboard()

        assert result == multiline

    def test_copy_unicode_text(self):
        """Can copy unicode characters to clipboard."""
        service = ClipboardService()
        unicode_text = "Hello 世界 🌍 مرحبا"

        service.copy_to_clipboard(unicode_text)
        result = service.get_clipboard()

        assert result == unicode_text

    def test_paste_at_cursor_exists(self):
        """paste_at_cursor method exists and is callable."""
        service = ClipboardService()

        # Just verify the method exists
        assert hasattr(service, 'paste_at_cursor')
        assert callable(service.paste_at_cursor)
