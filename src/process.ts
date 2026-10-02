import { spawn, type ChildProcess } from "child_process";
import { accessSync, constants } from "fs";
import { delimiter, join } from "path";
import { parseExtraArgs } from "./args";

export interface SpawnOptions {
	nvimPath: string;
	/** Obsidian started from the Dock has PATH=/usr/bin:/bin:/usr/sbin:/sbin, so nvim would not find LSP servers. */
	loginShell: boolean;
	/** Shell for loginShell. Empty: see findShell. */
	shell?: string;
	/** See parseExtraArgs. Throws on a parse error. */
	extraArgs: string;
	cwd?: string;
}

export function spawnNvim(o: SpawnOptions): ChildProcess {
	const extra = parseExtraArgs(o.extraArgs);
	const args = [
		"--embed",
		// Like g:vscode in vscode-neovim: lets the user config detect Obsidian.
		"--cmd",
		"let g:obsidian_neovim_view = 1",
		"--cmd",
		"let g:obsidian_neovim_view_vault = $OBSIDIAN_NEOVIM_VIEW_VAULT",
		"--cmd",
		"set autoread",
		// Last, so that user --cmd lines can override ours.
		...extra.args,
	];
	const env = { ...process.env, OBSIDIAN_NEOVIM_VIEW_VAULT: o.cwd ?? "", ...extra.env };

	if (o.loginShell && process.platform !== "win32") {
		const shell = o.shell?.trim() || findShell(process.env);
		const cmd = ["exec", ...[o.nvimPath, ...args].map(shellQuote)].join(" ");
		return spawn(shell, ["-l", "-c", cmd], { cwd: o.cwd, env });
	}
	return spawn(o.nvimPath, args, { cwd: o.cwd, env });
}

/** $SHELL, else the first of zsh, bash, sh in PATH or in the standard folders. */
export function findShell(env: NodeJS.ProcessEnv, exists = isExecutable): string {
	if (env.SHELL) return env.SHELL;
	// Obsidian started from the Dock or a launcher has a short PATH, so also look in the standard folders.
	const dirs = [...(env.PATH ?? "").split(delimiter), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"];
	for (const name of ["zsh", "bash", "sh"]) {
		for (const dir of dirs) {
			const path = dir && join(dir, name);
			if (path && exists(path)) return path;
		}
	}
	return "/bin/sh";
}

function isExecutable(path: string): boolean {
	try {
		accessSync(path, constants.X_OK);
		return true;
	} catch {
		return false;
	}
}

function shellQuote(s: string): string {
	return `'${s.replace(/'/g, `'\\''`)}'`;
}
