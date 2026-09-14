import { describe, expect, it } from 'vitest'
import bs9Candidates from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  createCardCheckDemoState,
  createCardNegativeDemoState,
  parseTestStateConfig,
} from './demo'
import { applyGameCommand } from './commands'
import { getEffectTargetCandidates } from './effects'
import type { CardEffect, EffectContext, GameState } from './types'

const records = bs9Candidates.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string) => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  const conversion = convertOfficialCardToGameCard(record, 'bs9-032-test')
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

const openOwnTurnFlip = (initial: GameState): GameState => {
  const trigger = initial.players['player-one'].hand.find((card) => card.id === 'P-018')
  if (!trigger) throw new Error('BS9-032 fixture has no Mustard Cookie trigger')
  let state = applyGameCommand(initial, {
    kind: 'deploy-cookie',
    playerId: 'player-one',
    instanceId: trigger.instanceId,
  })
  const discard = state.players['player-one'].hand[0]
  if (!discard) throw new Error('BS9-032 fixture has no On Play discard candidate')
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

const finishPendingDamage = (initial: GameState): GameState => {
  let state = initial
  while (state.pendingBattle?.stage === 'damage') {
    state = applyGameCommand(state, {
      kind: 'resolve-next-damage',
      playerId: 'player-one',
    })
  }
  return state
}

const openSetActiveThen = (initial: GameState, drawCount: number): GameState => {
  let state = applyGameCommand(initial, {
    kind: 'resolve-flip',
    playerId: 'player-one',
    activate: true,
    discardHandIds: [],
    targetIds: [],
  })
  expect(state.pendingDrawUpTo).toMatchObject({
    playerId: 'player-one',
    max: 1,
    sourceCardName: 'Yoga Cookie',
  })
  state = applyGameCommand(state, {
    kind: 'resolve-draw-up-to',
    playerId: 'player-one',
    drawCount,
  })
  expect(state.pendingAbilityEffect).toMatchObject({
    playerId: 'player-one',
    sourceCardName: 'Yoga Cookie',
    sourceKind: 'flip',
    effectIndex: 0,
  })
  return state
}

describe('BS9-032 Yoga Cookie FLIP candidate', () => {
  it('converts the printed draw and own-turn set-active sequence', () => {
    const card = candidate('BS9-032')
    expect(card.id).toBe('BS9-032')
    expect(card.name).toBe('Yoga Cookie')
    expect(card.flip).toMatchObject({
      cost: { energy: {}, discardHand: 0 },
      effects: [
        { kind: 'draw-up-to', max: 1 },
        {
          kind: 'set-cookie-active',
          target: { side: 'self', min: 0, max: 1, restedOnly: true },
          condition: { kind: 'activated-during-your-turn' },
        },
      ],
    })
  })

  it('continues from draw 0 or 1 into only rested friendly Cookie targets', () => {
    for (const drawCount of [0, 1]) {
      const opened = openOwnTurnFlip(createCardCheckDemoState('BS9-032'))
      const state = openSetActiveThen(opened, drawCount)
      const pending = state.pendingAbilityEffect!
      const effect = pending.effects[pending.effectIndex] as CardEffect
      if (effect.kind !== 'set-cookie-active' || !effect.target) {
        throw new Error('BS9-032 Then should be a targeted set-active effect')
      }
      const context: EffectContext = {
        sourcePlayerId: pending.sourcePlayerId,
        sourceInstanceId: pending.sourceInstanceId,
        sourceCardName: pending.sourceCardName,
      }
      expect(
        getEffectTargetCandidates(state, context, effect.target).map(
          (entry) => entry.card.instanceId,
        ),
      ).toEqual(['bs9-bs9-032-effect-target'])
      expect(battleEntry(state, 'bs9-bs9-032-effect-target').rested).toBe(true)
      expect(() => applyGameCommand(state, {
        kind: 'resolve-ability-effect',
        playerId: 'player-one',
        targetIds: ['bs9-bs9-032-trigger'],
      })).toThrow()
    }
  })

  it('sets the selected Cookie active while preserving the legal choose-zero branch', () => {
    const selected = openSetActiveThen(
      openOwnTurnFlip(createCardCheckDemoState('BS9-032')),
      1,
    )
    const selectedThenResolved = applyGameCommand(selected, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: ['bs9-bs9-032-effect-target'],
    })
    expect(selectedThenResolved.pendingAbilityEffect).toBeUndefined()
    expect(selectedThenResolved.pendingBattle?.effectDamageSequence).toBeDefined()
    const selectedResolved = finishPendingDamage(selectedThenResolved)
    expect(battleEntry(selectedResolved, 'bs9-bs9-032-effect-target').rested).toBe(false)

    const skipped = openSetActiveThen(
      openOwnTurnFlip(createCardCheckDemoState('BS9-032')),
      0,
    )
    const skippedThenResolved = applyGameCommand(skipped, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(skippedThenResolved.pendingAbilityEffect).toBeUndefined()
    expect(skippedThenResolved.pendingBattle?.effectDamageSequence).toBeDefined()
    const skippedResolved = finishPendingDamage(skippedThenResolved)
    expect(battleEntry(skippedResolved, 'bs9-bs9-032-effect-target').rested).toBe(true)
  })

  it('keeps the draw but skips Then outside the FLIP owner turn', () => {
    const initial = createCardNegativeDemoState('BS9-032')
    expect(initial.activePlayerId).toBe('player-two')
    let state = applyGameCommand(initial, {
      kind: 'resolve-flip',
      playerId: 'player-one',
      activate: true,
      discardHandIds: [],
      targetIds: [],
    })
    state = applyGameCommand(state, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 1,
    })
    expect(state.pendingAbilityEffect?.sourceCardName).not.toBe('Yoga Cookie')
    expect(battleEntry(state, 'bs9-bs9-032-effect-target').rested).toBe(true)
  })

  it('keeps the candidate routes isolated to localhost', () => {
    expect(parseTestStateConfig('?test-state=bs9-card:BS9-032', 'localhost')).toEqual({
      kind: 'bs9-candidate',
      cardNumber: 'BS9-032',
      negative: false,
    })
    expect(parseTestStateConfig(
      '?test-state=bs9-card-negative:BS9-032',
      'localhost',
    )).toEqual({
      kind: 'bs9-candidate',
      cardNumber: 'BS9-032',
      negative: true,
    })
    expect(parseTestStateConfig(
      '?test-state=bs9-card:BS9-032',
      'braverse.example',
    )).toBeNull()
  })
})
