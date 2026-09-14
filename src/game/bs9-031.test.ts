import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import bs9Candidates from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import {
  createCardCheckDemoState,
  createCardNegativeDemoState,
  parseTestStateConfig,
} from './demo'
import { applyGameCommand } from './commands'
import { getEffectTargetCandidates, getEffectSelectionLimits, isEffectConditionMet } from './effects'
import { resolveFlip } from './battle'
import type { CardEffect, EffectContext, GameCard, GameState } from './types'

const records = bs9Candidates.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber) ??
    records.find((card) => card.baseCardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  const conversion = convertOfficialCardToGameCard(record, 'bs9-031-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

const battleEntry = (state: GameState, instanceId: string) => {
  const entry = state.players['player-one'].battleArea.find(
    (candidateEntry) => candidateEntry.card.instanceId === instanceId,
  )
  if (!entry) throw new Error(`Missing battle entry ${instanceId}`)
  return entry
}

const flipEffect = (state: GameState, index: number): CardEffect => {
  const effect = state.pendingBattle?.revealedHpCard?.flip?.effects[index]
  if (!effect) throw new Error(`Missing BS9-031 FLIP effect ${index}`)
  return effect
}

const resolveBs9031 = (initial: GameState, drawCount: number): GameState => {
  const opened = openOwnTurnFlip(initial)
  const target = battleEntry(opened, 'bs9-030-demo-extra')
  const discard = opened.players['player-one'].hand[0]
  if (!discard) throw new Error('BS9-031 fixture has no discard candidate')
  let state = applyGameCommand(opened, {
    kind: 'resolve-flip',
    playerId: 'player-one',
    activate: true,
    discardHandIds: [discard.instanceId],
    targetIds: [target.card.instanceId],
  })
  expect(state.pendingDrawUpTo).toMatchObject({
    playerId: 'player-one',
    max: 1,
    sourceCardName: 'Alchemist Cookie',
    condition: { kind: 'activated-during-your-turn' },
    battleContinuation: 'attack-effect',
  })
  expect(battleEntry(state, target.card.instanceId).hpCards).toHaveLength(7)
  expect(state.players['player-one'].hand).toHaveLength(0)
  expect(state.players['player-one'].discardPile).toContainEqual(
    expect.objectContaining({ id: 'BS9-031' }),
  )
  state = applyGameCommand(state, {
    kind: 'resolve-draw-up-to',
    playerId: 'player-one',
    drawCount,
  })
  return state
}

const openOwnTurnFlip = (initial: GameState): GameState => {
  const detachedFlip = initial.players['player-one'].hand.find((card) => card.id === 'BS9-031')
  if (!detachedFlip) throw new Error('BS9-031 fixture has no detached FLIP card')
  const state = applyGameCommand(initial, {
    kind: 'resolve-optional-cost-attack',
    playerId: 'player-one',
    action: 'pay',
    discardCardIds: [detachedFlip.instanceId],
    paymentIds: [],
  })
  expect(state.pendingBattle?.detachedFlip).toBe(true)
  expect(state.pendingBattle?.revealedHpCard?.id).toBe('BS9-031')
  return state
}

describe('BS9-031 Alchemist Cookie FLIP candidate', () => {
  it('opens BS9 FLIP verification from Shadow Milk Cookie attack-after', () => {
    for (const cardNumber of ['BS9-031', 'BS9-031@1', 'BS9-031@2', 'BS9-032']) {
      const state = createCardCheckDemoState(cardNumber)
      expect(state.pendingBattle?.stage).toBe('attack-effect')
      expect(state.pendingBattle?.attackerInstanceId).toBe('bs9-030-demo-extra')
      expect(state.pendingOptionalCostAttack).toMatchObject({
        sourceCardName: 'Shadow Milk Cookie',
        effects: [{ kind: 'activate-discarded-flip' }],
      })
      expect(state.players['player-one'].hand).toContainEqual(
        expect.objectContaining({ id: cardNumber.split('@')[0] }),
      )
    }
  })

  it('converts the base card and both official variants with the printed boundaries', () => {
    for (const cardNumber of ['BS9-031', 'BS9-031@1', 'BS9-031@2']) {
      const card = candidate(cardNumber)
      // The runtime identity is the base card number; alternate-art records
      // retain their official variant through the source record, not a new
      // gameplay card id.
      expect(card.id).toBe('BS9-031')
      expect(card.name).toBe('Alchemist Cookie')
      expect(card.flip).toMatchObject({
        cost: { energy: {}, discardHand: 1 },
        effects: [
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 1, max: 1, minLevel: 3 },
          },
          {
            kind: 'draw-up-to',
            max: 1,
            condition: { kind: 'activated-during-your-turn' },
          },
        ],
      })
    }
  })

  it('uses only a real LV.3 Cookie as the HP target and rejects invalid payment or targets', () => {
    const state = openOwnTurnFlip(createCardCheckDemoState('BS9-031'))
    const context: EffectContext = {
      sourcePlayerId: 'player-one',
      sourceInstanceId: state.pendingBattle!.revealedHpCard!.instanceId,
    }
    const gainHp = flipEffect(state, 0)
    if (gainHp.kind !== 'gain-hp' || !gainHp.target) {
      throw new Error('BS9-031 first FLIP effect should target a Cookie')
    }
    expect(getEffectSelectionLimits(gainHp)).toEqual({
      side: 'self',
      min: 1,
      max: 1,
      minLevel: 3,
    })
    expect(getEffectTargetCandidates(state, context, gainHp.target).map((entry) => ({
      id: entry.card.id,
      level: entry.card.level,
    }))).toEqual([{ id: 'BS9-030', level: 3 }])
    expect(isEffectConditionMet(state, context, flipEffect(state, 1))).toBe(true)
    expect(isEffectConditionMet({ ...state, activePlayerId: 'player-two' }, context, flipEffect(state, 1))).toBe(false)

    const target = battleEntry(state, 'bs9-030-demo-extra')
    const opponentTarget = state.players['player-two'].battleArea[0]
    if (!opponentTarget) throw new Error('BS9-031 test requires an opponent target')
    expect(() => resolveFlip(state, 'player-one', {
      activate: true,
      discardHandIds: [],
      targetIds: [target.card.instanceId],
    })).toThrow('Must discard exactly 1')
    expect(() => resolveFlip(state, 'player-one', {
      activate: true,
      discardHandIds: [state.players['player-one'].hand[0]!.instanceId],
      targetIds: [opponentTarget.card.instanceId],
    })).toThrow()
  })

  it('resolves the own-turn Then draw as an explicit 0-or-1 decision and finishes the battle', () => {
    const drawZero = resolveBs9031(createCardCheckDemoState('BS9-031'), 0)
    expect(drawZero.pendingDrawUpTo).toBeNull()
    expect(drawZero.pendingBattle).toBeNull()
    expect(drawZero.players['player-one'].hand).toHaveLength(0)
    expect(drawZero.players['player-one'].deck).toHaveLength(46)

    const drawOne = resolveBs9031(createCardCheckDemoState('BS9-031'), 1)
    expect(drawOne.pendingDrawUpTo).toBeNull()
    expect(drawOne.pendingBattle).toBeNull()
    expect(drawOne.players['player-one'].hand).toHaveLength(1)
    expect(drawOne.players['player-one'].deck).toHaveLength(45)
    expect(battleEntry(drawOne, 'bs9-030-demo-extra').hpCards).toHaveLength(7)
  })

  it('keeps the HP gain but skips Then when the FLIP owner is not taking their turn', () => {
    const initial = createCardNegativeDemoState('BS9-031')
    const target = battleEntry(initial, 'bs9-bs9-031-trigger')
    const discard = initial.players['player-one'].hand[0]!
    const state = applyGameCommand(initial, {
      kind: 'resolve-flip',
      playerId: 'player-one',
      activate: true,
      discardHandIds: [discard.instanceId],
      targetIds: [target.card.instanceId],
    })
    let resolved = state
    if (resolved.pendingBattle) {
      resolved = applyGameCommand(resolved, {
        kind: 'resolve-next-damage',
        playerId: 'player-one',
      })
    }
    expect(resolved.activePlayerId).toBe('player-two')
    expect(resolved.pendingDrawUpTo ?? null).toBeNull()
    expect(resolved.pendingBattle).toBeNull()
    expect(resolved.players['player-one'].hand).toHaveLength(2)
    expect(resolved.players['player-one'].deck).toHaveLength(19)
    expect(battleEntry(resolved, target.card.instanceId).hpCards).toHaveLength(5)
    expect(resolved.players['player-one'].discardPile).toContainEqual(
      expect.objectContaining({ id: 'BS9-031' }),
    )
  })

  it('keeps the BS9 candidate routes isolated to localhost', () => {
    expect(parseTestStateConfig('?test-state=bs9-card:BS9-031', 'localhost')).toEqual({
      kind: 'bs9-candidate', cardNumber: 'BS9-031', negative: false,
    })
    expect(parseTestStateConfig('?test-state=bs9-card-negative:BS9-031@1', 'localhost')).toEqual({
      kind: 'bs9-candidate', cardNumber: 'BS9-031@1', negative: true,
    })
    expect(parseTestStateConfig('?test-state=bs9-card:BS9-031', 'braverse.example')).toBeNull()
  })
})
