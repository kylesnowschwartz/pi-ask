# Contributing

Thanks for contributing to `pi-ask`, a fork of [`@eko24ive/pi-ask`](https://github.com/eko24ive/pi-ask).

## Development setup

Install dependencies:

```bash
pnpm install
```

Run the extension locally:

```bash
pi -e ./src/index.ts
```

## Validation

Before sharing a change set, please run:

```bash
pnpm format
pnpm typecheck
pnpm test
```

You can also run the repo-wide check:

```bash
pnpm check
```

## Commit messages

This repo uses conventional commits and semantic-release.

Recommended flow:

```bash
pnpm commit
```

Examples:

- `feat: add preview question footer hint`
- `fix: preserve option notes when toggling selection`
- `docs: clarify npm install flow`

Conventional commit types matter because releases are generated automatically from commit history.

## Scope of changes

Please keep changes focused:

- state logic in plain TypeScript modules
- pi/TUI wiring thin
- tests updated when behavior changes materially
- docs updated when public behavior or usage changes materially

## Sharing changes

A useful issue with a linked fork should include:

- a clear summary of the change
- why the change matters
- tests for behavior changes
- docs updates when user-facing behavior changes
