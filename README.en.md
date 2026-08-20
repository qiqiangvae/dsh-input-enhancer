# dsh-input-enhancer

[中文](README.md) | English

A **DeepSeek Harness Web plugin** that makes the chat composer better suited to long-form editing.

## Features

| Feature | What it does | How |
| --- | --- | --- |
| 🔒 **Lock Enter-send** | While locked, Enter won't accidentally send; you can keep editing | Click the lock button |
| 📏 **Enlarge composer** | Locking grows the composer (`min-height: 40vh`, ceiling `60vh`) for long drafts | Automatic on lock |
| ⚡ **Triple-Enter send** | Press Enter 3 times (≤800ms apart) to unlock and send immediately | Press Enter while locked |
| 🔢 **Character count** | A live character-count badge appears after the lock button while non-empty | Automatic |
| ⚠️ **Long-text warning** | Past 800 characters the badge turns amber, so the length is clear before sending | Automatic |

- **Lock button**: registered in the official `conversation.input.right` slot, near the send button; a prominent red fill when locked, with a state tooltip on hover.
- **Lock ⇔ enlarge coupling**: locking enters "long-form editing mode"; unlocking restores the default size.
- **Character count is independent**: it shows whenever the composer is non-empty, locked or not.
- **Long-text warning**: once the draft reaches the threshold (800 chars by default), the count badge turns amber with a "long text" hover hint.
- **Per-session state**: each conversation keeps its own lock flag.

### Lock state & composer

| State | Lock icon | Composer | Enter behavior |
| --- | --- | --- | --- |
| Unlocked | Gray outlined | Default size | Sends normally |
| Locked | **Red fill + white lock icon** | **Enlarged** | Does not send (3× Enter unlocks and sends) |

Tooltip:

- Unlocked: `Unlocked: composer is normal size, Enter sends normally`
- Locked: `Locked and enlarged: Enter will not send. Press Enter 3 times to unlock and send`

### Triple-Enter (locked-state escape hatch)

While locked, to send without first unlocking: **press Enter 3 times** to unlock and send immediately.

- The first two Enters have no side effect (no send, no newline); they only count. The lock icon turns into the current count (1st shows "1", 2nd shows "2") with a growing pulse.
- The 3rd Enter plays a **firework burst** (colored particles flying out from the lock button for ~1 second), then unlocks and sends the current content.
- Timeout, any other key, or a session switch resets the count.

> Triple-tap applies only while locked; an empty composer will not send.

## Guarantees

- **No composer replacement**: intercepts only the keyboard submit path and overlays enlargement styles, keeping the official input state machine, command menu, queue, and attachments.
- **IME-friendly**: Enter during composition is never intercepted.
- Blocked while locked: plain `Enter`, `Ctrl+Enter` / `Cmd+Enter`, other Enter combos that reach the official submit path.
- Preserved: `Shift+Enter` newline, IME candidate confirmation, edit/copy/paste/attachments, and mouse-click send (the lock only guards the keyboard).

## Keyboard shortcut (future work)

Global shortcuts such as `Ctrl+Alt+L` (`Cmd+Alt+L` on macOS) are listed as **future work**. Use the lock button to lock/unlock; triple-Enter serves as the locked-state "unlock and send" escape hatch.

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
   - Press **Enter 3 times** (within 800ms each) to unlock and send immediately (the lock icon shows "1"/"2" on the first two taps, then plays an unlock burst on the third).

5. Lock state is per session and is kept in memory only. It is cleared on refresh or restart.

6. The character count is independent of the lock: whenever the composer is non-empty (locked or not), a character-count badge appears right after the lock button.

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
│   └── client.js         # Web half: layered orchestration (lock feature + char count + long-text warning)
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

Compared with `dsh-enter-lock`, this plugin adds:

- **Enlarge composer**: locking grows the composer for long-form editing;
- **Triple-Enter send**: press Enter 3 times to unlock and send immediately (with count flashes and an unlock-burst animation);
- **Character count**: a live character count, independent of the lock;
- **Long-text warning**: past 800 characters the badge turns amber.

## License

[MIT](./LICENSE)
