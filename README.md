# Neovim View

Edit your Obsidian notes in Neovim, inside an Obsidian tab. You get your own Neovim config, plugins and LSP.

> **Set a hotkey after you install.** The plugin has no default hotkey. See [Set a hotkey](#set-a-hotkey).

Neovim saves the note to disk. Obsidian sees the change, as with any external editor.

## Requirements

- Obsidian 1.13.0 or newer, on desktop (macOS, Windows, Linux). Mobile is not supported.
- [Neovim](https://neovim.io) 0.10 or newer, installed on your computer.

## Install

1. In Obsidian, open Settings → Community plugins.
2. If Restricted mode is on, select "Turn on community plugins".
3. Select "Browse" and search for "Neovim View".
4. Select "Install", then "Enable".

## Set a hotkey

The command "Neovim View: Toggle Neovim for current file" switches the current note between the Obsidian editor and Neovim. It has no default hotkey.

1. Open Settings → Hotkeys.
2. Search for "Toggle Neovim".
3. Select the `+` icon and press the keys that you want, for example `Cmd+Shift+E` (`Ctrl+Shift+E` on Windows and Linux).

This hotkey also works while Neovim has focus.

## Usage

### Open a note in Neovim

| Method                                         | Result                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| Toggle hotkey in a note                        | The same tab changes to Neovim with this note                                    |
| Header button (terminal icon) in a note        | Same as above                                                                    |
| Ribbon icon (left sidebar, terminal icon)      | Opens the active note in Neovim. If no note is active, opens an empty Neovim tab |
| File explorer → right-click → "Open in Neovim" | Opens the file in a new Neovim tab                                               |
| Command palette → "Neovim View: Open Neovim"   | Opens an empty Neovim tab in the vault folder                                    |

### Return to the Obsidian editor

| Method                                  | Result                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `:q`, `:wq`, `:x`                       | The tab shows the note in the Obsidian editor again                                  |
| Toggle hotkey in a Neovim tab           | Same. If you have unsaved changes, a dialog asks: Save all / Discard                 |
| Header button "Back to Obsidian editor" | Same as the toggle hotkey                                                            |
| Close the tab (`x`)                     | Closes Neovim. The same dialog asks about unsaved changes. `Esc` in the dialog saves |

If Neovim cannot save (for example, a new buffer has no file name), Neovim stays open and a notice tells you why. Fix it in Neovim, then try again.

If you open another note in Neovim (`:e other.md`), the tab title changes. When you quit, the Obsidian editor shows that note.

### Keyboard

- While Neovim has focus, it gets **all** keys, including `Cmd+W`, `Cmd+O`, `Ctrl+Tab` and `Esc`.
- Exceptions: the toggle hotkey, and the keys in the "Obsidian hotkeys to keep" setting (default: `Cmd+P`, the command palette).
- `Cmd+<key>` goes to Neovim as `<D-key>`, so you can map it. Example: `vim.keymap.set("n", "<D-s>", "<cmd>w<cr>")`.
- `Cmd+V` pastes from the system clipboard.
- Accents and input methods work (`´` + `a` = `á`, Japanese and Chinese input).
- The Option key types characters by default (`@ [ ] { }` on Spanish keyboards). To use it as Meta (`<M-x>`), turn on "Option key as Meta".

### Mouse

Click, drag to select, right-click and scroll work. Neovim must have the `mouse` option set (it is on by default).

## Settings

Open Settings → Neovim View.

| Setting                   | Default                                                           | What it does                                                                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neovim path               | `nvim`                                                            | Where Neovim is. Use the full path if Obsidian cannot find Neovim                                                                                                                                   |
| Start through login shell | on                                                                | Starts Neovim with your shell settings, so it finds your tools (LSP, `rg`, `node`). Not used on Windows                                                                                             |
| Shell                     | empty                                                             | The shell for "Start through login shell", for example `/bin/zsh`. If empty, the plugin uses your default shell (`$SHELL`). If that is not set, it uses the first of zsh, bash and sh that it finds |
| Font family               | `"JetBrainsMono NFM", "Symbols Nerd Font Mono", Menlo, monospace` | The font. Use a [Nerd Font](https://www.nerdfonts.com) to see icons. A `guifont` set in your Neovim config wins                                                                                     |
| Font size                 | `14`                                                              | Size in pixels                                                                                                                                                                                      |
| Line height               | `1.2`                                                             | Space between lines                                                                                                                                                                                 |
| Option key as Meta        | off                                                               | See [Keyboard](#keyboard)                                                                                                                                                                           |
| Extra arguments           | empty                                                             | More options for Neovim. See [Use a separate Neovim config](#use-a-separate-neovim-config)                                                                                                          |
| Obsidian hotkeys to keep  | `Mod+P`                                                           | Hotkeys that go to Obsidian, not Neovim. One per line, for example `Mod+Shift+X`. `Mod` is Cmd on macOS, Ctrl on other systems                                                                      |

Keyboard settings apply at once. Other settings apply to Neovim tabs that you open after the change.

### Use a separate Neovim config

Use "Extra arguments" for this. Examples:

| Goal                                        | Extra arguments                  |
| ------------------------------------------- | -------------------------------- |
| Use the config in `~/.config/nvim-obsidian` | `NVIM_APPNAME=nvim-obsidian`     |
| Use one config file                         | `-u ~/.config/nvim/obsidian.lua` |
| Start Neovim with no config and no plugins  | `--clean`                        |

You can also change your normal config only when it runs inside Obsidian:

```lua
if vim.g.obsidian_neovim_view then
  vim.opt.wrap = true
  vim.opt.linebreak = true
end
```

More options: [docs/neovim-config.md](docs/neovim-config.md).

## Troubleshooting

| Problem                                | What to do                                                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| "Cannot start Neovim"                  | Set "Neovim path" to the full path. To find it, run `which nvim` in a terminal (`where nvim` on Windows)               |
| LSP or other tools are not found       | Turn on "Start through login shell". Your PATH must be set in a login shell file (`~/.zprofile` or `~/.zshrc` for zsh) |
| Icons show as boxes                    | Install a [Nerd Font](https://www.nerdfonts.com) and put its name in "Font family", for example `JetBrainsMono NFM`    |
| A key goes to Obsidian, not Neovim     | Remove it from "Obsidian hotkeys to keep". Click the Neovim tab to give it focus (the cursor is a filled block)        |
| `@`, `[`, `]` do not type              | Turn off "Option key as Meta"                                                                                          |
| Neovim does not show changes to a note | Save your changes in Neovim first. Neovim only reloads notes with no unsaved changes                                   |
| Something else                         | [Open an issue](https://github.com/ktowen/obsidian-neovim-view/issues)                                                 |

## Limits

- Desktop only.
- No font ligatures.
- Each Neovim tab is a separate Neovim. Tabs do not share buffers or registers.
- If Neovim waits at a "Press ENTER" prompt when you close the tab, it closes after 1 second without the save dialog. Use the toggle hotkey or `:q` to be safe.

## Privacy and file access

- The plugin starts Neovim on your computer as a separate program.
- Neovim can read and write files outside your vault. It reads your Neovim config (for example `~/.config/nvim`), and it can open any file that you open with `:e`. Your Neovim plugins can also do this.
- The plugin itself does not use the network and collects no data. Your Neovim plugins can use the network.

## For developers

- [How it works](docs/architecture.md)
- [Development and release](docs/development.md)
- [Manual testing](docs/manual-testing.md)

## License

MIT. See [LICENSE](LICENSE).
