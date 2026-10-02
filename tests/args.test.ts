import { expect, test } from "vitest";
import { parseExtraArgs } from "../src/args";

const p = (s: string) => parseExtraArgs(s, "/home/u");

test("empty", () => {
	expect(p("  ")).toEqual({ env: {}, args: [] });
});

test("leading NAME=value words are env, later ones are args", () => {
	expect(p("NVIM_APPNAME=nvim-obsidian FOO=1 -u x.lua A=b")).toEqual({
		env: { NVIM_APPNAME: "nvim-obsidian", FOO: "1" },
		args: ["-u", "x.lua", "A=b"],
	});
});

test("quotes and escapes", () => {
	expect(p(`--cmd "set wrap linebreak" -c 'lua print("hi")' a\\ b "q\\"x"`).args).toEqual([
		"--cmd",
		"set wrap linebreak",
		"-c",
		'lua print("hi")',
		"a b",
		'q"x',
	]);
});

test("~/ expands, quoted ~ does not", () => {
	expect(p(`-u ~/cfg/init.lua '~/lit' X=~/y`)).toEqual({
		env: {},
		args: ["-u", "/home/u/cfg/init.lua", "~/lit", "X=~/y"],
	});
	expect(p("X=~/y").env).toEqual({ X: "/home/u/y" });
});

test("unclosed quote throws", () => {
	expect(() => p(`--cmd "set wrap`)).toThrow(/Unclosed/);
});
