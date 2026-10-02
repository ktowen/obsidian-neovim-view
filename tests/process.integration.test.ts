import { expect, test } from "vitest";
import { spawnNvim } from "../src/process";
import { RpcClient } from "../src/rpc";

const NVIM = process.env.NVIM_BIN ?? "nvim";

test.each([false, true])(
	"loginShell=%s: g:obsidian_neovim_view, vault var, autoread",
	async (loginShell) => {
		const proc = spawnNvim({ nvimPath: NVIM, loginShell, extraArgs: "", cwd: "/tmp" });
		try {
			const rpc = new RpcClient(proc.stdout!, proc.stdin!);
			await rpc.request("nvim_ui_attach", [40, 10, { ext_linegrid: true }]);
			const got = await rpc.request("nvim_eval", [
				"[g:obsidian_neovim_view, g:obsidian_neovim_view_vault, &autoread]",
			]);
			expect(got).toEqual([1, "/tmp", 1]);
		} finally {
			proc.kill();
		}
	},
	15_000,
);

test.each([false, true])(
	"loginShell=%s: extra args and env reach nvim",
	async (loginShell) => {
		const proc = spawnNvim({
			nvimPath: NVIM,
			loginShell,
			extraArgs: `OBSV_TEST='a b' --clean --cmd "let g:x = 'it''s'" --cmd 'set noautoread'`,
			cwd: "/tmp",
		});
		try {
			const rpc = new RpcClient(proc.stdout!, proc.stdin!);
			await rpc.request("nvim_ui_attach", [40, 10, { ext_linegrid: true }]);
			const got = await rpc.request("nvim_eval", ["[g:x, $OBSV_TEST, &autoread, g:obsidian_neovim_view]"]);
			expect(got).toEqual(["it's", "a b", 0, 1]);
		} finally {
			proc.kill();
		}
	},
	15_000,
);

test("loginShell with the shell setting", async () => {
	const proc = spawnNvim({ nvimPath: NVIM, loginShell: true, shell: "/bin/sh", extraArgs: "--clean", cwd: "/tmp" });
	try {
		const rpc = new RpcClient(proc.stdout!, proc.stdin!);
		await rpc.request("nvim_ui_attach", [40, 10, { ext_linegrid: true }]);
		expect(await rpc.request("nvim_eval", ["g:obsidian_neovim_view"])).toBe(1);
	} finally {
		proc.kill();
	}
}, 15_000);
