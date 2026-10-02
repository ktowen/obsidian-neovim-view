import { describe, expect, test } from "vitest";
import { escapeText, hotkeySpec, matchesSpec, translateKey, type KeyLike } from "../src/input/keys";

const k = (key: string, mods: Partial<KeyLike> = {}): KeyLike => ({
	key,
	code: "",
	ctrlKey: false,
	altKey: false,
	shiftKey: false,
	metaKey: false,
	isComposing: false,
	getModifierState: () => false,
	...mods,
});
const opts = { optionAsMeta: false };

describe("translateKey", () => {
	test.each([
		[k("Escape"), "<Esc>"],
		[k("Enter"), "<CR>"],
		[k("Backspace"), "<BS>"],
		[k("ArrowUp"), "<Up>"],
		[k("F5"), "<F5>"],
		[k("Tab", { shiftKey: true }), "<S-Tab>"],
		[k("Tab", { ctrlKey: true }), "<C-Tab>"],
		[k("ArrowLeft", { altKey: true }), "<M-Left>"],
		[k("w", { ctrlKey: true }), "<C-w>"],
		[k("V", { ctrlKey: true, shiftKey: true }), "<C-V>"],
		[k("p", { metaKey: true }), "<D-p>"],
		[k("<", { ctrlKey: true }), "<C-lt>"],
		[k("\\", { ctrlKey: true }), "<C-Bslash>"],
		[k(" ", { ctrlKey: true }), "<C-Space>"],
		[k("å", { altKey: true, code: "KeyA" }), "<M-a>"],
	])("%o -> %s", (e, want) => {
		const o = e.key === "å" ? { optionAsMeta: true } : opts;
		expect(translateKey(e, o)).toEqual({ send: want });
	});

	test("plain printable keys go through the textarea", () => {
		expect(translateKey(k("a"), opts)).toBe("text");
		expect(translateKey(k("<"), opts)).toBe("text");
		expect(translateKey(k("ñ"), opts)).toBe("text");
	});

	test("Option chars type text when optionAsMeta is false (Spanish @ is Option+2)", () => {
		expect(translateKey(k("@", { altKey: true, code: "Digit2" }), opts)).toBe("text");
	});

	test("AltGr chars type text (Windows reports AltGr as Ctrl+Alt)", () => {
		const altGr = { ctrlKey: true, altKey: true, getModifierState: (m: string) => m === "AltGraph" };
		expect(translateKey(k("@", altGr), opts)).toBe("text");
		expect(translateKey(k("@", { ctrlKey: true, altKey: true }), opts)).toEqual({ send: "<C-@>" });
	});

	test("dead keys and composition go through the textarea", () => {
		expect(translateKey(k("Dead"), opts)).toBe("text");
		expect(translateKey(k("Enter", { isComposing: true }), opts)).toBe("text");
	});

	test("modifier keys alone are ignored", () => {
		expect(translateKey(k("Meta", { metaKey: true }), opts)).toBe("ignore");
		expect(translateKey(k("Shift", { shiftKey: true }), opts)).toBe("ignore");
	});
});

test("escapeText", () => {
	expect(escapeText("a<b>")).toBe("a<LT>b>");
});

test("matchesSpec", () => {
	expect(matchesSpec(k("p", { metaKey: true }), "Mod+P", true)).toBe(true);
	expect(matchesSpec(k("p", { ctrlKey: true }), "Mod+P", false)).toBe(true);
	expect(matchesSpec(k("p", { metaKey: true, shiftKey: true }), "Mod+P", true)).toBe(false);
	expect(matchesSpec(k(",", { metaKey: true }), "Mod+,", true)).toBe(true);
	expect(matchesSpec(k("Tab", { ctrlKey: true }), "Ctrl+Tab", true)).toBe(true);
	// Non-ASCII chars match by physical key: Cyrillic layout, and Option on macOS.
	expect(matchesSpec(k("з", { metaKey: true, code: "KeyP" }), "Mod+P", true)).toBe(true);
	expect(matchesSpec(k("π", { altKey: true, code: "KeyP" }), "Alt+P", true)).toBe(true);
	// An ASCII char matches by char, not position (Dvorak "l" is on the QWERTY P key).
	expect(matchesSpec(k("l", { metaKey: true, code: "KeyP" }), "Mod+P", true)).toBe(false);
});

test("hotkeySpec: Obsidian hotkey with key or physical code", () => {
	expect(hotkeySpec({ modifiers: ["Mod", "Shift"], key: "E" })).toBe("Mod+Shift+E");
	expect(hotkeySpec({ modifiers: ["Ctrl"], code: "KeyJ" })).toBe("Ctrl+j");
	expect(hotkeySpec({ modifiers: ["Alt"], code: "Digit1" })).toBe("Alt+1");
	expect(
		matchesSpec(
			k("E", { metaKey: true, shiftKey: true }),
			hotkeySpec({ modifiers: ["Mod", "Shift"], key: "E" }),
			true,
		),
	).toBe(true);
});
