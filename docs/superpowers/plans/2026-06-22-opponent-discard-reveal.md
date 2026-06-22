# Opponent Discard Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The user has explicitly disabled delegation.

**Goal:** Display every card the AI discards due to an opponent-hand-discard effect in one confirmation modal before continuing the game.

**Architecture:** The rules engine remains authoritative for card movement. The AI decision captures the selected cards as `revealedCards`; the existing AI confirmation pause holds the resulting state until App renders a focused multi-card modal and the player confirms.

**Tech Stack:** TypeScript, React, Vitest, React DOM server rendering.

---

### Task 1: Expose discarded cards from the AI decision

**Files:**
- Modify: `src/game/ai/types.ts`
- Modify: `src/game/ai/pending-handler.ts`
- Test: `src/game/ai-opponent-discard.test.ts`

- [ ] Add a failing assertion that an AI opponent-discard decision returns all discarded cards in `revealedCards`.
- [ ] Run `npm.cmd test -- src/game/ai-opponent-discard.test.ts` and confirm the new assertion fails because `revealedCards` is absent.
- [ ] Add `revealedCards?: GameCard[]` to `AiDecision`; capture the selected hand cards before applying `resolve-opponent-hand-discard` and return them on the decision.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Render all discarded cards in one modal

**Files:**
- Modify: `src/components/modals/GameModals.tsx`
- Modify: `src/components/modals/GameModals.test.tsx`
- Modify: `src/App.tsx`

- [ ] Add a failing server-render test for `DiscardRevealModal` with two cards, asserting both names, the title, and the confirmation label are present.
- [ ] Run `npm.cmd test -- src/components/modals/GameModals.test.tsx` and confirm the missing component causes failure.
- [ ] Implement `DiscardRevealModal` with semantic dialog markup, stable card instance keys, existing `CardFace` presentation, and one confirmation button.
- [ ] Render it from App when `pendingAiDecision.revealedCards` is non-empty and call `confirmAiDecision` on confirmation; retain the existing single-card modal for trap and FLIP decisions.
- [ ] Re-run the modal test and confirm it passes.

### Task 3: Pause AI state until the reveal is confirmed

**Files:**
- Modify: `src/hooks/useAiTurn.ts`
- Modify: `src/hooks/useAiTurn.test.tsx`

- [ ] Add a failing hook test whose AI discard decision contains `revealedCards`, asserting `setGame` is not called before confirmation and is called with the decision state after `confirmAiDecision`.
- [ ] Run `npm.cmd test -- src/hooks/useAiTurn.test.tsx` and confirm the pre-confirmation state assertion fails.
- [ ] Treat either `revealedCard` or a non-empty `revealedCards` list as a reveal decision and update the waiting message without duplicating game rules.
- [ ] Re-run the hook test and confirm it passes.

### Task 4: Synchronize documentation and verify

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] Update the verified test count and note that effect-driven AI discards are publicly shown in one multi-card window.
- [ ] Run `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run build`; require zero failures.
- [ ] Run `npm.cmd run test:ai:browser`; report the exact result and distinguish the recorded 1920×1080 baseline assertion if it remains.
- [ ] Run `git diff --check` and inspect only the intended diff. Do not commit unless the user requests it.
