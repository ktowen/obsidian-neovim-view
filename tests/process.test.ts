import { expect, test } from "vitest";
import { findShell } from "../src/process";

const only =
	(...paths: string[]) =>
	(p: string) =>
		paths.includes(p);

test("findShell: $SHELL first", () => {
	expect(findShell({ SHELL: "/usr/bin/fish", PATH: "/bin" }, only("/bin/zsh"))).toBe("/usr/bin/fish");
});

test("findShell: zsh, then bash, then sh", () => {
	const env = { PATH: "/a:/b" };
	expect(findShell(env, only("/b/zsh", "/a/bash", "/a/sh"))).toBe("/b/zsh");
	expect(findShell(env, only("/a/bash", "/a/sh"))).toBe("/a/bash");
	expect(findShell(env, only("/a/sh"))).toBe("/a/sh");
});

test("findShell: standard folders when PATH is short", () => {
	expect(findShell({ PATH: "/usr/bin:/bin" }, only("/opt/homebrew/bin/zsh"))).toBe("/opt/homebrew/bin/zsh");
	expect(findShell({}, only("/bin/bash"))).toBe("/bin/bash");
});

test("findShell: /bin/sh when nothing is found", () => {
	expect(findShell({}, () => false)).toBe("/bin/sh");
});
