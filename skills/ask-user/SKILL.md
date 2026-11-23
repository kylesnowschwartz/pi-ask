---
name: ask-user
description: "Use ask_user only when a decision that changes the work is not settled by the request, the code, or standing instructions; otherwise pick the sensible default, state it, and proceed."
metadata:
  short-description: Ask only when blocked
---

# Ask User when blocked

Use `ask_user` only when the request, the code, and the standing instructions do not settle a decision that changes the work. In every other case, choose the sensible default, state it, and proceed.

This skill covers how to ask well once a question is warranted. It is not for general chat.

## When to ask

Ask when all of these hold:

- the next step depends on a decision the user has not made
- the request, the code, docs, and standing instructions do not answer it
- a wrong guess is costly to undo, or changes the result enough that the user would want a say

Do not ask when:

- a sensible default exists and the choice is cheap to reverse; state the default and continue
- the question is a trivial formatting or style micro-decision
- the answer is available from code, docs, or tools you have not read yet
- standing instructions already tell you to proceed without pausing

When the user explicitly asks you to interview them, gather requirements, or scope research, asking is the task; use `ask_user` rather than a plain-text questionnaire.

## Handshake

1. Gather evidence first from code, docs, and tools.
2. Summarize neutral context: current state, constraints, trade-offs, and your recommendation.
3. Ask one focused `ask_user` decision, or bundle 2-3 closely related unresolved decisions into one call.
4. Restate the user's decision and proceed with it.
5. Re-open only for materially new ambiguity.

## Bundling and follow-ups

- When a prior answer narrows the branch, bundle the next 2-3 related unresolved decisions into one follow-up call.
- Use one-at-a-time follow-ups only when the next question depends on the previous answer.
- When a choice is still needed after an elaboration or follow-up note, ask another structured `ask_user` call rather than plain-text multiple choice.
- Plain-text questions are fine when the user asked for a written checklist, the question is rhetorical, or exactly one small factual clarification would be heavier as an interactive form.

## Question budget

- At most 1 `ask_user` call per decision boundary in normal cases.
- At most 2 calls for the same boundary if the first answer is unclear or cancelled.
- Never re-ask the same trade-off without new evidence.

The second attempt must be narrower and offer:

- `Proceed with recommended option`
- `Choose another option`
- `Stop for now`

After the second attempt:

- if the decision is costly to undo, stop as blocked until the user decides
- otherwise, if the user delegates ("your call"), proceed with the most reversible default and state the assumptions

## Payload quality

- Ask one concrete decision per question.
- Provide clear, distinct options with short, outcome-oriented labels. Do not add filler options.
- Include trade-off descriptions when they are not obvious.
- Choose the question `type` from the semantics: mutually exclusive answers are `single`, answers that can coexist are `multi`, and options that need preview-pane detail are `preview` with non-empty preview text on every option.
- Prefer non-`preview` questions when a free-form answer may be useful, since those include an internal `Type your own` option.
- Ask about goals, constraints, evaluation criteria, audience, budget, timeline, risk tolerance, or output format only when they materially affect the result.

## Guardrails

- Read available context before asking.
- Do not continue implementation after an unclear answer to a decision that is costly to undo.

## Conflict rule

If this skill conflicts with implementation behavior or tests, the project contract wins:

1. `docs/contract.md`
2. `tests/*.test.ts`
3. this skill
