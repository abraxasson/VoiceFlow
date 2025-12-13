# VoiceFlow

**Local, Private, Fast Voice-to-Text for Windows.**

VoiceFlow is a free, open-source voice dictation application that runs entirely on your machine. Using OpenAI's Whisper models locally, it delivers accurate speech-to-text without sending your audio to the cloud.

> Built for privacy-conscious users who want powerful dictation without subscriptions or data collection.

---

## Quick Start

```powershell
# Clone and setup
git clone https://github.com/infiniV/VoiceFlow.git
cd VoiceFlow
pnpm run setup

# Run
pnpm run dev
```

**Usage:** Hold `Ctrl+Win` to record, release to transcribe. Text is pasted at your cursor.

---

## Features

| Feature | Description |
|---------|-------------|
| **Instant Dictation** | Hold hotkey to record, release to paste directly into any application |
| **100% Local** | All processing happens on your device. No internet required after setup |
| **6 AI Models** | From Tiny (fast) to Large-v3 (accurate) - choose your speed/quality balance |
| **99+ Languages** | Full multilingual support with auto-detection |
| **History & Stats** | Searchable transcription history with word counts and streaks |
| **System Tray** | Runs quietly in background, always ready |
| **Dark/Light Themes** | Follows system preference or manual selection |

### How It Works

1. **Press `Ctrl+Win`** - A minimal overlay appears showing recording status
2. **Speak** - Real-time amplitude visualization confirms audio capture
3. **Release** - Whisper transcribes locally, text pastes at cursor
4. **Done** - Transcription saved to history automatically

---

## Why VoiceFlow?

### vs Cloud Dictation Services

| | VoiceFlow | Cloud Services |
|---|:---:|:---:|
| **Cost** | Free | $8-20/month |
| **Privacy** | 100% Local | Uploaded to servers |
| **Offline** | Yes | No |
| **Account Required** | No | Yes |
| **Data Ownership** | You own everything | Provider stores data |
| **Latency** | Hardware dependent | Network dependent |

### vs Other Local Solutions

| | VoiceFlow | Others |
|---|:---:|:---:|
| **Setup** | One command | Complex configuration |
| **UI** | Modern dashboard | CLI or basic |
| **Auto-paste** | Built-in | Manual copy |
| **History** | Searchable with stats | None or basic |
| **Updates** | Active development | Varies |

### Current Limitations

We believe in transparency. Here's what we don't support yet:

- **Command Mode** - No AI editing/rewriting (transcription only)
- **Context Awareness** - Doesn't read screen content
- **macOS/Linux** - Windows only for now
- **GPU Acceleration** - CPU-only (planned)
- **Custom Hotkeys** - Fixed to `Ctrl+Win` (planned)

---

## Roadmap

### Coming Soon
- [ ] **GPU Acceleration** - CUDA support for faster transcription
- [ ] **Custom Hotkeys** - Configure your preferred key combination
- [ ] **Export Options** - Save history as TXT, MD, or JSON
- [ ] **Moonshine ASR** - Alternative lightweight model option

### Future Plans
- [ ] **macOS Support** - Cross-platform compatibility
- [ ] **Linux Support** - Full desktop coverage
- [ ] **Cloud Backup** - Optional encrypted sync
- [ ] **Command Mode** - AI-powered text editing
- [ ] **Plugins** - Extensible architecture

### Not Planned
- Mandatory accounts or sign-up
- Telemetry or usage tracking
- Subscription paywalls
- Selling user data

---

## Installation

### Requirements

| Requirement | Version |
|-------------|---------|
| OS | Windows 10/11 |
| Python | 3.9+ |
| Node.js | 20+ |
| CPU | Modern with AVX2 (recommended) |
| RAM | 2GB+ (more for larger models) |
| Storage | 100MB - 3GB (depends on model) |

### Install Steps

1. **Clone the repository**
   ```powershell
   git clone https://github.com/infiniV/VoiceFlow.git
   cd VoiceFlow
   ```

2. **Install dependencies**
   ```powershell
   pnpm run setup
   ```

3. **Run the application**
   ```powershell
   pnpm run dev
   ```

4. **Complete onboarding** - Select your microphone, model, and preferences

### Model Sizes

| Model | Parameters | Speed | Quality | Download |
|-------|------------|-------|---------|----------|
| Tiny | 39M | Fastest | Basic | ~75 MB |
| Base | 74M | Fast | Good | ~150 MB |
| Small | 244M | Balanced | Recommended | ~500 MB |
| Turbo | 809M | Fast | High | ~1.5 GB |
| Medium | 769M | Slower | Higher | ~1.5 GB |
| Large-v3 | 1.5B | Slowest | Best | ~3 GB |

Models download automatically on first use.

---

## Development

### Architecture

```
VoiceFlow/
├── src-pyloid/              # Python Backend (Pyloid/PySide6)
│   ├── main.py              # App entry, window management
│   ├── server.py            # RPC API endpoints
│   ├── app_controller.py    # Business logic orchestrator
│   └── services/
│       ├── audio.py         # Microphone capture
│       ├── transcription.py # Whisper inference
│       ├── hotkey.py        # Global hotkey listener
│       ├── clipboard.py     # Paste operations
│       ├── database.py      # SQLite storage
│       └── settings.py      # Configuration
│
├── src/                     # React Frontend (Vite + TypeScript)
│   ├── pages/               # Popup, Dashboard, Onboarding
│   ├── components/          # UI components (shadcn/ui)
│   └── lib/                 # API client, utilities
│
└── dist/                    # Built executable
```

### Commands

| Command | Description |
|---------|-------------|
| `pnpm run setup` | Install all dependencies |
| `pnpm run dev` | Development mode with hot reload |
| `pnpm run dev:watch` | Dev with Python auto-restart |
| `pnpm run build` | Build standalone executable |
| `pnpm run lint` | Lint frontend code |

### Tech Stack

**Backend:**
- [Pyloid](https://github.com/Pyloid/Pyloid) - Desktop framework (PySide6 + QtWebEngine)
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) - Optimized Whisper inference
- sounddevice - Audio capture
- keyboard - Global hotkey handling

**Frontend:**
- React 18 + TypeScript
- Vite - Build tooling
- Tailwind CSS v4
- shadcn/ui - Component library

### Contributing

1. **Test on Windows** - Platform-specific APIs used (`keyboard`, `os.startfile`)
2. **Follow the style** - Minimalist, dark-mode first, sage green accents
3. **GPU support** - If adding, ensure CPU fallback works

---

## FAQ

**Q: Is my audio sent anywhere?**
A: No. All processing happens locally. The only network call is the one-time model download.

**Q: Why is the first transcription slow?**
A: The model loads on first use. Subsequent transcriptions are faster.

**Q: Can I use a different hotkey?**
A: Not yet, but it's on the roadmap. Currently fixed to `Ctrl+Win`.

**Q: Does it work offline?**
A: Yes, after the initial model download.

**Q: Which model should I use?**
A: Start with **Small** for a balance of speed and accuracy. Use **Tiny** if speed is critical, **Large-v3** for maximum accuracy.

---

## License

[MIT License](LICENSE) - Free to use, modify, and distribute.

---

## Acknowledgments

- [OpenAI Whisper](https://github.com/openai/whisper) - The AI model powering transcription
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) - Optimized inference implementation
- [Pyloid](https://github.com/Pyloid/Pyloid) - Desktop application framework
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components

---

<p align="center">
  <strong>Built with privacy in mind.</strong><br>
  Your voice, your data, your device.
</p>
