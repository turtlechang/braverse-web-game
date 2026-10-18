import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { applyGameCommand } from './commands'
import { createGame } from './setup'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import type { CookieInBattle, GameCard, PlayerId } from './types'
import type { DeckAdditionScenario } from './bs12-deck-addition-demo'

/** Local original-printing acceptance state loaded from the promoted registry. */
export const createSt6005State = (scenario: DeckAdditionScenario) => {
  const counts = new Map<string, number>()
  const card = (number: string, owner: PlayerId): GameCard => {
    const key = `${owner}:${number}`, copy = (counts.get(key) ?? 0) + 1
    if (copy > 4) throw new Error(`Printed copy limit: ${key}`)
    counts.set(key, copy)
    const raw = getCardPoolEntry(number)
    if (!raw) throw new Error(`Missing original printing ${number}`)
    return createCard(raw, owner, copy)
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
    { id: 'player-one', name: 'ST6逐卡驗收', deck: createOfficialRedStarterDeck('player-one') },
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
  const attack = scenario.startsWith('attack') || ['wrong-color', 'wrong-phase'].includes(scenario)
  self.battleArea = [battle(attack ? 'ST6-005' : 'ST1-005', 'player-one'), battle('ST1-011', 'player-one')]
  foe.battleArea = [battle(attack ? 'ST1-005' : 'ST6-003', 'player-two')]
  if (attack) {
    self.supportArea = ['ST1-018', scenario === 'wrong-color' ? 'ST2-020' : 'ST1-020']
      .map((number, index) => ({ card: card(number, 'player-one'), rested: scenario === 'attack-negative' && index === 1 }))
    if (scenario === 'wrong-phase') state.phase = 'support'
  } else {
    const last = scenario === 'low' || scenario === 'last-no-hand'
    const position = last ? 0 : self.battleArea[0].hpCards.length - 1
    const displaced = self.battleArea[0].hpCards[position]
    self.battleArea[0].hpCards[position] = card('ST6-005', 'player-one')
    self.deck.push(displaced)
    if (!['negative', 'last-no-hand'].includes(scenario)) self.hand = [card('ST1-001', 'player-one'), card('ST1-020', 'player-one')]
    foe.supportArea = ['ST1-018', 'ST2-020', 'ST3-016'].map(number => ({ card: card(number, 'player-two'), rested: false }))
    state.activePlayerId = 'player-two'
  }
  for (const owner of ['player-one', 'player-two'] as const) {
    const player = state.players[owner]
    const used = player.deck.length + player.hand.length + player.supportArea.length +
      player.battleArea.reduce((n, source) => n + 1 + source.hpCards.length, 0)
    player.deck.push(...filler(60 - used, owner))
  }
  if (!attack) {
    state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two',
      attackerInstanceId: foe.battleArea[0].card.instanceId, targetInstanceId: self.battleArea[0].card.instanceId,
      supportPaymentIds: foe.supportArea.map(support => support.card.instanceId) })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
    for (let point = 0; point < (scenario === 'low' || scenario === 'last-no-hand' ? 3 : 1); point++) {
      state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })
    }
  }
  return state
}
