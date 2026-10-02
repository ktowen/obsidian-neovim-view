# Neovim configuration

## Detect Obsidian in your Neovim config

The plugin sets these before Neovim reads `init.lua`, like `vim.g.vscode` in vscode-neovim:

| Name                               | Value               |
| ---------------------------------- | ------------------- |
| `vim.g.obsidian_neovim_view`       | `1`                 |
| `vim.g.obsidian_neovim_view_vault` | Absolute vault path |
| `$OBSIDIAN_NEOVIM_VIEW_VAULT`      | Absolute vault path |

```lua
if vim.g.obsidian_neovim_view then
  vim.opt.wrap = true
  vim.opt.linebreak = true
end

-- lazy.nvim: skip a plugin inside Obsidian
{ "some/plugin", cond = not vim.g.obsidian_neovim_view }
```

The plugin also sets `autoread`. When a vault file changes outside Neovim, the plugin runs `:checktime`, so Neovim reloads the file (if the buffer has no unsaved changes).

You can also use a separate config, or any other Neovim argument, with the "Extra arguments" setting (see [Extra arguments](#extra-arguments)).

## Extra arguments

The text goes to Neovim after the plugin arguments (`--embed` and the `--cmd` lines). The plugin parses it like a shell command line:

- Spaces separate arguments. Use `'...'` or `"..."` for an argument with spaces. `\` escapes one character.
- `NAME=value` words **at the start** are environment variables, not arguments.
- `~/` at the start of a word changes to your home folder. There is no `$VAR` expansion and no globbing.
- Newlines count as spaces, so you can put one argument per line.

| Goal                                      | Extra arguments                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| Separate config `~/.config/nvim-obsidian` | `NVIM_APPNAME=nvim-obsidian`                                                    |
| Config file                               | `-u ~/.config/nvim/obsidian.lua`                                                |
| Add options                               | `--cmd "set wrap linebreak"`                                                    |
| Run Lua after startup                     | `-c "lua require('obsidian_setup')"`                                            |
| No config, no plugins                     | `--clean`                                                                       |
| All together                              | `NVIM_APPNAME=nvim-obsidian --cmd "set wrap" -c "lua vim.opt.conceallevel = 2"` |

Your `--cmd` lines run after the plugin ones, so you can change `autoread` (for example `--cmd "set noautoread"`).
Do not add `--embed`, `--headless`, `--listen` or file names: the plugin controls them.
If the text has an unclosed quote, the Neovim tab shows the error.
