import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { applyGameCommand } from './commands'
import { createGame } from './setup'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import type { CookieInBattle, GameCard, PlayerId } from './types'
import type { DeckAdditionScenario } from './bs12-deck-addition-demo'

/** Local original-printing Blocker verification using the promoted registry. */
export const createSt6010PreviewState = (scenario: DeckAdditionScenario) => {
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
  const attackMode = scenario.startsWith('attack') || scenario === 'wrong-phase'
  self.battleArea = [battle('ST6-010', 'player-one'), battle('ST1-011', 'player-one')]
  foe.battleArea = [battle('ST1-005', 'player-two'), battle('ST1-005', 'player-two')]
  const wrong = scenario === 'wrong-color' || scenario === 'attack-wrong-color'
  self.supportArea = (wrong ? ['ST2-020', 'ST2-019', 'ST3-016'] : ['ST1-018', 'ST1-019', 'ST2-020'])
    .map((number, index) => ({card:card(number,'player-one'),rested:scenario==='negative'||(scenario==='attack-negative'&&index!==0)}))
  foe.supportArea = ['ST3-016', 'ST3-019', 'ST3-018'].map(number => ({card:card(number,'player-two'),rested:false}))
  for (const owner of ['player-one','player-two'] as const) {
    const player=state.players[owner]
    const used=player.hand.length+player.supportArea.length+player.battleArea.reduce((n,c)=>n+1+c.hpCards.length,0)
    player.deck=filler(60-used,owner)
  }
  if (attackMode) {
    if(scenario==='wrong-phase')state.phase='support'
    return state
  }
  if(scenario==='no-battle'){state.phase='support';return state}
  if(scenario==='rested-source'){
    state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:self.battleArea[0].card.instanceId,
      targetInstanceId:foe.battleArea[0].card.instanceId,supportPaymentIds:[self.supportArea[0].card.instanceId,self.supportArea[2].card.instanceId]})
    state=applyGameCommand(state,{kind:'skip-trap',playerId:'player-two'})
    state=applyGameCommand(state,{kind:'resolve-battle',playerId:'player-one'})
    for(let step=0;step<5;step++)state=applyGameCommand(state,{kind:'advance-phase',playerId:state.activePlayerId})
    if(state.activePlayerId!=='player-two'||state.phase!=='main')throw new Error('Expected actual opponent main phase')
  } else state.activePlayerId='player-two'
  state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:foe.battleArea[0].card.instanceId,
    targetInstanceId:self.battleArea[scenario==='already-target'?0:1].card.instanceId,supportPaymentIds:[foe.supportArea[0].card.instanceId]})
  if (scenario === 'second-attack' || scenario === 'low') {
    state = scenario === 'second-attack'
      ? applyGameCommand(state, { kind: 'play-blocker', playerId: 'player-one',
        sourceInstanceId: self.battleArea[0].card.instanceId, paymentIds: [self.supportArea[0].card.instanceId] })
      : applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
    state = applyGameCommand(state, { kind: 'resolve-battle', playerId: 'player-two' })
    state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two',
      attackerInstanceId: foe.battleArea[1].card.instanceId, targetInstanceId: self.battleArea[1].card.instanceId,
      supportPaymentIds: [foe.supportArea[1].card.instanceId] })
  }
  return state
}
