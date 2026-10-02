import { expect, test } from "vitest";
import { parseGuifont } from "../src/ui/metrics";

const fallback = { family: '"JetBrainsMono NFM", monospace', size: 14 };

test("parseGuifont keeps the settings font as fallback for icons", () => {
	expect(parseGuifont("Fira_Code,Menlo:h16:b", fallback)).toEqual({
		family: '"Fira Code", "Menlo", "JetBrainsMono NFM", monospace',
		size: 16,
	});
});

test("parseGuifont: empty value", () => {
	expect(parseGuifont("", fallback)).toBeNull();
});
