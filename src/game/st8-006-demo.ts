import document from '../../data/candidates/st6-st10/official-st8.en.json'
import type {OfficialCardRecord} from '../cards/types'
const original=getCardPoolEntry('ST8-006') ?? (document.cards as OfficialCardRecord[]).find(card=>card.cardNumber==='ST8-006')
if(!original)throw Error('Missing original ST8-006')
export const raw=original
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { applyGameCommand } from './commands'
import { createGame } from './setup'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import type { CookieInBattle, GameCard, GameState, PlayerId } from './types'

/** Original-printing candidate preview; formal lookup is used only after verified promotion. */
export const createSt8006PreviewState = (scenario: string, prepareOnly=false): GameState => {
  if (scenario.startsWith('ai-')) return JSON.parse(JSON.stringify(createSt8006PreviewState(scenario.slice(3), prepareOnly))
    .replaceAll('player-one', 'player-swap').replaceAll('player-two', 'player-one').replaceAll('player-swap', 'player-two')) as GameState
  const allowed = ['positive', 'low', 'negative', 'last-no-hand', 'attack', 'attack-negative', 'wrong-color', 'wrong-phase',
    'play', 'attack-few', 'first-turn', 'source-rested', 'rested-carrier', 'last-deck', 'last-deck-low', 'over-printed',
    'cost-yellow', 'cost-green', 'cost-blue', 'cost-purple', 'cost-black', 'cost-trap', 'cost-stage']
  if (!allowed.includes(scenario)) throw new Error(`Unknown ST8-006 scenario ${scenario}`)
  const counts = new Map<string, number>()
  const card = (number: string, owner: PlayerId): GameCard => {
    const key = `${owner}:${number}`, copy = (counts.get(key) ?? 0) + 1
    if (copy > 4) throw new Error(`Printed copy limit: ${key}`)
    counts.set(key, copy)
    const record = number === 'ST8-006' ? raw : getCardPoolEntry(number)
    if (!record) throw new Error(`Missing original printing ${number}`)
    return createCard(record, owner, copy)
  }
  const filler = (count: number, owner: PlayerId) => {
    if (count === 0) return []
    const cards: GameCard[] = []
    for (const raw of getAllCardPoolEntries()) {
      if (raw.variant || raw.type === 'extra' || hasFlipAbility(raw) ||
          (counts.get(`${owner}:${raw.baseCardNumber}`) ?? 0) >= 4) continue
      cards.push(card(raw.baseCardNumber, owner))
      if (cards.length === count) return cards
    }
    throw new Error('Insufficient original-printing fillers')
  }
  const battle = (number: string, owner: PlayerId): CookieInBattle => {
    const source = card(number, owner)
    if (source.type !== 'cookie') throw new Error('Expected original Cookie')
    return { card: source, hpCards: filler(source.hp, owner), rested: false,
      battleEntryId: `${source.instanceId}:entry` }
  }
  let state = createGame(
    { id: 'player-one', name: 'ST7逐卡驗收', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: '實體對手', deck: createOfficialRedStarterDeck('player-two') },
    'player-one', cards => cards,
  )
  state.status = 'playing'; state.phase = 'main'; state.turnNumber = 3
  for (const player of Object.values(state.players)) {
    player.deck = []; player.hand = []; player.supportArea = []; player.breakArea = []
    player.discardPile = []; player.battleArea = []; player.stage = null
    player.startingCookieSelected = true
  }
  const self = state.players['player-one'], foe = state.players['player-two']
  const attack = scenario.startsWith('attack') || ['wrong-color', 'wrong-phase', 'play', 'first-turn', 'source-rested'].includes(scenario)
  self.battleArea = [battle(attack ? 'ST8-006' : 'ST1-005', 'player-one'), battle('ST1-011', 'player-one')]
  foe.battleArea = [battle(attack ? 'ST1-005' : 'ST6-003', 'player-two')]
  if (attack) {
    self.supportArea = ['ST3-020', 'ST3-019', 'ST3-016', scenario === 'wrong-color' ? 'ST1-020' : 'ST3-020']
      .map((number, index) => ({ card: card(number, 'player-one'), rested: scenario === 'attack-negative' && index === 3 }))
    if (scenario === 'wrong-phase') state.phase = 'support'
    if (scenario === 'first-turn') state.turnNumber = 1
    if (scenario === 'source-rested') self.battleArea[0].rested = true
    if (scenario === 'attack-few') self.deck.push(self.supportArea.pop()!.card)
  } else {
    const last = ['low', 'last-no-hand', 'last-deck-low'].includes(scenario)
    const position = last ? 0 : self.battleArea[0].hpCards.length - 1
    const displaced = self.battleArea[0].hpCards[position]
    if (scenario === 'over-printed') self.deck.push(card('ST8-006', 'player-one'))
    else {
      self.battleArea[0].hpCards[position] = card('ST8-006', 'player-one')
      self.deck.push(displaced)
    }
    const costs: Record<string, string> = { 'cost-yellow': 'ST2-001', 'cost-green': 'ST3-001', 'cost-blue': 'ST9-016',
      'cost-purple': 'ST5-001', 'cost-black': 'BS11-093', 'cost-trap': 'ST1-018', 'cost-stage': 'ST1-020' }
    if (!['negative', 'last-no-hand'].includes(scenario)) self.hand = [card(costs[scenario] ?? 'ST1-001', 'player-one'), card('ST9-016', 'player-one')]
    if (scenario === 'rested-carrier') self.battleArea[0].rested = true
    if (scenario === 'over-printed') {
      self.hand.push(card('ST7-018', 'player-one'))
      self.supportArea = ['ST2-019', 'ST2-020'].map(number => ({ card: card(number, 'player-one'), rested: false }))
    }
    foe.supportArea = ['ST1-018', 'ST2-020', 'ST3-016'].map(number => ({ card: card(number, 'player-two'), rested: false }))
    state.activePlayerId = 'player-two'
  }
  for (const owner of ['player-one', 'player-two'] as const) {
    const player = state.players[owner]
    const used = player.deck.length + player.hand.length + player.supportArea.length +
      player.battleArea.reduce((n, source) => n + 1 + source.hpCards.length, 0)
    player.deck.push(...filler(60 - used, owner))
  }
  if (scenario === 'play') {
    const source = self.battleArea.shift()!
    self.hand.push(source.card)
    self.deck.push(...source.hpCards)
  }
  if (scenario === 'last-deck' || scenario === 'last-deck-low') self.discardPile.push(...self.deck.splice(1))
  if(prepareOnly)return state
  if (!attack) {
    state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two',
      attackerInstanceId: foe.battleArea[0].card.instanceId, targetInstanceId: self.battleArea[0].card.instanceId,
      supportPaymentIds: foe.supportArea.map(support => support.card.instanceId) })
    state = scenario === 'over-printed'
      ? applyGameCommand(state, { kind: 'play-trap', playerId: 'player-one', trapInstanceId: self.hand.find(card => card.id === 'ST7-018')!.instanceId,
        paymentIds: self.supportArea.map(support => support.card.instanceId), targetIds: [], effectTargets: [self.battleArea.map(cookie => cookie.card.instanceId)] })
      : applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
    for (let point = 0; point < (['low', 'last-no-hand', 'last-deck-low'].includes(scenario) ? 3 : 1); point++) {
      state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })
    }
  }
  return state
}
