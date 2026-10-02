import { MarkdownView, Plugin, TFile, type WorkspaceLeaf } from "obsidian";
import { hotkeySpec, type SavedHotkey } from "./input/keys";
import { DEFAULT_SETTINGS, SettingsTab, type Settings } from "./settings";
import { ICON, NvimView, VIEW_TYPE } from "./view";

const HEADER_BUTTON_CLASS = "obsidian-neovim-view-action";

/** `app.hotkeyManager`: not public API. */
interface HotkeyManager {
	getHotkeys(commandId: string): SavedHotkey[] | undefined;
}

export default class NeovimViewPlugin extends Plugin {
	settings: Settings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<Settings> | null) };
		this.addSettingTab(new SettingsTab(this.app, this));
		this.registerView(VIEW_TYPE, (leaf) => new NvimView(leaf, this.settings, () => this.keptHotkeys()));

		this.addCommand({
			id: "toggle",
			name: "Toggle Neovim for current file",
			checkCallback: (checking) => {
				const nvim = this.app.workspace.getActiveViewOfType(NvimView);
				const md = this.activeMarkdown();
				if (!nvim && !md) return false;
				if (!checking) {
					if (nvim) void nvim.quit();
					else if (md) void this.openInNvim(md.file, md.leaf);
				}
				return true;
			},
		});
		this.addCommand({
			id: "open-empty",
			name: "Open Neovim",
			callback: () => void this.openEmpty(),
		});

		this.addRibbonIcon(ICON, "Open current file in Neovim", () => {
			const md = this.activeMarkdown();
			void (md ? this.openInNvim(md.file, md.leaf) : this.openEmpty());
		});

		this.app.workspace.onLayoutReady(() => {
			this.addHeaderButtons();
		});
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.addHeaderButtons();
			}),
		);
		// A background tab loads its view when it is shown.
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.addHeaderButtons();
			}),
		);
		this.register(() => {
			for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
				leaf.view.containerEl.querySelectorAll(`.${HEADER_BUTTON_CLASS}`).forEach((el) => {
					el.remove();
				});
			}
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!(file instanceof TFile)) return;
				menu.addItem((item) =>
					item
						.setTitle("Open in Neovim")
						.setIcon(ICON)
						.onClick(() => void this.openInNvim(file)),
				);
			}),
		);

		this.registerEvent(
			this.app.vault.on("modify", () => {
				for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
					if (leaf.view instanceof NvimView) leaf.view.checktime();
				}
			}),
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/** "Obsidian hotkeys to keep" plus the toggle hotkey that the user has now, so that the toggle always works. */
	private keptHotkeys(): string[] {
		const manager = (this.app as unknown as { hotkeyManager?: HotkeyManager }).hotkeyManager;
		const id = `${this.manifest.id}:toggle`;
		const toggle = manager?.getHotkeys(id) ?? [];
		return [...this.settings.passthrough, ...toggle.map(hotkeySpec)];
	}

	private activeMarkdown(): { file: TFile; leaf: WorkspaceLeaf } | null {
		const md = this.app.workspace.getActiveViewOfType(MarkdownView);
		return md?.file ? { file: md.file, leaf: md.leaf } : null;
	}

	private addHeaderButtons(): void {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			// A background tab is a DeferredView until it is shown.
			if (!(view instanceof MarkdownView) || view.containerEl.querySelector(`.${HEADER_BUTTON_CLASS}`)) continue;
			view.addAction(ICON, "Open in Neovim", () => {
				if (view.file) void this.openInNvim(view.file, view.leaf);
			}).addClass(HEADER_BUTTON_CLASS);
		}
	}

	/** `replace` is the Markdown tab of the file: Neovim takes it, so the note is not open in two editors. */
	private async openInNvim(file: TFile, replace?: WorkspaceLeaf): Promise<void> {
		const leaf = replace ?? this.app.workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE, active: true, state: { file: file.path } });
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
	}

	private async openEmpty(): Promise<void> {
		await this.app.workspace.getLeaf("tab").setViewState({ type: VIEW_TYPE, active: true });
	}
}
