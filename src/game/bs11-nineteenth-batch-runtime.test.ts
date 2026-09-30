import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { resolveAttackEffect, resolveOptionalCostAttack } from './battle'
import { getEffectiveAttack, getEffectiveAttackBreakdown } from './effects/combat'
import { createBattleState, item } from './test-helpers/battle-helpers'
import type {
  CookieCard,
  CookieInBattle,
  GameCard,
  GameState,
} from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(
    record,
    `bs11-nineteenth-${suffix}`,
  )
  if (result.status !== 'converted') {
    throw new Error(`${cardNumber}: ${result.reason}`)
  }
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const cookieEntry = (
  card: GameCard,
  hpCards: GameCard[],
): CookieInBattle => {
  if (card.type !== 'cookie') throw new Error(`Expected Cookie: ${card.name}`)
  return {
    card: card as CookieCard,
    hpCards,
    rested: false,
    battleEntryId: `${card.instanceId}:battle`,
  }
}

const makeCaramelArrowAttackState = (trashCount: number): {
  state: GameState
  attacker: GameCard
  defender: CookieInBattle
  payment: GameCard
} => {
  const base = createBattleState()
  const attacker = candidate('BS11-078', 'attacker')
  if (attacker.type !== 'cookie' || !attacker.attackEffects) {
    throw new Error('Caramel Arrow attack mapping missing')
  }
  const defender = cookieEntry(
    base.players['player-one'].battleArea[0].card,
    [item('bs11-078:defender-hp-1'), item('bs11-078:defender-hp-2')],
  )
  const payment = item('bs11-078:payment', 'purple')
  const attackerEntry = cookieEntry(
    attacker,
    [item('bs11-078:attacker-hp')],
  )
  return {
    state: {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [defender],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [attackerEntry],
          supportArea: [{ card: payment, rested: false }],
          discardPile: Array.from(
            { length: trashCount },
            (_, index) => item(`bs11-078:trash-${index}`),
          ),
        },
      },
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: attacker.instanceId,
        targetInstanceId: defender.card.instanceId,
        declaredDamage: attacker.attack,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: attacker.attackEffects,
        attackEffectIndex: 0,
      },
    },
    attacker,
    defender,
    payment,
  }
}

describe('BS11-077 Dark Spirit Helmet runtime', () => {
  it('gives only the named allied Dark Choco Cookie +1 attack at 15+ trash', () => {
    const base = createBattleState()
    const helmet = candidate('BS11-077', 'helmet')
    const darkChoco = candidate('BS11-072', 'dark-choco')
    const unrelated = candidate('BS11-074', 'unrelated')
    if (
      helmet.type !== 'cookie' ||
      darkChoco.type !== 'cookie' ||
      unrelated.type !== 'cookie'
    ) {
      throw new Error('BS11-077 runtime fixtures must all be Cookies')
    }
    const darkChocoEntry = cookieEntry(darkChoco, [item('bs11-077:dark-choco-hp')])
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            cookieEntry(helmet, [item('bs11-077:helmet-hp')]),
            darkChocoEntry,
            cookieEntry(unrelated, [item('bs11-077:unrelated-hp')]),
          ],
          discardPile: Array.from(
            { length: 15 },
            (_, index) => item(`bs11-077:trash-${index}`),
          ),
        },
      },
    }

    expect(getEffectiveAttack(state, darkChoco.instanceId)).toBe(darkChoco.attack + 1)
    expect(getEffectiveAttack(state, unrelated.instanceId)).toBe(unrelated.attack)
    expect(getEffectiveAttackBreakdown(state, darkChoco.instanceId)).toMatchObject({
      effective: darkChoco.attack + 1,
      entries: [{ sourceCardName: 'Dark Spirit Helmet', amount: 1 }],
    })

    const belowThreshold = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          discardPile: state.players['player-two'].discardPile.slice(0, 14),
        },
      },
    }
    expect(getEffectiveAttack(belowThreshold, darkChoco.instanceId)).toBe(darkChoco.attack)
  })
})

describe('BS11-078 Caramel Arrow Cookie runtime', () => {
  it('requires 15 cards in the attacker trash, then pays 1P and trashes the selected Cookie top HP', () => {
    const scenario = makeCaramelArrowAttackState(15)
    const pending = resolveAttackEffect(
      scenario.state,
      'player-two',
      [],
    )
    expect(pending.pendingOptionalCostAttack).toMatchObject({
      cost: { energy: { purple: 1 }, discardHand: 0 },
      effects: [{ kind: 'hp-to-trash', amount: 1 }],
    })

    const resolved = resolveOptionalCostAttack(
      pending,
      'player-two',
      'pay',
      [],
      [scenario.defender.card.instanceId],
      [scenario.payment.instanceId],
    )
    expect(resolved.pendingOptionalCostAttack ?? null).toBeNull()
    expect(resolved.pendingBattle).toBeNull()
    expect(
      resolved.players['player-one'].battleArea[0].hpCards,
    ).toHaveLength(1)
    expect(
      resolved.players['player-one'].discardPile,
    ).toContainEqual(expect.objectContaining({ instanceId: 'bs11-078:defender-hp-2' }))
    expect(resolved.players['player-two'].supportArea[0].rested).toBe(true)
  })

  it('skips the optional attack effect below the 15-card trash threshold', () => {
    const scenario = makeCaramelArrowAttackState(14)
    const resolved = resolveAttackEffect(
      scenario.state,
      'player-two',
      [],
    )
    expect(resolved.pendingOptionalCostAttack ?? null).toBeNull()
    expect(resolved.pendingBattle).toBeNull()
    expect(resolved.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
  })
})
