# Manual tests

`npm test` covers the parts with no DOM (keys, grid, args, RPC, spawn). These checks cover what needs Obsidian.
Do them before a release, in the test vault, with the latest `npm run build`. Keep the dev console (`Cmd+Opt+I`) open, and write down errors.

`Cmd` means Cmd on macOS and Ctrl on other systems, except where a check says macOS.

Setup: the toggle command has no default hotkey. In Settings → Hotkeys, set "Toggle Neovim for current file" to `Cmd+Shift+E`.

## Open and close

1. [ ] Markdown note → `Cmd+Shift+E` → the same tab shows Neovim with the note. The tab title is `nvim: <file name>`.
2. [ ] Header terminal button in a Markdown tab → same result.
3. [ ] Ribbon icon with a note active → same result.
4. [ ] Ribbon icon with no note open → empty Neovim tab, title `Neovim`.
5. [ ] File explorer right-click → "Open in Neovim" → new tab with the file.
6. [ ] Command palette → "Open Neovim" → empty tab. `:pwd` shows the vault path.
7. [ ] `:q` → the tab shows the note in the Obsidian editor.
8. [ ] `:wq` after an edit → back to the Obsidian editor, and the edit is there.
9. [ ] `Cmd+Shift+E` in Neovim, no changes → back to the Obsidian editor, with no dialog.
10. [ ] `Cmd+Shift+E` in Neovim with unsaved changes → dialog that lists the file. "Save all" saves. Repeat with "Discard": the change is not saved.
11. [ ] Header "Back to Obsidian editor" button → same as items 9 and 10.
12. [ ] Close the Neovim tab (`x`) with unsaved changes → dialog. `Esc` in the dialog saves.
13. [ ] `:enew`, type text, `Cmd+Shift+E` → dialog shows `[No Name]`. "Save all" → notice `Neovim could not save: ... E141 ...`, and Neovim stays open. `:bd!`, then `Cmd+Shift+E` → back to the Obsidian editor.
14. [ ] `:e other.md` inside Neovim → the tab title changes. `:q` → the Obsidian editor shows `other.md`.
15. [ ] Extra arguments `-c "cd /tmp"`, then open a note in Neovim → the note opens with its text (not a new empty file), and `:pwd` shows `/tmp`. Clear the setting.
16. [ ] Empty Neovim tab → `:q` → the tab closes.
17. [ ] `:cq` (exit code 1) → overlay "Neovim exited (code 1)." with a Restart button. Restart works.
18. [ ] Restart Obsidian with a Neovim tab open → the tab comes back with the same file.
19. [ ] Disable the plugin with a Neovim tab open → no `nvim --embed` process stays (`pgrep -fl 'nvim --embed'`). The header buttons are removed from Markdown tabs.
20. [ ] Vault opened through a symlink (for example `ln -s <vault> /tmp/vault-link`, then open `/tmp/vault-link` as a vault) → `:e other.md` changes the tab title, and `:q` shows `other.md`.

## Config and environment

21. [ ] `:echo g:obsidian_neovim_view g:obsidian_neovim_view_vault $OBSIDIAN_NEOVIM_VIEW_VAULT` → `1` and the vault path two times.
22. [ ] Your config loads (theme, statusline, plugins). A plugin with `cond = not vim.g.obsidian_neovim_view` does not load.
23. [ ] Start Obsidian from the Dock or app launcher, not a terminal. `:echo $PATH` has the folders from your login shell (for example `/opt/homebrew/bin`). LSP works on a file with a server (for example a `.lua` file).
24. [ ] Settings → turn off "Start through login shell", set "Neovim path" to the absolute path (`which nvim`), open a new tab → it starts. `:echo $PATH` is the short system PATH (only when Obsidian started from the Dock or launcher).
25. [ ] "Neovim path" `nvim-does-not-exist`, login shell on, open a new tab → overlay `Neovim exited (code 127). ... command not found ...`. With login shell off → overlay `Cannot start Neovim: spawn nvim-does-not-exist ENOENT. Check "Neovim path" in the settings.` Restore both settings.
26. [ ] Extra arguments `NVIM_APPNAME=nvim-test` (a config that does not exist) → Neovim starts with the default config.
27. [ ] Extra arguments `--cmd "let g:hello = 'a b'"` → `:echo g:hello` shows `a b`.
28. [ ] Extra arguments `--cmd "set wrap` (unclosed quote) → overlay `Unclosed " in extra arguments. Check "Extra arguments" in the settings.` Clear the setting.
29. [ ] If you have Neovim 0.9 or older: set it as "Neovim path" → overlay `Neovim 0.9 is too old. Use 0.10 or newer.`

## Keyboard

