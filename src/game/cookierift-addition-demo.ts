import document from '../../data/cards/official-cookierift-additions.en.json'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import { applyGameCommand } from './commands'
import type { OfficialCardRecord } from '../cards/types'
import type { CookieCard, GameCard, PlayerId } from './types'
import type { DeckAdditionScenario } from './bs12-deck-addition-demo'

export const COOKIERIFT_ADDITION_NUMBERS = ['P-163', 'ST7-005']

/** Local card acceptance; all zones use original printed cards and normal commands. */
export const createCookieriftAdditionState = (number:string, scenario:DeckAdditionScenario) => {
  const counts = new Map<string,number>()
  const card = (id:string, owner:PlayerId = 'player-one'):GameCard => {
    const key = `${owner}:${id}`, copy = (counts.get(key) ?? 0)+1
    if(copy>4) throw new Error(`Too many printed copies: ${key}`)
    counts.set(key,copy)
    const raw = (document.cards as OfficialCardRecord[]).find(c=>c.cardNumber===id) ?? getCardPoolEntry(id)
    if(!raw) throw new Error(`Missing printed card ${id}`)
    return createCard(raw,owner,copy)
  }
  const filler = (count:number, owner:PlayerId = 'player-one') => {
    const cards:GameCard[] = []
    for(const raw of getAllCardPoolEntries()) {
      if(raw.variant || raw.type==='extra' || hasFlipAbility(raw) || COOKIERIFT_ADDITION_NUMBERS.includes(raw.cardNumber)) continue
      if((counts.get(`${owner}:${raw.baseCardNumber}`)??0)>=4) continue
      cards.push(card(raw.baseCardNumber,owner))
      if(cards.length===count) return cards
    }
    throw new Error('Not enough physical filler')
  }
  const battle = (id:string, owner:PlayerId = 'player-one') => {
    const c=card(id,owner)
    if(c.type!=='cookie')throw new Error('Expected printed Cookie')
    return {card:c as CookieCard,hpCards:filler(c.hp,owner),rested:false,battleEntryId:`${c.instanceId}:entry`}
  }
  let state=createGame(
    {id:'player-one',name:'卡牌驗收',deck:createOfficialRedStarterDeck('player-one')},
    {id:'player-two',name:'實體對手',deck:createOfficialRedStarterDeck('player-two')},
    'player-one', cards=>cards,
  )
  for(const p of Object.values(state.players)) {
    p.deck=[];p.hand=[];p.supportArea=[];p.breakArea=[];p.discardPile=[];p.battleArea=[];p.stage=null
    p.startingCookieSelected=true
  }
  const self=state.players['player-one'], foe=state.players['player-two']
  state={...state,status:'playing',phase:'main',turnNumber:3,activePlayerId:'player-one'}
  const normalAttack = scenario.startsWith('attack')
  self.battleArea=[battle(number==='P-163'?'P-163':normalAttack?'ST7-005':'BS12-059')]
  if(number==='P-163') {
    self.battleArea.push(battle(scenario==='low'||scenario==='non-arena'?'ST1-001':scenario==='green-arena'?'BS7-062':'BS12-016'))
    self.battleArea[1].rested=true
    self.supportArea=(normalAttack?['ST1-018','ST1-019','ST1-020']:[scenario==='wrong-color'?'ST2-020':'ST1-020']).map((id,index)=>({card:card(id),rested:scenario==='negative'||(scenario==='attack-negative'&&index===2)}))
    foe.battleArea=[battle('BS12-059','player-two')]
  } else if(normalAttack) {
    self.supportArea=['ST2-019','ST2-020'].map((id,index)=>({card:card(id),rested:scenario==='attack-negative'&&index===1}))
    foe.battleArea=[battle('BS12-059','player-two')]
  } else {
    const hp=card('ST7-005')
    // Replace a filler HP card, returning it to the deck below; retain printed HP count.
    const displaced=self.battleArea[0].hpCards[scenario==='low'?0:3]
    self.battleArea[0].hpCards[scenario==='low'?0:3]=hp
    self.deck.push(displaced)
    if(scenario!=='negative')self.hand=[card('ST1-001')]
    foe.battleArea=[battle('BS12-059','player-two')]
    foe.supportArea=['ST4-013','ST4-014','ST4-015'].map(id=>({card:card(id,'player-two'),rested:false}))
    state.activePlayerId='player-two'
  }
  for(const owner of ['player-one','player-two'] as const) {
    const p=state.players[owner]
    const used=p.deck.length+p.hand.length+p.supportArea.length+p.battleArea.reduce((n,c)=>n+1+c.hpCards.length,0)
    p.deck.push(...filler(60-used,owner))
  }
  if(number==='ST7-005'&&!normalAttack) {
    state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-two',
      attackerInstanceId:foe.battleArea[0].card.instanceId,targetInstanceId:self.battleArea[0].card.instanceId,
      supportPaymentIds:foe.supportArea.map(s=>s.card.instanceId)})
    state=applyGameCommand(state,{kind:'skip-trap',playerId:'player-one'})
    for(let i=0;i<(scenario==='low'?4:1);i++)state=applyGameCommand(state,{kind:'resolve-next-damage',playerId:'player-one'})
  }
  return state
}
