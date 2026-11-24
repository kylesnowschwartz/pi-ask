import assert from "node:assert/strict";
import test from "node:test";
import askExtension from "../src/index.ts";

const noop = () => undefined;

test("before_agent_start appends the tagged configuration line", async () => {
	const handlers: Record<string, (event: unknown) => unknown> = {};
	askExtension({
		appendEntry: noop,
		events: { emit: noop, on: () => noop },
		on(name: string, handler: (event: unknown) => unknown) {
			handlers[name] = handler;
		},
		registerCommand: noop,
		registerMessageRenderer: noop,
		registerTool: noop,
	} as never);

	const result = (await handlers.before_agent_start({
		systemPrompt: "base",
	})) as { systemPrompt: string };

	assert(result.systemPrompt.startsWith("base\n\n<pi_ask>\n"));
	assert(result.systemPrompt.endsWith("\n</pi_ask>"));
	assert(result.systemPrompt.includes("docs/configuration.md"));
});
