/** KeyboardEvent to Nvim key notation (:h key-notation). No DOM, so it is testable in Node. */

export interface KeyLike {
	key: string;
	code: string;
	ctrlKey: boolean;
	altKey: boolean;
	shiftKey: boolean;
	metaKey: boolean;
	isComposing: boolean;
	getModifierState(key: string): boolean;
}

export interface KeyOptions {
	/** Send Option+key as <M-key>. If false, Option types its char (Spanish layouts need it for @ [ ]). */
	optionAsMeta: boolean;
}

/**
 * - `{ send }`: keys for nvim_input.
 * - `"text"`: let the browser type it. The textarea `input` / `compositionend` handler sends the text.
 * - `"ignore"`: drop it (a modifier key alone).
 */
export type KeyAction = { send: string } | "text" | "ignore";

const SPECIAL: Record<string, string> = {
	Escape: "Esc",
	Enter: "CR",
	Tab: "Tab",
	Backspace: "BS",
	Delete: "Del",
	Insert: "Insert",
	Home: "Home",
	End: "End",
	PageUp: "PageUp",
	PageDown: "PageDown",
	ArrowUp: "Up",
	ArrowDown: "Down",
	ArrowLeft: "Left",
	ArrowRight: "Right",
	Help: "Help",
};
for (let i = 1; i <= 12; i++) SPECIAL[`F${i}`] = `F${i}`;

const MODIFIER_KEYS = new Set([
	"Shift",
	"Control",
	"Alt",
	"AltGraph",
	"Meta",
	"CapsLock",
	"Fn",
	"FnLock",
	"Hyper",
	"Super",
	"OS",
]);

/** Chars that have a special meaning inside <...>. */
const NAMED: Record<string, string> = { "<": "lt", "\\": "Bslash", "|": "Bar", " ": "Space" };

export function translateKey(e: KeyLike, opts: KeyOptions): KeyAction {
	// Only a real text input composes dead keys (´ + a = á) and IME text.
	if (e.isComposing || e.key === "Dead" || e.key === "Process" || e.key === "Unidentified") return "text";
	if (MODIFIER_KEYS.has(e.key)) return "ignore";

	const special = SPECIAL[e.key];
	if (special) {
		return { send: `<${modifiers(e, true, true)}${special}>` };
	}

	// Not printable: a named key that Nvim does not have, for example "AudioVolumeUp".
	if ([...e.key].length !== 1) return "ignore";

	// Windows reports AltGr as Ctrl+Alt, but AltGr types a char (@ on Spanish layouts).
	if (e.ctrlKey && e.altKey && e.getModifierState("AltGraph")) return "text";

	const altAsMeta = e.altKey && opts.optionAsMeta;
	if (!e.ctrlKey && !e.metaKey && !altAsMeta) return "text";

	// With Option held, macOS changes e.key (Option+a = "å"), so use the physical key.
	const base = (altAsMeta && baseFromCode(e.code, e.shiftKey)) || e.key;
	// No S-: Shift is already in the char ("A", "?").
	return { send: `<${modifiers(e, altAsMeta, false)}${NAMED[base] ?? base}>` };
}

function modifiers(e: KeyLike, withAlt: boolean, withShift: boolean): string {
	let m = "";
	if (e.ctrlKey) m += "C-";
	if (withShift && e.shiftKey) m += "S-";
	if (withAlt && e.altKey) m += "M-";
	if (e.metaKey) m += "D-";
	return m;
}

function baseFromCode(code: string, shift: boolean): string | undefined {
	const letter = /^Key([A-Z])$/.exec(code)?.[1];
	if (letter) return shift ? letter : letter.toLowerCase();
	return shift ? undefined : /^Digit(\d)$/.exec(code)?.[1];
}

/** An Obsidian hotkey. Obsidian can save the physical key (`code`) instead of `key`. */
export interface SavedHotkey {
	modifiers: string[];
	key?: string;
	code?: string;
}

/** Obsidian hotkey → spec for matchesSpec. */
export function hotkeySpec(h: SavedHotkey): string {
	const key = h.code ? (baseFromCode(h.code, false) ?? h.code) : (h.key ?? "");
	return [...h.modifiers, key].join("+");
}

/** In nvim_input text, only "<" is special. */
export function escapeText(text: string): string {
	return text.replace(/</g, "<LT>");
}

/**
 * Spec examples: "Mod+P", "Ctrl+Shift+Tab". `Mod` is Cmd on macOS, Ctrl elsewhere.
 * A non-ASCII char (Cyrillic layout, Option+P = "π") matches by its physical key.
 */
export function matchesSpec(e: KeyLike, spec: string, isMac: boolean): boolean {
	const parts = spec.split("+").map((p) => p.trim().toLowerCase());
	const key = parts.pop();
	if (!key) return false;
	const want = { ctrl: false, alt: false, shift: false, meta: false };
	for (const p of parts) {
		if (p === "mod") want[isMac ? "meta" : "ctrl"] = true;
		else if (p === "ctrl") want.ctrl = true;
		else if (p === "alt" || p === "option") want.alt = true;
		else if (p === "shift") want.shift = true;
		else if (p === "cmd" || p === "meta") want.meta = true;
		else return false;
	}
	const pressed = /^[^\x20-\x7e]$/u.test(e.key) ? baseFromCode(e.code, false) : e.key;
	return (
		pressed?.toLowerCase() === key &&
		e.ctrlKey === want.ctrl &&
		e.altKey === want.alt &&
		e.shiftKey === want.shift &&
		e.metaKey === want.meta
	);
}
