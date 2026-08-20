# dsh-input-enhancer

[中文](README.md) | English

A **DeepSeek Harness Web plugin** that enhances the chat composer:

- Click the lock button next to the composer to **lock Enter-send** and **enlarge the composer**.
- While locked, you can keep editing the text in the composer, but pressing Enter will not send it.
- Click the button again to unlock and restore the default composer size and Enter-send.

## Why this plugin exists

The DeepSeek Harness Web composer sends the current text as soon as Enter is pressed, and its height is limited. That makes accidental sends and cramped long-form editing easy when:

- Enter is pressed only to confirm an IME candidate;
- the user is editing a long prompt, code, or structured text and hits Enter by mistake;
- the user needs to write a lot of text but the default composer is too small;
- the text in the composer is still incomplete and is submitted before the user intended.

This plugin adds a "lock before send" guard and, while locked, enlarges the composer for long-form editing.

## What it focuses on

- **Lock button**: registered in the official `conversation.input.right` slot, next to the model selector and send button; the locked state uses a prominent red fill.
- **Lock ⇔ enlarge coupling**: locking enters "long-form editing mode" — the composer grows immediately (`min-height: 40vh`) and the auto-grow ceiling rises from the default `336px` to `60vh`. Unlocking restores the default size.
- **Per-session state**: each conversation has its own lock flag.
- **No composer replacement**: it only intercepts the keyboard submit path and overlays enlargement styles, keeping the official input state machine, command menu, queue, and attachment behavior.
- **IME-friendly**: Enter during composition is never intercepted.

## Lock state styles

| State | Lock icon style | Composer | Meaning |
| --- | --- | --- | --- |
| Unlocked (normal) | Gray outlined icon | Default size | Enter can send messages normally |
| Locked | **Red fill with a white lock icon** | **Enlarged** | Enter cannot send messages |

Hovering over the lock icon shows a state-specific tooltip:

- Unlocked: `Unlocked: composer is normal size, Enter sends normally`
- Locked: `Locked and enlarged: Enter will not send`

## What it prevents

While locked, the following keyboard sends are blocked:

- plain `Enter` send;
- `Ctrl+Enter` / `Cmd+Enter` send;
- other Enter combinations that reach the official composer submit path;
- accidental submission of unfinished composer text.

Normal behaviors remain available:

- `Shift+Enter` still inserts a newline;
- IME candidate confirmation still works;
- editing, copy, paste, and attachments are unaffected;
- clicking the official send button still sends; the lock only guards the keyboard.

## Triple-Enter to unlock and send

While locked, if you want to send the current composer content without first unlocking, **press Enter 3 times** (each within 800ms of the previous) to unlock and send immediately.

- The first two Enters have no side effect (no send, no newline); they only advance the counter.
- After 2 taps the lock icon **flashes** once to hint "one more to send".
- The 3rd Enter unlocks and immediately sends the current composer content.
- The counter resets when the window expires, when any other key is pressed, or when you switch sessions.

> Note: the triple-tap only applies to a locked composer; an empty composer will not send.

## Keyboard shortcut (future work)

Global keyboard shortcuts such as `Ctrl+Alt+L` (`Cmd+Alt+L` on macOS) are currently listed as **future work**. For now, use the lock button beside the composer to lock and unlock; the triple-Enter gesture above serves as the locked-state "unlock and send" escape hatch.

## Requirements

- DeepSeek Harness `0.1.0-rc.6` or newer;
- the `web` profile;
- a modern Chromium-based browser (Chrome or Edge).

## Installation

### Install from this GitHub repository

```sh
dsh plugin --profile web add github:qiqiangvae/dsh-input-enhancer
```

Or use the explicit Git URL:

```sh
dsh plugin --profile web add https://github.com/qiqiangvae/dsh-input-enhancer.git
```

For reproducible installs, pin a commit:

```sh
dsh plugin --profile web add 'github:qiqiangvae/dsh-input-enhancer#<commit-sha>'
```

