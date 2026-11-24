import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

interface InventoryRecord {
	characters: number;
	text: string;
}

interface Inventory {
	records: InventoryRecord[];
}

interface LintResult {
	findings: { message: string; rule: string; severity: string }[];
}

interface PromptLintModule {
	collectInventory(
		entries: string[],
		options: { cwd?: string }
	): Promise<Inventory>;
	compareSnapshot(
		inventory: Inventory,
		snapshotPath: string,
		update?: boolean
	): Promise<{ diff: string }>;
	lintInventory(inventory: Inventory, options: { budget?: number }): LintResult;
}

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT_PATH = resolve(
	PACKAGE_DIR,
	"tests",
	"prompt-lint.snapshot.json"
);
const SNAPSHOT_PACKAGE_DIR = "<pi-ask>";
const UPDATE_SNAPSHOT = process.env.PI_PROMPT_LINT_UPDATE === "1";
const VIEWER_DIR = resolve(
	process.env.PI_SYSTEM_PROMPT_VIEWER_DIR ??
		resolve(PACKAGE_DIR, "..", "pi-system-prompt-viewer")
);
const LINT_MODULE = resolve(VIEWER_DIR, "src", "lint", "index.ts");
const VIEWER_PI_PACKAGE = resolve(
	VIEWER_DIR,
	"node_modules",
	"@earendil-works",
	"pi-coding-agent"
);

// Measured always-on total is 2286 characters; the budget leaves about 10% headroom.
const ALWAYS_ON_BUDGET = 2500;

const linterAvailable =
	existsSync(LINT_MODULE) && existsSync(VIEWER_PI_PACKAGE);
const SKIP_MESSAGE = `prompt linter not resolvable: needs a pi-system-prompt-viewer checkout with installed dependencies at ${VIEWER_DIR} (set PI_SYSTEM_PROMPT_VIEWER_DIR to use another checkout)`;

// The system prompt line names this package's absolute docs path, so the
// snapshot swaps the package directory for a fixed placeholder.
function portableInventory(inventory: Inventory): Inventory {
	return {
		...inventory,
		records: inventory.records.map((record) => {
			const text = record.text.replaceAll(PACKAGE_DIR, SNAPSHOT_PACKAGE_DIR);
			return { ...record, text, characters: text.length };
		}),
	};
}

test("always-on prompt text stays within budget and matches the snapshot", {
	skip: linterAvailable ? false : SKIP_MESSAGE,
}, async () => {
	const linter = (await import(
		pathToFileURL(LINT_MODULE).href
	)) as PromptLintModule;
	const inventory = await linter.collectInventory([PACKAGE_DIR], {
		cwd: PACKAGE_DIR,
	});

	const result = linter.lintInventory(inventory, {
		budget: ALWAYS_ON_BUDGET,
	});
	const errors = result.findings.filter(
		(finding) => finding.severity === "error"
	);
	assert.deepEqual(errors, []);

	const { diff } = await linter.compareSnapshot(
		portableInventory(inventory),
		SNAPSHOT_PATH,
		UPDATE_SNAPSHOT
	);
	assert.equal(
		diff,
		"",
		`prompt text differs from ${SNAPSHOT_PATH}; rerun with PI_PROMPT_LINT_UPDATE=1 to accept\n${diff}`
	);
});
