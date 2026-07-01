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
import type { CookieCard, GameCard, GameState } from '../game'

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
        viewerPlayerId: 'player-one',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {},
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

  it('does not call skipCookieOnPlay when canceling activate skill', async () => {
    const gameState = createDiscardHandSkillGameState()
    const setGameMock = vi.fn()
    let captured: ReturnType<typeof usePendingEffect> | null = null

    function TestHarness() {
      const pending = usePendingEffect({
        game: gameState,
        setGame: setGameMock,
        viewerPlayerId: 'player-one',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {},
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

  it('does not allow cancel when sourceKind is not cookie', async () => {
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
        viewerPlayerId: 'player-one',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {},
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

    expect(captured!.pendingEffect).not.toBeNull()

    await act(() => root.unmount())
  })

  it('confirm is disabled when discardHand selection is insufficient', async () => {
    const gameState = createDiscardHandSkillGameState()
    let captured: ReturnType<typeof usePendingEffect> | null = null

    function TestHarness() {
      const pending = usePendingEffect({
        game: gameState,
        setGame: () => {},
        viewerPlayerId: 'player-one',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {},
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
        viewerPlayerId: 'player-one',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {},
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
        viewerPlayerId: 'player-one',
        setMessage: () => {},
        clearAttacker: () => {},
        setInspectedHpPile: () => {},
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {},
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
