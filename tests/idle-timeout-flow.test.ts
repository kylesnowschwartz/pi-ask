import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { DEFAULT_ASK_CONFIG } from "../src/config/defaults.ts";
import type { AskConfig } from "../src/config/schema.ts";
import { getAskConfigStore } from "../src/config/store.ts";
import type { AskIdleTimeout } from "../src/idle-timeout.ts";
import type { AskResult } from "../src/types.ts";
import { runAskFlow } from "../src/ui/controller.ts";

interface FlowComponent {
	dispose(): void;
	handleInput(data: string): void;
	render(width: number): string[];
}

function configWithIdleTimeout(idleTimeout: AskIdleTimeout): AskConfig {
	return {
		...DEFAULT_ASK_CONFIG,
		behaviour: { ...DEFAULT_ASK_CONFIG.behaviour, idleTimeout },
		notifications: { ...DEFAULT_ASK_CONFIG.notifications, enabled: false },
	};
}

function plainTheme() {
	return {
		bg: (_color: string, text: string) => text,
		bold: (text: string) => text,
		fg: (_color: string, text: string) => text,
	};
}

async function openFlow(
	t: TestContext,
	options: { continueWhenIdle: boolean; idleTimeout: AskIdleTimeout }
) {
	t.mock.timers.enable({ apis: ["setInterval"] });
	getAskConfigStore().setConfig(configWithIdleTimeout(options.idleTimeout));
	t.after(() => getAskConfigStore().setConfig(DEFAULT_ASK_CONFIG));

	let component: FlowComponent | undefined;
	let result: AskResult | undefined;
	let doneCalls = 0;
	runAskFlow(
		{
			cwd: process.cwd(),
			mode: "tui",
			ui: {
				custom(callback: (...args: unknown[]) => unknown) {
					return new Promise((resolve) => {
						const tui = {
							requestRender() {
								// Rendering is read directly through component.render.
							},
						};
						component = callback(tui, plainTheme(), {}, (value: unknown) => {
							doneCalls += 1;
							resolve(value);
						}) as FlowComponent;
					});
				},
			},
		} as never,
		{
			questions: [
				{
					id: "q1",
					label: "Pick",
					prompt: "Question?",
					type: "multi",
					options: [
						{ value: "a", label: "A" },
						{ value: "b", label: "B" },
					],
				},
			],
		},
		{ continueWhenIdle: options.continueWhenIdle }
	).then((value) => {
		result = value;
	});
	await new Promise((resolve) => setImmediate(resolve));
	assert(component);
	t.after(() => component?.dispose());

	return {
		component,
		doneCalls: () => doneCalls,
		async result() {
			await new Promise((resolve) => setImmediate(resolve));
			return result;
		},
	};
}

test("an idle tool flow continues once with the answers selected so far", async (t) => {
	const flow = await openFlow(t, {
		continueWhenIdle: true,
		idleTimeout: "60s",
	});
	assert(
		flow.component
			.render(80)
			.join("\n")
			.includes("Continues without an answer in 1:00 if idle")
	);

	flow.component.handleInput(" ");
	t.mock.timers.tick(59_000);
	assert.equal(await flow.result(), undefined);
	assert(flow.component.render(80).join("\n").includes("in 1s if idle"));

	t.mock.timers.tick(120_000);
	const result = await flow.result();
	assert.equal(result?.idleTimeoutMs, 60_000);
	assert.equal(result?.cancelled, false);
	assert.deepEqual(result?.answers.q1?.values, ["a"]);
	assert.equal(flow.doneCalls(), 1);
});

test("a key press starts the idle time again", async (t) => {
	const flow = await openFlow(t, {
		continueWhenIdle: true,
		idleTimeout: "60s",
	});

	t.mock.timers.tick(50_000);
	flow.component.handleInput("\u001b[B");
	t.mock.timers.tick(50_000);
	assert.equal(await flow.result(), undefined);

	t.mock.timers.tick(10_000);
	assert.equal((await flow.result())?.idleTimeoutMs, 60_000);
});

test("an answered flow does not continue a second time", async (t) => {
	const flow = await openFlow(t, {
		continueWhenIdle: true,
		idleTimeout: "60s",
	});

	flow.component.handleInput("\u0003");
	t.mock.timers.tick(120_000);

	const result = await flow.result();
	assert.equal(result?.cancelled, true);
	assert.equal(result?.idleTimeoutMs, undefined);
	assert.equal(flow.doneCalls(), 1);
});

test("the never setting waits without a countdown", async (t) => {
	const flow = await openFlow(t, {
		continueWhenIdle: true,
		idleTimeout: "never",
	});

	t.mock.timers.tick(3_600_000);

	assert.equal(await flow.result(), undefined);
	assert.equal(flow.component.render(80).join("\n").includes("if idle"), false);
});

test("a flow that the user started waits without a countdown", async (t) => {
	const flow = await openFlow(t, {
		continueWhenIdle: false,
		idleTimeout: "60s",
	});

	t.mock.timers.tick(3_600_000);

	assert.equal(await flow.result(), undefined);
	assert.equal(flow.component.render(80).join("\n").includes("if idle"), false);
});

test("a changed setting applies to the open flow", async (t) => {
	const flow = await openFlow(t, {
		continueWhenIdle: true,
		idleTimeout: "60s",
	});

	getAskConfigStore().setConfig(configWithIdleTimeout("never"));
	t.mock.timers.tick(3_600_000);
	assert.equal(await flow.result(), undefined);

	getAskConfigStore().setConfig(configWithIdleTimeout("5m"));
	t.mock.timers.tick(300_000);
	assert.equal((await flow.result())?.idleTimeoutMs, 300_000);
});
