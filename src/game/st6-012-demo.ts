import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { applyGameCommand } from './commands'
import { createGame } from './setup'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import type { CookieInBattle, GameCard, PlayerId } from './types'
import type { DeckAdditionScenario } from './bs12-deck-addition-demo'

/** Original ST6-012 local acceptance; formal card-pool records only. */
export const createSt6012PreviewState = (scenario: DeckAdditionScenario, targetNumber = 'ST6-002') => {
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
  self.battleArea = [battle('ST6-012', 'player-one'), battle(scenario === 'no-target' ? 'ST6-011' : targetNumber, 'player-one')]
  foe.battleArea = scenario === 'low'
    ? [battle('BS12-059', 'player-two'), battle('ST1-005', 'player-two')]
    : [battle('ST6-002', 'player-two'), battle('BS12-059', 'player-two')]
  self.supportArea = ['ST1-018','ST1-019','ST1-020','ST2-020'].map((number,index) => ({
    card: card(scenario === 'wrong-color' ? ['ST2-020','ST2-019','ST2-018','ST2-020'][index] : number, 'player-one'),
    rested: scenario === 'negative' || (scenario === 'attack-negative' && index > 0),
  }))
  foe.supportArea = ['ST3-016','ST3-019','ST3-018','ST3-017'].map(number => ({card:card(number,'player-two'),rested:false}))
  for (const owner of ['player-one','player-two'] as const) {
    const player = state.players[owner]
    const used = player.supportArea.length + player.battleArea.reduce((sum,c) => sum+1+c.hpCards.length,0)
    player.deck = filler(60-used,owner)
  }
  if (scenario === 'wrong-phase') state.phase = 'support'
  if (scenario === 'used') state = applyGameCommand(state, {kind:'activate-skill',playerId:'player-one',trigger:'activate',
    sourceInstanceId:self.battleArea[0].card.instanceId,paymentIds:[self.supportArea[0].card.instanceId],effectTargets:[[]]})
  if (scenario === 'rested-source' || scenario === 'rested-target') {
    const attacker = self.battleArea[scenario === 'rested-source' ? 0 : 1]
    state = applyGameCommand(state, {kind:'declare-attack',playerId:'player-one',attackerInstanceId:attacker.card.instanceId,
      targetInstanceId:foe.battleArea[1].card.instanceId,supportPaymentIds:self.supportArea.slice(0,2).map(s=>s.card.instanceId)})
    state = applyGameCommand(state,{kind:'skip-trap',playerId:'player-two'})
    if (scenario === 'rested-target') {
      state = applyGameCommand(state,{kind:'resolve-next-damage',playerId:'player-two'})
      state = applyGameCommand(state,{kind:'resolve-attack-effect',playerId:'player-one',targetIds:[]})
      state = applyGameCommand(state,{kind:'resolve-optional-cost-attack',playerId:'player-one',action:'skip'})
    } else state = applyGameCommand(state,{kind:'resolve-battle',playerId:'player-one'})
  }
  if (scenario === 'one-card') self.discardPile.push(...self.deck.splice(1))
  if (scenario === 'low') {
    state.activePlayerId='player-two'
    for (const [index, payments] of [[0,[0,1,2]],[1,[3]]] as const) {
      state = applyGameCommand(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:foe.battleArea[index].card.instanceId,
        targetInstanceId:self.battleArea[1].card.instanceId,supportPaymentIds:payments.map(i=>foe.supportArea[i].card.instanceId)})
      state = applyGameCommand(state,{kind:'skip-trap',playerId:'player-one'})
      state = applyGameCommand(state,{kind:'resolve-battle',playerId:'player-two'})
    }
    for (let i=0;i<8&&!(state.activePlayerId==='player-one'&&state.phase==='main');i++)
      state = applyGameCommand(state,{kind:'advance-phase',playerId:state.activePlayerId})
    if (state.activePlayerId!=='player-one'||state.phase!=='main') throw new Error('Failed to reach own main after actual damage')
  }
  return state
}
