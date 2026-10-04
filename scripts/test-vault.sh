#!/bin/sh
# Creates a vault for docs/manual-testing.md, with this repo linked as the plugin.
# Usage: scripts/test-vault.sh [vault dir]   (default: ../obsidian-neovim-view-testvault)
set -eu

repo=$(cd "$(dirname "$0")/.." && pwd)
vault=${1:-"$repo/../obsidian-neovim-view-testvault"}

if [ -e "$vault" ]; then
	echo "$vault exists. Remove it first." >&2
	exit 1
fi

mkdir -p "$vault/.obsidian/plugins" "$vault/folder"
vault=$(cd "$vault" && pwd)
ln -s "$repo" "$vault/.obsidian/plugins/neovim-view"

echo '["neovim-view"]' >"$vault/.obsidian/community-plugins.json"
# Setup step of the manual tests: the toggle command has no default hotkey.
echo '{ "neovim-view:toggle": [{ "modifiers": ["Mod", "Shift"], "key": "E" }] }' >"$vault/.obsidian/hotkeys.json"

cat >"$vault/note.md" <<'EOF'
# Note

Open this note in Neovim with Cmd+Shift+E (Ctrl+Shift+E on Windows and Linux).

- [[other]]
- [[wide]]
- [[big]]
EOF

cat >"$vault/other.md" <<'EOF'
# Other

Use `:e other.md` from note.md to check the tab title.
EOF

cat >"$vault/wide.md" <<'EOF'
# Wide characters

日本語 😀 한국어 中文
á é í ó ú ñ ü ¿ ¡ @ # [ ] { } \ | < >
EOF

cat >"$vault/100% #1.md" <<'EOF'
# Special file name

Neovim must open this file with no `%` or `#` expansion.
EOF

cat >"$vault/folder/nested.md" <<'EOF'
# Nested note
EOF

cat >"$vault/example.lua" <<'EOF'
-- For the LSP check: open in Neovim with :e example.lua
local function greet(name)
	return "Hello, " .. name
end

print(greet("vault"))
EOF

{
	echo "# Big file"
	echo
	i=1
	while [ "$i" -le 5000 ]; do
		echo "Line $i: the quick brown fox jumps over the lazy dog."
		i=$((i + 1))
	done
} >"$vault/big.md"

if [ -f "$repo/docs/manual-testing.md" ]; then
	cp "$repo/docs/manual-testing.md" "$vault/Manual tests.md"
fi

[ -f "$repo/main.js" ] || echo "main.js is missing. Run npm run build or npm run dev." >&2
echo "Test vault: $vault"
