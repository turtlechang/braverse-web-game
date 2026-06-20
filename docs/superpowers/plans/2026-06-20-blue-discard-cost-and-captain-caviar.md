# BLUE Discard Costs and Captain Caviar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, and follow the repository develop-braverse skill plus AGENTS.md.

**Goal:** Implement ST4-012 Werewolf Cookie (activate skill with discardHand cost) and ST4-013 Captain Caviar Cookie (inspect-deck OnPlay + optional-cost-attack attackEffect). All generic types only in rules/UI; card-number-specific mapping only in `src/cards/`.

**Architecture:** Pure game engine (`src/game/`) → React hooks → React UI. State changes via `src/game/` pure functions only. UI reads `PendingDecision`/`getPendingDecision` and sends `GameCommand`/`applyGameCommand`. Never modify `GameState` directly from React.

**Tech Stack:** TypeScript 5.x (strict), React 18+, Vite 5+, Vitest (unit tests), Playwright (browser E2E).

---

## TDD RULES (strict, no exceptions)

1. Every product code change MUST be preceded by a test that **fails** because the behavior is missing.
2. Run the test → confirm **RED** (expected failure).
3. Write **minimal** implementation to pass.
4. Run the test → confirm **GREEN**.
5. Do NOT write implementation code before its test exists and is red.
6. Each task lists its exact test file, test name, and implementation file/function.
7. After ALL tasks: `npm test && npm run lint && npm run build && npm run test:ai:browser`.
8. End with `git diff --stat` only. Never commit.

---

## Phase 1: Types (`src/game/types.ts`)

### Task 1.1 — Add `InspectDeckEffect`, `OptionalCostAttackEffect` to `CardEffect` union

**Test file:** None needed (pure type addition; `npx tsc --noEmit` serves as the gate).

**File:** `src/game/types.ts`

Insert after `SetActiveEffect` (line 219):

```typescript
export interface InspectDeckEffect {
  kind: 'inspect-deck'
  lookCount: number
  pickCount: number
  restToBottom: true
}

export interface OptionalCostAttackEffect {
  kind: 'optional-cost-attack'
  cost: AbilityCost
  effects: CardEffect[]
  effectText: string
}
```

Extend `CardEffect` union (line 255) to add `| InspectDeckEffect | OptionalCostAttackEffect` after `SetActiveEffect`.

**Verify:** `npx tsc --noEmit` passes.

---

### Task 1.2 — Add `pendingInspectDeck`, `pendingOptionalCostAttack` to `GameState`

**File:** `src/game/types.ts`

Add after `pendingOpponentHandDiscard` (line 410):

```typescript
  pendingInspectDeck?: {
    playerId: PlayerId
    sourceInstanceId: string
    sourceCardName: string
    revealedCards: GameCard[]
    lookCount: number
    pickCount: number
  } | null
  pendingOptionalCostAttack?: {
    playerId: PlayerId
    sourceInstanceId: string
    sourceCardName: string
    cost: AbilityCost
    effects: CardEffect[]
    effectText: string
  } | null
```

**Verify:** `npx tsc --noEmit` passes.

---

## Phase 2: Official Adapter Layer (`src/cards/`)

### Task 2.1 — Test: ST4-013 OnPlay is `inspect-deck`, ST4-012 skill has discardHand cost

**Test file:** `src/game/starter-deck.test.ts`

Add two tests (RED initially):

```typescript
it('ST4-013 Captain Caviar OnPlay is inspect-deck effect', () => {
  const deck = createOfficialBlueStarterDeck('player-one')
  const caviar = deck.find((card) => card.id === 'ST4-013')
  expect(caviar).toBeDefined()
  expect(caviar!.skill).toBeDefined()
  expect(caviar!.skill!.trigger).toBe('on-play')
  expect(caviar!.skill!.effects).toEqual([
    { kind: 'inspect-deck', lookCount: 3, pickCount: 1, restToBottom: true },
  ])
})

it('ST4-012 Werewolf Cookie skill has discardHand cost and modify-attack effect', () => {
  const deck = createOfficialBlueStarterDeck('player-one')
  const werewolf = deck.find((card) => card.id === 'ST4-012')
  expect(werewolf).toBeDefined()
  expect(werewolf!.skill).toBeDefined()
  expect(werewolf!.skill!.trigger).toBe('activate')
  expect(werewolf!.skill!.oncePerTurn).toBe(true)
  expect(werewolf!.skill!.yourTurn).toBe(false)
  expect(werewolf!.skill!.restSource).toBe(false)
  expect(werewolf!.skill!.cost).toEqual({ energy: {}, discardHand: 1 })
  expect(werewolf!.skill!.effects).toEqual([
    {
      kind: 'modify-attack',
      amount: 1,
      duration: 'this-turn',
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    },
  ])
})
```

Run: `npm test -- --run src/game/starter-deck.test.ts` → **RED**.

---

### Task 2.2 — Update ST4-013 exactStarterEffects, add ST4-013 attackEffects hardcoding

**File:** `src/cards/official-effect-adapter.ts`

Change line 244 from:
```typescript
    'ST4-013': [{ kind: 'draw', amount: 1 }],
```
to:
```typescript
    'ST4-013': [
      { kind: 'inspect-deck', lookCount: 3, pickCount: 1, restToBottom: true },
    ],
```

**File:** `src/cards/official-card-adapter.ts`

In `convertOfficialCardToGameCard`, before the `const gameCard: GameCard = {` line (line 96), add hardcoded attackEffects map for ST4-013:

```typescript
  const hardcodedAttackEffects: Partial<Record<string, CardEffect[]>> = {
    'ST4-013': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 1, max: 1 },
          },
        ],
        effectText:
          'Discard 2 cards from your hand to deal 1 damage to 1 opponent cookie.',
      },
    ],
  }
  const resolvedAttackEffects = hardcodedAttackEffects[card.cardNumber]
```

Then in the cookie gameCard construction (after `attackText: card.attackText ?? undefined,`), add:
```typescript
      ...(resolvedAttackEffects ? { attackEffects: resolvedAttackEffects } : {}),
```

Also add the import for `CardEffect` at the top of `official-card-adapter.ts` (line 1 currently imports `GameCard` only; add `CardEffect`):
```typescript
import type { CardEffect, GameCard } from '../game'
```

**Verify:** `npm test -- --run src/game/starter-deck.test.ts` → **GREEN** (ST4-013 OnPlay test passes, ST4-012 test still RED — ST4-012 autoparses, may be green already if parseAbilityCost handles it).

---

### Task 2.3 — Ensure ST4-012 autoparses correctly (no hardcoding needed)

ST4-012's skill text `{mob} {t1} 《Discard 1 card.》 During this turn, this Cookie gains +1 attack damage.` autoparses through:
- `parseAbilityCost`: `《Discard 1 card.》` → `discardHand: 1`, `energy: {}`
- `convertOfficialCardEffects`: strips brackets/markers → `"During this turn, this Cookie gains +1 attack damage."` → `modify-attack` via `increaseMatch`
- `convertOfficialCookieSkill`: trigger=`activate`, oncePerTurn=`true`, yourTurn=`false`, restSource=`false`

If the ST4-012 test from Task 2.1 is **RED**, confirm the bracket text uses `《》` (U+300A/U+300B) and `parseAbilityCost`'s regex covers it. The regex `/(?:<|《)\s*Discard\s+(\d+)\s+card(?:s)?\.\s*(?:>|》)/i` handles both `<`/`>` and `《`/`》`.

If still RED, add to `exactStarterEffects`:
```typescript
    'ST4-012': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
```
Then in `convertOfficialCookieSkill`, before `return { ... }` (line 981), add a guard that also handles the exactStarterEffects case for skill (reuse the existing `exactStarterEffects` map).

**Verify:** `npm test -- --run src/game/starter-deck.test.ts` → **GREEN** (both tests pass).

Also re-run full test suite after this Phase:
```powershell
npm test -- --run
```
Confirm only the two new starter-deck tests were red and are now green; no regressions.

---

## Phase 3: Skills — discardHand Cost (`src/game/skills.ts`)

