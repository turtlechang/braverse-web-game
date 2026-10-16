// Synthetic counterexamples exercise engine boundaries, not printed-card rulings.
import {describe,expect,it} from 'vitest'
import {
 applyGameCommand,createCard,createPlayerView,getCardPoolEntry,takeAiStep,
 type AiLevel,type GameCard,type GameCommand,type GameState,type PlayerId,
} from './index'
import {createSt8007PreviewState,raw as st8007} from './st8-007-demo'
import {commandFromLogEntry} from './replay'

const owner:PlayerId='player-one',attacker:PlayerId='player-two'
const levels:AiLevel[]=[3,4,5]
const scenarios=['positive','low','own-carrier'] as const
type Scenario=typeof scenarios[number]
const need=<T,>(value:T|undefined|null,label:string):T=>{
 if(value===undefined||value===null)throw new Error(`Missing ${label}`)
 return value
}
const battle=(s:GameState)=>need(s.pendingBattle,'battle')
const flip=(s:GameState)=>need(need(battle(s).revealedHpCard,'revealed HP').flip,'FLIP')
const command=(s:GameState):GameCommand=>commandFromLogEntry(need(need(s.commandLog,'command log').at(-1),'last entry'))
const cards=(s:GameState,id:PlayerId):GameCard[]=>{
 const p=s.players[id],b=s.pendingBattle
 const revealed=b?.revealedHpCard&&!b.detachedFlip&&(b.damagePlayerId??b.defenderPlayerId)===id?b.revealedHpCard:undefined
 return [...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(x=>x.card),
  ...p.battleArea.flatMap(x=>[x.card,...x.hpCards]),...(p.stage?[p.stage.card]:[]),...(revealed?[revealed]:[])]
}
const resources=(s:GameState)=>{
 for(const id of [owner,attacker]){
  const all=cards(s,id),counts=new Map<string,number>()
  expect(s.players[id].extraDeck).toHaveLength(0)
  expect(all).toHaveLength(60)
  expect(new Set(all.map(c=>c.instanceId)).size).toBe(60)
  for(const c of all){
   counts.set(c.id,(counts.get(c.id)??0)+1)
   const raw=need(c.id==='ST8-007'?st8007:getCardPoolEntry(c.id),c.id)
   expect(c.name).toBe(raw.name);expect(c.imageUrl).toBe(raw.imageUrl)
   if(c.type==='cookie'){expect(c.level).toBe(raw.level);expect(c.hp).toBe(raw.hp)}
  }
  expect([...counts.values()].every(n=>n<=4)).toBe(true)
 }
 expect(new Set([...cards(s,owner),...cards(s,attacker)].map(c=>c.instanceId)).size).toBe(120)
}
const hp=(s:GameState)=>s.players[owner].battleArea.map(c=>({id:c.card.instanceId,hp:c.hpCards.length}))
const replay=(initial:GameState,commands:readonly GameCommand[])=>{
 let s=structuredClone(initial)
 for(const c of commands){s=applyGameCommand(s,structuredClone(c));resources(s)}
 return s
}
const parent=(scenario:Scenario)=>{
 const initial=createSt8007PreviewState(scenario,true),p=initial.players[attacker]
 expect(initial.preventHpGainThisTurn?.[owner]).not.toBe(true)
 const raw=need(getCardPoolEntry('BS9-035'),'BS9-035')
 expect(raw.type).toBe('cookie');expect(raw.level).toBe(3);expect(raw.hp).toBe(5)
 expect(need(p.deck.shift(),'replacement filler').flip).toBeUndefined()
 const source=createCard(raw,attacker,1)
 if(source.type!=='cookie')throw new Error('Expected BS9-035 Cookie')
 expect(source.skill).toMatchObject({trigger:'activate',oncePerTurn:true,cost:{energy:{},discardHand:1},effects:[{kind:'prevent-opponent-hp-gain'}]})
 p.battleArea.push({card:source,hpCards:p.deck.splice(0,5),rested:false,battleEntryId:source.instanceId+':entry'})
 p.hand.push(need(p.deck.shift(),'actual hand cost'))
 resources(initial)
 const ordinary=need(p.battleArea[0],'ordinary attacker')
 expect(ordinary.card.id).toBe('ST6-003');expect(ordinary.card.name).toBe('Devil Cookie')
 if(ordinary.card.type!=='cookie')throw new Error('Expected attacking Cookie')
 expect(ordinary.card.attack).toBe(3);expect(ordinary.card.attackEnergyCost).toEqual({neutral:3})
 const target=need(initial.players[owner].battleArea[0],'HP bearer')
 const commands:GameCommand[]=[
  {kind:'begin-activate-skill',playerId:attacker,sourceInstanceId:source.instanceId,trigger:'activate',paymentIds:[],discardHandIds:[need(p.hand[0],'skill discard').instanceId]},
  {kind:'resolve-ability-effect',playerId:attacker,targetIds:[]},
  {kind:'declare-attack',playerId:attacker,attackerInstanceId:ordinary.card.instanceId,targetInstanceId:target.card.instanceId,supportPaymentIds:p.supportArea.map(x=>x.card.instanceId)},
  {kind:'skip-trap',playerId:owner},
  ...Array.from({length:scenario==='low'?3:1},():GameCommand=>({kind:'resolve-next-damage',playerId:owner})),
 ]
 let state=structuredClone(initial)
 const trace:GameCommand[]=[]
 for(const [index,c] of commands.entries()){
  state=applyGameCommand(state,c);resources(state)
  expect(command(state)).toEqual(c);trace.push(structuredClone(command(state)))
  if(index===0){expect(state.players[attacker].hand).toHaveLength(0);expect(state.preventHpGainThisTurn?.[owner]).not.toBe(true)}
  if(index===1)expect(state.preventHpGainThisTurn).toEqual({[owner]:true})
 }
 expect(battle(state).stage).toBe('flip')
 expect(need(battle(state).revealedHpCard,'revealed printing').id).toBe('ST8-007')
 expect(replay(initial,trace)).toEqual(state)
 return {initial,state,trace}
}
const decide=(s:GameState,level:AiLevel)=>{
 const before=structuredClone(s),result=takeAiStep(s,owner,{level,seed:1})
 expect(result.error).toBeUndefined();expect(s).toEqual(before);resources(result.state)
 expect(applyGameCommand(s,structuredClone(command(result.state)))).toEqual(result.state)
 return result
}
describe('public prevention of pure paid HP FLIP',()=>{
 for(const level of levels)for(const scenario of scenarios){
  it(`Lv${level} original BS9-035 parent: skip blocked pure paid HP (${scenario})`,()=>{
   const {initial,state,trace}=parent(scenario),actual=decide(state,level),c=command(actual.state)
   expect(c).toMatchObject({kind:'resolve-flip',activate:false,discardHandIds:[]})
   expect(actual.state.players[owner].hand).toEqual(state.players[owner].hand)
   expect(replay(initial,[...trace,c])).toEqual(actual.state)
   const paid=applyGameCommand(state,{kind:'resolve-flip',playerId:owner,activate:true,discardHandIds:[need(state.players[owner].hand[0],'FLIP payment').instanceId]})
   resources(paid)
   expect(hp(paid)).toEqual(hp(actual.state))
   expect(paid.players[owner].deck).toEqual(actual.state.players[owner].deck)
   expect(paid.players[owner].hand.length).toBe(actual.state.players[owner].hand.length-1)
   expect(paid.cookiesGainedHpThisTurn?.[owner]).not.toBe(true)
  })
 }
 // 3 scenarios x 3 levels x 2 variants = 18 same-public-view permutation pairs.
 for(const level of levels)for(const scenario of scenarios)for(const mode of ['deck-order','deck-and-hp'] as const){
  it(`Lv${level} same-public-view hidden permutation (${scenario}/${mode})`,()=>{
   const {state}=parent(scenario),changed=structuredClone(state),p=changed.players[owner]
   const first=need(p.deck[0],'deck first'),last=need(p.deck.at(-1),'deck last')
   p.deck[0]=last;p.deck[p.deck.length-1]=first
   if(mode==='deck-and-hp'){
    const bearer=need(p.battleArea.find(c=>c.hpCards.length>0),'unknown HP bearer')
    const unknown=need(bearer.hpCards[0],'unknown HP'),top=need(p.deck[0],'unknown top')
    bearer.hpCards[0]=top;p.deck[0]=unknown
   }
   resources(changed)
   expect(createPlayerView(changed,owner)).toEqual(createPlayerView(state,owner))
   expect(command(decide(changed,level).state)).toEqual(command(decide(state,level).state))
  })
 }
 const modes=['unblocked-rescue','other-owner-blocked','synthetic-draw','synthetic-free','synthetic-deck-bottom','synthetic-detached'] as const
 for(const level of levels)for(const mode of modes){
  it(`Lv${level} preserves effective / excluded branch (${mode})`,()=>{
   const {state}=parent('low'),f=flip(state),b=battle(state)
   if(mode==='unblocked-rescue')state.preventHpGainThisTurn={}
   if(mode==='other-owner-blocked')state.preventHpGainThisTurn={[attacker]:true}
   if(mode==='synthetic-draw')f.effects=[{kind:'draw',amount:1}]
   if(mode==='synthetic-free')f.cost={energy:{}}
   if(mode==='synthetic-deck-bottom')f.handCostDestination='deck-bottom'
   if(mode==='synthetic-detached'){
    // Synthetic isolated branch: detached reveal references a card still in
    // its physical zone, unlike damage that actually removes an HP card.
    state.players[owner].deck.unshift(need(b.revealedHpCard,'detached reference'))
    b.detachedFlip=true;b.attackerPlayerId=owner
    b.attackerInstanceId=need(state.players[owner].battleArea[1],'synthetic attacker').card.instanceId
   }
   resources(state)
   const actual=decide(state,level),c=command(actual.state)
   expect(c).toMatchObject({kind:'resolve-flip',activate:true})
   if(mode==='unblocked-rescue'||mode==='other-owner-blocked')expect(need(actual.state.players[owner].battleArea.find(x=>x.card.instanceId===b.targetInstanceId),'rescued bearer').hpCards).toHaveLength(1)
   if(mode==='synthetic-draw'){
    expect(actual.state.players[owner].deck).toHaveLength(state.players[owner].deck.length-1)
    expect(hp(actual.state)).toEqual(hp(applyGameCommand(state,{kind:'resolve-flip',playerId:owner,activate:false,discardHandIds:[]})))
   }
   if(mode==='synthetic-free')expect(c).toMatchObject({discardHandIds:[]})
   if(mode==='synthetic-deck-bottom')expect(actual.state.players[owner].deck).toHaveLength(state.players[owner].deck.length+1)
  })
 }
})
