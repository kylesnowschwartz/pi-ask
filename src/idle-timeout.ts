import type { AskState } from "./types.ts";

export const IDLE_TIMEOUT_VALUES = ["60s", "5m", "10m", "never"] as const;
export type AskIdleTimeout = (typeof IDLE_TIMEOUT_VALUES)[number];
export const DEFAULT_IDLE_TIMEOUT: AskIdleTimeout = "60s";

const IDLE_TIMEOUT_SECONDS: Record<AskIdleTimeout, number | undefined> = {
	"60s": 60,
	"5m": 300,
	"10m": 600,
	never: undefined,
};
const TICK_MS = 1000;
const SECONDS_PER_MINUTE = 60;

export function normalizeIdleTimeout(value: unknown): AskIdleTimeout {
	return IDLE_TIMEOUT_VALUES.includes(value as AskIdleTimeout)
		? (value as AskIdleTimeout)
		: DEFAULT_IDLE_TIMEOUT;
}

export function nextIdleTimeout(value: AskIdleTimeout): AskIdleTimeout {
	const index = IDLE_TIMEOUT_VALUES.indexOf(value);
	return IDLE_TIMEOUT_VALUES[(index + 1) % IDLE_TIMEOUT_VALUES.length];
}

/** Idle seconds before the flow continues by itself; undefined means it waits forever. */
export function idleTimeoutSeconds(value: AskIdleTimeout): number | undefined {
	return IDLE_TIMEOUT_SECONDS[value];
}

/** Completes the flow with the answers selected so far and records that nobody answered. */
export function completeOnIdleTimeout(
	state: AskState,
	idleSeconds: number
): AskState {
	if (state.completed) {
		return state;
	}
	return {
		...state,
		cancelled: false,
		completed: true,
		idleTimeoutMs: idleSeconds * TICK_MS,
		mode: "submit",
	};
}

/** Text for the model: the user did not answer, so it decides with what it has. */
export function formatIdleTimeoutInstruction(idleTimeoutMs: number): string {
	return `No response after ${Math.round(idleTimeoutMs / TICK_MS)}s — the user may be away from keyboard. Proceed using your best judgment based on the context so far; you can re-ask this question later if it's still relevant.`;
}

/** Text for the transcript row of the tool result. */
export function formatIdleTimeoutResultLine(idleTimeoutMs: number): string {
	return `No response after ${Math.round(idleTimeoutMs / TICK_MS)}s; continued without an answer`;
}

export function formatIdleCountdown(remainingSeconds: number): string {
	const minutes = Math.floor(remainingSeconds / SECONDS_PER_MINUTE);
	const seconds = remainingSeconds % SECONDS_PER_MINUTE;
	const remaining =
		minutes > 0
			? `${minutes}:${String(seconds).padStart(2, "0")}`
			: `${seconds}s`;
	return `Continues without an answer in ${remaining} if idle`;
}

export interface IdleTimer {
	dispose(): void;
	remainingSeconds(): number;
	/** Starts the count again from the full idle time. */
	reset(): void;
}

/**
 * Counts idle seconds with one repeating tick. The count and the timeout come
 * from the same ticks, so the displayed seconds always match when it fires.
 */
export function createIdleTimer(options: {
	idleSeconds: number;
	onTick: (remainingSeconds: number) => void;
	onTimeout: () => void;
}): IdleTimer {
	let remaining = options.idleSeconds;
	let interval: ReturnType<typeof setInterval> | undefined = setInterval(() => {
		remaining -= 1;
		if (remaining > 0) {
			options.onTick(remaining);
			return;
		}
		dispose();
		options.onTimeout();
	}, TICK_MS);
	interval.unref?.();

	function dispose() {
		if (interval) {
			clearInterval(interval);
			interval = undefined;
		}
	}

	return {
		dispose,
		remainingSeconds: () => remaining,
		reset() {
			remaining = options.idleSeconds;
		},
	};
}
