import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAskConfig } from "../src/config/defaults.ts";
import { validateAskConfigFileV5 } from "../src/config/schema.ts";
import {
	completeOnIdleTimeout,
	createIdleTimer,
	formatIdleCountdown,
	idleTimeoutSeconds,
	nextIdleTimeout,
	normalizeIdleTimeout,
} from "../src/idle-timeout.ts";
import { renderResultText } from "../src/result.ts";
import { createInitialState } from "../src/state/create.ts";
import { summarizeResult, toAskResult } from "../src/state/result.ts";
import type { AskState } from "../src/types.ts";

function twoQuestionState(): AskState {
	return createInitialState({
		questions: [
			{
				id: "style",
				label: "Style",
				options: [
					{ label: "Rich", value: "rich" },
					{ label: "Plain", value: "plain" },
				],
				prompt: "Which style?",
				type: "single",
			},
			{
				id: "scope",
				label: "Scope",
				options: [{ label: "Small", value: "small" }],
				prompt: "Which scope?",
				type: "single",
			},
		],
	});
}

test("idle timeout config defaults to 60s and rejects unknown values", () => {
	assert.equal(normalizeAskConfig().behaviour.idleTimeout, "60s");
	assert.equal(normalizeIdleTimeout("5m"), "5m");
	assert.equal(normalizeIdleTimeout("never"), "never");
	assert.equal(normalizeIdleTimeout("2h"), "60s");
	assert.equal(normalizeIdleTimeout(300), "60s");
	assert.equal(
		validateAskConfigFileV5.Check({
			schemaVersion: 5,
			behaviour: { idleTimeout: 60 },
		}),
		true
	);
	assert.equal(
		normalizeAskConfig({ schemaVersion: 5, behaviour: { idleTimeout: "10m" } })
			.behaviour.idleTimeout,
		"10m"
	);
});

test("idle timeout values map to seconds and cycle in order", () => {
	assert.equal(idleTimeoutSeconds("60s"), 60);
	assert.equal(idleTimeoutSeconds("5m"), 300);
	assert.equal(idleTimeoutSeconds("10m"), 600);
	assert.equal(idleTimeoutSeconds("never"), undefined);
	assert.equal(nextIdleTimeout("60s"), "5m");
	assert.equal(nextIdleTimeout("never"), "60s");
});

test("idle countdown shows seconds, then minutes and seconds", () => {
	assert.equal(
		formatIdleCountdown(42),
		"Continues without an answer in 42s if idle"
	);
	assert.equal(
		formatIdleCountdown(299),
		"Continues without an answer in 4:59 if idle"
	);
});

test("idle timer fires once after the idle time and reports each second", (t) => {
	t.mock.timers.enable({ apis: ["setInterval"] });
	const ticks: number[] = [];
	let timeouts = 0;
	const timer = createIdleTimer({
		idleSeconds: 3,
		onTick: (remaining) => ticks.push(remaining),
		onTimeout: () => {
			timeouts += 1;
		},
	});

	t.mock.timers.tick(2000);
	assert.deepEqual(ticks, [2, 1]);
	assert.equal(timer.remainingSeconds(), 1);
	assert.equal(timeouts, 0);

	t.mock.timers.tick(10_000);
	assert.equal(timeouts, 1);
});

test("idle timer starts again from the full time on reset", (t) => {
	t.mock.timers.enable({ apis: ["setInterval"] });
	let timeouts = 0;
	const timer = createIdleTimer({
		idleSeconds: 3,
		onTick: () => undefined,
		onTimeout: () => {
			timeouts += 1;
		},
	});

	t.mock.timers.tick(2000);
	timer.reset();
	assert.equal(timer.remainingSeconds(), 3);
	t.mock.timers.tick(2000);
	assert.equal(timeouts, 0);
	t.mock.timers.tick(1000);
	assert.equal(timeouts, 1);
});

test("idle timer does not fire after dispose", (t) => {
	t.mock.timers.enable({ apis: ["setInterval"] });
	let timeouts = 0;
	const timer = createIdleTimer({
		idleSeconds: 2,
		onTick: () => undefined,
		onTimeout: () => {
			timeouts += 1;
		},
	});

	timer.dispose();
	t.mock.timers.tick(10_000);
	assert.equal(timeouts, 0);
});

test("idle timeout keeps selected answers and tells the model nobody answered", () => {
	const state: AskState = {
		...twoQuestionState(),
		answers: {
			style: { selected: [{ index: 1, label: "Rich", value: "rich" }] },
		},
	};

	const result = toAskResult(completeOnIdleTimeout(state, 60));

	assert.equal(result.cancelled, false);
	assert.equal(result.mode, "submit");
	assert.equal(result.idleTimeoutMs, 60_000);
	assert.deepEqual(Object.keys(result.answers), ["style"]);
	assert.equal(
		summarizeResult(result),
		[
			"Style: Rich",
			"Scope: (no answer)",
			"",
			"No response after 60s — the user may be away from keyboard. Proceed using your best judgment based on the context so far; you can re-ask this question later if it's still relevant.",
		].join("\n")
	);
	assert.equal(
		renderResultText(result),
		[
			"✓ Style: Rich",
			"? Scope: (no answer)",
			"No response after 60s; continued without an answer",
		].join("\n")
	);
});

test("idle timeout leaves a completed flow unchanged", () => {
	const submitted: AskState = { ...twoQuestionState(), completed: true };

	assert.equal(completeOnIdleTimeout(submitted, 60), submitted);
	assert.equal(toAskResult(submitted).idleTimeoutMs, undefined);
});
