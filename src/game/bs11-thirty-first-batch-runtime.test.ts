import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  beginAttack,
  resolveAttackEffect,
  resolveNextDamage,
  skipTrap,
} from '.'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'
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
    `bs11-thirty-first-${suffix}`,
  )
  if (result.status !== 'converted') {
    throw new Error(`${cardNumber}: ${result.reason}`)
  }
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const cookieEntry = (card: GameCard, hpCards: GameCard[]): CookieInBattle => {
  if (card.type !== 'cookie') throw new Error(`Expected Cookie: ${card.name}`)
  return {
    card: card as CookieCard,
    hpCards,
    rested: false,
    battleEntryId: `${card.instanceId}:battle`,
  }
}

const attackState = (
  source: GameCard,
  paymentColor: GameCard['energyColor'],
  options: { opponentTrashCount?: number; specialPlayAlly?: GameCard } = {},
): GameState => {
  const base = createBattleState()
  const defender = cookie(`bs11-thirty-first-${source.instanceId}-defender`, 1, 1)
  const sourceEntry = cookieEntry(source, [item(`${source.instanceId}:hp`), item(`${source.instanceId}:hp-2`), item(`${source.instanceId}:hp-3`), item(`${source.instanceId}:hp-4`), item(`${source.instanceId}:hp-5`)])
  const allies = options.specialPlayAlly
    ? [cookieEntry(options.specialPlayAlly, [item(`${options.specialPlayAlly.instanceId}:hp`)])]
    : []
  const payment = Array.from({ length: 3 }, (_, index) => ({
    card: item(`${source.instanceId}:payment-${index}`, paymentColor),
    rested: false,
  }))

  return {
    ...base,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        battleArea: [cookieEntry(defender, Array.from({ length: 8 }, (_, index) => item(`${source.instanceId}:defender-hp-${index}`)))],
        discardPile: Array.from(
          { length: options.opponentTrashCount ?? 0 },
          (_, index) => item(`${source.instanceId}:opponent-trash-${index}`),
        ),
      },
      'player-two': {
        ...base.players['player-two'],
        battleArea: [sourceEntry, ...allies],
        supportArea: payment,
        discardPile: [],
      },
    },
  }
}

const advanceToAttackEffect = (
  state: GameState,
  source: GameCard,
  target: string,
): GameState => {
  let current = beginAttack(
    state,
    source.instanceId,
    target,
    state.players['player-two'].supportArea.map((support) => support.card.instanceId),
  )
  current = skipTrap(current, 'player-one')
  while (current.pendingBattle?.stage === 'damage') {
    current = resolveNextDamage(current)
  }
  return current
}

describe('BS11-088 conditional attack Then runtime', () => {
  it('deals the extra damage when the opponent has 15 cards in trash', () => {
    const source = candidate('BS11-088', 'positive')
    const state = attackState(source, 'purple', { opponentTrashCount: 15 })
    const targetId = state.players['player-one'].battleArea[0]!.card.instanceId
    let current = advanceToAttackEffect(state, source, targetId)

    expect(current.pendingBattle?.stage).toBe('attack-effect')
    current = resolveAttackEffect(current, 'player-two', [targetId])

    expect(current.pendingBattle).toBeNull()
    expect(current.players['player-one'].battleArea[0]?.hpCards).toHaveLength(5)
  })

  it('skips the extra damage when the opponent has fewer than 15 cards in trash', () => {
    const source = candidate('BS11-088', 'negative')
    const state = attackState(source, 'purple', { opponentTrashCount: 14 })
    const targetId = state.players['player-one'].battleArea[0]!.card.instanceId
    let current = advanceToAttackEffect(state, source, targetId)

    expect(current.pendingBattle?.stage).toBe('attack-effect')
    current = resolveAttackEffect(current, 'player-two', [])

    expect(current.pendingBattle).toBeNull()
    expect(current.players['player-one'].battleArea[0]?.hpCards).toHaveLength(6)
  })
})

describe('BS11-105 conditional attack Then runtime', () => {
  it('deals the extra damage when a Special Play Cookie is in the attacker battle area', () => {
    const source = candidate('BS11-105', 'positive')
    const specialPlayAlly = candidate('BS11-111', 'special-play-ally')
    const state = attackState(source, 'black', { specialPlayAlly })
    const targetId = state.players['player-one'].battleArea[0]!.card.instanceId
    let current = advanceToAttackEffect(state, source, targetId)

    expect(specialPlayAlly.type === 'cookie' && specialPlayAlly.skill?.specialPlayCost).toBeDefined()
    expect(current.pendingBattle?.stage).toBe('attack-effect')
    current = resolveAttackEffect(current, 'player-two', [targetId])

    expect(current.pendingBattle).toBeNull()
    expect(current.players['player-one'].battleArea[0]?.hpCards).toHaveLength(4)
  })

  it('skips the extra damage when no Special Play Cookie is in the attacker battle area', () => {
    const source = candidate('BS11-105', 'negative')
    const state = attackState(source, 'black')
    const targetId = state.players['player-one'].battleArea[0]!.card.instanceId
    let current = advanceToAttackEffect(state, source, targetId)

    expect(current.pendingBattle?.stage).toBe('attack-effect')
    current = resolveAttackEffect(current, 'player-two', [])

    expect(current.pendingBattle).toBeNull()
    expect(current.players['player-one'].battleArea[0]?.hpCards).toHaveLength(5)
  })
})
