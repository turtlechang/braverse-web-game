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
  const target = battleEntry(opened, 'bs9-bs9-031-trigger')
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
    // The FLIP is revealed inside P-018's effect-damage sequence; that
    // sequence resumes after the explicit draw decision.
    battleContinuation: undefined,
  })
  expect(battleEntry(state, target.card.instanceId).hpCards).toHaveLength(5)
  expect(state.players['player-one'].hand).toHaveLength(2)
  expect(state.players['player-one'].discardPile).toContainEqual(
    expect.objectContaining({ id: 'BS9-031' }),
  )
  state = applyGameCommand(state, {
    kind: 'resolve-draw-up-to',
    playerId: 'player-one',
    drawCount,
  })
  // Finish the explicit effect-damage continuation, matching the Browser
  // card-check auto-advance after the draw modal closes.
  if (state.pendingBattle) {
    state = applyGameCommand(state, {
      kind: 'resolve-next-damage',
      playerId: 'player-one',
    })
  }
  return state
}

const openOwnTurnFlip = (initial: GameState): GameState => {
  const trigger = initial.players['player-one'].hand.find((card) => card.id === 'P-018')
  if (!trigger) throw new Error('BS9-031 fixture has no Mustard Cookie trigger')
  let state = applyGameCommand(initial, {
    kind: 'deploy-cookie',
    playerId: 'player-one',
    instanceId: trigger.instanceId,
  })
  const discard = state.players['player-one'].hand[0]
  if (!discard) throw new Error('BS9-031 fixture has no On Play discard candidate')
  state = applyGameCommand(state, {
    kind: 'begin-activate-skill',
    playerId: 'player-one',
    sourceInstanceId: trigger.instanceId,
    trigger: 'on-play',
    paymentIds: [],
    discardHandIds: [discard.instanceId],
    targetIds: [],
  })
  state = applyGameCommand(state, {
    kind: 'resolve-ability-effect',
    playerId: 'player-one',
    targetIds: [],
  })
  return applyGameCommand(state, {
    kind: 'resolve-next-damage',
    playerId: 'player-one',
  })
}

describe('BS9-031 Alchemist Cookie FLIP candidate', () => {
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
    }))).toEqual([{ id: 'P-018', level: 3 }])
    expect(isEffectConditionMet(state, context, flipEffect(state, 1))).toBe(true)
    expect(isEffectConditionMet({ ...state, activePlayerId: 'player-two' }, context, flipEffect(state, 1))).toBe(false)

    const target = battleEntry(state, 'bs9-bs9-031-trigger')
    const lv2 = battleEntry(state, 'bs9-bs9-031-effect-target')
    expect(() => resolveFlip(state, 'player-one', {
      activate: true,
      discardHandIds: [],
      targetIds: [target.card.instanceId],
    })).toThrow('Must discard exactly 1')
    expect(() => resolveFlip(state, 'player-one', {
      activate: true,
      discardHandIds: [state.players['player-one'].hand[0]!.instanceId],
      targetIds: [lv2.card.instanceId],
    })).toThrow()
  })

  it('resolves the own-turn Then draw as an explicit 0-or-1 decision and finishes the battle', () => {
    const drawZero = resolveBs9031(createCardCheckDemoState('BS9-031'), 0)
    expect(drawZero.pendingDrawUpTo).toBeNull()
    expect(drawZero.pendingBattle).toBeNull()
    expect(drawZero.players['player-one'].hand).toHaveLength(2)
    expect(drawZero.players['player-one'].deck).toHaveLength(19)

    const drawOne = resolveBs9031(createCardCheckDemoState('BS9-031'), 1)
    expect(drawOne.pendingDrawUpTo).toBeNull()
    expect(drawOne.pendingBattle).toBeNull()
    expect(drawOne.players['player-one'].hand).toHaveLength(3)
    expect(drawOne.players['player-one'].deck).toHaveLength(18)
    expect(battleEntry(drawOne, 'bs9-bs9-031-trigger').hpCards).toHaveLength(5)
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
