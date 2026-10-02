export interface FontSpec {
	family: string;
	size: number;
}

export interface CellMetrics {
	width: number;
	height: number;
	baseline: number;
}

export function measureCell(ctx: CanvasRenderingContext2D, font: FontSpec, lineHeight: number): CellMetrics {
	ctx.font = cssFont(font, false, false);
	const m = ctx.measureText("M");
	const ascent = m.fontBoundingBoxAscent;
	const descent = m.fontBoundingBoxDescent;
	const height = Math.ceil((ascent + descent) * lineHeight);
	// Extra line height is split above and below the text.
	return { width: m.width, height, baseline: Math.round((height - ascent - descent) / 2 + ascent) };
}

export function cssFont(f: FontSpec, bold: boolean, italic: boolean): string {
	return `${italic ? "italic " : ""}${bold ? "bold " : ""}${f.size}px ${f.family}`;
}

/** Parses 'guifont' ("JetBrains_Mono,Menlo:h14"). `fallback` stays last in the family list, so its icons still render. */
export function parseGuifont(value: string, fallback: FontSpec): FontSpec | null {
	if (!value) return null;
	const [names = "", ...opts] = value.split(":");
	let size = fallback.size;
	for (const o of opts) {
		const h = /^h(\d+(?:\.\d+)?)$/.exec(o);
		if (h?.[1]) size = parseFloat(h[1]);
	}
	const families = names
		.split(",")
		.map((n) => n.trim().replace(/_/g, " "))
		.filter(Boolean)
		.map((n) => `"${n}"`);
	return { family: [...families, fallback.family].join(", "), size };
}
