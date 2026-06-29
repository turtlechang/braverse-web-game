---
name: braverse-workflow
description: Use when planning, splitting, delegating, validating, or preparing pre-commit review for Braverse project tasks, including rule, UI, AI, test, Git review, AGENTS.md, Skill, workflow, validation-level, or OpenCode Go handoff work.
---

# Braverse Workflow

Use this skill to keep Braverse work short, typed, and verifiable. Pair it with `develop-braverse` for implementation details; this skill focuses on task shape, delegation prompts, validation level, and commit readiness.

## Quick Start

1. Classify the task as one or more of: `rules`, `ui`, `ai`, `tests`, `git-review`, `docs-workflow`.
2. Fill the smallest useful task brief from [references/task-template.md](references/task-template.md).
3. Choose validation from [references/verification-levels.md](references/verification-levels.md).
4. If using OpenCode Go or subagents, use [references/delegation-template.md](references/delegation-template.md).
5. Before staging or committing, run [references/pre-commit-review.md](references/pre-commit-review.md).

## Load Only What You Need

- **New Braverse task or thread opener**: read `task-template.md`.
- **Validation decision**: read `verification-levels.md`.
- **OpenCode Go or subagent handoff**: read `delegation-template.md`, then load `../develop-braverse/references/delegation.md` only when model routing or sandbox handling details matter.
- **Commit preparation or diff review**: read `pre-commit-review.md`.

## Guardrails

- Keep root `AGENTS.md` as the hard-rule entrypoint.
- Do not weaken rule-engine, UI, AI, Git, or security boundaries from `AGENTS.md` and `develop-braverse`.
- Keep historical bug matrices and model tables in references or README status notes, not in every task prompt.
- Prefer short, fresh threads for focused Braverse work; include the task type, files, boundaries, and validation level up front.