### Install from a local directory

```sh
git clone https://github.com/qiqiangvae/dsh-input-enhancer.git
dsh plugin --profile web add ./dsh-input-enhancer
```

### Verify

```sh
dsh --profile web --dump-config | grep dsh-input-enhancer
```

Then restart `dsh web` and refresh the page.

## Usage

1. Start DeepSeek Harness Web:

   ```sh
   dsh web
   ```

2. Find the lock button in the composer tool row, near the model selector and the send button.

3. Toggle the lock:

   - Click the lock button in the composer tool row.

4. While locked:

   - The composer **enlarges** for long-form editing.
   - Plain `Enter` does not send.
   - `Ctrl+Enter` / `Cmd+Enter` does not send.
   - `Shift+Enter` still inserts a newline.
   - IME composition Enter still confirms the candidate.
   - Clicking the official send button still sends; the lock only guards keyboard input.
   - Press **Enter 3 times** (within 800ms each) to unlock and send immediately.

5. Lock state is per session and is kept in memory only. It is cleared on refresh or restart.

## Configuration

The plugin is zero-configuration. It requires no API key, no settings fields, and no `settings.yaml` entry. Lock state lives in browser memory only.

## Limitations

- Lock state is browser-memory only; it does not write `settings.yaml` and makes no network requests.
- The plugin uses the official `conversation.input.right` slot and does not replace the composer.
- Enlargement is implemented via CSS variables (`min-height` and `--dsh-composer-text-max-height`); the official bottom anchor `--dsh-composer-height` re-syncs automatically as the height changes.

## Troubleshooting

### The lock button is not visible

1. Verify that the plugin is mounted:

   ```sh
   dsh --profile web --dump-config | grep dsh-input-enhancer
   ```

2. Restart `dsh web` and force-refresh the page (`Ctrl+F5`).
3. Make sure you are using the `web` profile.

### The shortcut is unavailable

Keyboard shortcut support has not been enabled yet and is listed as future work. Use the lock button beside the composer instead. Lock state is per session: a newly opened session starts unlocked.

### A message was sent while locked

- `Shift+Enter` inserts a newline; it is not a send.
- Clicking the official send button is a deliberate mouse action and is not blocked.
- Check that the lock button shows the red filled locked state and review which Enter combination was pressed.

### The composer did not enlarge while locked

- Make sure the lock button shows the red filled locked state.
- If another plugin or theme overrides `--dsh-composer-text-max-height` or `[data-composer-card]` `min-height`, this plugin's enlargement may be overridden; check for style conflicts.

## Uninstall

```sh
dsh plugin --profile web remove dsh-input-enhancer
```

## Development and build

No build step is required to install this repository: `lib/` contains committed prebuilt artifacts and the package has no `prepare` / `postinstall` scripts.

After changing the source, regenerate the artifacts with:

```sh
npm run build   # generate lib/index.js and lib/client.js
npm run check   # structural checks
```

## Project layout

```text
dsh-input-enhancer/
├── package.json          # dsh.bundle + dsh.client plugin manifest
├── cordis.patch.yml      # profile bundle patch
├── src/
│   ├── index.js          # Host half (dependency-free no-op)
│   └── client.js         # Web half: button, Enter interception, enlarge styles
├── lib/                  # prebuilt artifacts
├── scripts/
│   ├── build.mjs
│   └── check.mjs
├── README.md
├── README.en.md
└── LICENSE
```

## Migration from dsh-enter-lock

This plugin was renamed and enhanced from `dsh-enter-lock`. If you previously installed the old name, uninstall it first, then install this plugin:

```sh
dsh plugin --profile web remove dsh-enter-lock
dsh plugin --profile web add github:qiqiangvae/dsh-input-enhancer
```

The new release adds "lock to enlarge the composer" on top of the existing Enter-send lock, for long-form editing.

## License

[MIT](./LICENSE)
