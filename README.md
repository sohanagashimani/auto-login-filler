## Auto Login Filler (Chrome Extension)

Fast command palette to auto-fill login credentials.

### Quick start

- **Press Ctrl+Shift+L** to open the palette on any matched site.

### Features

- **Command palette**: Fast, searchable list of saved accounts.
- **Keyboard-first**: ↑/↓ navigate, 1–9 quick select, Enter fill & submit, Esc close, 0 reuse last, Shift+Enter fill only, Alt+Enter copy password.
- **Tag filtering**: Filter accounts by tags with chip controls.
- **Remembers last used**: Quickly reuse with key 0.
- **Local-only**: Data lives inside the extension (no network).

### Install (Load unpacked)

1. Open `chrome://extensions` in Chrome.
2. Enable Developer mode.
3. Click “Load unpacked” and select this folder.

### Use

- Go to a matched site (see `manifest.json` → `content_scripts.matches`).
- Press `Ctrl+Shift+L` to open/close the palette.
- Type to search; use ↑/↓ or 1–9; press Enter to fill & submit.

Tip: If the hotkey doesn’t fire, set it at `chrome://extensions/shortcuts`.

### Configure

- Edit `CREDENTIALS` in `content.js` to add/update your accounts.
