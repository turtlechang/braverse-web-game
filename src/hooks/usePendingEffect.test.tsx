/// @vitest-environment jsdom

import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import {
  createBlueOptionalCostAttackDemoState,
  createItemUsageDemoState,
} from '../game/demo'
import { usePendingEffect } from './usePendingEffect'
import {
  applyGameCommand,
  beginAttack,
  resolveAttackEffect,
  resolveNextDamage,
  resolveOptionalCostAttack,
  skipTrap,
  type CookieCard,
  type GameCard,
  type GameState,
} from '../game'
import officialBS3 from '../../data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  createBattleState,
  item as battleItem,
} from '../game/test-helpers/battle-helpers'
import type { DispatchGameCommand } from './useBattleActions'

const createDispatch = (
  game: GameState,
  setGame: (value: GameState) => void,
): DispatchGameCommand => (command, _successMessage, onSuccess) => {
  const commands = Array.isArray(command) ? command : [command]
  const nextGame = commands.reduce(
    (state, cmd) => applyGameCommand(state, cmd),
    game,
  )
  setGame(nextGame)
  onSuccess?.(nextGame)
}

const createTestCookieWithDiscardHandSkill = (): CookieCard => ({
  id: 'test-discard-cookie',
  instanceId: 'test-discard-cookie-1',
  name: '測試棄牌餅乾',
  type: 'cookie',
  level: 1,
  hp: 5,
  attack: 3,
  attackCost: 1,
  skill: {
    trigger: 'activate',
    oncePerTurn: false,
    yourTurn: true,
    restSource: false,
    cost: { energy: { red: 1 }, discardHand: 1 },
    text: '棄置 1 張手牌，抽 1 張牌。',
    effects: [{ kind: 'draw', amount: 1 }],
  },
})

const createTestDamageCookieWithDiscardHandSkill = (): CookieCard => ({
  id: 'test-discard-damage-cookie',
  instanceId: 'test-discard-damage-cookie-1',
  name: 'Discard Damage Cookie',
  type: 'cookie',
  level: 2,
  hp: 4,
  attack: 2,
  attackCost: 1,
  skill: {
    trigger: 'activate',
    oncePerTurn: false,
    yourTurn: true,
    restSource: false,
    cost: { energy: { red: 1 }, discardHand: 1 },
    text: 'Discard 1 card. Deal 3 damage.',
    effects: [
      {
        kind: 'damage',
        amount: 3,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
  },
})

const createTestSupportCard = (
  instanceId: string,
  color: 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'wild' = 'red',
): GameCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'item',
  energyColor: color,
})

const createTestHandCard = (instanceId: string): GameCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'item',
})

function createDiscardHandSkillGameState(): GameState {
  const baseGame = createItemUsageDemoState(true)
  const cookie = createTestCookieWithDiscardHandSkill()
  const support = createTestSupportCard('energy-support-1', 'red')
  const handCard = createTestHandCard('hand-card-1')

  return {
    ...baseGame,
    phase: 'main',
    activePlayerId: 'player-one',
    status: 'playing',
    players: {
      ...baseGame.players,
      'player-one': {
        ...baseGame.players['player-one'],
        hand: [handCard],
        battleArea: [
          {
            card: cookie,
            hpCards: [],
            rested: false,
            battleEntryId: `${cookie.instanceId}:battle:1`,
          },
        ],
        supportArea: [{ card: support, rested: false }],
      },
    },
  }
}

function createDiscardHandDamageSkillGameState(): GameState {
  const baseGame = createItemUsageDemoState(true)
  const cookie = createTestDamageCookieWithDiscardHandSkill()
  const support = createTestSupportCard('energy-support-1', 'red')
  const handCard = createTestHandCard('hand-card-1')
  const targetCookie: CookieCard = {
    id: 'target-cookie',
    instanceId: 'target-cookie-1',
    name: 'Target Cookie',
    type: 'cookie',
    level: 1,
    hp: 1,
    attack: 1,
    attackCost: 0,
  }

  return {
    ...baseGame,
    phase: 'main',
    activePlayerId: 'player-one',
    status: 'playing',
    players: {
      ...baseGame.players,
      'player-one': {
        ...baseGame.players['player-one'],
        hand: [handCard],
        battleArea: [
          {
            card: cookie,
            hpCards: [],
            rested: false,
            battleEntryId: `${cookie.instanceId}:battle:1`,
          },
        ],
        supportArea: [{ card: support, rested: false }],
      },
      'player-two': {
        ...baseGame.players['player-two'],
        hand: [],
        battleArea: [
          {
            card: targetCookie,
            hpCards: [createTestHandCard('target-hp-1')],
            rested: false,
            battleEntryId: `${targetCookie.instanceId}:battle:2`,
          },
        ],
      },
    },
  }
}

