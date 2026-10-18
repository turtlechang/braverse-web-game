import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { applyGameCommand } from './commands'
import { createGame } from './setup'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import type { CookieInBattle, GameCard, PlayerId } from './types'
import type { DeckAdditionScenario } from './bs12-deck-addition-demo'

/** Original-printing acceptance state loaded only from the promoted registry. */
export const createSt6004State = (scenario: DeckAdditionScenario) => {
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
    const cards: GameCard[] = []
    for (const raw of getAllCardPoolEntries()) {
      if (raw.variant || raw.type === 'extra' || hasFlipAbility(raw) || (counts.get(`${owner}:${raw.baseCardNumber}`) ?? 0) >= 4) continue
      cards.push(card(raw.baseCardNumber, owner))
      if (cards.length === count) return cards
    }
    throw new Error('Insufficient original-printing fillers')
  }
  const battle = (number: string, owner: PlayerId): CookieInBattle => {
    const source = card(number, owner)
    if (source.type !== 'cookie') throw new Error('Expected Cookie')
    return { card: source, hpCards: filler(source.hp, owner), rested: false, battleEntryId: `${source.instanceId}:entry` }
  }
  let state = createGame(
    { id: 'player-one', name: 'ST6逐卡驗收', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: '實體對手', deck: createOfficialRedStarterDeck('player-two') },
    'player-one', cards => cards,
  )
  state.status = 'playing'; state.phase = 'main'; state.turnNumber = 3
  for (const player of Object.values(state.players)) {
    player.deck = []; player.hand = []; player.battleArea = []; player.supportArea = []
    player.breakArea = []; player.discardPile = []; player.stage = null
    player.startingCookieSelected = true
  }
  const self = state.players['player-one'], foe = state.players['player-two']
  self.battleArea = [battle('ST6-004', 'player-one'), battle('ST1-005', 'player-one')]
  self.hand = scenario === 'negative' ? [] : [card('BS12-007', 'player-one'), card('ST1-001', 'player-one')]
  self.supportArea = [0, 1, 2, 3].map(index => ({
    card: card(scenario === 'wrong-color' && index < 3 || scenario === 'attack-wrong-color' && index === 3 ? 'ST2-020' : 'ST1-020', 'player-one'),
    rested: scenario === 'no-energy' || scenario === 'attack-negative' && index >= 2 || scenario === 'no-extra-energy' && index === 3,
  }))
  foe.battleArea = [battle('BS12-059', 'player-two'), battle('ST1-005', 'player-two')]
  for (const owner of ['player-one', 'player-two'] as const) {
    const player = state.players[owner]
    const used = player.hand.length + player.supportArea.length + player.battleArea.reduce((n, cookie) => n + 1 + cookie.hpCards.length, 0)
    player.deck = filler(60 - used, owner)
  }
  if (scenario === 'wrong-phase') state.phase = 'support'
  if (scenario === 'used') state = applyGameCommand(state, { kind: 'activate-skill', playerId: 'player-one', trigger: 'activate',
    sourceInstanceId: self.battleArea[0].card.instanceId, paymentIds: [], discardHandIds: [self.hand[0].instanceId],
    effectTargets: [[self.battleArea[0].card.instanceId]] })
  if (scenario === 'rested-source') {
    state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one',
      attackerInstanceId: self.battleArea[0].card.instanceId, targetInstanceId: foe.battleArea[0].card.instanceId,
      supportPaymentIds: self.supportArea.slice(0, 3).map(support => support.card.instanceId) })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
    while (state.pendingBattle?.stage === 'damage') state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
    state = applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'skip' })
  }
  return state
}
