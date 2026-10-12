import {describe,expect,it} from 'vitest'
import type {GameCard,GameState,PlayerId} from './types'
import {createSt7012PreviewState} from './st7-012-demo'
import {getCardPoolEntry} from './card-pool'
import {createCard} from './starter-deck'
import {applyGameCommand} from './commands'
import {canPlayItem} from './card-abilities'
import {takeAiStep} from './ai'

export const raw=getCardPoolEntry('ST7-013')
if(!raw)throw Error('Formal original ST7-013 required')
const zones=(state:GameState,owner:PlayerId):GameCard[]=>{
 const p=state.players[owner]
 return [...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(s=>s.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards,...(c.equippedCards??[])])]
}
// Prepare the original full-pool filler once; each case owns a deep clone.
const originals=new Map(['attack-yellow','attack-faint'].map(scenario=>[scenario,createSt7012PreviewState(scenario,true)]))
const fixture=(scenario='attack-yellow')=>{
 const original=originals.get(scenario);if(!original)throw Error('Missing original scenario')
 const state=structuredClone(original)
 const add=(number:string,zone:'hand'|'discardPile'|'breakArea',owner:PlayerId='player-one')=>{
  const original=number==='ST7-013'?raw:getCardPoolEntry(number)
  if(!original)throw Error('Missing original '+number)
  const used=new Set(zones(state,owner).map(card=>card.instanceId))
  let card:GameCard|undefined
  for(let copy=1;copy<=4;copy++){const candidate=createCard(original,owner,copy);if(!used.has(candidate.instanceId)){card=candidate;break}}
  if(!card)throw Error('Original copy limit '+number)
  if(!state.players[owner].deck.shift())throw Error('Original deck replacement required')
  if(zone==='breakArea'){
   if(card.type!=='cookie')throw Error('Only original Cookies enter Break')
   state.players[owner].breakArea.push(card)
  }else state.players[owner][zone].push(card)
  return card
 }
 const item=add('ST7-013','hand')
 const low=add('ST7-004','discardPile'),middle=add('ST7-007','discardPile'),high=add('ST7-001','discardPile')
 const red=add('ST6-006','discardPile'),trap=add('ST2-020','discardPile'),hand=add('ST7-004','hand')
 const paymentIds=state.players['player-one'].supportArea.slice(0,2).map(s=>s.card.instanceId)
 const target=state.players['player-two'].battleArea[0].card.instanceId
 const command={kind:'play-item' as const,playerId:'player-one' as const,instanceId:item.instanceId,paymentIds,trashCookieToBreakAreaIds:[low.instanceId],effectTargets:[[target]]}
 return {state,add,item,low,middle,high,red,trap,hand,command,target}
}
describe('ST7-013 original printed item cost through formal commands',()=>{
 it('preserves original sixty-card zones, copy limits, printed item and full cost',()=>{
  const f=fixture()
  for(const owner of ['player-one','player-two'] as const){
   const cards=zones(f.state,owner);expect(cards).toHaveLength(60)
   expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60)
   const counts=new Map<string,number>();for(const c of cards){const id=c.instanceId.replace(/-\d+$/,'');counts.set(id,(counts.get(id)??0)+1)}
   expect([...counts.values()].every(count=>count<=4)).toBe(true)
  }
  if(f.item.type!=='item')throw Error('Original item required')
  expect(f.item.item?.cost).toEqual({energy:{yellow:2},discardHand:0,trashCookieToBreakArea:{count:1,energyColor:'yellow'}})
 })
 it.each(['low','middle','high'] as const)('pays any printed yellow Cookie level: %s',level=>{
  const f=fixture(),before=structuredClone(f.state),chosen=f[level]
  const next=applyGameCommand(f.state,{...f.command,trashCookieToBreakAreaIds:[chosen.instanceId]})
  expect(next.players['player-one'].breakArea.map(c=>c.instanceId)).toEqual([chosen.instanceId])
  expect(next.players['player-one'].discardPile.some(c=>c.instanceId===chosen.instanceId)).toBe(false)
  expect(next.players['player-one'].discardPile.filter(c=>c.instanceId===f.item.instanceId)).toHaveLength(1)
  expect(next.players['player-one'].hand.some(c=>c.instanceId===f.item.instanceId)).toBe(false)
  expect(next.players['player-one'].supportArea.map(s=>s.rested)).toEqual([true,true,false])
  expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
  expect(f.state).toEqual(before)
 })
 it('optional zero still pays the complete cost and leaves opponent HP intact',()=>{
  const f=fixture(),next=applyGameCommand(f.state,{...f.command,effectTargets:[[]]})
  expect(next.players['player-one'].breakArea.map(c=>c.instanceId)).toEqual([f.low.instanceId])
  expect(next.players['player-one'].supportArea.map(s=>s.rested)).toEqual([true,true,false])
  expect(next.players['player-one'].discardPile.filter(c=>c.instanceId===f.item.instanceId)).toHaveLength(1)
  expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
 })
 it.each(['missing','duplicate','two','red','trap','hand','support','battle','foreign'])('rejects invalid trash payment %s without mutating input',scenario=>{
  const f=fixture(),before=structuredClone(f.state)
  const ids:Record<string,string[]>={missing:[],duplicate:[f.low.instanceId,f.low.instanceId],two:[f.low.instanceId,f.middle.instanceId],red:[f.red.instanceId],trap:[f.trap.instanceId],hand:[f.hand.instanceId],support:[f.command.paymentIds[0]],battle:[f.state.players['player-one'].battleArea[0].card.instanceId],foreign:[f.target]}
  expect(()=>applyGameCommand(f.state,{...f.command,trashCookieToBreakAreaIds:ids[scenario]})).toThrow()
  expect(f.state).toEqual(before)
 })
 it('disables item when no eligible yellow Cookie is in own trash',()=>{
  const f=fixture(),p=f.state.players['player-one']
  p.deck.push(...p.discardPile.filter(c=>c.type==='cookie'&&c.energyColor==='yellow'))
  p.discardPile=p.discardPile.filter(c=>c.type!=='cookie'||c.energyColor!=='yellow')
  expect(canPlayItem(f.state,'player-one',f.item.instanceId)).toBe(false)
  expect(()=>applyGameCommand(f.state,f.command)).toThrow()
 })
 it.each(['play-item','begin-play-item'] as const)('cost reaches Break ten before damage via %s',kind=>{
  const f=fixture();for(let copy=0;copy<3;copy++)f.add('ST7-003','breakArea')
  expect(f.state.players['player-one'].breakArea.reduce((sum,c)=>sum+c.level,0)).toBe(9)
  const next=applyGameCommand(f.state,{...f.command,kind})
  expect(next.status).toBe('finished');expect(next.result?.winnerId).toBe('player-two')
  expect(next.players['player-one'].breakArea.reduce((sum,c)=>sum+c.level,0)).toBe(10)
  expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
  expect(next.pendingAbilityEffect??null).toBeNull()
 })
 it('interactive target opens after the exact cost has left trash',()=>{
  const f=fixture(),next=applyGameCommand(f.state,{...f.command,kind:'begin-play-item'})
  expect(next.players['player-one'].breakArea.map(c=>c.instanceId)).toEqual([f.low.instanceId])
  expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
  expect(next.pendingAbilityEffect?.sourceInstanceId).toBe(f.item.instanceId)
  const resolved=applyGameCommand(next,{kind:'resolve-ability-effect',playerId:'player-one',targetIds:[f.target]})
  expect(resolved.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
 })
 for(const level of [3,4,5] as const){
  it.each([false,true])(`AI Lv${level} takes lethal using a safe public cost regardless of trash order: %s`,reverse=>{
   const f=fixture('attack-faint')
   for(let copy=0;copy<3;copy++)f.add('ST7-003','breakArea','player-two')
   for(let copy=0;copy<2;copy++)f.add('ST7-003','breakArea')
   f.add('ST7-004','breakArea')
   f.state.players['player-one'].battleArea.forEach(c=>{c.rested=true})
   if(reverse)f.state.players['player-one'].discardPile.reverse()
   const before=structuredClone(f.state),next=takeAiStep(f.state,'player-one',{level,seed:70132026,searchNow:()=>0})
   expect(next.action).toBe('play-item');expect(next.state.result?.winnerId).toBe('player-one')
   expect(next.state.players['player-one'].breakArea.reduce((sum,c)=>sum+c.level,0)).toBe(8)
   expect(next.state.commandLog?.at(-1)?.payload).toMatchObject({kind:'play-item',trashCookieToBreakAreaIds:[f.low.instanceId]})
   expect(f.state).toEqual(before)
  })
  it(`AI Lv${level} declines lethal damage when paying first would itself lose`,()=>{
   const f=fixture('attack-faint')
   for(let copy=0;copy<3;copy++){f.add('ST7-003','breakArea');f.add('ST7-003','breakArea','player-two')}
   f.state.players['player-one'].battleArea.forEach(c=>{c.rested=true})
   const before=structuredClone(f.state),next=takeAiStep(f.state,'player-one',{level,seed:70132026,searchNow:()=>0})
   expect(next.action).not.toBe('play-item');expect(next.state.result?.winnerId).not.toBe('player-two')
   expect(f.state).toEqual(before)
  })
 }
})
