import { Decoder, Encoder } from "@msgpack/msgpack";
import type { Readable, Writable } from "stream";

const REQUEST = 0;
const RESPONSE = 1;
const NOTIFICATION = 2;

interface Pending {
	resolve: (v: unknown) => void;
	reject: (e: Error) => void;
}
export type NotificationHandler = (method: string, params: unknown[]) => void;

/** Minimal msgpack-RPC client for the Neovim API (:h msgpack-rpc). */
export class RpcClient {
	private nextId = 1;
	private pending = new Map<number, Pending>();
	private encoder = new Encoder();
	private handlers: NotificationHandler[] = [];
	/** Nvim ended, or close() was called. */
	closed = false;

	constructor(
		private input: Readable,
		private output: Writable,
	) {
		// A write after Nvim exits fails with EPIPE. Without a listener, that is an uncaught error.
		output.on("error", () => {
			this.close();
		});
		void this.readLoop();
	}

	onNotification(handler: NotificationHandler): void {
		this.handlers.push(handler);
	}

	request<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
		if (this.closed) return Promise.reject(new Error("RPC channel closed"));
		const id = this.nextId++;
		return new Promise<T>((resolve, reject) => {
			this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
			this.write([REQUEST, id, method, params]);
		});
	}

	notify(method: string, params: unknown[] = []): void {
		if (!this.closed) this.write([NOTIFICATION, method, params]);
	}

	close(): void {
		if (this.closed) return;
		this.closed = true;
		for (const p of this.pending.values()) p.reject(new Error("RPC channel closed"));
		this.pending.clear();
	}

	private write(msg: unknown[]): void {
		this.output.write(this.encoder.encode(msg));
	}

	private async readLoop(): Promise<void> {
		try {
			for await (const msg of new Decoder().decodeStream(this.input as AsyncIterable<Uint8Array>)) {
				this.dispatch(msg as unknown[]);
			}
		} catch (e) {
			console.error("Neovim View: RPC decode error", e);
		}
		this.close();
	}

	private dispatch(msg: unknown[]): void {
		switch (msg[0]) {
			case RESPONSE: {
				const [, id, err, result] = msg as [number, number, unknown, unknown];
				const p = this.pending.get(id);
				if (!p) return;
				this.pending.delete(id);
				if (err != null) p.reject(new Error(formatError(err)));
				else p.resolve(result);
				return;
			}
			case NOTIFICATION: {
				const [, method, params] = msg as [number, string, unknown[]];
				for (const h of this.handlers) h(method, params);
				return;
			}
			case REQUEST: {
				// We expose no methods, but Nvim blocks until it gets an answer.
				const [, id, method] = msg as [number, number, string];
				this.write([RESPONSE, id, `obsidian-neovim-view: unknown method ${method}`, null]);
				return;
			}
		}
	}
}

/** Nvim errors are [type, message]. */
function formatError(err: unknown): string {
	if (Array.isArray(err) && typeof err[1] === "string") return err[1];
	return JSON.stringify(err);
}
