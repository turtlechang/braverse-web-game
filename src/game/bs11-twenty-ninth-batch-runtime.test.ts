import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardToGameCard,
} from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  beginAttack,
  getTrapCostOptions,
  playTrap,
} from './battle'
import { applyGameCommand } from './commands'
import { canPlayItem } from './card-abilities'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'
import type { CookieCard, GameCard, GameState } from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const findRecord = (cardNumber: string): OfficialCardRecord => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  return record
}

const converted = (cardNumber: string, instanceId: string): GameCard => {
  const result = convertOfficialCardToGameCard(findRecord(cardNumber), instanceId)
  if (result.status !== 'converted') {
    throw new Error(`${cardNumber} did not convert: ${result.reason}`)
  }
  return { ...result.gameCard, instanceId }
}

const entry = (card: CookieCard, hp = 4) => ({
  card,
  hpCards: Array.from({ length: hp }, (_, index) => item(`${card.instanceId}:hp-${index}`)),
  rested: false,
  battleEntryId: `${card.instanceId}:battle`,
})

const makeTrapState = (
  cardNumber: 'BS11-106' | 'BS11-110',
  options: { minLevel?: number; specialPlay?: boolean } = {},
): { state: GameState; trap: GameCard } => {
  const base = createBattleState()
  const trap = converted(cardNumber, `bs11-${cardNumber}-trap`)
  const defender = {
    ...cookie('defender', 1, 5),
    level: options.minLevel ?? 1,
    ...(options.specialPlay
      ? { skill: { trigger: 'on-play' as const, oncePerTurn: false, yourTurn: false, restSource: false, cost: { energy: {}, discardHand: 0 }, text: 'Special Play', effects: [], specialPlayCost: { energy: {}, discardHand: 0 } } }
      : {}),
  }
  return {
    trap,
    state: {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [trap],
          battleArea: [entry(defender)],
          supportArea: [{ card: item('p1-black-support', 'black'), rested: false }],
        },
      },
    },
  }
}

const makeItemState = (levels: number[]): { state: GameState; card: GameCard } => {
  const base = createBattleState()
  const card = converted('BS11-107', 'bs11-107-item')
  const ownCookies = levels.map((level, index) => ({
    ...cookie(`own-${index}`, 1, 3),
    level,
  }))
  return {
    card,
    state: {
      ...base,
      activePlayerId: 'player-one',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [card],
          battleArea: ownCookies.map((ownCookie) => entry(ownCookie, 3)),
          supportArea: [
            { card: item('item-black-a', 'black'), rested: false },
            { card: item('item-black-b', 'black'), rested: false },
          ],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [entry(base.players['player-two'].battleArea[0]!.card, 3)],
        },
      },
    },
  }
}

describe('BS11-106／107／110 battle-area condition runtime', () => {
  it('uses the reduced 0K cost only when BS11-106 has LV.5+ or Special Play', () => {
    const highLevel = makeTrapState('BS11-106', { minLevel: 5 })
    const highLevelBattle = beginAttack(highLevel.state, 'attacker', 'defender', ['p2-support'])
    expect(getTrapCostOptions(highLevel.trap.trap!, highLevelBattle, 'player-one')).toEqual([
      { energy: {}, discardHand: 0 },
    ])

    const specialPlay = makeTrapState('BS11-106', { specialPlay: true })
    const specialPlayBattle = beginAttack(specialPlay.state, 'attacker', 'defender', ['p2-support'])
    expect(getTrapCostOptions(specialPlay.trap.trap!, specialPlayBattle, 'player-one')).toEqual([
      { energy: {}, discardHand: 0 },
    ])

    const unmet = makeTrapState('BS11-106', { minLevel: 4 })
    const unmetBattle = beginAttack(unmet.state, 'attacker', 'defender', ['p2-support'])
    expect(getTrapCostOptions(unmet.trap.trap!, unmetBattle, 'player-one')).toEqual([
      { energy: { black: 1 }, discardHand: 0 },
    ])
  })

  it('requires the total Cookie LV. in the battle area for BS11-107', () => {
    const valid = makeItemState([3, 2])
    expect(canPlayItem(valid.state, 'player-one', valid.card.instanceId)).toBe(true)

    const invalid = makeItemState([4])
    expect(canPlayItem(invalid.state, 'player-one', invalid.card.instanceId)).toBe(false)

    const resolved = applyGameCommand(valid.state, {
      kind: 'play-item',
      playerId: 'player-one',
      instanceId: valid.card.instanceId,
      paymentIds: ['item-black-a', 'item-black-b'],
      effectTargets: [['attacker']],
    })
    expect(resolved.players['player-two'].battleArea[0]?.hpCards).toHaveLength(1)
  })

  it('applies BS11-110 Then to the same target only when the condition is met', () => {
    const valid = makeTrapState('BS11-110', { minLevel: 5 })
    const validBattle = beginAttack(valid.state, 'attacker', 'defender', ['p2-support'])
    const validResolved = playTrap(validBattle, 'player-one', {
      trapInstanceId: valid.trap.instanceId,
      paymentIds: ['p1-black-support'],
      targetIds: ['attacker'],
    })
    expect(validResolved.attackModifiers.filter((modifier) => modifier.amount === -1)).toHaveLength(2)

    const invalid = makeTrapState('BS11-110', { minLevel: 4 })
    const invalidBattle = beginAttack(invalid.state, 'attacker', 'defender', ['p2-support'])
    const invalidResolved = playTrap(invalidBattle, 'player-one', {
      trapInstanceId: invalid.trap.instanceId,
      paymentIds: ['p1-black-support'],
      targetIds: ['attacker'],
    })
    expect(invalidResolved.attackModifiers.filter((modifier) => modifier.amount === -1)).toHaveLength(1)
  })
})
