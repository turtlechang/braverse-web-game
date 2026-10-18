import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import { applyGameCommand } from './commands'
import type { CookieInBattle, GameCard, PlayerId } from './types'
import type { DeckAdditionScenario } from './bs12-deck-addition-demo'

/** Local original-printing acceptance state, loaded from the promoted registry. */
export const createSt6002State = (scenario: DeckAdditionScenario) => {
  const counts = new Map<string, number>()
  const card = (id: string, owner: PlayerId): GameCard => {
    const key = `${owner}:${id}`, copy = (counts.get(key) ?? 0) + 1
    if (copy > 4) throw new Error(`Printed copy limit: ${key}`)
    counts.set(key, copy)
    const raw = getCardPoolEntry(id)
    if (!raw) throw new Error(`Missing printed card ${id}`)
    return createCard(raw, owner, copy)
  }
  const filler = (count: number, owner: PlayerId) => {
    const cards: GameCard[] = []
    for (const raw of getAllCardPoolEntries()) {
      if (raw.variant || raw.type === 'extra' || hasFlipAbility(raw) || (counts.get(`${owner}:${raw.baseCardNumber}`) ?? 0) >= 4) continue
      cards.push(card(raw.baseCardNumber, owner))
      if (cards.length === count) return cards
    }
    throw new Error('Insufficient physical fillers')
  }
  const battle = (id: string, owner: PlayerId): CookieInBattle => {
    const c = card(id, owner)
    if (c.type !== 'cookie') throw new Error('Expected printed Cookie')
    return { card: c, hpCards: filler(c.hp, owner), rested: false, battleEntryId: `${c.instanceId}:entry` }
  }
  let state = createGame(
    { id: 'player-one', name: 'ST6逐卡驗收', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: '實體對手', deck: createOfficialRedStarterDeck('player-two') },
    'player-one', cards => cards,
  )
  state.status = 'playing'; state.phase = 'main'; state.turnNumber = 3
  for (const p of Object.values(state.players)) {
    p.deck = []; p.hand = []; p.supportArea = []; p.breakArea = []; p.discardPile = []; p.battleArea = []; p.stage = null
    p.startingCookieSelected = true
  }
  const self = state.players['player-one'], foe = state.players['player-two']
  self.battleArea = [battle('ST6-002', 'player-one'), battle('ST1-005', 'player-one')]
  self.supportArea = [0, 1, 2].map(index => ({ card: card(scenario === 'wrong-color' ? 'ST2-020' : 'ST1-020', 'player-one'),
    rested: scenario === 'negative' || (scenario === 'attack-negative' && index < 2) }))
  // A separate two-Cookie board witnesses the original defender fainting.
  foe.battleArea = scenario === 'target-faints'
    ? [battle('BS12-059', 'player-two'), battle('ST7-005', 'player-two')]
    : [battle('BS12-059', 'player-two'), battle('ST1-005', 'player-two')]
  if (scenario === 'low') foe.supportArea = Array.from({ length: 4 }, () => ({ card: card('ST1-020', 'player-two'), rested: false }))
  for (const owner of ['player-one', 'player-two'] as const) {
    const p = state.players[owner]
    const used = p.supportArea.length + p.battleArea.reduce((n, c) => n + 1 + c.hpCards.length, 0)
    p.deck = filler(60 - used, owner)
  }
  if (scenario === 'low') {
    state.activePlayerId = 'player-two'
    // Original Sour Belt NNN4 and Leek N1 reduce printed 6 HP to 1.
    for (const [attacker, payment] of [
      [foe.battleArea[0], foe.supportArea.slice(0, 3)],
      [foe.battleArea[1], foe.supportArea.slice(3)],
    ] as const) {
      state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two',
        attackerInstanceId: attacker.card.instanceId, targetInstanceId: self.battleArea[0].card.instanceId,
        supportPaymentIds: payment.map(support => support.card.instanceId) })
      state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
      state = applyGameCommand(state, { kind: 'resolve-battle', playerId: 'player-two' })
    }
    for (let i = 0; i < 8 && !(state.activePlayerId === 'player-one' && state.phase === 'main'); i++) {
      state = applyGameCommand(state, { kind: 'advance-phase', playerId: state.activePlayerId })
    }
    if (state.activePlayerId !== 'player-one' || state.phase !== 'main') throw new Error('Failed to reach own main phase after actual damage')
  }
  if (scenario === 'wrong-phase') state.phase = 'support'
  if (scenario === 'used') state = applyGameCommand(state, { kind: 'activate-skill', playerId: 'player-one',
    trigger: 'activate', sourceInstanceId: self.battleArea[0].card.instanceId,
    paymentIds: [self.supportArea[0].card.instanceId], effectTargets: [[foe.battleArea[0].card.instanceId]] })
  return state
}
