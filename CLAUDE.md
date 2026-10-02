# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Desktop-only Obsidian plugin "Neovim View" (repo and package `obsidian-neovim-view`; plugin ID `neovim-view`, because Obsidian rejects IDs that contain "obsidian") that embeds a real Neovim in an Obsidian tab. The plugin is a pure UI client (like Neovide): it spawns `nvim --embed`, attaches with `nvim_ui_attach`, paints `redraw` events on a `<canvas>`, and forwards keys/mouse. Neovim owns all editing and file I/O. `docs/architecture.md` explains how it works. Read it before non-trivial changes. `README.md` is for end users.

## Commands

The committed lockfile is `package-lock.json` (npm).

```sh
npm run dev       # esbuild watch → main.js (inline source maps)
npm run build     # tsc type-check + production build
npm test          # vitest: unit + integration tests (integration needs real nvim)
npm run lint      # ESLint (includes eslint-plugin-obsidianmd)
npm run check     # prettier --check + lint + tsc + tests — run before committing
npx vitest run tests/grid.test.ts          # single file
npx vitest run -t "<test name pattern>"    # single test
```

- Integration tests (`*.integration.test.ts`, and a real-nvim scroll test in `grid.test.ts`) need `nvim` ≥ 0.10 in PATH; set `NVIM_BIN` to override.
- Known flake (~1 in 30): fresh `nvim --embed --clean` sometimes shows a hit-enter prompt and requests block. The grid integration test retries.
- Manual testing: checklist in `docs/manual-testing.md`. Test vault at `../obsidian-neovim-view-testvault` with this repo symlinked into `.obsidian/plugins/neovim-view`; reload by toggling the plugin.
- Release: bump `manifest.json` + `package.json` version, push a tag equal to it (no `v`); `.github/workflows/release.yml` creates a draft release.
- Style: Prettier with tabs (see `.prettierrc.json` / `.editorconfig`).

## Architecture

Data flow: `NvimView` (one per tab, `src/view.ts`) owns a hidden focused `<textarea>` (keys/IME), a `<canvas>`, an `RpcClient`, a `Grid`, and a `Renderer`. Nvim stdout → `RpcClient` → `redraw` notifications → `Grid` → on `flush`, `Renderer` paints dirty rows in one `requestAnimationFrame`.

- `src/main.ts` — Plugin: commands (toggle, open; no default hotkeys, per plugin guidelines), ribbon, file menu, settings; on `vault.on("modify")` runs `:checktime` in every view.
- `src/process.ts` + `src/args.ts` — spawns nvim (by default via `<shell> -l -c "exec nvim ..."`; shell = "Shell" setting, else `$SHELL`, else first of zsh/bash/sh (`findShell`) because Dock-launched Obsidian has a minimal PATH), cwd = vault root, with `--cmd` setting `g:obsidian_neovim_view`, `g:obsidian_neovim_view_vault`, `autoread` before `init.lua` runs (`--embed` defers config load until UI attach). `args.ts` parses the shell-like "Extra arguments" setting.
- `src/rpc.ts` — own minimal msgpack-RPC client on `@msgpack/msgpack` (deliberately not the `neovim` npm package). Stream-decodes stdout; replies with an error to any request from nvim so it never blocks. Hot-path calls (`nvim_input`, `nvim_input_mouse`) are notifications.
- `src/ui/grid.ts` — DOM-free screen model of grid 1 (`ext_linegrid`), unit-tested in Node. Each redraw event can carry multiple arg tuples; `grid_line` cells omit `hl_id` to mean "reuse previous". Unhandled events are ignored.
- `src/ui/renderer.ts`, `src/ui/metrics.ts` — fixed cell size from `measureText("M")` × line height; one glyph per cell (never use font advance for layout); DPR-aware backing store; `ResizeObserver` (50 ms debounce) → `nvim_ui_try_resize`. A user-set `guifont` takes precedence, with the settings font kept last as fallback (for Nerd Font icons); Neovim's platform-default `guifont` is ignored (`src/view.ts`).
- `src/input/keys.ts` — `translateKey()` returns `{send}` (special/modified keys → `nvim_input`), `"text"` (let the textarea receive it; sent on `input`/`compositionend`, `<` escaped as `<LT>`), or `"ignore"`. Option-as-Meta uses `e.code`, not `e.key`.

Key non-obvious mechanics:

- **Hotkey capture:** Obsidian handles hotkeys before DOM events, so the view pushes its own catch-all `Scope` on textarea focus (pops on blur). The handler returns `false` to swallow keys for nvim; returns `undefined` (Obsidian continues to `app.scope`, where its hotkey handler is; `true` would stop there) for keys in the "Obsidian hotkeys to keep" setting and for the toggle command's current hotkey, read from the non-public `app.hotkeyManager` in `main.ts` (`keptHotkeys`).
- **Startup:** `nvim_get_api_info` (reject `api_level` < 12) → measure cells → `nvim_ui_attach` → install a `BufEnter` autocmd that `rpcnotify`s `obsidian_neovim_view_buf` with the current path → open file via `nvim_cmd` with `magic = {file=false, bar=false}` (no `%`/`#`/`|` expansion).
- **View state** is `{ file: <vault-relative path> }`, updated from `obsidian_neovim_view_buf` (only normal buffers inside the vault). Exit code 0 → `leaf.openFile(file)` (or close the tab if none); other exit → error overlay with stderr + Restart. Toggle/close/disable check `getbufinfo({'bufmodified':1})` and prompt Save all / Discard.
- **Process lifecycle:** `this.proc` is the live process; `kill()` sets it to null, so `onExit` ignores exits the plugin caused. Errors from a closed RPC channel are left to `onExit`, which has the real reason (exit code, stderr). `stop()` returns false (Nvim keeps running) when Nvim does not answer or `:wall` fails; `onClose` then kills anyway.
- **Naming:** `obsidian-neovim-view` everywhere (view type, CSS classes, package), `obsidian_neovim_view` on the Neovim side (`g:obsidian_neovim_view`, `$OBSIDIAN_NEOVIM_VIEW_VAULT`, augroup, `obsidian_neovim_view_buf` notification). Only `manifest.json` `id` is `neovim-view`.
- Plugin guidelines discourage console logging other than errors.
- Tab title refresh uses non-public `leaf.updateHeader()`.
