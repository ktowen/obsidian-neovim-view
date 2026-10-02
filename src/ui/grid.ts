/** Model of the Nvim screen (grid 1 of :h ui-linegrid). No DOM, so it is testable in Node. */

export interface HlAttr {
	foreground?: number;
	background?: number;
	special?: number;
	reverse?: boolean;
	italic?: boolean;
	bold?: boolean;
	strikethrough?: boolean;
	underline?: boolean;
	undercurl?: boolean;
	underdouble?: boolean;
	underdotted?: boolean;
	underdashed?: boolean;
}

export interface ModeInfo {
	cursor_shape?: "block" | "horizontal" | "vertical";
	cell_percentage?: number;
	attr_id?: number;
}

export interface Colors {
	fg: number;
	bg: number;
	sp: number;
}

export class Grid {
	cols = 0;
	rows = 0;
	/** Row-major. "" is the right half of a double-width char. */
	text: string[] = [];
	/** Highlight id of each cell, same index as `text`. */
	hl = new Uint32Array(0);
	dirty = new Set<number>();
	/** Colors or highlights changed: every row needs a repaint. */
	allDirty = false;

	hlTable = new Map<number, HlAttr>();
	colors: Colors = { fg: 0xffffff, bg: 0x000000, sp: 0xff0000 };
	cursor = { row: 0, col: 0 };
	modeInfo: ModeInfo[] = [];
	modeIdx = 0;
	busy = false;

	onFlush: () => void = () => undefined;
	onOption: (name: string, value: unknown) => void = () => undefined;

	get mode(): ModeInfo {
		return this.modeInfo[this.modeIdx] ?? {};
	}

	/** `events` are the params of one `redraw` notification: `[name, ...argTuples]` per event. */
	applyRedraw(events: unknown[]): void {
		for (const [name, ...tuples] of events as [string, ...unknown[][]][]) {
			for (const args of tuples) this.applyEvent(name, args);
		}
	}

	private applyEvent(name: string, a: unknown[]): void {
		switch (name) {
			case "grid_resize":
				this.resize(a[1] as number, a[2] as number);
				return;
			case "grid_clear":
				this.clear();
				return;
			case "grid_line":
				this.line(a[1] as number, a[2] as number, a[3] as [string, number?, number?][]);
				return;
			case "grid_scroll":
				// The last argument (cols) is always 0 (:h ui-event-grid_scroll).
				this.scroll(...(a.slice(1, 6) as [number, number, number, number, number]));
				return;
			case "grid_cursor_goto":
				this.markCursor();
				this.cursor = { row: a[1] as number, col: a[2] as number };
				this.markCursor();
				return;
			case "default_colors_set": {
				// -1 means "not set".
				const [fg, bg, sp] = a as number[];
				this.colors = {
					fg: fg !== undefined && fg >= 0 ? fg : 0xffffff,
					bg: bg !== undefined && bg >= 0 ? bg : 0x000000,
					sp: sp !== undefined && sp >= 0 ? sp : 0xff0000,
				};
				this.allDirty = true;
				return;
			}
			case "hl_attr_define":
				this.hlTable.set(a[0] as number, a[1] as HlAttr);
				this.allDirty = true;
				return;
			case "mode_info_set":
				this.modeInfo = a[1] as ModeInfo[];
				this.markCursor();
				return;
			case "mode_change":
				this.modeIdx = a[1] as number;
				this.markCursor();
				return;
			case "busy_start":
				this.busy = true;
				this.markCursor();
				return;
			case "busy_stop":
				this.busy = false;
				this.markCursor();
				return;
			case "option_set":
				this.onOption(a[0] as string, a[1]);
				return;
			case "flush":
				this.onFlush();
				return;
			// Other events are not used. :h ui says that UIs must ignore unknown events.
		}
	}

	private resize(cols: number, rows: number): void {
		const text = new Array<string>(cols * rows).fill(" ");
		const hl = new Uint32Array(cols * rows);
		for (let r = 0; r < Math.min(rows, this.rows); r++) {
			for (let c = 0; c < Math.min(cols, this.cols); c++) {
				text[r * cols + c] = this.text[r * this.cols + c]!;
				hl[r * cols + c] = this.hl[r * this.cols + c]!;
			}
		}
		this.cols = cols;
		this.rows = rows;
		this.text = text;
		this.hl = hl;
		this.allDirty = true;
	}

	private clear(): void {
		this.text.fill(" ");
		this.hl.fill(0);
		this.allDirty = true;
	}

	private line(row: number, colStart: number, cells: [string, number?, number?][]): void {
		if (row >= this.rows) return;
		let col = colStart;
		let hlId = 0;
		const base = row * this.cols;
		for (const cell of cells) {
			const [text, id, repeat = 1] = cell;
			// A missing hl_id means: the last one in this event.
			if (id !== undefined) hlId = id;
			for (let i = 0; i < repeat && col < this.cols; i++, col++) {
				this.text[base + col] = text;
				this.hl[base + col] = hlId;
			}
		}
		this.dirty.add(row);
	}

	/**
	 * Copy cells in the region [top, bot) x [left, right). rows > 0 moves content up, rows < 0 moves it down.
	 * The rows that the copy leaves behind keep old content: Nvim sends grid_line for them.
	 */
	private scroll(top: number, bot: number, left: number, right: number, rows: number): void {
		const copyRow = (dst: number, src: number) => {
			const d = dst * this.cols;
			const s = src * this.cols;
			for (let c = left; c < right; c++) {
				this.text[d + c] = this.text[s + c]!;
				this.hl[d + c] = this.hl[s + c]!;
			}
			this.dirty.add(dst);
		};
		// Copy order matters: the source rows must not be overwritten before they are read.
		if (rows > 0) {
			for (let r = top; r < bot - rows; r++) copyRow(r, r + rows);
		} else {
			for (let r = bot - 1; r >= top - rows; r--) copyRow(r, r + rows);
		}
	}

	private markCursor(): void {
		if (this.cursor.row < this.rows) this.dirty.add(this.cursor.row);
	}

	rowText(row: number): string {
		return this.text.slice(row * this.cols, (row + 1) * this.cols).join("");
	}

	/** Returns the rows to repaint, and resets them. */
	takeDirty(): number[] {
		const rows = this.allDirty ? [...Array(this.rows).keys()] : [...this.dirty];
		this.dirty.clear();
		this.allDirty = false;
		return rows;
	}
}
