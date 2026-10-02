import { homedir } from "os";

export interface ExtraArgs {
	env: Record<string, string>;
	args: string[];
}

/**
 * Parse the "Extra arguments" setting like a shell: quotes, backslash escapes, leading `~/`.
 * Leading `NAME=value` words are environment variables (`NVIM_APPNAME=nvim-obsidian -u x.lua`).
 * No variable expansion or globbing.
 */
export function parseExtraArgs(input: string, home = homedir()): ExtraArgs {
	const words = splitWords(input);
	const env: Record<string, string> = {};
	let i = 0;
	for (; i < words.length; i++) {
		const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s.exec(words[i]!.text);
		if (!m) break;
		env[m[1]!] = expandHome(m[2]!, home);
	}
	const args = words.slice(i).map((w) => (w.quotedStart ? w.text : expandHome(w.text, home)));
	return { env, args };
}

function expandHome(s: string, home: string): string {
	return s === "~" || s.startsWith("~/") ? home + s.slice(1) : s;
}

interface Word {
	text: string;
	/** The word starts with a quote, so `~` is literal, as in a shell. */
	quotedStart: boolean;
}

function splitWords(input: string): Word[] {
	const words: Word[] = [];
	let cur: Word | null = null;
	let quote: "'" | '"' | null = null;
	const start = (quoted: boolean) => (cur ??= { text: "", quotedStart: quoted });

	for (let i = 0; i < input.length; i++) {
		const ch = input[i]!;
		if (quote === "'") {
			if (ch === "'") quote = null;
			else cur!.text += ch;
		} else if (quote === '"') {
			if (ch === '"') quote = null;
			else if (ch === "\\" && i + 1 < input.length && '"\\$`'.includes(input[i + 1]!)) cur!.text += input[++i];
			else cur!.text += ch;
		} else if (ch === "'" || ch === '"') {
			start(true);
			quote = ch;
		} else if (ch === "\\") {
			start(false).text += input[++i] ?? "";
		} else if (/\s/.test(ch)) {
			if (cur) words.push(cur);
			cur = null;
		} else {
			start(false).text += ch;
		}
	}
	if (quote) throw new Error(`Unclosed ${quote} in extra arguments`);
	if (cur) words.push(cur);
	return words;
}
