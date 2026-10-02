import type { Grid, HlAttr } from "./grid";
import { cssFont, measureCell, type CellMetrics, type FontSpec } from "./metrics";

/** Paints the Grid on a canvas. Nvim owns the layout: each glyph goes at its cell, the font advance is never used. */
export class Renderer {
	cell: CellMetrics;
	focused = true;
	private ctx: CanvasRenderingContext2D;
	private dpr = 1;
	private frame = 0;
	/** The window of the pending frame. The canvas can move to a pop-out window. */
	private frameWin: Window = window;
	/** Grid size, pixel ratio and cell size of the last canvas resize. */
	private sizeKey = "";

	constructor(
		private canvas: HTMLCanvasElement,
		private grid: Grid,
		private font: FontSpec,
		private lineHeight: number,
	) {
		const ctx = canvas.getContext("2d", { alpha: false });
		if (!ctx) throw new Error("Canvas 2D is not available");
		this.ctx = ctx;
		this.cell = measureCell(ctx, font, lineHeight);
	}

	setFont(font: FontSpec): void {
		this.font = font;
		this.cell = measureCell(this.ctx, font, this.lineHeight);
	}

	/** Grid size that fits in `width` x `height` CSS pixels. */
	fit(width: number, height: number): { cols: number; rows: number } {
		return {
			cols: Math.max(1, Math.floor(width / this.cell.width)),
			rows: Math.max(1, Math.floor(height / this.cell.height)),
		};
	}

	resizeCanvas(): void {
		this.dpr = this.canvas.win.devicePixelRatio || 1;
		this.sizeKey = this.currentSizeKey();
		const w = this.grid.cols * this.cell.width;
		const h = this.grid.rows * this.cell.height;
		this.canvas.setCssStyles({ width: `${w}px`, height: `${h}px` });
		this.canvas.width = Math.ceil(w * this.dpr);
		this.canvas.height = Math.ceil(h * this.dpr);
		this.grid.allDirty = true;
	}

	schedule(): void {
		if (this.frame) return;
		this.frameWin = this.canvas.win;
		this.frame = this.frameWin.requestAnimationFrame(() => {
			this.frame = 0;
			this.paint();
		});
	}

	dispose(): void {
		if (this.frame) this.frameWin.cancelAnimationFrame(this.frame);
		this.frame = 0;
	}

	/** After a move to another window: the old window can close before it runs the pending frame. */
	moved(): void {
		this.dispose();
		this.resizeCanvas();
		this.schedule();
	}

	private paint(): void {
		// Also catches a window move to a display with another pixel ratio.
		if (this.sizeKey !== this.currentSizeKey()) this.resizeCanvas();
		this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
		this.ctx.textBaseline = "alphabetic";
		for (const row of this.grid.takeDirty()) this.paintRow(row);
		this.paintCursor();
	}

	private currentSizeKey(): string {
		return `${this.grid.cols}x${this.grid.rows}@${this.canvas.win.devicePixelRatio}/${this.cell.width}x${this.cell.height}`;
	}

	private paintRow(row: number): void {
		const g = this.grid;
		const { width: cw, height: ch } = this.cell;
		const y = row * ch;
		const base = row * g.cols;

		// All backgrounds first, so that a glyph wider than its cell is not cut by the next background.
		for (let col = 0; col < g.cols;) {
			const hl = g.hl[base + col] ?? 0;
			let end = col + 1;
			while (end < g.cols && g.hl[base + end] === hl) end++;
			this.ctx.fillStyle = hex(this.colorsFor(hl).bg);
			this.ctx.fillRect(col * cw, y, (end - col) * cw, ch);
			col = end;
		}

		this.ctx.save();
		this.ctx.beginPath();
		this.ctx.rect(0, y, g.cols * cw, ch);
		this.ctx.clip();
		for (let col = 0; col < g.cols; col++) {
			const hl = g.hl[base + col] ?? 0;
			this.drawGlyph(col, row, this.colorsFor(hl).fg);
			this.drawDecorations(col, row, g.hlTable.get(hl));
		}
		this.ctx.restore();
	}

