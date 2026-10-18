import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { applyGameCommand } from './commands'
import { createGame } from './setup'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import type { CookieInBattle, GameCard, PlayerId } from './types'
import type { DeckAdditionScenario } from './bs12-deck-addition-demo'

/** Original ST6-011 local acceptance; formal card-pool records only. */
export const createSt6011PreviewState = (scenario: DeckAdditionScenario) => {
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
  self.battleArea = [battle('ST6-011','player-one'),battle('ST6-003','player-one')]
  foe.battleArea = [battle('BS12-059','player-two'),battle('ST1-005','player-two')]
  self.supportArea = ['ST1-018','ST2-020','ST3-016','ST4-017','ST5-019','BS12-105']
    .map(number=>({card:card(number,'player-one'),rested:scenario==='negative'}))
  foe.supportArea = ['ST3-016','ST3-019','ST3-018'].map(number=>({card:card(number,'player-two'),rested:false}))
  if(scenario==='reveal'){
    const index=self.battleArea[0].hpCards.length-1
    self.deck.push(self.battleArea[0].hpCards[index])
    self.battleArea[0].hpCards[index]=card('ST6-011','player-one')
  }
  for(const owner of ['player-one','player-two'] as const){
    const player=state.players[owner]
    const used=player.deck.length+player.hand.length+player.supportArea.length+player.battleArea.reduce((sum,c)=>sum+1+c.hpCards.length,0)
    player.deck.push(...filler(60-used,owner))
  }
  if(scenario==='wrong-phase')state.phase='support'
  if(scenario==='low'||scenario==='rested-source'){
    const index=scenario==='low'?1:0
    state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:self.battleArea[index].card.instanceId,
      targetInstanceId:foe.battleArea[0].card.instanceId,supportPaymentIds:self.supportArea.slice(0,scenario==='low'?3:1).map(s=>s.card.instanceId)})
    state=applyGameCommand(state,{kind:'skip-trap',playerId:'player-two'})
    state=applyGameCommand(state,{kind:'resolve-battle',playerId:'player-one'})
  }
  if(scenario==='reveal'){
    state.activePlayerId='player-two'
    state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:foe.battleArea[1].card.instanceId,
      targetInstanceId:self.battleArea[0].card.instanceId,supportPaymentIds:[foe.supportArea[0].card.instanceId]})
  }
  return state
}