### Task 3.1 (RED) — `canActivateCookieSkill` rejects insufficient hand

**Test file:** `src/game/skills.test.ts`

Add test:

```typescript
describe('activate skill with discardHand cost', () => {
  it('rejects when hand has fewer cards than discardHand cost', () => {
    const state = createDemoGame()
    const player = state.players['player-one']
    // First, arrange: ensure hand has 0 cards
    const stateWithEmptyHand: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-one': { ...player, hand: [] },
      },
    }
    // Give the battle area cookie a skill with discardHand: 1
    const source = stateWithEmptyHand.players['player-one'].battleArea[0]
    const modifiedSource: GameState = {
      ...stateWithEmptyHand,
      players: {
        ...stateWithEmptyHand.players,
        'player-one': {
          ...stateWithEmptyHand.players['player-one'],
          battleArea: stateWithEmptyHand.players['player-one'].battleArea.map((c) =>
            c.card.instanceId === source.card.instanceId
              ? {
                  ...c,
                  card: {
                    ...c.card,
                    skill: {
                      trigger: 'activate' as const,
                      oncePerTurn: false,
                      yourTurn: false,
                      restSource: false,
                      cost: { energy: {}, discardHand: 1 },
                      text: 'test',
                      effects: [],
                    },
                  },
                }
              : c,
          ),
        },
      },
    }
    // Now hand has 0 cards, cost requires discardHand: 1
    const battleSource = modifiedSource.players['player-one'].battleArea[0]
    expect(
      canActivateCookieSkill(
        modifiedSource,
        'player-one',
        battleSource.card.instanceId,
        'activate',
      ),
    ).toBe(false)
  })

  it('allows when hand has enough cards for discardHand cost', () => {
    const state = createDemoGame()
    const player = state.players['player-one']
    // Keep existing hand cards, verify >= 1
    expect(player.hand.length).toBeGreaterThanOrEqual(1)
    const source = player.battleArea[0]
    const modifiedSource: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          battleArea: player.battleArea.map((c) =>
            c.card.instanceId === source.card.instanceId
              ? {
                  ...c,
                  card: {
                    ...c.card,
                    skill: {
                      trigger: 'activate' as const,
                      oncePerTurn: false,
                      yourTurn: false,
                      restSource: false,
                      cost: { energy: {}, discardHand: 0 },
                      text: 'test',
                      effects: [],
                    },
                  },
                }
              : c,
          ),
        },
      },
    }
    expect(
      canActivateCookieSkill(
        modifiedSource,
        'player-one',
        source.card.instanceId,
        'activate',
      ),
    ).toBe(true)
  })
})
```

Run: `npm test -- --run src/game/skills.test.ts` → **RED** (hand length check not yet implemented).

---

### Task 3.1 (GREEN) — Add hand length check to `canActivateCookieSkill`

**File:** `src/game/skills.ts`, in `canActivateCookieSkill` (after the `restSource` check at line 113, and before `const energyPayment = selectEnergyPayment(`):

```typescript
  if (skill.cost.discardHand > 0 && player.hand.length < skill.cost.discardHand) {
    return false
  }
```

Run: `npm test -- --run src/game/skills.test.ts` → **GREEN**.

---

### Task 3.2 (RED) — `activateCookieSkill` accepts + validates `discardHandIds`

**Test file:** `src/game/skills.test.ts`

Add tests:

```typescript
it('discards specified hand cards when paying discardHand cost', () => {
  const state = createDemoGame()
  const player = state.players['player-one']
  const source = player.battleArea[0]
  const handCardToDiscard = player.hand[0]
  const modifiedState: GameState = {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...player,
        battleArea: player.battleArea.map((c) =>
          c.card.instanceId === source.card.instanceId
            ? {
                ...c,
                card: {
                  ...c.card,
                  skill: {
                    trigger: 'activate' as const,
                    oncePerTurn: false,
                    yourTurn: false,
                    restSource: false,
                    cost: { energy: {}, discardHand: 1 },
                    text: 'test',
                    effects: [{ kind: 'draw', amount: 1 }],
                  },
                },
              }
            : c,
        ),
      },
    },
  }
  const result = activateCookieSkill(
    modifiedState,
    'player-one',
    source.card.instanceId,
    'activate',
    [],
    [],
    [handCardToDiscard.instanceId],
  )
  expect(result.players['player-one'].hand.map((c) => c.instanceId)).not.toContain(
    handCardToDiscard.instanceId,
  )
  expect(result.players['player-one'].discardPile.map((c) => c.instanceId)).toContain(
    handCardToDiscard.instanceId,
  )
})

it('rejects wrong discardHand count', () => {
  const state = createDemoGame()
  const player = state.players['player-one']
  const source = player.battleArea[0]
  const modifiedState: GameState = {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...player,
        battleArea: player.battleArea.map((c) =>
          c.card.instanceId === source.card.instanceId
            ? {
                ...c,
                card: {
                  ...c.card,
                  skill: {
                    trigger: 'activate' as const,
                    oncePerTurn: false,
                    yourTurn: false,
                    restSource: false,
                    cost: { energy: {}, discardHand: 2 },
                    text: 'test',
                    effects: [{ kind: 'draw', amount: 1 }],
                  },
                },
              }
            : c,
        ),
      },
    },
  }
  expect(() =>
    activateCookieSkill(
      modifiedState,
      'player-one',
      source.card.instanceId,
      'activate',
      [],
      [],
      [player.hand[0].instanceId],
    ),
  ).toThrow('必須棄置 2 張手牌作為技能代價')
})

it('rejects discardHandIds not in hand', () => {
  const state = createDemoGame()
  const player = state.players['player-one']
  const source = player.battleArea[0]
  const modifiedState: GameState = {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...player,
        battleArea: player.battleArea.map((c) =>
          c.card.instanceId === source.card.instanceId
            ? {
                ...c,
                card: {
                  ...c.card,
                  skill: {
                    trigger: 'activate' as const,
                    oncePerTurn: false,
                    yourTurn: false,
                    restSource: false,
                    cost: { energy: {}, discardHand: 1 },
                    text: 'test',
                    effects: [{ kind: 'draw', amount: 1 }],
                  },
                },
              }
            : c,
        ),
      },
    },
  }
  expect(() =>
    activateCookieSkill(
      modifiedState,
      'player-one',
      source.card.instanceId,
      'activate',
      [],
      [],
      ['non-existent-id'],
    ),
  ).toThrow('只能選擇自己的手牌作為代價')
})

it('rejects discardHandIds when cost does not require discardHand', () => {
  const state = createDemoGame()
  const player = state.players['player-one']
  const source = player.battleArea[0]
  const modifiedState: GameState = {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...player,
        battleArea: player.battleArea.map((c) =>
          c.card.instanceId === source.card.instanceId
            ? {
                ...c,
                card: {
                  ...c.card,
                  skill: {
                    trigger: 'activate' as const,
                    oncePerTurn: false,
                    yourTurn: false,
                    restSource: false,
                    cost: { energy: {}, discardHand: 0 },
                    text: 'test',
                    effects: [{ kind: 'draw', amount: 1 }],
                  },
                },
              }
            : c,
        ),
      },
    },
  }
  expect(() =>
    activateCookieSkill(
      modifiedState,
      'player-one',
      source.card.instanceId,
      'activate',
      [],
      [],
      [player.hand[0].instanceId],
    ),
  ).toThrow('此技能不需要棄手牌代價')
})
```