	private drawGlyph(col: number, row: number, fg: number): void {
		const idx = row * this.grid.cols + col;
		const text = this.grid.text[idx];
		if (!text || text === " ") return;
		const attr = this.grid.hlTable.get(this.grid.hl[idx] ?? 0);
		const { width: cw, height: ch, baseline } = this.cell;
		this.ctx.font = cssFont(this.font, !!attr?.bold, !!attr?.italic);
		this.ctx.fillStyle = hex(fg);
		// maxWidth squeezes fallback glyphs that are wider than the cells Nvim gave them.
		this.ctx.fillText(text, col * cw, row * ch + baseline, this.cellSpan(idx) * cw * 1.2);
	}

	/** 2 for a double-width char, else 1. */
	private cellSpan(idx: number): number {
		return this.grid.text[idx + 1] === "" ? 2 : 1;
	}

	private drawDecorations(col: number, row: number, a: HlAttr | undefined): void {
		if (!a) return;
		const { width: cw, height: ch, baseline } = this.cell;
		const x = col * cw;
		const y = row * ch;
		const sp = hex(a.special ?? this.grid.colors.sp);
		const ctx = this.ctx;
		const line = (yy: number, color: string, dash: number[] = []) => {
			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			ctx.setLineDash(dash);
			ctx.beginPath();
			ctx.moveTo(x, yy + 0.5);
			ctx.lineTo(x + cw, yy + 0.5);
			ctx.stroke();
			ctx.setLineDash([]);
		};
		const under = y + baseline + 2;
		if (a.underline) line(under, sp);
		if (a.underdouble) {
			line(under, sp);
			line(under + 2, sp);
		}
		if (a.underdotted) line(under, sp, [1, 2]);
		if (a.underdashed) line(under, sp, [3, 2]);
		if (a.undercurl) {
			ctx.strokeStyle = sp;
			ctx.beginPath();
			for (let i = 0; i <= cw; i += 1) ctx.lineTo(x + i, under + Math.sin((i / cw) * Math.PI * 2) * 1.5);
			ctx.stroke();
		}
		if (a.strikethrough) line(y + ch / 2, hex(a.foreground ?? this.grid.colors.fg));
	}

	private paintCursor(): void {
		const g = this.grid;
		const { row, col } = g.cursor;
		if (g.busy || row >= g.rows || col >= g.cols) return;
		const { width: cw, height: ch } = this.cell;
		const mode = g.mode;
		const shape = mode.cursor_shape ?? "block";
		const pct = (mode.cell_percentage ?? 100) / 100;
		const idx = row * g.cols + col;
		const w = this.cellSpan(idx) * cw;
		const x = col * cw;
		const y = row * ch;

		const cellColors = this.colorsFor(g.hl[idx] ?? 0);
		// attr_id 0 means: swap the cell colors (:h ui-global).
		const cursorColors = mode.attr_id ? this.colorsFor(mode.attr_id) : { fg: cellColors.bg, bg: cellColors.fg };

		const ctx = this.ctx;
		if (!this.focused) {
			ctx.strokeStyle = hex(cursorColors.bg);
			ctx.lineWidth = 1;
			ctx.strokeRect(x + 0.5, y + 0.5, w - 1, ch - 1);
			return;
		}
		ctx.fillStyle = hex(cursorColors.bg);
		if (shape === "vertical") ctx.fillRect(x, y, Math.max(1, w * pct), ch);
		else if (shape === "horizontal") ctx.fillRect(x, y + ch - Math.max(1, ch * pct), w, Math.max(1, ch * pct));
		else {
			ctx.fillRect(x, y, w, ch);
			this.drawGlyph(col, row, cursorColors.fg);
		}
		// Repaint this row next frame, so that the cursor is removed when it moves.
		g.dirty.add(row);
	}

	private colorsFor(hl: number): { fg: number; bg: number } {
		const a = this.grid.hlTable.get(hl);
		const d = this.grid.colors;
		const fg = a?.foreground ?? d.fg;
		const bg = a?.background ?? d.bg;
		return a?.reverse ? { fg: bg, bg: fg } : { fg, bg };
	}
}

function hex(n: number): string {
	return `#${n.toString(16).padStart(6, "0")}`;
}
