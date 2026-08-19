import { describe, expect, it } from 'vitest'
import officialBS6Inventory from '../../data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json'
import { convertOfficialCookieSkill } from '../cards/official-effect-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  executeCardEffect,
  getEffectTargetCandidates,
} from './effects'
import type { CardEffect, EffectContext, GameState } from './types'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'

const findBs6Card = (cardNumber: string) => {
  const card = (officialBS6Inventory.cards as OfficialCardRecord[]).find(
    (candidate) => candidate.cardNumber === cardNumber,
  )

  if (!card) throw new Error(`Missing BS6 inventory card ${cardNumber}`)
  return card
}

const damageEffect = (): Extract<CardEffect, { kind: 'damage-all' }> => {
  const skill = convertOfficialCookieSkill(findBs6Card('BS6-023'))
  const effect = skill?.effects[1]
  if (effect?.kind !== 'damage-all') {
    throw new Error('BS6-023 should have a follow-up damage-all effect.')
  }
  return effect
}

const sourceContext: EffectContext = {
  sourcePlayerId: 'player-two',
  sourceInstanceId: 'attacker',
  sourceCardName: 'Dark Fondue Cookie',
}

const stateWithTwoOpponentCookies = (): GameState => {
  const state = createBattleState()
  return {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        battleArea: [
          {
            card: cookie('first-target', 1, 2),
            hpCards: [item('first-hp-1'), item('first-hp-2')],
            rested: false,
            battleEntryId: 'first-target:battle:1',
          },
          {
            card: cookie('second-target', 1, 2),
            hpCards: [item('second-hp-1'), item('second-hp-2')],
            rested: false,
            battleEntryId: 'second-target:battle:2',
          },
        ],
      },
    },
  }
}

describe('BS6-023 Dark Fondue Cookie: sequential On Play damage', () => {
  it('exposes every opponent Cookie as an ordered target', () => {
    const effect = damageEffect()
    expect(effect).toMatchObject({
      sequential: true,
      target: { side: 'opponent', min: 1, max: 2 },
    })

    const state = stateWithTwoOpponentCookies()
    const candidates = getEffectTargetCandidates(
      state,
      sourceContext,
      effect.target!,
    )
    expect(candidates.map((target) => target.card.instanceId)).toEqual([
      'first-target',
      'second-target',
    ])
  })

  it('starts damage on the chosen first target and keeps the second target pending', () => {
    const state = stateWithTwoOpponentCookies()
    const effect = damageEffect()
    const next = executeCardEffect(
      state,
      sourceContext,
      effect,
      ['second-target', 'first-target'],
    )

    expect(next.players['player-one'].battleArea).toHaveLength(2)
    expect(next.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
    expect(next.players['player-one'].battleArea[1].hpCards).toHaveLength(2)
    expect(next.pendingBattle).toMatchObject({
      stage: 'damage',
      targetInstanceId: 'second-target',
      effectDamageSequence: {
        remainingTargetInstanceIds: ['first-target'],
      },
    })
  })
})