describe('usePendingEffect cancelPendingSkill', () => {
  it('clears pendingEffect without modifying GameState when canceling activate cookie skill', async () => {
    const gameState = createDiscardHandSkillGameState()
    const gameStateSnapshot = JSON.parse(JSON.stringify(gameState))

    const setGameMock = vi.fn()
    let captured: ReturnType<typeof usePendingEffect> | null = null

    function TestHarness() {
      const pending = usePendingEffect({
        game: gameState,
        setGame: setGameMock,
        dispatch: createDispatch(gameState, setGameMock),
        viewerPlayerId: 'player-one',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {},
        hasAfterDamage: false,
        afterDamageTargetIds: new Set(),
        selectedAfterDamageTargetIds: [],
        afterDamageMinMax: { min: 0, max: 0 },
        setSelectedAfterDamageTargetIds: () => {},
      })
      captured = pending
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    expect(captured).not.toBeNull()
    expect(captured!.pendingEffect).toBeNull()

    const cookie = gameState.players['player-one'].battleArea[0].card
    await act(() => {
      captured!.beginCookieSkill(
        gameState,
        cookie,
        'player-one',
        'activate',
        '主動技能',
        false,
      )
    })

    expect(captured!.pendingEffect).not.toBeNull()
    expect(captured!.pendingEffect?.sourceKind).toBe('cookie')
    expect(captured!.pendingEffect?.trigger).toBe('activate')
    expect(captured!.pendingEffect?.skillActivated).toBe(false)

    const supportId =
      gameState.players['player-one'].supportArea[0].card.instanceId
    await act(() => {
      captured!.toggleSkillPayment(supportId)
    })
    expect(captured!.pendingEffect?.selectedPaymentIds).toContain(supportId)

    const handId = gameState.players['player-one'].hand[0].instanceId
    await act(() => {
      captured!.toggleSkillDiscardHand(handId)
    })
    expect(captured!.pendingEffect?.selectedDiscardHandIds).toContain(handId)

    setGameMock.mockClear()

    await act(() => {
      captured!.cancelPendingSkill()
    })

    expect(captured!.pendingEffect).toBeNull()
    expect(setGameMock).not.toHaveBeenCalled()

    const gameStateAfterCancel = gameState
    expect(JSON.parse(JSON.stringify(gameStateAfterCancel))).toEqual(
      gameStateSnapshot,
    )

    await act(() => root.unmount())
  })

  it('does not activate faint targeting while replacement is pending', async () => {
    const gameState: GameState = {
      ...createItemUsageDemoState(true),
      pendingReplacement: {
        tasks: [{ playerId: 'player-one', remaining: 1 }],
      },
    }
    let captured: ReturnType<typeof usePendingEffect> | null = null

    function TestHarness() {
      captured = usePendingEffect({
        game: gameState,
        setGame: () => {},
        dispatch: createDispatch(gameState, () => {}),
        viewerPlayerId: 'player-one',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: true,
        faintTargetIds: new Set(['target-cookie']),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 1 },
        setSelectedFaintTargetIds: () => {},
        hasAfterDamage: false,
        afterDamageTargetIds: new Set(),
        selectedAfterDamageTargetIds: [],
        afterDamageMinMax: { min: 0, max: 0 },
        setSelectedAfterDamageTargetIds: () => {},
      })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    expect(captured!.faintActive).toBe(false)

    await act(() => root.unmount())
  })

  it('does not call skipCookieOnPlay when canceling activate skill', async () => {
    const gameState = createDiscardHandSkillGameState()
    const setGameMock = vi.fn()
    let captured: ReturnType<typeof usePendingEffect> | null = null

    function TestHarness() {
      const pending = usePendingEffect({
        game: gameState,
        setGame: setGameMock,
        dispatch: createDispatch(gameState, setGameMock),
        viewerPlayerId: 'player-one',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {},
        hasAfterDamage: false,
        afterDamageTargetIds: new Set(),
        selectedAfterDamageTargetIds: [],
        afterDamageMinMax: { min: 0, max: 0 },
        setSelectedAfterDamageTargetIds: () => {},
      })
      captured = pending
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    const cookie = gameState.players['player-one'].battleArea[0].card
    await act(() => {
      captured!.beginCookieSkill(
        gameState,
        cookie,
        'player-one',
        'activate',
        '主動技能',
        false,
      )
    })

    expect(captured!.pendingEffect).not.toBeNull()

    await act(() => {
      captured!.cancelPendingSkill()
    })

    expect(setGameMock).not.toHaveBeenCalled()

    await act(() => root.unmount())
  })

  it('allows cancel when sourceKind is item', async () => {
    const baseGame = createItemUsageDemoState(true)
    const itemCard: GameCard = {
      id: 'test-item',
      instanceId: 'test-item-1',
      name: '測試物品',
      type: 'item',
      item: {
        cost: { red: 1 },
        text: '測試',
        effects: [{ kind: 'draw', amount: 1 }],
      },
    }

    const state: GameState = {
      ...baseGame,
      players: {
        ...baseGame.players,
        'player-one': {
          ...baseGame.players['player-one'],
          hand: [itemCard, ...baseGame.players['player-one'].hand],
        },
      },
    }

    let captured: ReturnType<typeof usePendingEffect> | null = null

    function TestHarness() {
      const pending = usePendingEffect({
        game: state,
        setGame: () => {},
        dispatch: createDispatch(state, () => {}),
        viewerPlayerId: 'player-one',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {},
        hasAfterDamage: false,
        afterDamageTargetIds: new Set(),
        selectedAfterDamageTargetIds: [],
        afterDamageMinMax: { min: 0, max: 0 },
        setSelectedAfterDamageTargetIds: () => {},
      })
      captured = pending
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    await act(() => {
      captured!.beginCardAbility(
        itemCard,
        {
          cost: { red: 1 },
          text: '測試',
          effects: [{ kind: 'draw', amount: 1 }],
        },
        'item',
        '使用物品',
      )
    })

    expect(captured!.pendingEffect).not.toBeNull()
    expect(captured!.pendingEffect?.sourceKind).toBe('item')

    await act(() => {
      captured!.cancelPendingSkill()
    })

    expect(captured!.pendingEffect).toBeNull()

    await act(() => root.unmount())
  })

  it('allows cancel when sourceKind is stage', async () => {
    const baseGame = createItemUsageDemoState(true)
    const stageCard: GameCard = {
      id: 'test-stage',
      instanceId: 'test-stage-1',
      name: '測試場景',
      type: 'stage',
      stageAbility: {
        placementCost: {},
        cost: { red: 1 },
        text: '測試',
        restSource: false,
        effects: [{ kind: 'draw', amount: 1 }],
      },
    }

    const state: GameState = {
      ...baseGame,
      players: {
        ...baseGame.players,
        'player-one': {
          ...baseGame.players['player-one'],
          stage: { card: stageCard, rested: false },
        },
      },
    }

    let captured: ReturnType<typeof usePendingEffect> | null = null

    function TestHarness() {
      const pending = usePendingEffect({
        game: state,
        setGame: () => {},
        dispatch: createDispatch(state, () => {}),
        viewerPlayerId: 'player-one',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {},
        hasAfterDamage: false,
        afterDamageTargetIds: new Set(),
        selectedAfterDamageTargetIds: [],
        afterDamageMinMax: { min: 0, max: 0 },
        setSelectedAfterDamageTargetIds: () => {},
      })
      captured = pending
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    await act(() => {
      captured!.beginCardAbility(
        stageCard,
        stageCard.stageAbility!,
        'stage',
        '啟動場景',
      )
    })

    expect(captured!.pendingEffect).not.toBeNull()
    expect(captured!.pendingEffect?.sourceKind).toBe('stage')

    await act(() => {
      captured!.cancelPendingSkill()
    })

    expect(captured!.pendingEffect).toBeNull()

    await act(() => root.unmount())
  })

  it('confirm is disabled when discardHand selection is insufficient', async () => {
    const gameState = createDiscardHandSkillGameState()
    let captured: ReturnType<typeof usePendingEffect> | null = null

    function TestHarness() {
      const pending = usePendingEffect({
        game: gameState,
        setGame: () => {},
        dispatch: createDispatch(gameState, () => {}),
        viewerPlayerId: 'player-one',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {},
        hasAfterDamage: false,
        afterDamageTargetIds: new Set(),
        selectedAfterDamageTargetIds: [],
        afterDamageMinMax: { min: 0, max: 0 },
        setSelectedAfterDamageTargetIds: () => {},
      })
      captured = pending
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    const cookie = gameState.players['player-one'].battleArea[0].card
    await act(() => {
      captured!.beginCookieSkill(
        gameState,
        cookie,
        'player-one',
        'activate',
        '主動技能',
        false,
      )
    })

    expect(captured!.pendingEffect).not.toBeNull()
    expect(captured!.discardHandCost).toBe(1)
    expect(captured!.pendingEffect?.selectedDiscardHandIds).toHaveLength(0)

    const supportId =
      gameState.players['player-one'].supportArea[0].card.instanceId
    await act(() => {
      captured!.toggleSkillPayment(supportId)
    })

    expect(captured!.pendingEffect?.selectedPaymentIds).toHaveLength(1)
    expect(captured!.pendingEffect?.selectedDiscardHandIds).toHaveLength(0)

    const isConfirmDisabled =
      !captured!.pendingEffect!.skillActivated &&
      (captured!.pendingEffect!.selectedPaymentIds.length !==
        (captured!.pendingEffect!.skill.cost.energy ?? {}).red ||
        captured!.pendingEffect!.selectedDiscardHandIds.length !==
          captured!.discardHandCost)

    expect(isConfirmDisabled).toBe(true)

    const handId = gameState.players['player-one'].hand[0].instanceId
    await act(() => {
      captured!.toggleSkillDiscardHand(handId)
    })

    expect(captured!.pendingEffect?.selectedDiscardHandIds).toHaveLength(1)

    const isConfirmDisabledAfterSelection =
      !captured!.pendingEffect!.skillActivated &&
      (captured!.pendingEffect!.selectedPaymentIds.length !==
        (captured!.pendingEffect!.skill.cost.energy ?? {}).red ||
        captured!.pendingEffect!.selectedDiscardHandIds.length !==
          captured!.discardHandCost)

    expect(isConfirmDisabledAfterSelection).toBe(false)

    await act(() => root.unmount())
  })

  it('confirms a discard-hand damage skill and queues defeated Cookie replacement', async () => {
    const gameState = createDiscardHandDamageSkillGameState()
    const setGameMock = vi.fn()
    let captured: ReturnType<typeof usePendingEffect> | null = null

    function TestHarness() {
      const pending = usePendingEffect({
        game: gameState,
        setGame: setGameMock,
        dispatch: createDispatch(gameState, setGameMock),
        viewerPlayerId: 'player-one',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {},
        hasAfterDamage: false,
        afterDamageTargetIds: new Set(),
        selectedAfterDamageTargetIds: [],
        afterDamageMinMax: { min: 0, max: 0 },
        setSelectedAfterDamageTargetIds: () => {},
      })
      captured = pending
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    const cookie = gameState.players['player-one'].battleArea[0].card
    await act(() => {
      captured!.beginCookieSkill(
        gameState,
        cookie,
        'player-one',
        'activate',
        'Activate',
        false,
      )
    })

    await act(() => {
      captured!.toggleSkillPayment('energy-support-1')
    })
    await act(() => {
      captured!.toggleSkillDiscardHand('hand-card-1')
    })
    await act(() => {
      captured!.toggleEffectTarget('target-cookie-1')
    })

    await act(() => {
      captured!.confirmEffect()
    })

    expect(captured!.pendingEffect).toBeNull()
    expect(setGameMock).toHaveBeenCalledTimes(1)
    expect(setGameMock.mock.calls[0][0]).toMatchObject({
      pendingReplacement: {
        tasks: [{ playerId: 'player-two', remaining: 1 }],
      },
    })

    await act(() => root.unmount())
  })
})

describe('usePendingEffect required target gating', () => {
  it('does not open BS2-058-style payment UI without an opposing level 3 Cookie', async () => {
    const baseGame = createItemUsageDemoState(true)
    const originalSource = baseGame.players['player-one'].battleArea[0]
    const sourceCard: CookieCard = {
      ...originalSource.card,
      type: 'cookie',
      level: originalSource.card.level ?? 1,
      hp: originalSource.card.hp ?? 1,
      attack: originalSource.card.attack ?? 1,
      attackCost: originalSource.card.attackCost ?? 1,
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: true,
        restSource: false,
        cost: { energy: { red: 1 } },
        text: 'Place 1 opposing LV.3 Cookie into trash.',
        effects: [
          { kind: 'opponent-battle-to-trash', minLevel: 3, maxLevel: 3 },
        ],
      },
    }
    const gameState: GameState = {
      ...baseGame,
      players: {
        ...baseGame.players,
        'player-one': {
          ...baseGame.players['player-one'],
          battleArea: [{ ...originalSource, card: sourceCard }],
        },
      },
    }
    const setMessage = vi.fn()
    let captured: ReturnType<typeof usePendingEffect> | null = null
    function TestHarness() {
      captured = usePendingEffect({
        game: gameState,
        setGame: () => undefined,
        dispatch: vi.fn(),
        viewerPlayerId: 'player-one',
        setMessage,
        clearAttacker: () => undefined,
        setInspectedHpPile: () => undefined,
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => undefined,
        hasAfterDamage: false,
        afterDamageTargetIds: new Set(),
        selectedAfterDamageTargetIds: [],
        afterDamageMinMax: { min: 0, max: 0 },
        setSelectedAfterDamageTargetIds: () => undefined,
      })
      return null
    }

    const root = createRoot(document.createElement('div'))
    await act(() => root.render(<TestHarness />))
    await act(() =>
      captured!.beginCookieSkill(
        gameState,
        sourceCard,
        'player-one',
        'activate',
        '主動技能',
      ),
    )

    expect(captured!.pendingEffect).toBeNull()
    expect(setMessage).toHaveBeenCalledWith(
      `${sourceCard.name}目前沒有合法的效果目標。`,
    )
    await act(() => root.unmount())
  })
})

describe('usePendingEffect support-to-trash toggleEffectTarget', () => {
  it('selects and deselects a support-to-trash candidate via toggleEffectTarget', async () => {
    const baseGame = createItemUsageDemoState(true)
    const supportArea = baseGame.players['player-one'].supportArea
    const supportId = supportArea[0].card.instanceId

    const itemCard: GameCard = {
      id: 'test-support-trash-item',
      instanceId: 'test-support-trash-item-1',
      name: '測試支援丟棄物品',
      type: 'item',
      item: {
        cost: { green: 2 },
        text: '測試',
        effects: [{ kind: 'support-to-trash', amount: 1 }],
      },
    }

    const state: GameState = {
      ...baseGame,
      players: {
        ...baseGame.players,
        'player-one': {
          ...baseGame.players['player-one'],
          hand: [itemCard, ...baseGame.players['player-one'].hand],
        },
      },
    }

    let captured: ReturnType<typeof usePendingEffect> | null = null

    function TestHarness() {
      const pending = usePendingEffect({
        game: state,
        setGame: () => {},
        dispatch: createDispatch(state, () => {}),
        viewerPlayerId: 'player-one',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {},
        hasAfterDamage: false,
        afterDamageTargetIds: new Set(),
        selectedAfterDamageTargetIds: [],
        afterDamageMinMax: { min: 0, max: 0 },
        setSelectedAfterDamageTargetIds: () => {},
      })
      captured = pending
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    expect(captured).not.toBeNull()
    expect(captured!.pendingEffect).toBeNull()

    await act(() => {
      captured!.beginCardAbility(
        itemCard,
        {
          cost: { green: 2 },
          text: '測試',
          effects: [{ kind: 'support-to-trash', amount: 1 }],
        },
        'item',
        '使用物品',
      )
    })

    expect(captured!.pendingEffect).not.toBeNull()
    expect(captured!.currentEffect?.kind).toBe('support-to-trash')
    expect(captured!.supportEffectTargetIds.has(supportId)).toBe(true)
    expect(captured!.pendingEffect?.selectedTargetIds).toHaveLength(0)

    await act(() => {
      captured!.toggleEffectTarget(supportId)
    })

    expect(captured!.pendingEffect?.selectedTargetIds).toContain(supportId)

    await act(() => {
      captured!.toggleEffectTarget(supportId)
    })

    expect(captured!.pendingEffect?.selectedTargetIds).not.toContain(supportId)

    await act(() => root.unmount())
  })
})

function createAttackEffectPendingState(): GameState {
  const base = createBlueOptionalCostAttackDemoState(true)
  const attacker = base.players['player-one'].battleArea[0]
  return {
    ...base,
    pendingOptionalCostAttack: null,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        battleArea: [
          {
            ...attacker,
            card: {
              ...attacker.card,
              // 故意讓攻擊文字與技能文字不同，驗證 hook 給 UI 的是攻擊文字
              // （skill.text），不是卡牌固定的技能文字（effectText），對應
              // EffectPanel.tsx 先前誤讀欄位的 BS2-058 迴歸問題。
              attackText: '攻擊後續效果測試文字（應顯示於 skill.text）',
              effectText: 'OnPlay 技能文字（不應顯示於攻擊後續效果）',
            },
          },
        ],
      },
    },
    pendingBattle: {
      ...base.pendingBattle!,
      attackEffects: [
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
          condition: { kind: 'trash-count-at-least', count: 0 },
        },
      ],
    },
  }
}

describe('usePendingEffect attack-effect trigger', () => {
  it("sets pendingEffect.skill.text to the attacker's attackText, not its unrelated effectText (BS2-058 regression)", async () => {
    vi.useFakeTimers()
    const gameState = createAttackEffectPendingState()
    const setGameMock = vi.fn()
    let captured: ReturnType<typeof usePendingEffect> | null = null

    function TestHarness() {
      const pending = usePendingEffect({
        game: gameState,
        setGame: setGameMock,
        dispatch: createDispatch(gameState, setGameMock),
        viewerPlayerId: 'player-one',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {},
        hasAfterDamage: false,
        afterDamageTargetIds: new Set(),
        selectedAfterDamageTargetIds: [],
        afterDamageMinMax: { min: 0, max: 0 },
        setSelectedAfterDamageTargetIds: () => {},
      })
      captured = pending
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))
    await act(() => vi.runAllTimers())

    expect(captured).not.toBeNull()
    expect(captured!.pendingEffect).not.toBeNull()
    expect(captured!.pendingEffect?.sourceKind).toBe('attack')
    expect(captured!.pendingEffect?.skill.text).toBe(
      '攻擊後續效果測試文字（應顯示於 skill.text）',
    )
    expect(captured!.pendingEffect?.skill.text).not.toBe(
      'OnPlay 技能文字（不應顯示於攻擊後續效果）',
    )

    await act(() => root.unmount())
    vi.useRealTimers()
  })
})

describe('usePendingEffect optional-cost-attack', () => {
  it('asks the rules layer to create the pending decision from a real attack effect', async () => {
    vi.useFakeTimers()
    const gameState = createBlueOptionalCostAttackDemoState(true)
    gameState.pendingOptionalCostAttack = null
    const setGameMock = vi.fn()

    function TestHarness() {
      usePendingEffect({
        game: gameState,
        setGame: setGameMock,
        dispatch: createDispatch(gameState, setGameMock),
        viewerPlayerId: 'player-one',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {},
        hasAfterDamage: false,
        afterDamageTargetIds: new Set(),
        selectedAfterDamageTargetIds: [],
        afterDamageMinMax: { min: 0, max: 0 },
        setSelectedAfterDamageTargetIds: () => {},
      })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))
    await act(() => vi.runAllTimers())

    expect(setGameMock).toHaveBeenCalledTimes(1)
    const updateGame = setGameMock.mock.calls[0][0] as (
      state: GameState,
    ) => GameState
    const nextState = updateGame(gameState)
    expect(nextState.pendingOptionalCostAttack).toMatchObject({
      playerId: 'player-one',
      cost: { discardHand: 2 },
    })

    await act(() => root.unmount())
    vi.useRealTimers()
  })
})

/**
 * 靈魂果醬（BS3-019 等）的效果鏈是「造成傷害，Then 裝載到指定的餅乾」，
 * equip-source 用 requiredCookieId 鎖定唯一能裝載的目標卡號。執行層
 * （game/effects/execute.ts）本就會拒絕裝載到其他卡號，但本機互動精靈
 * 算候選名單時，equip-source 落入通用的 target 選擇器分支，完全沒套用
 * requiredCookieId 篩選——玩家戰鬥區只要有其他餅乾，UI 就會把它們也列成
 * 可裝載的候選，點下去才會在執行層被拒絕。
 */
describe('usePendingEffect equip-source candidate filtering', () => {
  const requiredCookie: CookieCard = {
    id: 'BS3-017',
    instanceId: 'hollyberry-1',
    name: 'Hollyberry Cookie',
    type: 'cookie',
    level: 3,
    hp: 5,
    attack: 3,
    attackCost: 2,
  }

  const otherCookie: CookieCard = {
    id: 'BS3-002',
    instanceId: 'other-cookie-1',
    name: 'Other Cookie',
    type: 'cookie',
    level: 1,
    hp: 3,
    attack: 1,
    attackCost: 1,
  }

  const soulJamCard: GameCard = {
    id: 'BS3-019',
    instanceId: 'soul-jam-1',
    name: 'Soul Jam: Light of Passion',
    type: 'item',
  }

  const equipAbility = {
    cost: {},
    text: '測試裝載',
    effects: [
      {
        kind: 'equip-source' as const,
        target: { side: 'self' as const, min: 0, max: 1 },
        requiredCookieId: 'BS3-017',
        attackBonus: 1,
      },
    ],
  }

  const renderWithBattleArea = async (
    battleArea: GameState['players']['player-one']['battleArea'],
  ) => {
    const baseGame = createItemUsageDemoState(true)
    const state: GameState = {
      ...baseGame,
      players: {
        ...baseGame.players,
        'player-one': {
          ...baseGame.players['player-one'],
          battleArea,
        },
      },
    }

    let captured: ReturnType<typeof usePendingEffect> | null = null
    function TestHarness() {
      captured = usePendingEffect({
        game: state,
        setGame: () => {},
        dispatch: createDispatch(state, () => {}),
        viewerPlayerId: 'player-one',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {},
        hasAfterDamage: false,
        afterDamageTargetIds: new Set(),
        selectedAfterDamageTargetIds: [],
        afterDamageMinMax: { min: 0, max: 0 },
        setSelectedAfterDamageTargetIds: () => {},
      })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))
    await act(() => {
      captured!.beginCardAbility(soulJamCard, equipAbility, 'item', '使用物品')
    })

    return { captured: captured!, root }
  }

  it('only offers the required Cookie, even when other Cookies share the battle area', async () => {
    const { captured, root } = await renderWithBattleArea([
      {
        card: requiredCookie,
        hpCards: [],
        rested: false,
        battleEntryId: 'hollyberry-1:battle:1',
      },
      {
        card: otherCookie,
        hpCards: [],
        rested: false,
        battleEntryId: 'other-cookie-1:battle:2',
      },
    ])

    expect(
      captured.effectTargetCandidates.map((cookie) => cookie.card.instanceId),
    ).toEqual(['hollyberry-1'])

    await act(() => root.unmount())
  })

  it('offers no candidates when the required Cookie is absent, even though other Cookies are present', async () => {
    const { captured, root } = await renderWithBattleArea([
      {
        card: otherCookie,
        hpCards: [],
        rested: false,
        battleEntryId: 'other-cookie-1:battle:1',
      },
    ])

    expect(captured.effectTargetCandidates).toEqual([])

    await act(() => root.unmount())
  })
})

