import document from '../../data/candidates/st6-st10/official-st8.en.json'
import type { OfficialCardRecord } from '../cards/types'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { applyGameCommand } from './commands'
import { createGame } from './setup'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import type { CookieInBattle, GameCard, GameState, PlayerId } from './types'

const original = getCardPoolEntry('ST8-009') ?? (document.cards as OfficialCardRecord[]).find(card => card.cardNumber === 'ST8-009')
if (!original) throw new Error('Missing original ST8-009')
export const raw = original
export const st8009Scenarios = ['positive', 'low', 'own-carrier', 'rested-carrier', 'no-hand', 'high-hand', 'no-support',
  'rested-support', 'top-cookie', 'top-item', 'top-trap', 'top-stage', 'top-blue', 'last-deck', 'last-deck-low', 'multiple-flip',
  'attack', 'negative', 'attack-negative', 'wrong-color', 'attack-few', 'wrong-phase', 'first-turn', 'source-rested', 'play'] as const

export const createSt8009PreviewState = (scenario: string, prepareOnly = false): GameState => {
  if (!st8009Scenarios.some(value => value === scenario)) throw new Error(`Unknown ST8-009 scenario ${scenario}`)
  const copies = new Map<string, number>(), records = getAllCardPoolEntries()
  const card = (number: string, owner: PlayerId): GameCard => {
    const record = number === 'ST8-009' ? raw : getCardPoolEntry(number)
    if (!record) throw new Error(`Missing original ${number}`)
    const key = `${owner}:${number}`, copy = (copies.get(key) ?? 0) + 1
    if (copy > 4) throw new Error(`Printed copy limit ${key}`)
    copies.set(key, copy)
    return createCard(record, owner, copy)
  }
  const filler = (count: number, owner: PlayerId): GameCard[] => {
    if (!count) return []
    const cards: GameCard[] = []
    for (const record of records) {
      if (record.variant || record.type === 'extra' || hasFlipAbility(record) ||
        (copies.get(`${owner}:${record.baseCardNumber}`) ?? 0) >= 4) continue
      cards.push(card(record.baseCardNumber, owner))
      if (cards.length === count) return cards
    }
    throw new Error('Insufficient original non-FLIP cards')
  }
  const battle = (number: string, owner: PlayerId): CookieInBattle => {
    const source = card(number, owner)
    if (source.type !== 'cookie') throw new Error('Expected original Cookie')
    return { card: source, hpCards: filler(source.hp, owner), rested: false, battleEntryId: `${source.instanceId}:entry` }
  }
  let state = createGame({ id: 'player-one', name: 'ST8-009逐卡驗收', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: '實體對手', deck: createOfficialRedStarterDeck('player-two') }, 'player-one', cards => cards)
  state.status = 'playing'; state.phase = 'main'; state.turnNumber = 3
  for (const player of Object.values(state.players)) {
    player.deck = []; player.hand = []; player.supportArea = []; player.breakArea = []; player.discardPile = []
    player.battleArea = []; player.stage = null; player.startingCookieSelected = true
  }
  const self = state.players['player-one'], foe = state.players['player-two']
  const attacking = scenario.startsWith('attack') || ['negative', 'wrong-color', 'wrong-phase', 'first-turn', 'source-rested', 'play'].includes(scenario)
  const lastHp = ['low', 'own-carrier', 'last-deck-low'].includes(scenario)
  self.battleArea = [battle(attacking || scenario === 'own-carrier' ? 'ST8-009' : lastHp ? 'ST1-005' : 'ST6-003', 'player-one'), battle('ST1-011', 'player-one')]
  foe.battleArea = [battle(attacking ? 'ST1-005' : 'ST6-003', 'player-two'), battle('ST1-011', 'player-two')]
  self.hand = scenario === 'no-hand' ? [] : [card('ST1-016', 'player-one')]
  if (scenario === 'high-hand') self.hand.push(...filler(5, 'player-one'))
  if (attacking) {
    self.supportArea = ['ST3-020', 'ST3-019', scenario === 'wrong-color' ? 'ST1-020' : 'ST3-016']
      .map((number, index) => ({ card: card(number, 'player-one'), rested: ['negative', 'attack-negative'].includes(scenario) && index === 2 }))
    if (scenario === 'attack-few') self.deck.push(self.supportArea.pop()!.card)
    if (scenario === 'wrong-phase') state.phase = 'support'
    if (scenario === 'first-turn') state.turnNumber = 1
    if (scenario === 'source-rested') self.battleArea[0].rested = true
  } else {
    const carrier = self.battleArea[0]
    const position = lastHp ? 0 : carrier.hpCards.length - 1
    self.deck.push(carrier.hpCards[position])
    carrier.hpCards[position] = card('ST8-009', 'player-one')
    if (scenario === 'multiple-flip') {
      self.deck.push(carrier.hpCards[position - 1])
      carrier.hpCards[position - 1] = card('ST8-009', 'player-one')
    }
    if (scenario === 'rested-carrier') carrier.rested = true
    if (scenario === 'rested-support') self.supportArea = ['ST3-020', 'ST3-019', 'ST3-016'].map(number => ({ card: card(number, 'player-one'), rested: true }))
    const topNumber = ({ 'top-item': 'ST1-016', 'top-trap': 'ST1-020', 'top-stage': 'BS1-026', 'top-blue': 'ST9-016' } as Record<string, string>)[scenario]
    if (topNumber) self.deck.unshift(card(topNumber, 'player-one'))
    foe.supportArea = ['ST1-018', 'ST2-020', 'ST3-016'].map(number => ({ card: card(number, 'player-two'), rested: false }))
    state.activePlayerId = 'player-two'
  }
  for (const owner of ['player-one', 'player-two'] as const) {
    const player = state.players[owner]
    const used = player.deck.length + player.hand.length + player.supportArea.length +
      player.battleArea.reduce((sum, cookie) => sum + 1 + cookie.hpCards.length, 0)
    player.deck.push(...filler(60 - used, owner))
  }
  if (scenario === 'play') {
    const source = self.battleArea.shift()!
    self.hand.unshift(source.card); self.deck.push(...source.hpCards)
  }
  if (scenario === 'last-deck' || scenario === 'last-deck-low') self.discardPile.push(...self.deck.splice(1))
  if (prepareOnly || attacking) return state
  state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two',
    attackerInstanceId: foe.battleArea[0].card.instanceId, targetInstanceId: self.battleArea[0].card.instanceId,
    supportPaymentIds: foe.supportArea.map(support => support.card.instanceId) })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
  for (let point = 0; point < (lastHp ? 3 : 1); point++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })
  return state
}
