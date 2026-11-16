# CodeCraft

An AI-powered coding IDE built with Electron, React, and TypeScript. CodeCraft integrates Claude Code for agentic coding workflows, provides a FreeLLM API chat assistant, and includes a full-featured terminal, file explorer, and project management.

## Features

- **Claude Code Integration** — Full terminal-based agentic coding with streaming JSON output, session persistence, and interactive PTY terminal
- **FreeLLM API Chat** — Quick questions, code explanations, and general assistance via any OpenAI-compatible API
- **Project Vault** — Organize projects under `~/Documents/CodeCraft` with Finder-style file tree
- **First-run Onboarding** — Guided setup: enter your name, pick a theme (Midnight, Aurora, Sunset, Mono), choose response style
- **Themes & Customization** — Live theme switching with CSS custom properties, accent colors, font size
- **Secure Config** — API keys encrypted with Electron `safeStorage`, never written to disk in plaintext
- **Memory System** — Persistent facts, preferences, and project context across sessions
- **Cross-platform** — macOS (DMG/ZIP), Linux (AppImage, RPM, deb)

## Screenshots

*(Add screenshots here after first release)*

## Installation

### macOS
Download the latest `.dmg` or `.zip` from the [Releases](https://github.com/vh9hvnwrg6-prog/code-craft/releases) page.
- Open the DMG and drag CodeCraft to Applications
- Or unzip and move `CodeCraft.app` to Applications

### Linux
Choose your package format from the [Releases](https://github.com/vh9hvnwrg6-prog/code-craft/releases) page:
- **AppImage** — `chmod +x CodeCraft-*.AppImage && ./CodeCraft-*.AppImage`
- **RPM (Fedora/RHEL)** — `sudo dnf install codecraft-*.rpm`
- **deb (Debian/Ubuntu)** — `sudo apt install ./codecraft-*.deb`

### From Source
```bash
# Clone the repository
git clone https://github.com/vh9hvnwrg6-prog/code-craft.git
cd code-craft

# Install dependencies
npm install

# Development mode (hot reload)
npm run electron:dev

# Production build
npm run build

# Package installers
npm run dist:mac      # macOS DMG + ZIP
npm run dist:linux    # Linux AppImage, RPM, deb
```

## Development Setup

### Prerequisites
- **Node.js** 20+
- **npm** 10+
- **Claude Code CLI** (optional, for agentic features) — `npm i -g @anthropic-ai/claude-code`

### Project Structure
```
code-craft/
├── build/                 # Electron-builder assets (icons)
├── dist/                  # Compiled output (gitignored)
├── release/               # Built installers (gitignored)
├── public/                # Static assets
├── src/
│   ├── components/        # React components
│   │   ├── OnboardingScreen.tsx   # First-run setup
│   │   ├── Sidebar.tsx            # File tree, workspaces, user
│   │   ├── Terminal.tsx           # xterm.js + node-pty
│   │   ├── ClaudeCodePanel.tsx    # Streaming agent panel
│   │   ├── ChatPanel.tsx          # FreeLLM chat
│   │   └── ...
│   ├── llm/
│   │   ├── client.ts        # LLM API client (streaming)
│   │   ├── configStore.ts   # Encrypted config (safeStorage)
│   │   └── memoryStore.ts   # Persistent memory JSON
│   ├── onboarding/
│   │   └── store.ts         # First-run preferences
│   ├── main.tsx             # React entry
│   ├── App.tsx              # Root component, onboarding gate
│   ├── theme.ts             # Theme tokens & CSS vars
│   └── styles.css           # Global styles (Tailwind v4)
├── main.ts                  # Electron main process
├── preload.ts               # Context bridge (IPC)
├── index.html               # HTML template
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Key Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run electron:dev` | Concurrent Vite + Electron (hot reload) |
| `npm run build` | TypeScript + Vite production build |
| `npm run package` | Build + package with electron-builder |
| `npm run dist:mac` | macOS DMG + ZIP |
| `npm run dist:linux` | Linux AppImage, RPM, deb |
| `npm run rebuild` | Rebuild native modules for current platform |
| `npm run rebuild:linux` | Cross-compile native modules for Linux |

### Architecture Notes
- **Main process** (`main.ts`): Window management, IPC handlers, Claude Code CLI spawning, PTY terminals, file system, config/memory stores
- **Preload** (`preload.ts`): Secure context bridge exposing typed `electronAPI` to renderer
- **Renderer** (React + Vite): All UI components, onboarding, theme system, terminal (xterm.js)
- **IPC**: Typed request/response via `ipcMain.handle` / `electronAPI.*`
- **Security**: `contextIsolation: true`, `nodeIntegration: false`, workspace-root path validation, encrypted secrets

## Configuration

On first launch, CodeCraft guides you through:
1. **Name** — Displayed in sidebar avatar
2. **Theme** — Midnight / Aurora / Sunset / Mono (live preview)
3. **Response Style** — Concise / Balanced / Detailed
4. **Animations** — Enable/disable smooth transitions

Settings are persisted to `~/Library/Application Support/codecraft/` (macOS) or `~/.config/codecraft/` (Linux).

### API Key Setup
Open **Settings → AI** and enter:
- **Provider** — Any OpenAI-compatible endpoint (e.g., FreeLLMAPI, local LLM)
- **Base URL** — e.g., `https://api.llmapi.ai/v1`
- **API Key** — Your provider key (encrypted with `safeStorage`)
- **Model ID** — e.g., `claude-3-5-sonnet-latest`

The key never leaves the main process and is never logged.

## Building Installers

### macOS
```bash
npm run dist:mac
# Output: release/CodeCraft-0.1.0.dmg, release/CodeCraft-0.1.0-mac.zip
```

### Linux (requires Docker for RPM/deb on macOS)
```bash
# AppImage (works on any distro)
npm run dist:linux
# Output: release/CodeCraft-0.1.0.AppImage

# For RPM/deb on macOS, use the provided Docker scripts:
# See release/linux-build.sh for details
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Electron](https://www.electronjs.org/) — Cross-platform desktop apps
- [React](https://react.dev/) — UI library
- [Vite](https://vitejs.dev/) — Fast build tool
- [Tailwind CSS v4](https://tailwindcss.com/) — Utility-first styling
- [xterm.js](https://xtermjs.org/) — Terminal emulator
- [node-pty](https://github.com/Tyriar/node-pty) — Pseudo-terminal
- [Claude Code](https://github.com/anthropics/claude-code) — Agentic coding CLI
- [Lucide Icons](https://lucide.dev/) — Beautiful icons