/**
 * BS3-076《草莓可麗餅餅乾》的攻擊後續是「可選代價 → 展示牌庫頂 → 若為藍色
 * LV.2 餅乾，對攻擊對象追加 2 傷害」。巢狀 damage 帶 attackTargetOnly，所以
 * 規則層（battle.ts 的 finishBattle）會刻意保留 pendingBattle 讓它找得到攻擊
 * 目標，戰鬥要等 pendingAbilityEffect 結算完才收尾——commands.ts 的
 * resolvePendingAbilityEffect 也因此拿掉了 pendingBattle 前置檢查。
 *
 * 但本機互動精靈的 useEffect 仍然把 game.pendingBattle 當成阻擋條件，於是
 * pendingAbilityEffect 一旦在戰鬥中出現就永遠補建不出本機 pendingEffect：
 * 玩家看不到追加傷害的目標選擇畫面，對局直接卡死在攻擊後階段。
 */
describe('usePendingEffect nested attack effect during a preserved battle', () => {
  const buildStuckState = (): GameState => {
    const bs3076 = (officialBS3.cards as OfficialCardRecord[]).find(
      (card) => card.cardNumber === 'BS3-076',
    )
    if (!bs3076) throw new Error('Missing BS3-076 in the BS3 card data.')
    const conversion = convertOfficialCardToGameCard(bs3076)
    if (
      conversion.status !== 'converted' ||
      conversion.gameCard.type !== 'cookie'
    ) {
      throw new Error('BS3-076 should convert to a CookieCard.')
    }
    const crepe = { ...conversion.gameCard, instanceId: 'attacker' }

    let state = createBattleState()
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: crepe,
    }
    // 攻擊目標要撐得過普通攻擊傷害才輪得到追加傷害（重現使用者的實際盤面）。
    state.players['player-one'].battleArea[0] = {
      ...state.players['player-one'].battleArea[0],
      hpCards: Array.from({ length: 8 }, (_, index) =>
        battleItem(`defender-hp-${index}`),
      ),
    }
    // 牌庫頂放藍色 LV.2 餅乾，讓 reveal-top-deck 命中條件。
    state.players['player-two'].deck = [
      {
        id: 'blue-lv2',
        instanceId: 'blue-lv2',
        name: 'Blue LV2',
        type: 'cookie',
        level: 2,
        energyColor: 'blue',
        hp: 1,
        attack: 0,
        attackCost: 0,
      },
      battleItem('deck-filler'),
    ]
    state.players['player-two'].supportArea = Array.from(
      { length: 6 },
      (_, index) => ({
        card: { ...battleItem(`blue-sup-${index + 1}`), energyColor: 'blue' as const },
        rested: false,
      }),
    )

    state = beginAttack(
      state,
      'attacker',
      'defender',
      ['blue-sup-1', 'blue-sup-2', 'blue-sup-3'].slice(0, crepe.attackCost),
    )
    state = skipTrap(state, 'player-one')
    let guard = 0
    while (state.pendingBattle?.stage === 'damage' && guard++ < 20) {
      state = resolveNextDamage(state)
    }

    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeTruthy()

    // 代價是「將這隻餅乾當作 {B}」，不需另外選支援卡付費。
    state = resolveOptionalCostAttack(state, 'player-two', 'pay', [], [], [])
    expect(state.pendingRevealTopDeck?.matched).toBe(true)

    state = applyGameCommand(state, {
      kind: 'resolve-reveal-top-deck',
      playerId: 'player-two',
    })
    return state
  }

  it('builds the local pendingEffect even though pendingBattle is still held open', async () => {
    vi.useFakeTimers()
    const gameState = buildStuckState()

    // 前提：規則層確實留下了待結算效果，且刻意保留 pendingBattle。
    expect(gameState.pendingAbilityEffect).toBeDefined()
    expect(gameState.pendingBattle).not.toBeNull()

    let captured: ReturnType<typeof usePendingEffect> | null = null
    function TestHarness() {
      captured = usePendingEffect({
        game: gameState,
        setGame: () => {},
        dispatch: createDispatch(gameState, () => {}),
        viewerPlayerId: 'player-two',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {},
        hasAfterDamage: false,
        afterDamageTargetIds: new Set(),
        selectedAfterDamageTargetIds: [],
        afterDamageMinMax: { min: 0, max: 0 },
        setSelectedAfterDamageTargetIds: () => {},
      })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))
    await act(() => vi.runAllTimers())

    expect(captured!.pendingEffect).not.toBeNull()
    expect(captured!.currentEffect).toMatchObject({
      kind: 'damage',
      amount: 2,
    })
    // attackTargetOnly 要能鎖定當次攻擊目標，才有得選。
    expect(
      captured!.effectTargetCandidates.map((cookie) => cookie.card.instanceId),
    ).toEqual(['defender'])

    await act(() => root.unmount())
    vi.useRealTimers()
  })
})