30. [ ] `Cmd+P` opens the Obsidian command palette while Neovim has focus.
31. [ ] `Cmd+W`, `Cmd+O`, `Ctrl+Tab` do not trigger Obsidian. Check that Neovim gets them: `:nmap <D-o> :echo "got D-o"<CR>`, then `Cmd+O` (macOS).
32. [ ] `Esc` leaves insert mode and does not close or blur anything.
33. [ ] Insert mode: type `á é í ó ú ñ ü ¿ ¡ @ # [ ] { } \ | < >`. Every character is correct.
34. [ ] `Ctrl+W`, `Ctrl+O`, `Ctrl+V` (visual block), `Ctrl+R "` work.
35. [ ] Arrows, Home/End, PageUp/PageDown, Backspace, Delete, Tab, Shift+Tab, F1.
36. [ ] `:` cmdline, `/` search, `<C-n>` / LSP completion popup are visible.
37. [ ] macOS: "Option key as Meta" on → `:nmap <M-j> :echo "M-j"<CR>`, press Option+J → the message shows. Turn it off again.
38. [ ] Hold a key (for example `j`) → key repeat works and scroll is smooth.
39. [ ] Add a non-Latin layout (for example Russian). With it active, `Cmd+P` still opens the command palette.
40. [ ] Windows, Spanish layout: `AltGr+2` types `@`, `AltGr+[` types `[` in insert mode.
41. [ ] Settings → Hotkeys → change "Toggle Neovim for current file" to `Cmd+Alt+N`. Do not change "Obsidian hotkeys to keep". In a Neovim tab with focus, `Cmd+Alt+N` returns to the Obsidian editor, and `Cmd+Shift+E` now goes to Neovim (`:nmap <D-E> :echo "got"<CR>`, macOS).
42. [ ] Remove the toggle hotkey (no hotkey) → `Cmd+Shift+E` goes to Neovim. Set `Cmd+Shift+E` again after this check.

## Clipboard

43. [ ] `Cmd+V` (macOS) in insert mode pastes multi-line text as is, with no extra indent.
44. [ ] `"+y` in Neovim, then paste in another app → same text.

## Mouse

45. [ ] Click moves the cursor to the clicked cell.
46. [ ] Drag selects in visual mode.
47. [ ] Wheel scrolls in both directions, on a trackpad and on a mouse.
48. [ ] Click another Obsidian pane, then click Neovim → keys go to Neovim again.

## Rendering

49. [ ] Nerd Font icons show (file tree, statusline, diagnostic signs).
50. [ ] Colors match your theme. Bold, italic, underline, undercurl (spelling or diagnostics), strikethrough.
51. [ ] Cursor shape: block in normal mode, bar in insert mode, underline in replace mode (`r`).
52. [ ] Wide chars and emoji: type `日本語 😀` → no overlap, and the cursor moves by 2 cells.
53. [ ] Text is sharp on a retina display. Move the window to a non-retina display (if you have one) → still sharp.
54. [ ] Resize the pane, split it, open the sidebar → Neovim fills the pane with no gap or cut text.
55. [ ] `:set guifont=Menlo:h16` → font and size change, and the grid fits again.
56. [ ] Big file (for example 5000 lines) → `G`, `gg`, `Ctrl+D` are fast and show no artifacts.
57. [ ] Unfocus Neovim → the cursor shows as a hollow box.

## Sync with Obsidian

58. [ ] Same note open in Neovim and in an Obsidian editor (two tabs). Edit in Obsidian → Neovim reloads it (if Neovim has no unsaved changes).
59. [ ] `:w` in Neovim → the Obsidian tab shows the change.
60. [ ] Two Neovim tabs with different notes → each one works on its own. Closing one does not affect the other.

## Settings, pop-out windows and startup

61. [ ] Settings search (top of the Settings window) → type "Neovim path" → the setting shows.
62. [ ] Clear "Neovim path" → an inline error shows, and the old value stays.
63. [ ] Drag a Neovim tab into a new window (pop-out). Typing, IME, resize and the cursor work. Move it back → same.
64. [ ] Open Neovim in a pop-out window directly (right-click a file → "Open in new window", then toggle) → typing works.
65. [ ] Keep 3 Markdown tabs open, restart Obsidian. No errors in the console. Select each background tab → the "Open in Neovim" header button shows.
66. [ ] Disable the plugin → the "Open in Neovim" header buttons go away, also in pop-out windows.
67. [ ] Settings → "Shell" `/no/such/shell`, open a new tab → overlay `Cannot start Neovim: spawn /no/such/shell ENOENT. Check "Neovim path" and "Shell" in the settings.` "Shell" `/bin/sh` → Neovim starts. Turn off "Start through login shell" → the "Shell" setting is hidden. Clear the setting.
