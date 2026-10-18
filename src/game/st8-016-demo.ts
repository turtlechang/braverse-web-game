import type { OfficialCardRecord } from '../cards/types'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import type { GameCard, GameState, PlayerId } from './types'

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === undefined || value === null) throw Error(`Missing ${label}`)
  return value
}

export const rawSt8016: OfficialCardRecord = required(
  getCardPoolEntry('ST8-016'),
  "original Wind's Grace Earrings",
)

export type St8016Scenario =
  | 'positive'
  | 'wind-rested'
  | 'support-below-threshold'
  | 'wind-in-support'
  | 'wind-in-hand'
  | 'no-green-payment'
  | 'one-hp-faint'

export const st8016Scenarios: readonly St8016Scenario[] = [
  'positive', 'wind-rested', 'support-below-threshold', 'wind-in-support',
  'wind-in-hand', 'no-green-payment', 'one-hp-faint',
]

export const createSt8016PreviewState = (
  scenario: St8016Scenario = 'positive',
): GameState => {
  const copies = new Map<string, number>()
  const names = new Map<string, number>()

  const card = (id: string, owner: PlayerId): GameCard => {
    const record = id === 'ST8-016' ? rawSt8016 : required(getCardPoolEntry(id), id)
    const copyKey = `${owner}:${record.baseCardNumber || record.cardNumber}`
    const copy = (copies.get(copyKey) ?? 0) + 1
    const nameKey = `${owner}:${record.name}`
    if (copy > 4 || (names.get(nameKey) ?? 0) >= 4) {
      throw Error(`Four-copy/name resource limit ${copyKey}`)
    }
    copies.set(copyKey, copy)
    names.set(nameKey, (names.get(nameKey) ?? 0) + 1)
    return createCard(record, owner, copy)
  }

  const filler = (count: number, owner: PlayerId): GameCard[] => {
    const result: GameCard[] = []
    if (count === 0) return result
    for (const record of getAllCardPoolEntries()) {
      if (!record.flags.enabled || record.flags.hidden || record.flags.extra || record.variant ||
          record.type === 'extra' || record.type === 'unknown' || hasFlipAbility(record) ||
          (copies.get(`${owner}:${record.baseCardNumber || record.cardNumber}`) ?? 0) >= 4 ||
          (names.get(`${owner}:${record.name}`) ?? 0) >= 4) continue
      result.push(card(record.poolId, owner))
      if (result.length === count) return result
    }
    throw Error('Insufficient original resources')
  }

  const cookie = (
    id: string,
    owner: PlayerId,
    remainingHp: number,
    options: { rested?: boolean; hpCards?: GameCard[] } = {},
  ) => {
    const value = card(id, owner)
    if (value.type !== 'cookie' || remainingHp > value.hp ||
        (options.hpCards !== undefined && options.hpCards.length !== remainingHp)) {
      throw Error(`Cookie with sufficient printed HP required: ${id}`)
    }
    return {
      card: value,
      hpCards: options.hpCards ?? filler(remainingHp, owner),
      rested: options.rested ?? false,
      battleEntryId: `${value.instanceId}:entry`,
    }
  }

  const state = createGame(
    { id: 'player-one', name: "ST8-016 Wind's Grace Earrings", deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: 'Original-card opponent', deck: createOfficialRedStarterDeck('player-two') },
    'player-one',
    cards => cards,
  )
  state.status = 'playing'
  state.phase = 'main'
  state.turnNumber = 3
  state.activePlayerId = 'player-one'
  for (const player of Object.values(state.players)) {
    player.deck = []
    player.hand = []
    player.battleArea = []
    player.supportArea = []
    player.discardPile = []
    player.breakArea = []
    player.extraDeck = []
    player.stage = null
    player.startingCookieSelected = true
  }

  const own = state.players['player-one']
  const foe = state.players['player-two']
  own.hand = [card('ST8-016', 'player-one')]
  if (scenario === 'wind-in-hand') own.hand.push(card('ST8-005', 'player-one'))

  const windInBattle = scenario !== 'wind-in-support' && scenario !== 'wind-in-hand'
  own.battleArea = windInBattle
    ? [
        cookie('ST8-005', 'player-one', 6, { rested: scenario === 'wind-rested' }),
        cookie('ST1-011', 'player-one', 2),
      ]
    : [cookie('ST1-011', 'player-one', 2)]

  const supportCount = scenario === 'support-below-threshold' ? 4 : 5
  const payment = card('ST3-019', 'player-one')
  own.supportArea = [{ card: payment, rested: scenario === 'no-green-payment' }]
  if (scenario === 'wind-in-support') {
    own.supportArea.push({ card: card('ST8-005', 'player-one'), rested: true })
  }
  own.supportArea.push(...filler(supportCount - own.supportArea.length, 'player-one')
    .map(supportCard => ({ card: supportCard, rested: true })))

  const oneHpFlip = scenario !== 'one-hp-faint'
  const oneHpCard = oneHpFlip ? card('ST8-006', 'player-two') : filler(1, 'player-two')[0]
  if (!oneHpCard) throw Error('Original one-HP resource required')
  foe.hand = [filler(1, 'player-two')[0]!]
  foe.battleArea = [
    cookie('ST1-011', 'player-two', 2),
    cookie('ST1-011', 'player-two', 1, { hpCards: [oneHpCard] }),
  ]

  const used = (player: typeof own) => player.deck.length + player.hand.length + player.discardPile.length +
    player.breakArea.length + player.supportArea.length +
    player.battleArea.reduce((count, value) => count + 1 + value.hpCards.length, 0)
  own.deck.push(...filler(60 - used(own), 'player-one'))
  foe.deck.push(...filler(60 - used(foe), 'player-two'))
  return state
}
