import math
import numpy as np
import sounddevice as sd
from typing import Optional, Callable
import threading
import queue
from services.logger import get_logger

log = get_logger("audio")

N_BANDS = 20       # Frequency bands for spectrum visualizer
F_MIN   = 80       # Hz — low end of voice range
F_MAX   = 3500     # Hz — upper end of voiced speech (formants F1-F3)


class AudioService:
    SAMPLE_RATE = 16000  # Whisper expects 16kHz
    CHUNK_SIZE  = 1024
    CHANNELS    = 1
    DTYPE       = np.float32

    def __init__(self):
        self._recording = False
        self._audio_queue = queue.Queue()
        self._audio_data = []
        self._stream: Optional[sd.InputStream] = None
        self._amplitude_callback: Optional[Callable[[list], None]] = None
        self._device_id: Optional[int] = None  # None = default device
        self._smoothed_amplitude: float = 0.0

        # Pre-compute log-spaced frequency band bin ranges for the FFT
        freqs = np.fft.rfftfreq(self.CHUNK_SIZE, 1.0 / self.SAMPLE_RATE)
        band_edges = np.logspace(np.log10(F_MIN), np.log10(F_MAX), N_BANDS + 1)
        self._band_bins: list = []
        for i in range(N_BANDS):
            lo = int(np.searchsorted(freqs, band_edges[i]))
            hi = int(np.searchsorted(freqs, band_edges[i + 1]))
            self._band_bins.append((lo, max(lo + 1, min(hi, len(freqs) - 1))))
        self._smoothed_bands = np.zeros(N_BANDS, dtype=np.float64)

    def set_device(self, device_id: Optional[int]):
        """Set the input device to use. None for default."""
        self._device_id = device_id
        log.info("Audio device set", device_id=device_id)

    def set_amplitude_callback(self, callback: Callable[[float], None]):
        """Set callback to receive amplitude values for visualization."""
        self._amplitude_callback = callback

    def _audio_callback(self, indata, frames, time, status):
        if status:
            log.warning("Audio status warning", status=str(status))

        # Copy audio data
        audio_chunk = indata.copy().flatten()
        self._audio_queue.put(audio_chunk)

        if self._amplitude_callback:
            # --- Overall amplitude (for glow / container brightness) ---
            rms = float(np.sqrt(np.mean(audio_chunk ** 2)))
            raw_amp = min(1.0, math.log1p(rms * 90) / math.log1p(90))
            a = 0.6 if raw_amp > self._smoothed_amplitude else 0.25
            self._smoothed_amplitude = a * raw_amp + (1 - a) * self._smoothed_amplitude

            # --- Spectrum bands via FFT ---
            # Normalize magnitudes by chunk size so values are independent of N
            fft_mag = np.abs(np.fft.rfft(audio_chunk)) / (self.CHUNK_SIZE / 2)
            raw_bands = np.zeros(N_BANDS, dtype=np.float64)
            for i, (lo, hi) in enumerate(self._band_bins):
                band_mag = float(np.mean(fft_mag[lo:hi]))
                raw_bands[i] = min(1.0, math.log1p(band_mag * 140) / math.log1p(140))

            # Per-band EMA: fast attack, slow decay
            alpha = np.where(raw_bands > self._smoothed_bands, 0.72, 0.2)
            self._smoothed_bands = alpha * raw_bands + (1 - alpha) * self._smoothed_bands

            # Send [overall_amplitude, band0, ..., band19]
            data = [round(self._smoothed_amplitude, 3)] + \
                   [round(float(v), 3) for v in self._smoothed_bands]
            self._amplitude_callback(data)

    def start_recording(self):
        if self._recording:
            return

        self._recording = True
        self._audio_data = []

        # Clear queue
        while not self._audio_queue.empty():
            try:
                self._audio_queue.get_nowait()
            except queue.Empty:
                break

        log.info("Starting recording", device_id=self._device_id)
        self._stream = sd.InputStream(
            samplerate=self.SAMPLE_RATE,
            channels=self.CHANNELS,
            dtype=self.DTYPE,
            callback=self._audio_callback,
            blocksize=self.CHUNK_SIZE,
            device=self._device_id,
        )
        self._stream.start()
        log.debug("Recording started")

    def stop_recording(self) -> np.ndarray:
        if not self._recording:
            return np.array([], dtype=self.DTYPE)

        self._recording = False
        self._smoothed_amplitude = 0.0
        self._smoothed_bands[:] = 0.0

        if self._stream:
            self._stream.stop()
            self._stream.close()
            self._stream = None

        # Collect all audio from queue
        while not self._audio_queue.empty():
            try:
                chunk = self._audio_queue.get_nowait()
                self._audio_data.append(chunk)
            except queue.Empty:
                break

        if not self._audio_data:
            return np.array([], dtype=self.DTYPE)

        # Concatenate all chunks
        audio = np.concatenate(self._audio_data)
        self._audio_data = []

        return audio

    def is_recording(self) -> bool:
        return self._recording

    @staticmethod
    def get_input_devices() -> list:
        """Get list of available input devices."""
        devices = sd.query_devices()
        input_devices = []
        for i, device in enumerate(devices):
            if device['max_input_channels'] > 0:
                input_devices.append({
                    'id': i,
                    'name': device['name'],
                    'channels': device['max_input_channels'],
                })
        return input_devices
