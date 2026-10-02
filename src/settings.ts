import { Platform, PluginSettingTab, type App, type SettingDefinitionItem } from "obsidian";
import type NeovimViewPlugin from "./main";

export interface Settings {
	nvimPath: string;
	loginShell: boolean;
	/** Empty: $SHELL, else zsh, bash or sh. */
	shell: string;
	extraArgs: string;
	fontFamily: string;
	fontSize: number;
	lineHeight: number;
	optionAsMeta: boolean;
	/** Hotkey specs that Obsidian keeps while Neovim has focus. The toggle command's hotkey is always kept. */
	passthrough: string[];
}

export const DEFAULT_SETTINGS: Settings = {
	nvimPath: "nvim",
	loginShell: true,
	shell: "",
	extraArgs: "",
	fontFamily: '"JetBrainsMono NFM", "Symbols Nerd Font Mono", Menlo, monospace',
	fontSize: 14,
	lineHeight: 1.2,
	optionAsMeta: false,
	passthrough: ["Mod+P"],
};

export class SettingsTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: NeovimViewPlugin,
	) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const required = (v: string) => (v.trim() ? undefined : "Required.");
		return [
			{
				name: "Neovim path",
				desc: "Command name or absolute path. Example: /opt/homebrew/bin/nvim",
				control: { type: "text", key: "nvimPath", placeholder: "nvim", validate: required },
			},
			{
				name: "Start through login shell",
				desc: "Gives Neovim your shell PATH, so that LSP servers and other tools are found.",
				control: { type: "toggle", key: "loginShell" },
			},
			{
				name: "Shell",
				desc: "Shell for the login shell. Empty: $SHELL, else the first of zsh, bash and sh. Example: /bin/zsh",
				visible: () => this.plugin.settings.loginShell && !Platform.isWin,
				control: { type: "text", key: "shell", placeholder: "Automatic" },
			},
			{
				name: "Font family",
				desc: "CSS font-family. Use a Nerd Font for icons. A 'guifont' set in Neovim comes first.",
				control: { type: "text", key: "fontFamily", validate: required },
			},
			{ name: "Font size", control: { type: "number", key: "fontSize", min: 1 } },
			{ name: "Line height", control: { type: "number", key: "lineHeight", min: 1, step: 0.1 } },
			{
				name: "Option key as Meta",
				desc: "On: Option+x sends <M-x>. Off: Option types special characters, such as @ [ ] { } on Spanish layouts.",
				control: { type: "toggle", key: "optionAsMeta" },
			},
			{
				name: "Extra arguments",
				desc: 'Added after --embed. Leading NAME=value words set env vars. Example: NVIM_APPNAME=nvim-obsidian --cmd "set wrap"',
				control: { type: "textarea", key: "extraArgs", rows: 3 },
			},
			{
				name: "Obsidian hotkeys to keep",
				desc: "One per line, for example Mod+P. Mod is Cmd on macOS. All other keys go to Neovim.",
				render: (setting) => {
					setting.addTextArea((t) =>
						t.setValue(this.plugin.settings.passthrough.join("\n")).onChange(async (v) => {
							this.plugin.settings.passthrough = v
								.split("\n")
								.map((x) => x.trim())
								.filter(Boolean);
							await this.plugin.saveSettings();
						}),
					);
				},
			},
		];
	}
}
