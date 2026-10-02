# How it works

## Overview

```
┌──────────────────── Obsidian (Electron renderer) ─────────────────────┐
│ NvimView (ItemView, one per tab)                                      │
│                                                                       │
│   <textarea> (hidden, has focus) ── keys / IME ──┐                    │
│   <canvas>  ◄── Renderer ◄── Grid (screen model)  │                   │
│      │ mouse                       ▲              │                   │
│      └──────────────┐              │ redraw       ▼                   │
│                     ▼              │         RpcClient (msgpack-RPC)  │
└─────────────────────┼──────────────┼──────────────┼───────────────────┘
                      │ nvim_input_mouse      stdin │ ▲ stdout
                      ▼                             ▼ │
                  nvim --embed  (child process, cwd = vault root)
```

The plugin uses two APIs:

- **Obsidian plugin API.** `ItemView` gives a tab with a free DOM area. `Scope` / `Keymap` control hotkeys. `Plugin` gives commands, ribbon icons, the file menu and settings. On desktop, plugins can use Node (`child_process`).
- **Neovim UI protocol** (`:h ui`, `:h api`). msgpack-RPC on stdin/stdout. The client calls `nvim_ui_attach`. Then Neovim sends `redraw` notifications that describe what changed on the screen.

| File                 | Role                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `src/main.ts`        | Plugin: commands, ribbon, header buttons, file menu, vault `modify` → `:checktime`          |
| `src/view.ts`        | `NvimView`: process life, attach, file tracking, keyboard scope, mouse, resize, quit dialog |
| `src/process.ts`     | Spawn Neovim: login shell, env, `--cmd` variables, extra arguments                          |
| `src/args.ts`        | Shell-like parser for "Extra arguments"                                                     |
| `src/rpc.ts`         | msgpack-RPC client                                                                          |
| `src/settings.ts`    | Settings, defaults, settings tab                                                            |
| `src/input/keys.ts`  | `KeyboardEvent` → Neovim key notation, hotkey spec matching                                 |
| `src/ui/grid.ts`     | Screen model from `redraw` events (no DOM)                                                  |
| `src/ui/renderer.ts` | Canvas painter                                                                              |
| `src/ui/metrics.ts`  | Cell size, CSS font, `guifont` parsing                                                      |

## Startup sequence

