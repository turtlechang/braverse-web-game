import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { applyGameCommand } from './commands'
import { createGame } from './setup'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import type { CookieInBattle, GameCard, PlayerId } from './types'
import type { DeckAdditionScenario } from './bs12-deck-addition-demo'

/** Local original-printing acceptance using the promoted formal registry. */
export const createSt6009PreviewState = (scenario: DeckAdditionScenario) => {
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
  self.battleArea = [battle('ST6-009', 'player-one'), battle('ST6-003', 'player-one')]
  const supports = scenario === 'wrong-color'
    ? ['ST2-020', 'ST2-019', 'ST2-018', 'ST3-016', 'ST3-019']
    : ['ST1-018', 'ST1-019', 'ST1-020', 'ST1-017', 'ST1-016']
  self.supportArea = supports.map((number, index) => ({ card: card(number, 'player-one'),
    rested: scenario === 'no-energy' || (scenario === 'attack-negative' && index >= 3) }))
  self.hand = scenario === 'negative' ? [] : [card(scenario === 'cost-cookie' ? 'ST1-011' : scenario === 'cost-item' ? 'ST1-018' : 'ST2-020', 'player-one')]
  if (scenario === 'used') self.hand.push(card('ST1-011', 'player-one'))
  foe.battleArea = [battle('BS12-059', 'player-two'), battle('ST1-005', 'player-two')]
  for (const owner of ['player-one', 'player-two'] as const) {
    const player = state.players[owner]
    const used = player.hand.length + player.supportArea.length + player.battleArea.reduce((n, c) => n + 1 + c.hpCards.length, 0)
    player.deck = filler(60 - used, owner)
  }
  if (scenario === 'wrong-phase') state.phase = 'support'
  if (scenario === 'used') {
    state = applyGameCommand(state, { kind: 'activate-skill', playerId: 'player-one', trigger: 'activate',
      sourceInstanceId: self.battleArea[0].card.instanceId, paymentIds: [self.supportArea[0].card.instanceId],
      discardHandIds: [self.hand[0].instanceId], effectTargets: [[]] })
  }
  if (scenario === 'rested-source' || scenario === 'low') {
    const low = scenario === 'low'
    state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one',
      attackerInstanceId: self.battleArea[low ? 1 : 0].card.instanceId,
      targetInstanceId: foe.battleArea[low ? 0 : 1].card.instanceId,
      supportPaymentIds: self.supportArea.slice(0, low ? 3 : 4).map(s => s.card.instanceId) })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
    state = applyGameCommand(state, { kind: 'resolve-battle', playerId: 'player-one' })
    if (state.pendingReplacement) state = applyGameCommand(state, { kind: 'skip-replacement', playerId: 'player-two' })
  }
  return state
}
