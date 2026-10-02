import { spawn } from "child_process";
import { afterEach, expect, test } from "vitest";
import { RpcClient } from "../src/rpc";

const NVIM = process.env.NVIM_BIN ?? "nvim";
let proc: ReturnType<typeof spawn> | undefined;

afterEach(() => proc?.kill());

test("embed: attach, input text, receive grid_line with the text", async () => {
	proc = spawn(NVIM, ["--embed", "--clean"]);
	const rpc = new RpcClient(proc.stdout!, proc.stdin!);

	const lines: string[] = [];
	const seen = new Set<string>();
	let onFlush = () => {};
	rpc.onNotification((method, params) => {
		if (method !== "redraw") return;
		for (const [name, ...tuples] of params as [string, ...unknown[][]][]) {
			seen.add(name);
			if (name === "grid_line") {
				for (const [, row, , cells] of tuples as [number, number, number, [string, number?, number?][]][]) {
					if (row === 0) lines.push(cells.map(([t, , r]) => t.repeat(r ?? 1)).join(""));
				}
			}
			if (name === "flush") onFlush();
		}
	});

	const [, apiInfo] = await rpc.request<[number, { version: { api_level: number } }]>("nvim_get_api_info");
	expect(apiInfo.version.api_level).toBeGreaterThanOrEqual(12);

	await rpc.request("nvim_ui_attach", [40, 10, { rgb: true, ext_linegrid: true }]);
	await rpc.request("nvim_input", ["ihello<Esc>"]);
	await new Promise<void>((resolve) => {
		onFlush = () => lines.some((l) => l.startsWith("hello")) && resolve();
		onFlush();
	});

	expect(lines.some((l) => l.startsWith("hello"))).toBe(true);
	for (const ev of ["grid_resize", "hl_attr_define", "default_colors_set", "grid_cursor_goto", "mode_info_set"]) {
		expect(seen, ev).toContain(ev);
	}
	await expect(rpc.request("nvim_no_such_method")).rejects.toThrow();
}, 10_000);

test("after nvim exits: requests reject, writes do not throw", async () => {
	proc = spawn(NVIM, ["--embed", "--clean"]);
	const rpc = new RpcClient(proc.stdout!, proc.stdin!);
	await rpc.request("nvim_get_api_info");
	const exited = new Promise((resolve) => proc!.on("exit", resolve));
	rpc.notify("nvim_command", ["qall!"]);
	await exited;
	rpc.notify("nvim_input", ["x"]);
	await expect(rpc.request("nvim_get_api_info")).rejects.toThrow(/closed/);
	expect(rpc.closed).toBe(true);
});
