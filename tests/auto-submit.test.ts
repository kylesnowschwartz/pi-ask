import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ASK_CONFIG } from "../src/config/defaults.ts";
import type { AskConfig } from "../src/config/schema.ts";
import { getAskConfigStore } from "../src/config/store.ts";
import { createInitialState } from "../src/state/create.ts";
import { saveNote } from "../src/state/transitions.ts";
import type { AskState } from "../src/types.ts";
import { maybeAutoSubmitState } from "../src/ui/auto-submit.ts";
import { runAskFlow } from "../src/ui/controller.ts";

const enabledConfig: AskConfig = {
	...DEFAULT_ASK_CONFIG,
	behaviour: {
		...DEFAULT_ASK_CONFIG.behaviour,
		autoSubmitWhenAnsweredWithoutNotes: true,
	},
};

const disabledConfig: AskConfig = {
	...DEFAULT_ASK_CONFIG,
	behaviour: {
		...DEFAULT_ASK_CONFIG.behaviour,
		autoSubmitWhenAnsweredWithoutNotes: false,
	},
};

function answeredSubmitState(): AskState {
	return {
		...createInitialState({
			questions: [
				{
					id: "q1",
					label: "Q1",
					options: [{ label: "Option A", value: "a" }],
					prompt: "Pick one",
					required: false,
					type: "single",
				},
			],
		}),
		activeTabIndex: 1,
		answers: {
			q1: {
				selected: [{ index: 1, label: "Option A", value: "a" }],
			},
		},
		view: { kind: "submit" },
	};
}

test("auto submit completes answered submit-tab state when enabled", () => {
	const state = maybeAutoSubmitState(answeredSubmitState(), enabledConfig);

	assert.equal(state.completed, true);
	assert.equal(state.mode, "submit");
});

test("auto submit does nothing when disabled", () => {
	const state = maybeAutoSubmitState(answeredSubmitState(), disabledConfig);

	assert.equal(state.completed, false);
});

test("auto submit does not trigger when notes exist", () => {
	const stateWithNote = saveNote(
		{ ...answeredSubmitState(), view: { kind: "note", questionId: "q1" } },
		"Need more detail"
	);
	const submitState: AskState = {
		...stateWithNote,
		activeTabIndex: 1,
		view: { kind: "submit" },
	};
	const state = maybeAutoSubmitState(submitState, enabledConfig);

	assert.equal(state.completed, false);
});

test("auto submit finishes a flow answered with number keys only", async () => {
	getAskConfigStore().setConfig({
		...enabledConfig,
		notifications: { ...enabledConfig.notifications, enabled: false },
	});
	let component: { handleInput(data: string): void } | undefined;
	const resultPromise = runAskFlow(
		{
			cwd: process.cwd(),
			mode: "tui",
			ui: {
				custom(callback: (...args: unknown[]) => unknown) {
					return new Promise((resolve) => {
						const tui = {
							requestRender() {
								// Rendering is not needed for this input test.
							},
						};
						const theme = {
							bg: (_color: string, text: string) => text,
							fg: (_color: string, text: string) => text,
						};
						component = callback(tui, theme, {}, resolve) as typeof component;
					});
				},
			},
		} as never,
		{
			questions: [
				{
					id: "a",
					label: "A",
					options: [{ label: "X", value: "x" }],
					prompt: "A?",
					type: "single",
				},
				{
					id: "b",
					label: "B",
					options: [{ label: "Y", value: "y" }],
					prompt: "B?",
					type: "single",
				},
			],
		}
	);
	await new Promise((resolve) => setImmediate(resolve));

	component?.handleInput("1");
	component?.handleInput("1");
	const result = await Promise.race([
		resultPromise,
		new Promise<undefined>((resolve) => setImmediate(() => resolve(undefined))),
	]);
	getAskConfigStore().setConfig(DEFAULT_ASK_CONFIG);

	assert.deepEqual(result?.answers.a?.values, ["x"]);
	assert.deepEqual(result?.answers.b?.values, ["y"]);
	assert.equal(result?.cancelled, false);
});
