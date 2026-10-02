import { spawn } from "child_process";
import { describe, expect, test } from "vitest";
import { RpcClient } from "../src/rpc";
import { Grid } from "../src/ui/grid";

function grid(cols: number, rows: number): Grid {
	const g = new Grid();
	g.applyRedraw([["grid_resize", [1, cols, rows]]]);
	return g;
}

describe("grid_line", () => {
	test("hl carry-over and repeat", () => {
		const g = grid(6, 1);
		g.applyRedraw([["grid_line", [1, 0, 0, [["a", 5], ["b"], [" ", 7, 3]], false]]]);
		expect(g.rowText(0)).toBe("ab    ");
		expect([...g.hl]).toEqual([5, 5, 7, 7, 7, 0]);
	});

	test("hl carry-over resets per event", () => {
		const g = grid(4, 1);
		g.applyRedraw([["grid_line", [1, 0, 0, [["a", 5]], false], [1, 0, 2, [["b", 0], ["c"]], false]]]);
		expect([...g.hl]).toEqual([5, 0, 0, 0]);
	});

	test("double-width char uses an empty right cell", () => {
		const g = grid(4, 1);
		g.applyRedraw([["grid_line", [1, 0, 0, [["界", 1], [""], ["x"]], false]]]);
		expect(g.text.slice(0, 3)).toEqual(["界", "", "x"]);
	});

	test("cells that are not sent stay unchanged", () => {
		const g = grid(4, 1);
		g.applyRedraw([["grid_line", [1, 0, 0, [["a", 1, 4]], false]]]);
		g.applyRedraw([["grid_line", [1, 0, 1, [["b", 1]], false]]]);
		expect(g.rowText(0)).toBe("abaa");
	});

	test("does not write past the last column", () => {
		const g = grid(2, 1);
		g.applyRedraw([["grid_line", [1, 0, 1, [["z", 1, 5]], false]]]);
		expect(g.rowText(0)).toBe(" z");
	});
});

describe("grid_scroll", () => {
	const setup = () => {
		const g = grid(2, 4);
		for (const [r, t] of ["A", "B", "C", "D"].entries()) {
			g.applyRedraw([["grid_line", [1, r, 0, [[t, 0, 2]], false]]]);
		}
		return g;
	};
	const rows = (g: Grid) => [0, 1, 2, 3].map((r) => g.rowText(r));

	test("positive rows moves content up", () => {
		const g = setup();
		g.applyRedraw([["grid_scroll", [1, 0, 4, 0, 2, 1, 0]]]);
		expect(rows(g)).toEqual(["BB", "CC", "DD", "DD"]);
	});

	test("negative rows moves content down", () => {
		const g = setup();
		g.applyRedraw([["grid_scroll", [1, 0, 4, 0, 2, -1, 0]]]);
		expect(rows(g)).toEqual(["AA", "AA", "BB", "CC"]);
	});

	test("scroll inside a sub-region", () => {
		const g = setup();
		g.applyRedraw([["grid_scroll", [1, 1, 3, 0, 2, 1, 0]]]);
		expect(rows(g)).toEqual(["AA", "CC", "CC", "DD"]);
	});
});

test("resize keeps old content", () => {
	const g = grid(2, 1);
	g.applyRedraw([["grid_line", [1, 0, 0, [["q", 3, 2]], false]]]);
	g.applyRedraw([["grid_resize", [1, 3, 2]]]);
	expect(g.rowText(0)).toBe("qq ");
	expect(g.rowText(1)).toBe("   ");
});

// retry: about 1 run in 30 hits a startup hit-enter prompt that blocks nvim_buf_set_lines. Cause not found yet.
test("real nvim: model matches nvim screen after edits and scroll", { retry: 2, timeout: 5_000 }, async () => {
	const proc = spawn(process.env.NVIM_BIN ?? "nvim", ["--embed", "--clean"]);
	try {
		const rpc = new RpcClient(proc.stdout, proc.stdin);
		const g = new Grid();
		let check = () => {};
		g.onFlush = () => check();
		rpc.onNotification((m, p) => m === "redraw" && g.applyRedraw(p));
		const waitFor = (pred: () => boolean) =>
			new Promise<void>((resolve) => {
				check = () => pred() && resolve();
				check();
			});

		await rpc.request("nvim_ui_attach", [40, 10, { rgb: true, ext_linegrid: true, ext_messages: true }]);
		await waitFor(() => g.rows === 10);
		const lines = Array.from({ length: 30 }, (_, i) => `line ${i}`);
		await rpc.request("nvim_buf_set_lines", [0, 0, -1, false, lines]);
		await rpc.request("nvim_input", ["10<C-e>"]);
		await waitFor(() => g.rowText(0).startsWith("line 10"));

		const top = await rpc.request<number>("nvim_eval", ['line("w0")']);
		for (let r = 0; r < 4; r++) {
			expect(g.rowText(r).trimEnd()).toBe(`line ${top - 1 + r}`);
		}
		expect(top).toBe(11);
	} finally {
		proc.kill();
	}
});
