import { describe, expect, it } from 'vitest'
import bs9Candidates from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import {
  executeCardEffect,
  getFixedModifierTargetIds,
  hasFixedModifierTargets,
  isEffectConditionMet,
} from './effects'
import type { CookieCard } from './types'

const records = bs9Candidates.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string) => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  const conversion = convertOfficialCardToGameCard(record, 'bs9-038-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

describe('BS9-038 Chess Choco Cookie candidate', () => {
  it('converts the another-copy condition and fixed all-friendly HP gain', () => {
    expect(candidate('BS9-038')).toMatchObject({
      id: 'BS9-038',
      name: 'Chess Choco Cookie',
      level: 2,
      hp: 4,
      attack: 3,
      attackEnergyCost: { yellow: 3 },
      skill: {
        trigger: 'on-play',
        cost: { energy: {}, discardHand: 0 },
        effects: [{
          kind: 'gain-hp',
          amount: 1,
          target: { side: 'self', min: 1, max: 2, allMatching: true },
          condition: {
            kind: 'battle-area-has-named-cookie',
            side: 'self',
            name: 'Chess Choco Cookie',
            excludeSource: true,
          },
        }],
      },
    })
  })

  it('requires a distinct same-name Cookie and gives exactly one HP to every friendly Cookie', () => {
    const source = candidate('BS9-038') as CookieCard
    const effect = source.skill!.effects[0]!
    const base = createCardCheckDemoState('BS9-033')
    const sourceEntry = {
      ...base.players['player-one'].battleArea[0]!,
      card: source,
    }
    const context = {
      sourcePlayerId: 'player-one' as const,
      sourceInstanceId: source.instanceId,
    }
    const loneState = {
      ...base,
      players: {
        ...base.players,
        'player-one': { ...base.players['player-one'], battleArea: [sourceEntry] },
      },
    }
    expect(isEffectConditionMet(loneState, context, effect)).toBe(false)

    const twin = { ...source, instanceId: 'bs9-038-twin' }
    const twinEntry = {
      ...sourceEntry,
      card: twin,
      hpCards: sourceEntry.hpCards.map((card, index) => ({
        ...card,
        instanceId: `bs9-038-twin-hp-${index}`,
      })),
    }
    const pairedState = {
      ...loneState,
      players: {
        ...loneState.players,
        'player-one': {
          ...loneState.players['player-one'],
          battleArea: [sourceEntry, twinEntry],
        },
      },
    }
    expect(isEffectConditionMet(pairedState, context, effect)).toBe(true)
    expect(hasFixedModifierTargets(effect)).toBe(true)
    expect(getFixedModifierTargetIds(pairedState, context, effect)).toEqual([
      source.instanceId,
      twin.instanceId,
    ])
    const resolved = executeCardEffect(
      pairedState,
      context,
      effect,
      [source.instanceId, twin.instanceId],
    )
    expect(resolved.players['player-one'].battleArea.map(
      (entry) => entry.hpCards.length,
    )).toEqual([sourceEntry.hpCards.length + 1, twinEntry.hpCards.length + 1])
    expect(resolved.players['player-two'].battleArea.map(
      (entry) => entry.hpCards.length,
    )).toEqual(base.players['player-two'].battleArea.map((entry) => entry.hpCards.length))
  })

  it('uses the real On Play command path and requires the complete friendly target set', () => {
    const state = createCardCheckDemoState('BS9-038')
    const source = state.players['player-one'].hand.find((card) => card.id === 'BS9-038')!
    const deployed = applyGameCommand(state, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: source.instanceId,
    })
    const started = applyGameCommand(deployed, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'on-play',
      paymentIds: [],
    })
    const targetIds = started.players['player-one'].battleArea.map(
      (entry) => entry.card.instanceId,
    )
    expect(() => applyGameCommand(started, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: targetIds.slice(0, 1),
    })).toThrow('所有符合條件')
    const hpBefore = started.players['player-one'].battleArea.map((entry) => entry.hpCards.length)
    const resolved = applyGameCommand(started, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds,
    })
    expect(resolved.players['player-one'].battleArea.map(
      (entry) => entry.hpCards.length,
    )).toEqual(hpBefore.map((amount) => amount + 1))
  })
})