Run: `npm test -- --run src/game/skills.test.ts` → **RED** (function signature doesn't accept discardHandIds yet).

---

### Task 3.2 (GREEN) — Extend `activateCookieSkill` signature + logic

**File:** `src/game/skills.ts`

Change function signature (line 129) to:
```typescript
export const activateCookieSkill = (
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  trigger: SkillTrigger,
  paymentIds: string[],
  costSupportToTrashIds: string[] = [],
  discardHandIds: string[] = [],
): GameState => {
```

After `validatePayment` call (line 152) and before `const cost = source.card.skill.cost`, add discardHand validation:

```typescript
  const uniqueDiscardHandIds = [...new Set(discardHandIds)]
  if (uniqueDiscardHandIds.length !== discardHandIds.length) {
    throw new GameRuleError('不能重複選擇同一張手牌作為代價。')
  }
```

After the `costSupportToTrashIds` validation block (line 157–173), add:

```typescript
  if (cost.discardHand > 0) {
    if (uniqueDiscardHandIds.length !== cost.discardHand) {
      throw new GameRuleError(
        `必須棄置 ${cost.discardHand} 張手牌作為技能代價。`,
      )
    }
    const allInHand = uniqueDiscardHandIds.every((id) =>
      player.hand.some((card) => card.instanceId === id),
    )
    if (!allInHand) {
      throw new GameRuleError('只能選擇自己的手牌作為代價。')
    }
  } else if (uniqueDiscardHandIds.length > 0) {
    throw new GameRuleError('此技能不需要棄手牌代價。')
  }
```

In the return statement (line 189), add discarded hand cards to discardPile and filter from hand:

```typescript
  const discardedCards = player.hand.filter((card) =>
    uniqueDiscardHandIds.includes(card.instanceId),
  )
```

Then in the return object, change the hand and discardPile for the player:

```typescript
        hand: player.hand.filter(
          (card) => !uniqueDiscardHandIds.includes(card.instanceId),
        ),
        // ...
        discardPile: [
          ...player.discardPile,
          ...trashedCards.map((support) => support.card),
          ...discardedCards,
        ],
```

Run: `npm test -- --run src/game/skills.test.ts` → **GREEN**.

Run full suite: `npm test -- --run` to check no regressions.

---

## Phase 4: Battle — optional-cost-attack (`src/game/battle.ts`)

### Task 4.1 (RED) — Tests for `resolveAttackEffect` + `resolveOptionalCostAttack`

**Test file:** Create new file `src/game/battle-optional-cost-attack.test.ts`

```typescript
import { describe, expect, it } from 'vitest'
import {
  resolveAttackEffect,
  resolveOptionalCostAttack,
  skipTrap,
  resolveNextDamage,
} from './battle'
import { createBattleState, declareAttack } from './test-helpers/battle-helpers'
import type { GameCard } from './types'

const cookie = (id: string): GameCard => ({
  id,
  instanceId: `${id}-instance`,
  name: id,
  type: 'cookie',
  level: 1,
  hp: 1,
  attack: 0,
  attackCost: 0,
})

describe('optional-cost-attack', () => {
  it('skips automatically when attacker hand has insufficient cards for discard cost', () => {
    let state = createBattleState()
    state.players['player-two'].hand = []
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'test',
      },
    ]
    state = skipTrap(declareAttack(state), 'player-one')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    expect(state.pendingBattle!.stage).toBe('attack-effect')
    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.pendingBattle).toBeNull()
  })

  it('creates pendingOptionalCostAttack when hand has enough cards', () => {
    let state = createBattleState()
    const hc1 = cookie('hc1')
    const hc2 = cookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } },
        ],
        effectText: 'test',
      },
    ]
    state = skipTrap(declareAttack(state), 'player-one')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    expect(state.pendingBattle!.stage).toBe('attack-effect')
    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeDefined()
    expect(state.pendingOptionalCostAttack!.cost.discardHand).toBe(2)
  })

  it('skip action clears pending and finishes battle', () => {
    let state = createBattleState()
    state.players['player-two'].hand = [cookie('hc1'), cookie('hc2')]
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'test',
      },
    ]
    state = skipTrap(declareAttack(state), 'player-one')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeDefined()
    state = resolveOptionalCostAttack(state, 'player-two', 'skip')
    expect(state.pendingOptionalCostAttack).toBeNull()
    expect(state.pendingBattle).toBeNull()
  })

  it('pay action discards hand and deals damage', () => {
    let state = createBattleState()
    const hc1 = cookie('hc1')
    const hc2 = cookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } },
        ],
        effectText: 'test',
      },
    ]
    state = skipTrap(declareAttack(state), 'player-one')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeDefined()
    const targetId = state.players['player-one'].battleArea[0].card.instanceId
    state = resolveOptionalCostAttack(state, 'player-two', 'pay', [hc1.instanceId, hc2.instanceId], [targetId])
    expect(state.pendingOptionalCostAttack).toBeNull()
    expect(state.players['player-two'].hand).toHaveLength(0)
    expect(state.players['player-two'].discardPile.map((c) => c.instanceId)).toEqual(
      expect.arrayContaining([hc1.instanceId, hc2.instanceId]),
    )
    expect(state.pendingBattle).toBeNull()
  })

  it('rejects pay with wrong discard count', () => {
    let state = createBattleState()
    state.players['player-two'].hand = [cookie('hc1'), cookie('hc2')]
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'test',
      },
    ]
    state = skipTrap(declareAttack(state), 'player-one')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveAttackEffect(state, 'player-two', [])
    expect(() =>
      resolveOptionalCostAttack(state, 'player-two', 'pay', [cookie('hc1').instanceId], []),
    ).toThrow('必須棄置 2 張手牌作為代價')
  })
})
```

Run: `npm test -- --run src/game/battle-optional-cost-attack.test.ts` → **RED** (resolveAttackEffect doesn't handle optional-cost-attack; resolveOptionalCostAttack doesn't exist).

---

### Task 4.1 (GREEN) — Extend `resolveAttackEffect` + add `resolveOptionalCostAttack`

**File:** `src/game/battle.ts`

In `resolveAttackEffect` (line 660), after fetching the effect (line 673), add optional-cost-attack guard before `executeCardEffect`:

```typescript
  if (effect.kind === 'optional-cost-attack') {
    const attackerHand = state.players[playerId].hand
    const discardCost = effect.cost.discardHand
    if (attackerHand.length < discardCost) {
      const nextIndex = battle.attackEffectIndex + 1
      if (nextIndex < battle.attackEffects.length) {
        return {
          ...state,
          pendingBattle: { ...battle, attackEffectIndex: nextIndex, stage: 'attack-effect' },
        }
      }
      return finishBattle({ ...state, pendingBattle: { ...battle, attackEffectIndex: nextIndex } })
    }
    const sourceCard = state.players[playerId].battleArea.find(
      (c) => c.card.instanceId === battle.attackerInstanceId,
    )?.card
    return {
      ...state,
      pendingOptionalCostAttack: {
        playerId,
        sourceInstanceId: battle.attackerInstanceId,
        sourceCardName: sourceCard?.name ?? 'Unknown',
        cost: effect.cost,
        effects: effect.effects,
        effectText: effect.effectText,
      },
    }
  }
```

Add after `resolveAttackEffect` (line 711):

```typescript
export const resolveOptionalCostAttack = (
  state: GameState,
  playerId: PlayerId,
  action: 'skip' | 'pay',
  discardCardIds: string[] = [],
  targetIds: string[] = [],
): GameState => {
  const pending = state.pendingOptionalCostAttack
  if (!pending || pending.playerId !== playerId) {
    throw new GameRuleError('目前沒有待處理的攻擊後續可選代價效果。')
  }
  if (action === 'skip') {
    const battle = requirePendingBattle(state)
    const nextIndex = battle.attackEffectIndex + 1
    const clearedState: GameState = { ...state, pendingOptionalCostAttack: null }
    if (nextIndex < battle.attackEffects.length) {
      return { ...clearedState, pendingBattle: { ...battle, attackEffectIndex: nextIndex, stage: 'attack-effect' } }
    }
    return finishBattle({ ...clearedState, pendingBattle: { ...battle, attackEffectIndex: nextIndex } })
  }
  const player = state.players[playerId]
  const uniqueDiscardIds = [...new Set(discardCardIds)]
  if (uniqueDiscardIds.length !== pending.cost.discardHand) {
    throw new GameRuleError(`必須棄置 ${pending.cost.discardHand} 張手牌作為代價。`)
  }
  const allInHand = uniqueDiscardIds.every((id) => player.hand.some((card) => card.instanceId === id))
  if (!allInHand) {
    throw new GameRuleError('只能選擇自己的手牌作為代價。')
  }
  const discardedCards = player.hand.filter((card) => uniqueDiscardIds.includes(card.instanceId))
  let nextState: GameState = {
    ...state,
    pendingOptionalCostAttack: null,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hand: player.hand.filter((card) => !uniqueDiscardIds.includes(card.instanceId)),
        discardPile: [...player.discardPile, ...discardedCards],
      },
    },
  }
  const context = { sourcePlayerId: playerId, sourceInstanceId: pending.sourceInstanceId }
  for (const effect of pending.effects) {
    if (nextState.status !== 'playing') break
    nextState = executeCardEffect(nextState, context, effect, targetIds)
  }
  if (nextState.status !== 'playing') {
    return { ...nextState, pendingBattle: null }
  }
  const battle = requirePendingBattle(nextState)
  const nextIndex = battle.attackEffectIndex + 1
  if (nextIndex < battle.attackEffects.length) {
    return { ...nextState, pendingBattle: { ...battle, attackEffectIndex: nextIndex, stage: 'attack-effect' } }
  }
  return finishBattle({ ...nextState, pendingBattle: { ...battle, attackEffectIndex: nextIndex } })
}
```

Also update `resolveBattleAutomatically` (line 973) to handle optional-cost-attack when it encounters attack-effect stage: if `effect.kind === 'optional-cost-attack'`, just skip it (AI auto-skip for auto-resolve):

In `resolveBattleAutomatically`, the attack-effect block (line 1011) should add:
```typescript
      if (effect?.kind === 'optional-cost-attack') {
        // Auto-skip in automatic resolve
        nextState = resolveAttackEffect(nextState, battle.attackerPlayerId, [])
        continue
      }
```
(Actually, `resolveAttackEffect` already handles optional-cost-attack auto-skip when hand insufficient; if hand is sufficient, it creates a pending. For auto-resolve, we'll handle it differently in AI — see Phase 7.)

Run: `npm test -- --run src/game/battle-optional-cost-attack.test.ts` → **GREEN**.

---

## Phase 5: Inspect-Deck Module (`src/game/inspect-deck.ts`)

### Task 5.1 (RED) — Tests for inspect-deck effect

**Test file:** Create `src/game/inspect-deck.test.ts`

```typescript
import { describe, expect, it } from 'vitest'
import { executeCardEffect, resolveInspectDeck } from './effects'
import { createDemoGame } from './demo'
import type { GameState, GameCard } from './types'
import { getRefreshCandidates } from './refresh'
import { finishWithDefeat } from './victory'

const testCookie = (id: string, level = 1): GameCard => ({
  id,
  instanceId: `${id}-inst`,
  name: id,
  type: 'cookie',
  level,
  hp: 1,
  attack: 0,
  attackCost: 0,
})

describe('inspect-deck', () => {
  it('reveals top N cards and creates pendingInspectDeck', () => {
    const state = createDemoGame()
    const player = state.players['player-one']
    const deckCards = player.deck.slice(0, 3)
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'test-source' }
    const result = executeCardEffect(state, context, {
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 1,
      restToBottom: true,
    }, [])
    expect(result.pendingInspectDeck).toBeDefined()
    expect(result.pendingInspectDeck!.revealedCards).toHaveLength(3)
    expect(result.pendingInspectDeck!.revealedCards.map((c) => c.instanceId)).toEqual(
      deckCards.map((c) => c.instanceId),
    )
    expect(result.pendingInspectDeck!.lookCount).toBe(3)
    expect(result.pendingInspectDeck!.pickCount).toBe(1)
    // Top 3 cards removed from deck
    expect(result.players['player-one'].deck.length).toBe(player.deck.length - 3)
  })

  it('picks one card to hand, returns rest to bottom in specified order', () => {
    const state = createDemoGame()
    const player = state.players['player-one']
    const deckCards = player.deck.slice(0, 3)
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'test-source' }
    const withPending = executeCardEffect(state, context, {
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 1,
      restToBottom: true,
    }, [])
    const pending = withPending.pendingInspectDeck!
    const pickedId = pending.revealedCards[0].instanceId
    const restOrder = [pending.revealedCards[2].instanceId, pending.revealedCards[1].instanceId]
    const result = resolveInspectDeck(withPending, 'player-one', pickedId, restOrder)
    expect(result.pendingInspectDeck).toBeNull()
    expect(result.players['player-one'].hand.map((c) => c.instanceId)).toContain(pickedId)
    // Rest cards at bottom of deck in specified order
    const bottomCards = result.players['player-one'].deck.slice(-2)
    expect(bottomCards[0].instanceId).toBe(restOrder[0])
    expect(bottomCards[1].instanceId).toBe(restOrder[1])
  })

  it('rejects duplicate IDs in pickedCardId + restOrder', () => {
    const state = createDemoGame()
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'test-source' }
    const withPending = executeCardEffect(state, context, {
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 1,
      restToBottom: true,
    }, [])
    const pending = withPending.pendingInspectDeck!
    const pickedId = pending.revealedCards[0].instanceId
    expect(() =>
      resolveInspectDeck(withPending, 'player-one', pickedId, [pickedId, pending.revealedCards[1].instanceId]),
    ).toThrow('不能重複選取同一張卡牌')
  })

  it('rejects if restOrder does not cover all non-picked cards', () => {
    const state = createDemoGame()
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'test-source' }
    const withPending = executeCardEffect(state, context, {
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 1,
      restToBottom: true,
    }, [])
    const pending = withPending.pendingInspectDeck!
    const pickedId = pending.revealedCards[0].instanceId
    expect(() =>
      resolveInspectDeck(withPending, 'player-one', pickedId, [pending.revealedCards[1].instanceId]),
    ).toThrow('剩餘牌順序必須包含所有未選取的檢視卡牌')
  })

  it('rejects if pickedCardId is not in revealedCards', () => {
    const state = createDemoGame()
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'test-source' }
    const withPending = executeCardEffect(state, context, {
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 1,
      restToBottom: true,
    }, [])
    expect(() =>
      resolveInspectDeck(withPending, 'player-one', 'non-existent', ['a', 'b']),
    ).toThrow('選取的卡牌不在檢視清單中')
  })

  it('triggers refresh when deck has insufficient cards, then continues after refresh', () => {
    let state = createDemoGame()
    const player = state.players['player-one']
    // Empty deck except 1 card, set discardPile with LV1+ cookie for refresh
    const existingCards = player.deck.slice(0, 1)
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          deck: existingCards,
          discardPile: [testCookie('lv1-cookie', 1), ...player.discardPile],
        },
      },
    }
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'test-source' }
    const result = executeCardEffect(state, context, {
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 1,
      restToBottom: true,
    }, [])
    // Should have pendingRefresh AND pendingInspectDeck
    expect(result.pendingRefresh).toBeDefined()
    expect(result.pendingRefresh!.remainingDraws).toBe(0)
    expect(result.pendingInspectDeck).toBeDefined()
    expect(result.pendingInspectDeck!.revealedCards).toHaveLength(1)
  })

  it('triggers defeat when deck is empty and no refresh candidates', () => {
    let state = createDemoGame()
    const player = state.players['player-one']
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          deck: [],
          discardPile: [],
        },
      },
    }
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'test-source' }
    const result = executeCardEffect(state, context, {
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 1,
      restToBottom: true,
    }, [])
    expect(result.status).toBe('finished')
    expect(result.result?.loserId).toBe('player-one')
    expect(result.result?.reason).toBe('refresh-unavailable')
  })
})
```

Run: `npm test -- --run src/game/inspect-deck.test.ts` → **RED** (inspect-deck not implemented in executeCardEffect; resolveInspectDeck doesn't exist).

---

### Task 5.2 (GREEN) — Implement `executeCardEffect` inspect-deck case + `resolveInspectDeck`

**File:** `src/game/effects.ts`

Add import:
```typescript
import { continueInspectDeckAfterRefresh } from './inspect-deck'
```

In `executeCardEffect`, before the final generic targeted effect block (line 797), add new case:

```typescript
  if (effect.kind === 'inspect-deck') {
    const player = state.players[context.sourcePlayerId]
    const deckCards = player.deck.slice(0, effect.lookCount)
    const remainingDeck = player.deck.slice(effect.lookCount)
    const updatedPlayer = { ...player, deck: remainingDeck }
    let nextState = updatePlayer(state, updatedPlayer)

    if (deckCards.length < effect.lookCount && !nextState.pendingRefresh) {
      const candidates = getRefreshCandidates(nextState, context.sourcePlayerId)
      if (candidates.length === 0) {
        return finishWithDefeat(nextState, context.sourcePlayerId, 'refresh-unavailable')
      }
      return {
        ...nextState,
        pendingRefresh: { playerId: context.sourcePlayerId, remainingDraws: 0 },
        pendingInspectDeck: {
          playerId: context.sourcePlayerId,
          sourceInstanceId: context.sourceInstanceId,
          sourceCardName:
            state.players[context.sourcePlayerId].battleArea.find(
              (c) => c.card.instanceId === context.sourceInstanceId,
            )?.card.name ?? 'Unknown',
          revealedCards: deckCards,
          lookCount: effect.lookCount,
          pickCount: effect.pickCount,
        },
      }
    }

    return {
      ...nextState,
      pendingInspectDeck: {
        playerId: context.sourcePlayerId,
        sourceInstanceId: context.sourceInstanceId,
        sourceCardName:
          state.players[context.sourcePlayerId].battleArea.find(
            (c) => c.card.instanceId === context.sourceInstanceId,
          )?.card.name ?? 'Unknown',
        revealedCards: deckCards,
        lookCount: effect.lookCount,
        pickCount: effect.pickCount,
      },
    }
  }
```

Add `resolveInspectDeck` at end of `effects.ts`:

```typescript
export const resolveInspectDeck = (
  state: GameState,
  playerId: PlayerId,
  pickedCardId: string,
  restOrder: string[],
): GameState => {
  const pending = state.pendingInspectDeck
  if (!pending || pending.playerId !== playerId) {
    throw new GameRuleError('目前沒有待處理的牌庫檢視效果。')
  }
  const revealedIds = pending.revealedCards.map((c) => c.instanceId)
  const pickedCard = pending.revealedCards.find((c) => c.instanceId === pickedCardId)
  if (!pickedCard) {
    throw new GameRuleError('選取的卡牌不在檢視清單中。')
  }
  const allIds = [pickedCardId, ...restOrder]
  if (new Set(allIds).size !== allIds.length) {
    throw new GameRuleError('不能重複選取同一張卡牌。')
  }
  if (allIds.length !== revealedIds.length) {
    throw new GameRuleError('必須涵蓋所有檢視的卡牌。')
  }
  const expectedRest = revealedIds.filter((id) => id !== pickedCardId)
  const restSet = new Set(restOrder)
  const hasAllRest = expectedRest.every((id) => restSet.has(id))
  if (!hasAllRest || restOrder.length !== expectedRest.length) {
    throw new GameRuleError('剩餘牌順序必須包含所有未選取的檢視卡牌。')
  }
  const restCards = restOrder.map((id) => pending.revealedCards.find((c) => c.instanceId === id)!)
  const player = state.players[playerId]
  return {
    ...state,
    pendingInspectDeck: null,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hand: [...player.hand, pickedCard],
        deck: [...player.deck, ...restCards],
      },
    },
  }
}
```

---

### Task 5.3 — Create `src/game/inspect-deck.ts` (Refresh continuation)

Create new file `src/game/inspect-deck.ts`:

```typescript
import type { GameState, PlayerId } from './types'
import { getRefreshCandidates } from './refresh'
import { finishWithDefeat } from './victory'
import { continuePendingReplacements } from './replacement'

export const continueInspectDeckAfterRefresh = (state: GameState): GameState => {
  const pending = state.pendingInspectDeck
  if (!pending || state.pendingRefresh) return state
  if (state.status !== 'playing') return state

  const player = state.players[pending.playerId]
  const alreadyRevealed = pending.revealedCards
  const needed = pending.lookCount - alreadyRevealed.length

  if (needed <= 0) {
    return state
  }

  const newCards = player.deck.slice(0, needed)
  if (newCards.length < needed) {
    if (player.deck.length > 0) {
      // Took what's available, deck now empty
      const updatedPlayer = { ...player, deck: player.deck.slice(newCards.length) }
      const nextState = {
        ...state,
        players: { ...state.players, [pending.playerId]: updatedPlayer },
        pendingInspectDeck: {
          ...pending,
          revealedCards: [...alreadyRevealed, ...newCards],
        },
      }
      const candidates = getRefreshCandidates(nextState, pending.playerId)
      if (candidates.length === 0) {
        return finishWithDefeat(nextState, pending.playerId, 'refresh-unavailable')
      }
      return {
        ...nextState,
        pendingRefresh: { playerId: pending.playerId, remainingDraws: 0 },
      }
    }
    // Deck is empty and we took nothing — need refresh
    const candidates = getRefreshCandidates(state, pending.playerId)
    if (candidates.length === 0) {
      return finishWithDefeat(state, pending.playerId, 'refresh-unavailable')
    }
    return {
      ...state,
      pendingRefresh: { playerId: pending.playerId, remainingDraws: 0 },
    }
  }

  const updatedPlayer = { ...player, deck: player.deck.slice(needed) }
  return {
    ...state,
    players: { ...state.players, [pending.playerId]: updatedPlayer },
    pendingInspectDeck: {
      ...pending,
      revealedCards: [...alreadyRevealed, ...newCards],
    },
  }
}
```

**Test file:** `src/game/inspect-deck.test.ts` (same file as Task 5.1) — add tests for `continueInspectDeckAfterRefresh`:

```typescript
import { continueInspectDeckAfterRefresh } from './inspect-deck'
import { refreshDeck } from './refresh'

  it('continues inspect-deck after refresh, adding cards from new deck', () => {
    let state = createDemoGame()
    const player = state.players['player-one']
    // Set up: pendingInspectDeck with 1 revealed card, need 2 more, deck has 2
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          deck: player.deck.slice(0, 2),
          discardPile: [],
        },
      },
      pendingInspectDeck: {
        playerId: 'player-one',
        sourceInstanceId: 'test-source',
        sourceCardName: 'Test Cookie',
        revealedCards: [player.deck[0]],
        lookCount: 3,
        pickCount: 1,
      },
    }
    const result = continueInspectDeckAfterRefresh(state)
    expect(result.pendingInspectDeck!.revealedCards).toHaveLength(3)
    expect(result.players['player-one'].deck.length).toBe(0)
  })
```

Run: `npm test -- --run src/game/inspect-deck.test.ts` → **GREEN** (after implementing both `inspect-deck.ts` and the effects.ts changes).

---

### Task 5.4 — Wire `continueInspectDeckAfterRefresh` into `refresh.ts`

**File:** `src/game/refresh.ts`

At the top, add import:
```typescript
import { continueInspectDeckAfterRefresh } from './inspect-deck'
```

In `refreshDeck` (line 160), in the final return before `continuePendingReplacements`, add the hook:

Change line 160 from:
```typescript
  return continuePendingReplacements({
    ...replenishedState,
    pendingRefresh: null,
  })
```
to:
```typescript
  const refreshedState = continueInspectDeckAfterRefresh({
    ...replenishedState,
    pendingRefresh: null,
  })
  return continuePendingReplacements(refreshedState)
```

**Verify:** `npm test -- --run` passes all tests.

---

## Phase 6: Commands (`src/game/commands.ts`)

### Task 6.1 (RED) — Add typed decisions/commands

**Test file:** `src/game/commands.test.ts`

Add tests:

```typescript
import { inspectDeckDecision, inspectDeckCommand } from './test-helpers/command-helpers' // create helpers inline

it('returns inspect-deck decision when pendingInspectDeck exists', () => {
  const state = createDemoGame()
  const deck = state.players['player-two'].deck
  const withPending: GameState = {
    ...state,
    pendingInspectDeck: {
      playerId: 'player-two',
      sourceInstanceId: 'test-source',
      sourceCardName: 'Test',
      revealedCards: [deck[0], deck[1], deck[2]],
      lookCount: 3,
      pickCount: 1,
    },
  }
  const decision = getPendingDecision(withPending)
  expect(decision).toBeDefined()
  expect(decision!.kind).toBe('inspect-deck')
})

it('returns optional-cost-attack decision when pendingOptionalCostAttack exists', () => {
  const state = createDemoGame()
  const withPending: GameState = {
    ...state,
    pendingOptionalCostAttack: {
      playerId: 'player-two',
      sourceInstanceId: 'test-source',
      sourceCardName: 'Test',
      cost: { energy: {}, discardHand: 2 },
      effects: [],
      effectText: 'test',
    },
  }
  const decision = getPendingDecision(withPending)
  expect(decision).toBeDefined()
  expect(decision!.kind).toBe('optional-cost-attack')
})

it('applyGameCommand dispatches resolve-inspect-deck', () => {
  const state = createDemoGame()
  const deck = state.players['player-two'].deck
  const withPending: GameState = {
    ...state,
    pendingInspectDeck: {
      playerId: 'player-two',
      sourceInstanceId: 'test-source',
      sourceCardName: 'Test',
      revealedCards: [deck[0], deck[1], deck[2]],
      lookCount: 3,
      pickCount: 1,
    },
  }
  const result = applyGameCommand(withPending, {
    kind: 'resolve-inspect-deck',
    playerId: 'player-two',
    pickedCardId: deck[0].instanceId,
    restOrder: [deck[1].instanceId, deck[2].instanceId],
  })
  expect(result.pendingInspectDeck).toBeNull()
  expect(result.players['player-two'].hand.map((c) => c.instanceId)).toContain(
    deck[0].instanceId,
  )
})

it('applyGameCommand dispatches resolve-optional-cost-attack', () => {
  const state = createDemoGame()
  const withPending: GameState = {
    ...state,
    pendingOptionalCostAttack: {
      playerId: 'player-two',
      sourceInstanceId: 'test-source',
      sourceCardName: 'Test',
      cost: { energy: {}, discardHand: 0 },
      effects: [],
      effectText: 'test',
    },
  }
  const result = applyGameCommand(withPending, {
    kind: 'resolve-optional-cost-attack',
    playerId: 'player-two',
    action: 'skip',
  })
  expect(result.pendingOptionalCostAttack).toBeNull()
})
```

Run: `npm test -- --run src/game/commands.test.ts` → **RED** (new decision/command types not yet in union).

---

### Task 6.1 (GREEN) — Extend commands.ts

**File:** `src/game/commands.ts`

Add imports:
```typescript
import { resolveInspectDeck } from './effects'
import { resolveOptionalCostAttack } from './battle'
```

Add after `OpponentHandDiscardDecision` (line 23):
```typescript
export interface InspectDeckDecision {
  kind: 'inspect-deck'
  playerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  lookCount: number
  pickCount: number
  revealedCardIds: string[]
}

export interface OptionalCostAttackDecision {
  kind: 'optional-cost-attack'
  playerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  cost: AbilityCost
  effects: CardEffect[]
  effectText: string
}
```

Extend `PendingDecision` union:
```typescript
export type PendingDecision =
  | FaintEffectDecision
  | OpponentHandDiscardDecision
  | InspectDeckDecision
  | OptionalCostAttackDecision
```

Add commands:
```typescript
export interface ResolveInspectDeckCommand {
  kind: 'resolve-inspect-deck'
  playerId: PlayerId
  pickedCardId: string
  restOrder: string[]
}

export interface ResolveOptionalCostAttackCommand {
  kind: 'resolve-optional-cost-attack'
  playerId: PlayerId
  action: 'skip' | 'pay'
  discardCardIds?: string[]
  targetIds?: string[]
}
```

Extend `GameCommand` union:
```typescript
export type GameCommand =
  | ResolveFaintEffectCommand
  | ResolveOpponentHandDiscardCommand
  | ResolveInspectDeckCommand
  | ResolveOptionalCostAttackCommand
```

In `getPendingDecision` (line 43), add prioritize checks. The order must be: faint → opponent-hand-discard → inspect-deck → optional-cost-attack. Insert after the `pendingOpponentHandDiscard` block (before `return null`):

```typescript
  if (state.pendingInspectDeck) {
    const pending = state.pendingInspectDeck
    return {
      kind: 'inspect-deck',
      playerId: pending.playerId,
      sourceInstanceId: pending.sourceInstanceId,
      sourceCardName: pending.sourceCardName,
      lookCount: pending.lookCount,
      pickCount: pending.pickCount,
      revealedCardIds: pending.revealedCards.map((c) => c.instanceId),
    }
  }

  if (state.pendingOptionalCostAttack) {
    const pending = state.pendingOptionalCostAttack
    return {
      kind: 'optional-cost-attack',
      playerId: pending.playerId,
      sourceInstanceId: pending.sourceInstanceId,
      sourceCardName: pending.sourceCardName,
      cost: pending.cost,
      effects: pending.effects,
      effectText: pending.effectText,
    }
  }
```

In `applyGameCommand` (line 75), fix the kind matching to handle 4 kinds:

Replace line 85:
```typescript
  const cmdToDecisionKind: Record<string, string> = {
    'resolve-faint-effect': 'faint-effect',
    'resolve-opponent-hand-discard': 'opponent-hand-discard',
    'resolve-inspect-deck': 'inspect-deck',
    'resolve-optional-cost-attack': 'optional-cost-attack',
  }
  if (decision.kind !== cmdToDecisionKind[command.kind]) {
    throw new GameRuleError('指令種類與目前待處理的決策不相符。')
  }
```

Add new switch cases after the `resolve-opponent-hand-discard` case:
```typescript
    case 'resolve-inspect-deck':
      return resolveInspectDeck(state, command.playerId, command.pickedCardId, command.restOrder)
    case 'resolve-optional-cost-attack':
      return resolveOptionalCostAttack(
        state, command.playerId, command.action, command.discardCardIds ?? [], command.targetIds ?? [],
      )
```

Add import for `AbilityCost`:
```typescript
import type { AbilityCost, CardEffect, GameState, PlayerId } from './types'
```

**Update `src/game/index.ts`** — add exports:
```typescript
export { resolveInspectDeck } from './effects'
export { resolveOptionalCostAttack } from './battle'
export type {
  InspectDeckDecision,
  OptionalCostAttackDecision,
  ResolveInspectDeckCommand,
  ResolveOptionalCostAttackCommand,
} from './commands'
```

Run: `npm test -- --run src/game/commands.test.ts` → **GREEN**.

---

## Phase 7: AI Decisions (`src/game/ai.ts`)

### Task 7.1 — AI for inspect-deck, optional-cost-attack, and discardHand activation

**File:** `src/game/ai.ts`

#### 7.1.1 — Add `AiActionType` entries

Add to the `AiActionType` union (after `'resolve-faint'`, line 82):
```typescript
  | 'resolve-inspect-deck'
  | 'resolve-optional-cost-attack'
```

#### 7.1.2 — AI inspect-deck handling

In `takeAiStep`, after the `opponent-hand-discard` AI block (line 511), add:

```typescript
    if (
      state.pendingInspectDeck?.playerId === playerId &&
      !state.pendingRefresh
    ) {
      const pending = state.pendingInspectDeck
      const pickedCardId = pending.revealedCards[0].instanceId
      const restOrder = pending.revealedCards.slice(1).map((c) => c.instanceId)
      return {
        state: applyGameCommand(state, {
          kind: 'resolve-inspect-deck',
          playerId,
          pickedCardId,
          restOrder,
        }),
        action: 'resolve-inspect-deck',
        description: `AI 從檢視的牌中選取 ${pending.revealedCards[0].name} 加入手牌。`,
      }
    }
```

#### 7.1.3 — AI optional-cost-attack handling

Insert after the inspect-deck block, before the `pendingBattle` block (line 513):

```typescript
    if (
      state.pendingOptionalCostAttack?.playerId === playerId
    ) {
      const pending = state.pendingOptionalCostAttack
      const hand = state.players[playerId].hand
      if (hand.length >= pending.cost.discardHand) {
        const discardIds = hand.slice(0, pending.cost.discardHand).map((c) => c.instanceId)
        const opponentId = playerId === 'player-one' ? 'player-two' : 'player-one'
        const opponentCookie = state.players[opponentId].battleArea[0]
        return {
          state: applyGameCommand(state, {
            kind: 'resolve-optional-cost-attack',
            playerId,
            action: 'pay',
            discardCardIds: discardIds,
            targetIds: opponentCookie ? [opponentCookie.card.instanceId] : [],
          }),
          action: 'resolve-optional-cost-attack',
          description: `AI 支付棄手牌代價發動攻擊後續效果。`,
        }
      }
      return {
        state: applyGameCommand(state, {
          kind: 'resolve-optional-cost-attack',
          playerId,
          action: 'skip',
        }),
        action: 'resolve-optional-cost-attack',
        description: `AI 略過攻擊後續可選代價效果（手牌不足）。`,
      }
    }
```

#### 7.1.4 — AI discardHandIds in `resolveAiSkill`

In `resolveAiSkill` (line 274), after computing `costSupportToTrashIds` (line 311), add:

```typescript
  const discardCount = skill.cost.discardHand
  const discardHandIds = discardCount > 0
    ? state.players[playerId].hand.slice(0, discardCount).map((c) => c.instanceId)
    : []
```

Then change the `activateCookieSkill` call (line 323) to include `discardHandIds`:

```typescript
  let nextState = activateCookieSkill(
    state,
    playerId,
    source.card.instanceId,
    trigger,
    paymentIds,
    costSupportToTrashIds,
    discardHandIds,
  )
```

#### 7.1.5 — AI `simulateAiMatch` controller priority

In `simulateAiMatch` (line 957), the controller extraction already calls `getPendingDecision` first, which now returns inspect-deck and optional-cost-attack decisions before other pending states. No code change needed here — the existing priority chain works:
1. `getPendingDecision` → returns inspect-deck playerId or optional-cost-attack playerId
2. `pendingRefresh?.playerId`
3. etc.

#### 7.1.6 — Blocking pending guards

**File:** `src/game/pending.ts`

Add `pendingInspectDeck` and `pendingOptionalCostAttack` to `hasBlockingPending`:

```typescript
export const hasBlockingPending = (state: GameState): boolean =>
  Boolean(
    state.pendingReplacement ||
      state.pendingOnPlay ||
      state.pendingRefresh ||
      state.pendingBattle ||
      (state.pendingFaintEffects && state.pendingFaintEffects.length > 0) ||
      state.pendingOpponentHandDiscard ||
      state.pendingInspectDeck ||
      state.pendingOptionalCostAttack,
  )
```

**File:** `src/game/battle.ts` — `assertNoBlockingDecision` (line 42)

Add checks for new pending types:
```typescript
  if (state.pendingInspectDeck) {
    throw new GameRuleError('必須先完成牌庫檢視。')
  }
  if (state.pendingOptionalCostAttack) {
    throw new GameRuleError('必須先處理攻擊後續可選代價。')
  }
```

**File:** `src/game/skills.ts` — `canActivateCookieSkill` (line 71-78)

Add new pending checks to the if block that guards against other pendings:
```typescript
    state.pendingInspectDeck ||
    state.pendingOptionalCostAttack ||
```

**File:** `src/game/controller.ts` — No changes needed. `getActingPlayerId` already uses `getPendingDecision` as first priority, which covers inspect-deck and optional-cost-attack. `isPlayerControllingState` delegates to `getActingPlayerId`.

#### 7.1.7 — AI test

**Test file:** `src/game/ai.test.ts`

Add tests:

```typescript
it('AI picks first card from inspect-deck', () => {
  const state = createDemoGame()
  const deck = state.players['player-two'].deck
  const withPending: GameState = {
    ...state,
    pendingInspectDeck: {
      playerId: 'player-two',
      sourceInstanceId: 'test-source',
      sourceCardName: 'Test Cookie',
      revealedCards: [deck[0], deck[1], deck[2]],
      lookCount: 3,
      pickCount: 1,
    },
  }
  const result = takeAiStep(withPending, 'player-two')
  expect(result.action).toBe('resolve-inspect-deck')
  expect(result.state.pendingInspectDeck).toBeNull()
  expect(result.state.players['player-two'].hand.map((c) => c.instanceId)).toContain(
    deck[0].instanceId,
  )
})

it('AI pays optional-cost-attack when hand sufficient', () => {
  const state = createDemoGame()
  const withPending: GameState = {
    ...state,
    pendingOptionalCostAttack: {
      playerId: 'player-two',
      sourceInstanceId: 'test-source',
      sourceCardName: 'Test Cookie',
      cost: { energy: {}, discardHand: 1 },
      effects: [],
      effectText: 'test',
    },
  }
  const result = takeAiStep(withPending, 'player-two')
  expect(result.action).toBe('resolve-optional-cost-attack')
  expect(result.state.pendingOptionalCostAttack).toBeNull()
})

it('AI skips optional-cost-attack when hand insufficient', () => {
  const state = createDemoGame()
  const withPending: GameState = {
    ...state,
    players: {
      ...state.players,
      'player-two': { ...state.players['player-two'], hand: [] },
    },
    pendingOptionalCostAttack: {
      playerId: 'player-two',
      sourceInstanceId: 'test-source',
      sourceCardName: 'Test Cookie',
      cost: { energy: {}, discardHand: 2 },
      effects: [],
      effectText: 'test',
    },
  }
  const result = takeAiStep(withPending, 'player-two')
  expect(result.action).toBe('resolve-optional-cost-attack')
  expect(result.state.pendingOptionalCostAttack).toBeNull()
})
```

Run: `npm test -- --run src/game/ai.test.ts` → **RED** then **GREEN**.

---

## Phase 8: UI — React Hooks + Components

### Task 8.1 (RED) — `PendingEffect` adds `selectedDiscardHandIds`

**Test file:** `src/hooks/usePendingEffect.test.tsx`

Add test (RED):

```typescript
it('initializes selectedDiscardHandIds as empty array', () => {
  // Verify that a PendingEffect created for a skill with discardHand: 1
  // has selectedDiscardHandIds: [] initially
  const { result } = renderHook(() =>
    usePendingEffect({ ...defaultParams, game: createStateWithPendingOnPlayDiscardHand() }),
  )
  expect(result.current.pendingEffect?.selectedDiscardHandIds).toEqual([])
})
```

---

### Task 8.1 (GREEN) — Add `selectedDiscardHandIds` to `PendingEffect`

**File:** `src/components/effects/effectUiTypes.ts`

Add field after `selectedCostSupportToTrashIds` (line 18):
```typescript
  selectedDiscardHandIds: string[]
```

**File:** `src/hooks/usePendingEffect.ts`

In `beginCookieSkill` (line 297), add `selectedDiscardHandIds: []` to the `setPendingEffect` call:
```typescript
    setPendingEffect({
      // ... existing fields ...
      selectedDiscardHandIds: [],
    })
```

In `beginCardAbility` (line 334), add `selectedDiscardHandIds: []`.

In the attack-effect auto-detect `useEffect` (line 381), add `selectedDiscardHandIds: []`.

Run: `npm test -- --run src/hooks/usePendingEffect.test.tsx` → **GREEN**.

---

### Task 8.2 — Add `toggleDiscardHand` to `usePendingEffect`

**File:** `src/hooks/usePendingEffect.ts`

Add function after `toggleSkillCostSupport` (line 546):

```typescript
  const toggleDiscardHand = (instanceId: string) => {
    if (!pendingEffect || pendingEffect.skillActivated) return
    const discardHandCost = pendingEffect.skill.cost.discardHand
    if (discardHandCost === 0) return
    const isSelected = pendingEffect.selectedDiscardHandIds.includes(instanceId)
    if (!isSelected && pendingEffect.selectedDiscardHandIds.length >= discardHandCost) return
    const selectedDiscardHandIds = isSelected
      ? pendingEffect.selectedDiscardHandIds.filter((id) => id !== instanceId)
      : [...pendingEffect.selectedDiscardHandIds, instanceId]
    setPendingEffect({ ...pendingEffect, selectedDiscardHandIds })
  }
```

Add `toggleDiscardHand` to the return object.

In `confirmEffect` (line 601), pass `selectedDiscardHandIds` to `activateCookieSkill`:

Change the `activateCookieSkill` call (line 664):

```typescript
            : activateCookieSkill(
                game,
                pendingEffect.context.sourcePlayerId,
                pendingEffect.sourceCard.instanceId,
                pendingEffect.trigger,
                pendingEffect.selectedPaymentIds,
                pendingEffect.selectedCostSupportToTrashIds,
                pendingEffect.selectedDiscardHandIds,
              )
```

---

### Task 8.3 — UI: hand discard selection in `App.tsx`

**File:** `src/App.tsx`

In the `EffectPanel` rendering (where skill payment UI is shown), when `pendingEffect.skill.cost.discardHand > 0`:

1. Render the viewer's hand cards as selectable candidates.
2. Use `toggleDiscardHand` on click/tap.
3. Show `selectedDiscardHandIds.length / skill.cost.discardHand` count.
4. The "Confirm" button is disabled unless all costs are met: `selectedDiscardHandIds.length === skill.cost.discardHand && selectedPaymentIds.length >= skillEnergyCostTotal && ...`.

The cancel button (`skipOptionalSkill`) sets `setPendingEffect(null)`, which clears all local state (including `selectedDiscardHandIds`).

---

### Task 8.4 — UI: optional-cost-attack modal

**File:** `src/App.tsx`

When `game.pendingOptionalCostAttack` exists and `game.pendingOptionalCostAttack.playerId === viewerPlayerId`:

1. Render a modal showing `{effectText}`.
2. "Pay" button: if `viewerHand.length >= pendingOptionalCostAttack.cost.discardHand`, enable it. On click, enter hand selection for discard, then confirm → `applyGameCommand({ kind: 'resolve-optional-cost-attack', playerId, action: 'pay', discardCardIds, targetIds })`.
3. "Skip" button: always enabled → `applyGameCommand({ kind: 'resolve-optional-cost-attack', playerId, action: 'skip' })`.

Local state for hand selection: `const [optionalCostDiscardIds, setOptionalCostDiscardIds] = useState<string[]>([])`. Reset to `[]` when pending changes or on cancel.

---

### Task 8.5 — UI: inspect-deck modal

**File:** `src/App.tsx`

When `game.pendingInspectDeck` exists and `game.pendingInspectDeck.playerId === viewerPlayerId`:

1. Render a modal showing `revealedCards` face-up.
2. Player clicks one card to pick → `const [pickedId, setPickedId] = useState<string | null>(null)`.
3. Non-picked cards have "Move Up" / "Move Down" buttons for ordering.
4. Local state: `const [restOrder, setRestOrder] = useState<string[]>([])`. Initialize with non-picked cards in revealed order.
5. "Confirm" button disabled until `pickedId !== null`. On click → `applyGameCommand({ kind: 'resolve-inspect-deck', playerId, pickedCardId: pickedId, restOrder })`.
6. Reset local state when `pendingInspectDeck` is cleared.

---

## Phase 9: Playwright Browser Validation

### Task 9.1 — Legal paths

| Path | Steps |
|---|---|
| ST4-012 activate + pay discardHand | Deploy Werewolf → Main phase → click skill → select 1 hand card → confirm → attack boost applied |
| ST4-013 optional-cost-attack pay | Attack with Caviar → battle effects resolve → "Pay" button appears → select 2 hand cards + target → confirm → damage dealt |
| ST4-013 optional-cost-attack skip | Attack with Caviar → battle effects resolve → "Skip" button → no effect |
| ST4-013 OnPlay inspect-deck | Deploy Caviar → OnPlay triggers → 3 cards shown → pick 1 → order rest → confirm → card in hand, rest at bottom |

### Task 9.2 — Illegal paths

| Path | Steps |
|---|---|
| ST4-012 hand insufficient → skill button disabled | Have 0 hand cards → Werewolf in battle area → skill button not clickable |
| ST4-013 optional-cost-attack hand insufficient → "Pay" disabled | Have <2 hand cards → attack with Caviar → only "Skip" enabled |

### Task 9.3 — Cancel paths

| Path | Steps |
|---|---|
| Activate skill → select discards → cancel | Click skill → select 1 hand card → cancel → hand card not discarded, state unchanged |
| inspect-deck → cancel not possible (must pick 1) | inspect-deck is non-optional per spec; confirm only |

---

## Phase 10: Final Verification

```powershell
npm test
npm run lint
npm run build
npm run test:ai:browser
```

Update `AGENTS.md` test count with actual `npm test` output.
Update `README.md` progress section.

```powershell
git diff --stat
```

---

## File Change Summary

### New files
| File | Description |
|---|---|
| `src/game/inspect-deck.ts` | `continueInspectDeckAfterRefresh` hook |
| `src/game/inspect-deck.test.ts` | inspect-deck effect + refresh continuation tests |
| `src/game/battle-optional-cost-attack.test.ts` | optional-cost-attack battle tests |

### Modified files
| File | Changes |
|---|---|
| `src/game/types.ts` | +InspectDeckEffect, +OptionalCostAttackEffect, CardEffect union, +2 GameState pending fields |
| `src/cards/official-effect-adapter.ts` | ST4-013 exactStarterEffects: draw→inspect-deck |
| `src/cards/official-card-adapter.ts` | +hardcodedAttackEffects for ST4-013, +CardEffect import |
| `src/game/skills.ts` | +discardHand check in canActivateCookieSkill, +discardHandIds param + validation + payment in activateCookieSkill |
| `src/game/skills.test.ts` | +discardHand tests |
| `src/game/battle.ts` | +optional-cost-attack guard in resolveAttackEffect, +resolveOptionalCostAttack, +resolveBattleAutomatically skip, +assertNoBlockingDecision guards |
| `src/game/effects.ts` | +inspect-deck case in executeCardEffect, +resolveInspectDeck, +inspect-deck import |
| `src/game/refresh.ts` | +continueInspectDeckAfterRefresh import + call before continuePendingReplacements |
| `src/game/commands.ts` | +4 typed decision/command types, +PendingDecision/GameCommand union, +getPendingDecision/applyGameCommand cases |
| `src/game/commands.test.ts` | +inspect-deck/optional-cost-attack decision + command dispatch tests |
| `src/game/ai.ts` | +resolve-inspect-deck AI, +resolve-optional-cost-attack AI, +discardHandIds in resolveAiSkill, +AiActionType entries |
| `src/game/ai.test.ts` | +AI inspect-deck/optional-cost-attack tests |
| `src/game/pending.ts` | +pendingInspectDeck +pendingOptionalCostAttack to hasBlockingPending |
| `src/game/controller.ts` | No change (getActingPlayerId already delegates to getPendingDecision first) |
| `src/game/starter-deck.test.ts` | +ST4-013 OnPlay inspect-deck test, +ST4-012 skill discardHand test |
| `src/game/index.ts` | +resolveInspectDeck, +resolveOptionalCostAttack, +new type exports |
| `src/components/effects/effectUiTypes.ts` | +selectedDiscardHandIds |
| `src/hooks/usePendingEffect.ts` | +toggleDiscardHand, +selectedDiscardHandIds in begin*/attack-effect, +discardHandIds in confirmEffect |
| `src/App.tsx` | +hand discard selection UI, +optional-cost-attack modal, +inspect-deck modal |
| `docs/game-rules.md` | +discardHand cost, +inspect-deck, +optional-cost-attack rules |
| `docs/card-effects.md` | +InspectDeckEffect, +OptionalCostAttackEffect |
| `AGENTS.md` | Updated test count |
| `README.md` | Updated progress |
