import document from '../../data/candidates/st6-st10/official-st8.en.json'
import type { OfficialCardRecord } from '../cards/types'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { applyGameCommand } from './commands'
import { createGame } from './setup'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import type { CookieInBattle, GameCard, GameState, PlayerId } from './types'

const original = getCardPoolEntry('ST8-008') ?? (document.cards as OfficialCardRecord[]).find(card => card.cardNumber === 'ST8-008')
if (!original) throw new Error('Missing original ST8-008')
export const raw = original

export const createSt8008PreviewState = (scenario: string, prepareOnly = false): GameState => {
  const allowed = ['positive', 'negative', 'faint-equal', 'faint-less', 'faint-more', 'faint-rested',
    'faint-source-rested', 'faint-last-deck', 'faint-top-item', 'faint-top-stage', 'faint-top-blue', 'attack', 'attack-paid-wind',
    'attack-rested-wind', 'attack-no-wind', 'attack-wind-battle', 'attack-wind-hand', 'attack-wind-deck',
    'attack-wind-opponent', 'attack-no-hand', 'attack-last-deck', 'attack-negative', 'wrong-color',
    'wrong-phase', 'attack-few', 'first-turn', 'source-rested', 'source-faint', 'play']
  if (!allowed.includes(scenario)) throw new Error(`Unknown ST8-008 scenario ${scenario}`)
  const copies = new Map<string, number>()
  const records = getAllCardPoolEntries()
  const card = (number: string, owner: PlayerId): GameCard => {
    const record = number === 'ST8-008' ? raw : getCardPoolEntry(number)
    if (!record) throw new Error(`Missing original ${number}`)
    const key = `${owner}:${number}`, copy = (copies.get(key) ?? 0) + 1
    if (copy > 4) throw new Error(`Printed copy limit ${key}`)
    copies.set(key, copy)
    return createCard(record, owner, copy)
  }
  const filler = (count: number, owner: PlayerId): GameCard[] => {
    const result: GameCard[] = []
    if (!count) return result
    for (const record of records) {
      if (record.variant || record.type === 'extra' || hasFlipAbility(record) ||
        (copies.get(`${owner}:${record.baseCardNumber}`) ?? 0) >= 4) continue
      result.push(card(record.baseCardNumber, owner))
      if (result.length === count) return result
    }
    throw new Error('Insufficient original non-FLIP resources')
  }
  const battle = (number: string, owner: PlayerId): CookieInBattle => {
    const source = card(number, owner)
    if (source.type !== 'cookie') throw new Error('Expected original Cookie')
    return { card: source, hpCards: filler(source.hp, owner), rested: false, battleEntryId: `${source.instanceId}:entry` }
  }
  let state = createGame({ id: 'player-one', name: 'ST8-008逐卡驗收', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: '實體對手', deck: createOfficialRedStarterDeck('player-two') }, 'player-one', cards => cards)
  state.status = 'playing'; state.phase = 'main'; state.turnNumber = 3
  for (const player of Object.values(state.players)) {
    player.deck = []; player.hand = []; player.supportArea = []; player.breakArea = []; player.discardPile = []
    player.battleArea = []; player.stage = null; player.startingCookieSelected = true
  }
  const self = state.players['player-one'], foe = state.players['player-two']
  const attack = scenario.startsWith('attack') || ['wrong-color', 'wrong-phase', 'first-turn', 'source-rested', 'source-faint', 'play'].includes(scenario)
  self.battleArea = [battle('ST8-008', 'player-one'), battle(scenario === 'attack-wind-battle' ? 'ST8-005' : 'ST1-011', 'player-one')]
  self.hand = [card('ST9-016', 'player-one'), card('ST1-001', 'player-one')]
  if (attack) {
    foe.battleArea = [battle(scenario === 'source-faint' ? 'ST6-003' : 'ST1-005', 'player-two')]
    const paidWind = scenario === 'attack-paid-wind'
    const names = [paidWind ? 'ST8-005' : 'ST3-020', scenario === 'wrong-color' ? 'ST1-020' : 'ST3-019', 'ST3-016']
    self.supportArea = names.map((number, index) => ({ card: card(number, 'player-one'), rested: scenario === 'attack-negative' && index === 2 }))
    if (!paidWind && !['attack-no-wind', 'attack-wind-battle', 'attack-wind-hand', 'attack-wind-deck', 'attack-wind-opponent'].includes(scenario)) {
      self.supportArea.push({ card: card('ST8-005', 'player-one'), rested: ['attack-rested-wind', 'attack-negative', 'wrong-color'].includes(scenario) })
    }
    if (scenario === 'attack-wind-hand') self.hand.push(card('ST8-005', 'player-one'))
    if (scenario === 'attack-wind-deck') self.deck.push(card('ST8-005', 'player-one'))
    if (scenario === 'attack-wind-opponent') foe.supportArea.push({ card: card('ST8-005', 'player-two'), rested: false })
    if (scenario === 'attack-no-hand') self.deck.push(...self.hand.splice(0))
    if (scenario === 'attack-few') self.deck.push(...self.supportArea.splice(2).map(support => support.card))
    if (scenario === 'wrong-phase') state.phase = 'support'
    if (scenario === 'first-turn') state.turnNumber = 1
    if (scenario === 'source-rested') self.battleArea[0].rested = true
    if (scenario === 'source-faint') {
      const displaced = foe.battleArea[0].hpCards.pop()!
      foe.battleArea[0].hpCards.push(card('BS1-002', 'player-two'))
      foe.deck.push(displaced)
      foe.hand.push(card('ST1-001', 'player-two'))
      foe.supportArea = ['ST3-020', 'ST3-019', 'ST3-016'].map(number => ({ card: card(number, 'player-two'), rested: false }))
      state.activePlayerId = 'player-two'
    }
  } else {
    foe.battleArea = [battle('BS1-019', 'player-two')]
    foe.supportArea = ['ST3-020', 'ST3-019', 'ST3-016'].map(number => ({ card: card(number, 'player-two'), rested: false }))
    const count = scenario === 'faint-less' ? 2 : ['negative', 'faint-more'].includes(scenario) ? 4 : 3
    self.supportArea = filler(count, 'player-one').map((source, index) => ({ card: source, rested: scenario === 'faint-rested' || index % 2 === 0 }))
    if (scenario === 'faint-source-rested') self.battleArea[0].rested = true
    const top = ({ 'faint-top-item': 'ST1-016', 'faint-top-stage': 'BS1-026', 'faint-top-blue': 'ST9-016' } as Record<string, string>)[scenario]
    if (top) self.deck.push(card(top, 'player-one'))
    state.activePlayerId = 'player-two'
  }
  for (const owner of ['player-one', 'player-two'] as const) {
    const player = state.players[owner]
    const used = player.deck.length + player.hand.length + player.supportArea.length + player.battleArea.reduce((n, cookie) => n + 1 + cookie.hpCards.length, 0)
    player.deck.push(...filler(60 - used, owner))
  }
  if (scenario === 'play') {
    const source = self.battleArea.shift()!
    self.hand.unshift(source.card); self.deck.push(...source.hpCards)
  }
  if (scenario === 'faint-last-deck' || scenario === 'attack-last-deck') self.discardPile.push(...self.deck.splice(1))
  if (prepareOnly) return state
  if (scenario === 'source-faint') {
    state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two',
      attackerInstanceId: foe.battleArea[0].card.instanceId, targetInstanceId: self.battleArea[0].card.instanceId,
      supportPaymentIds: foe.supportArea.map(support => support.card.instanceId) })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
    state = applyGameCommand(state, { kind: 'resolve-battle', playerId: 'player-two' })
    for (let count = 0; count < 10 && !(state.activePlayerId === 'player-one' && state.phase === 'main'); count++) {
      state = applyGameCommand(state, { kind: 'advance-phase', playerId: state.activePlayerId })
    }
    if (state.activePlayerId !== 'player-one' || state.phase !== 'main') throw new Error('Real source-damage parent did not reach own Main Phase')
    return state
  }
  if (attack) return state
  state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two',
    attackerInstanceId: foe.battleArea[0].card.instanceId, targetInstanceId: self.battleArea[0].card.instanceId,
    supportPaymentIds: foe.supportArea.map(support => support.card.instanceId) })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
  return applyGameCommand(state, { kind: 'resolve-battle', playerId: 'player-two' })
}
