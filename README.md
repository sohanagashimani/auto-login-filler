# Auto Login Filler (Chrome Extension)

Tiny helper to auto-fill login credentials on selected sites with a fast command palette.

## Features

- Command palette (Ctrl+Shift+L by default)
- Search/filter by label or email; keyboard-first navigation
- 1–9 quick select, Enter to fill & submit, Esc to close

## Install (Load Unpacked)

1. Clone or download this repo.
2. In Chrome, open `chrome://extensions`.
3. Enable Developer mode (top-right).
4. Click Load unpacked and select this project folder.

## Usage

1. Go to a matched site (see `manifest.json` → `content_scripts.matches`).
2. Press `Ctrl+Shift+L` to open/close the palette.
3. Type to search; use ↑/↓ or 1–9; press Enter to fill & submit.

Tip: Change the shortcut at `chrome://extensions/shortcuts`.

## Editing Credentials

Edit the `CREDENTIALS` array in `content.js`.

```js
const CREDENTIALS = [
  { label: "Lease account", username: "user@example.com", password: "hunter2" },
  {
    label: "Admin account",
    username: "admin@example.com",
    password: "secret",
    isAdminSite: true,
  },
];
```

- label: Optional display name in the palette
- username: Email/username to fill
- password: Password to fill
- isAdminSite: Set to true if the target page uses the admin form (alternate selectors)

## Customize

- Sites: Edit `manifest.json` → `content_scripts.matches`.
- Hotkey: Update in `manifest.json` (`commands.open-login-palette.suggested_key`) or via `chrome://extensions/shortcuts`.

## Notes

- Credentials are stored locally in this extension only.
- Supports more than 9 accounts; use search and arrows to navigate.