1. `src/process.ts` spawns Neovim:
    ```
    <shell> -l -c "exec nvim --embed --cmd 'let g:obsidian_neovim_view = 1' \
                  --cmd 'let g:obsidian_neovim_view_vault = $OBSIDIAN_NEOVIM_VIEW_VAULT' --cmd 'set autoread'"
    ```
    Then come the "Extra arguments" (`src/args.ts` parses them). `cwd` is the vault root. `OBSIDIAN_NEOVIM_VIEW_VAULT` and the extra `NAME=value` variables are in the environment. `<shell>` is the "Shell" setting. If it is empty, `findShell()` uses `$SHELL`, else the first of `zsh`, `bash` and `sh` in `PATH` or in the standard folders (`/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, `/bin`). Without the login-shell setting, the plugin runs `nvim` directly.
2. `--embed` makes Neovim wait. It does not read `init.lua` until a UI attaches. So `--cmd` variables are set before the config runs.
3. The view calls `nvim_get_api_info`. It refuses Neovim older than 0.10 (`api_level` < 12). The response also gives the RPC channel id.
4. The view measures the font cell size and calculates how many columns and rows fit in the tab.
5. It calls `nvim_ui_attach(cols, rows, { rgb = true, ext_linegrid = true })`. Now Neovim reads the config and sends the first `redraw`.
6. It adds a `BufEnter` autocmd (with `nvim_exec_lua`). The autocmd sends `rpcnotify(channel, "obsidian_neovim_view_buf", path)`, so the plugin knows the current file.
7. It opens the file with `nvim_cmd({ cmd = "edit", args = { path }, magic = { file = false, bar = false } })`. The path is absolute, because your config can change the working directory. With `magic = false`, Neovim does not expand `%`, `#` or `|` in the file name.

## RPC client (`src/rpc.ts`)

A small msgpack-RPC client on `@msgpack/msgpack`. The plugin does not use the npm `neovim` package, because that package brings in a logger (`winston`) that the plugin does not need.

| Message      | Format                    | Use                                                                                   |
| ------------ | ------------------------- | ------------------------------------------------------------------------------------- |
| Request      | `[0, id, method, params]` | `request()` returns a Promise                                                         |
| Response     | `[1, id, error, result]`  | Resolves or rejects the Promise                                                       |
| Notification | `[2, method, params]`     | `notify()` sends. `onNotification()` receives `redraw` and `obsidian_neovim_view_buf` |

`decodeStream` reads the stdout stream, so messages split across chunks, and many messages in one chunk, are handled.
If Neovim sends a request to the plugin, the plugin answers with an error, so that Neovim does not block.
Hot-path calls (`nvim_input`, `nvim_input_mouse`) are notifications: they do not wait for a response.
When Neovim exits, pending requests reject and later calls do nothing.

## Screen model (`src/ui/grid.ts`)

Pure TypeScript, no DOM, so it is tested in Node. It keeps a copy of Neovim grid 1 (the full screen):

- `text[]`: the text of each cell. `""` is the right half of a double-width character.
- `hl[]`: the highlight id of each cell.
- `hlTable`: highlight id → attributes (colors, bold, italic, underline styles, reverse...).
- Cursor position, mode, cursor shapes per mode, default colors.
- `dirty`: rows that changed since the last paint.

Each `redraw` has a list of events. Each event has a name and **one or more** argument tuples. Events that the plugin uses:

| Event                                  | Effect                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `grid_resize`                          | New size. Keeps old content                                                                             |
| `grid_clear`                           | All cells empty                                                                                         |
| `grid_line`                            | Writes cells `[text, hl_id?, repeat?]` in a row. A missing `hl_id` uses the last one in the same event  |
| `grid_scroll`                          | Copies a region up (`rows > 0`) or down (`rows < 0`). Neovim then redraws the rows that the copy leaves |
| `grid_cursor_goto`                     | Cursor position                                                                                         |
| `default_colors_set`, `hl_attr_define` | Colors and highlights. All rows are repainted                                                           |
| `mode_info_set`, `mode_change`         | Cursor shape (block / vertical / horizontal) and size per mode                                          |
| `busy_start`, `busy_stop`              | Hide / show the cursor                                                                                  |
| `option_set`                           | UI options. `guifont` changes the font                                                                  |
| `flush`                                | End of a batch. The renderer paints now                                                                 |

The plugin ignores other events (`win_viewport`, `hl_group_set`, `mouse_on`...), as `:h ui` allows.

## Renderer (`src/ui/renderer.ts`, `src/ui/metrics.ts`)

- **Cell size:** from `measureText("M")` and the font ascent/descent, multiplied by "Line height". A cell has a fixed size. Neovim decides where each character goes, and the renderer never uses the font advance for layout.
- **Paint:** on `flush`, the renderer asks for one `requestAnimationFrame`. In the frame it repaints only dirty rows:
    1. Backgrounds, in runs of cells with the same highlight.
    2. Glyphs, one per cell, clipped to the row.
    3. Underline, undercurl, double/dotted/dashed underline and strikethrough (color from `special`).
- **Retina:** the canvas backing store is CSS size × `devicePixelRatio`, and the context is scaled. If the ratio changes (window moved to another display), the next frame resizes the canvas.
- **Cursor:** shape and `cell_percentage` from the mode. `attr_id = 0` means "swap the cell colors". Without focus, the cursor is a hollow box.
- **Resize:** a `ResizeObserver` on the tab (debounced 50 ms) calculates the new columns and rows, then calls `nvim_ui_try_resize`. Neovim answers with `grid_resize`.
- **Font:** Neovim always sends a `guifont`, also when you never set it. The plugin ignores the platform defaults from `:h 'guifont'`, because they have no Nerd Font icons.

## Keyboard (`src/input/keys.ts`, `src/view.ts`)

**Hotkeys.** Obsidian handles hotkeys before DOM events reach the view, also in the capture phase, so `stopPropagation` does not help. The fix:

- The view has its own `Scope` with a catch-all handler (`register(null, null, ...)`).
- When the hidden textarea gets focus, the view pushes the scope (`app.keymap.pushScope`). On blur, the view pops it.
- The handler returns `false` (Obsidian stops and calls `preventDefault`) for keys that go to Neovim.
- For the toggle hotkey and the keys in "Obsidian hotkeys to keep", it returns `undefined`, so Obsidian continues to the parent scope (`app.scope`), where its hotkeys are. `true` would stop there, as `false` does, but without `preventDefault`. A non-ASCII character (Cyrillic layout, Option+P = `π`) matches by its physical key.
- The plugin reads the current toggle hotkey from `app.hotkeyManager` (not public API) on each key press, so a new hotkey works at once. The command has no default hotkey. If `hotkeyManager` is missing, only "Obsidian hotkeys to keep" is used.

**Translation.** `translateKey()` gives one of three results:

| Result     | When                                                                                           | Then                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `{ send }` | Special keys (`<Esc>`, `<CR>`, `<F5>`, arrows...), or a key with Ctrl / Cmd / (Option as Meta) | `nvim_input(send)`                                                                                                                 |
| `"text"`   | Printable key with no modifier, AltGr, dead key, IME composition                               | The browser types into the textarea. The `input` / `compositionend` event sends the text with `nvim_input` (`<` escaped as `<LT>`) |
| `"ignore"` | Modifier key alone                                                                             | Nothing                                                                                                                            |

Examples: `Ctrl+W` → `<C-w>`, `Shift+Tab` → `<S-Tab>`, `Cmd+S` → `<D-s>`, `Ctrl+<` → `<C-lt>`, `Ctrl+\` → `<C-Bslash>`.
With Option as Meta, macOS changes `e.key` (Option+A = `å`), so the plugin uses the physical key (`e.code`) to send `<M-a>`.
Windows reports AltGr as Ctrl+Alt, so the plugin checks `getModifierState("AltGraph")` and lets AltGr type its character.

The hidden textarea moves to the cursor cell, so the IME candidate window opens near the cursor.
The view also sends `nvim_ui_set_focus` on focus and blur, so `FocusGained` / `FocusLost` autocmds work.

## Mouse

The view converts pixel position to row and column, and calls `nvim_input_mouse(button, action, modifiers, 0, row, col)`:

- `press`, `drag`, `release` for left, middle, right.
- Wheel: the view adds up `deltaY`, and sends one `up` / `down` per cell height. This keeps trackpad scroll smooth.
- The browser context menu is blocked on the canvas, so right-click goes to Neovim.

## File tracking and quit

- The view state is `{ file: "<vault-relative path>" }`. Obsidian saves it in the workspace layout, so the tab comes back after a restart.
- The `BufEnter` notification updates `file` when you change buffers in Neovim (only for normal buffers inside the vault). The tab title follows. Neovim reports paths with symlinks resolved, so the plugin compares them with the vault path and its real path.
- Exit code 0 (`:q`, `:wq`): the leaf opens `file` in the Obsidian editor (`leaf.openFile`). If there is no vault file, the tab closes.
- Other exit code, or spawn error: an overlay shows the message, the last stderr lines and a Restart button.
- Toggle hotkey, header button, tab close, plugin disable: the view asks Neovim for modified buffers (`getbufinfo({'bufmodified': 1})`). If there are any, a dialog asks Save all (`:wall`) / Discard. Then the view stops the process.

## Sync with Obsidian

- Neovim writes the file. Obsidian detects the change and updates its index and other views.
- When any vault file changes (`vault.on("modify")`), every Neovim view runs `:checktime`. With `autoread`, Neovim reloads buffers that have no unsaved changes.
- Both editors can open the same note (for example two tabs). Neovim shows its normal warning if the file changes while the buffer has unsaved changes.

## Design decisions

| Decision                                                 | Reason                                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| UI client (`--embed` + canvas), not sync with CodeMirror | You get all of Neovim: config, plugins, LSP, modes. No two-way text sync to keep correct             |
| `--embed` on stdio, not a socket                         | One process per tab. Neovim exits when the channel closes, so no process stays alive                 |
| Own `Scope` pushed on focus                              | The only method that blocks Obsidian hotkeys. `View.scope` is `null` by default since Obsidian 1.5.7 |
| Hidden textarea for text                                 | Dead keys and IME only work with a real text input                                                   |
| Option is not Meta by default                            | Spanish and other layouts need Option for `@ [ ] { } \|`                                             |
| Login shell by default                                   | Obsidian started from the Dock has `PATH=/usr/bin:/bin:/usr/sbin:/sbin`                              |
| Own RPC client                                           | Small, no logger dependency, full control of the `redraw` hot path                                   |
| Neovim takes the Markdown tab                            | The note is not open in two editors, so no "file changed" conflicts                                  |
| No default toggle hotkey                                 | Plugin guidelines: a default hotkey can conflict with hotkeys of the user or other plugins           |
