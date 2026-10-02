import obsidianmd from "eslint-plugin-obsidianmd";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

export default defineConfig(
	globalIgnores([
		"node_modules",
		"main.js",
		"esbuild.config.mjs",
		"package.json",
		"package-lock.json",
		"tsconfig.json",
	]),
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			parserOptions: {
				projectService: { allowDefaultProject: ["eslint.config.mts", "manifest.json"] },
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: [".json"],
			},
		},
	},
	...obsidianmd.configs.recommended,
	// "Neovim" is a proper noun.
	{ rules: { "obsidianmd/ui/sentence-case": ["warn", { ignoreWords: ["Neovim"] }] } },
	prettier,
);
