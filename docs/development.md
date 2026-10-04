# Development

## Install from source

```sh
git clone https://github.com/ktowen/obsidian-neovim-view.git
cd obsidian-neovim-view
npm install
npm run build                                       # creates main.js
ln -s "$PWD" <vault>/.obsidian/plugins/neovim-view
```

Use the folder name `neovim-view`, the plugin ID. Then enable the plugin in Settings → Community plugins. After each `npm run build`, disable and enable the plugin to load the new `main.js`.

## Commands

```sh
npm install
npm run dev       # esbuild watch → main.js (with inline source maps)
npm run build     # type-check + production build
npm test          # vitest: unit tests + integration tests against real nvim
npm run lint      # ESLint
npm run format    # Prettier, writes the files
npm run check     # format check + lint + type-check + tests (run before a commit)
```

- The integration tests need `nvim` in PATH. Set `NVIM_BIN` to use another binary.
- Test vault: `scripts/test-vault.sh` creates `../obsidian-neovim-view-testvault`, with this repo symlinked into its `.obsidian/plugins/neovim-view`.
- To reload the plugin: disable and enable it in Settings → Community plugins, or install `pjeby/hot-reload`.
- Dev console: `Cmd+Opt+I`. Neovim stderr shows in the overlay when Neovim exits with an error.
- Before a release, do the manual checks in [manual-testing.md](manual-testing.md).

## Release

1. Set the same new version in `manifest.json` and `package.json` (`x.y.z`, no `v`). If the plugin needs a newer Obsidian, raise `minAppVersion`.
2. Commit, then push a tag with that version: `git tag 0.1.0 && git push origin main 0.1.0`.
3. The `Release` GitHub Action builds and creates a **draft** release with `main.js`, `manifest.json` and `styles.css`. Check it on GitHub and publish it.

## Publish in Community plugins

Once, after the first release:

1. The repo must be public, with `README.md`, `LICENSE` and `manifest.json` in the root.
2. Read the [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines) and the [submission steps](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin).
3. Sign in to [community.obsidian.md](https://community.obsidian.md), link your GitHub account and add the plugin.
4. An automated review checks the repo and the release. Fix what it reports with new releases.

Later updates need only a new release: Obsidian reads `manifest.json` in the repo and downloads the files from the release with that tag.

## Known technical issues

- `grid_scroll` copies cells and repaints rows. It does not copy pixels, so a big scroll repaints all rows.
- Neovim draws the cmdline, popup menu and messages in the grid (`ext_cmdline`, `ext_popupmenu`, `ext_messages` are not used).
- Known test flake: about 1 run in 30, a fresh `nvim --embed --clean` shows a hit-enter prompt at startup, and requests block. The grid integration test retries. Cause not found yet.
- Two calls are not public API. If Obsidian removes them, only one feature breaks:
    - `leaf.updateHeader()`: the tab title stops updating after `:e`.
    - `app.hotkeyManager`: the toggle hotkey stops working while Neovim has focus, until you add it to "Obsidian hotkeys to keep".
