import {describe,it,expect} from 'vitest'
import {raw,fixture} from '../game/st7-002-demo'
import {applyGameCommand} from '../game/commands'
import {canActivateCookieSkill} from '../game/skills'
import {getCardPoolEntry} from '../game/card-pool'
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
import type {CookieCard} from '../game/types'
const record=(id:string)=>{const r=id==='ST7-002'?raw:getCardPoolEntry(id);if(!r)throw Error(id);return r}
const original=(id:string):CookieCard=>{const c=createCard(record(id),'player-one',1);if(c.type!=='cookie')throw Error('Cookie');return c}
const cases=[
 {id:'ST7-002',levels:[0,1,2,3],threshold:2,hp:2},
 {id:'P-066',levels:[0,4,5,6],threshold:5,hp:3},
 {id:'BS4-033',levels:[4,5,6],threshold:5,hp:4},
 {id:'BS6-078',levels:[4,5,6],threshold:5,hp:3},
].flatMap(c=>c.levels.map(value=>({...c,value})))
describe('original printed conditional On Play actual HP',()=>{
 it.each(cases)('$id threshold boundary $value after real deployment',({id,value,threshold,hp})=>{
  const coffee=id==='BS6-078',s=fixture(coffee?0:value,id,true,coffee?value:0),before=structuredClone(s)
  const source=s.players['player-one'].battleArea.find(c=>c.card.id===id)!
  const met=coffee?value<=threshold:value>=threshold
  expect(source.hpCards).toHaveLength(hp)
  expect(canActivateCookieSkill(s,'player-one',source.card.instanceId,'on-play')).toBe(met)
  const payments=id==='BS4-033'?[s.players['player-one'].supportArea[0].card.instanceId]:coffee?[s.players['player-one'].supportArea[2].card.instanceId]:[]
  const next=met?applyGameCommand(s,{kind:'activate-skill',playerId:'player-one',sourceInstanceId:source.card.instanceId,trigger:'on-play',paymentIds:payments,effectTargets:[[source.card.instanceId]]}):applyGameCommand(s,{kind:'skip-on-play',playerId:'player-one',sourceInstanceId:source.card.instanceId})
  expect(next.players['player-one'].battleArea.find(c=>c.card.id===id)!.hpCards).toHaveLength(hp+(met?1:0))
  expect(next.players['player-one'].deck).toHaveLength(s.players['player-one'].deck.length-(met?1:0))
  expect(next.pendingOnPlay).toBeNull();expect(s).toEqual(before)
 })
 it('Mango free On Play works without any support and while source REST',()=>{
  const s=fixture(2,'ST7-002',false),source=s.players['player-one'].battleArea.find(c=>c.card.id==='ST7-002')!
  source.rested=true
  const next=applyGameCommand(s,{kind:'activate-skill',playerId:'player-one',sourceInstanceId:source.card.instanceId,trigger:'on-play',paymentIds:[],effectTargets:[[source.card.instanceId]]})
  expect(next.players['player-one'].supportArea).toEqual([])
  expect(next.players['player-one'].battleArea.find(c=>c.card.id==='ST7-002')!.hpCards).toHaveLength(3)
  expect(next.players['player-one'].battleArea.find(c=>c.card.id==='ST7-002')!.rested).toBe(true)
 })
 it.each(['zero','other'] as const)('Choux optional target %s retains Y payment',mode=>{
  const s=fixture(5,'BS4-033'),own=s.players['player-one'],source=own.battleArea.find(c=>c.card.id==='BS4-033')!,other=own.battleArea[0]
  const next=applyGameCommand(s,{kind:'activate-skill',playerId:'player-one',sourceInstanceId:source.card.instanceId,trigger:'on-play',paymentIds:[own.supportArea[0].card.instanceId],effectTargets:[mode==='zero'?[]:[other.card.instanceId]]})
  expect(next.players['player-one'].supportArea[0].rested).toBe(true)
  expect(next.players['player-one'].battleArea.find(c=>c.card.id==='BS4-033')!.hpCards).toHaveLength(4)
  expect(next.players['player-one'].battleArea[0].hpCards).toHaveLength(mode==='zero'?6:7)
 })
 it.each(['BS4-033','BS6-078'])('%s wrong payment cannot mutate input',id=>{
  const s=fixture(5,id,true,id==='BS6-078'?5:0),before=structuredClone(s),source=s.players['player-one'].battleArea.find(c=>c.card.id===id)!
  const wrong=s.players['player-one'].supportArea[id==='BS4-033'?2:0].card.instanceId
  expect(()=>applyGameCommand(s,{kind:'activate-skill',playerId:'player-one',sourceInstanceId:source.card.instanceId,trigger:'on-play',paymentIds:[wrong],effectTargets:[[source.card.instanceId]]})).toThrow()
  expect(s).toEqual(before)
 })
 it.each(['BS4-033','BS6-078'])('%s cannot pay REST supports',id=>{
  const s=fixture(5,id,true,id==='BS6-078'?5:0),source=s.players['player-one'].battleArea.find(c=>c.card.id===id)!
  s.players['player-one'].supportArea.forEach(c=>c.rested=true)
  expect(canActivateCookieSkill(s,'player-one',source.card.instanceId,'on-play')).toBe(false)
 })
})
const expected=[
 {id:'ST7-002',hp:2,level:1,energy:{},condition:{kind:'break-level-at-least',level:2},target:{side:'self',min:1,max:1,sourceOnly:true}},
 {id:'BS4-033',hp:4,level:2,energy:{yellow:1},condition:{kind:'break-level-at-least',level:5},target:{side:'self',min:0,max:1}},
 {id:'BS6-078',hp:3,level:2,energy:{blue:1},condition:{kind:'hand-count-at-most',count:5},target:{side:'self',min:1,max:1,sourceOnly:true}},
]
describe('printed HP restrictions cannot disappear behind strict verified',()=>{
 it.each(expected)('$id original full HP effect and cost',e=>{
  const c=original(e.id)
  expect(c.hp).toBe(e.hp);expect(c.level).toBe(e.level);expect(c.flip).toBeUndefined()
  expect(c.skill?.trigger).toBe('on-play');expect(c.skill?.cost.energy).toEqual(e.energy)
  expect(c.skill?.effects).toEqual([{kind:'gain-hp',amount:1,target:e.target,condition:e.condition}])
  expect(analyze(record(e.id)).contract.status).toBe('verified')
 })
 const mutations=['missing-condition','wrong-threshold','wrong-amount','opponent-target','wrong-source-filter','mandatory-or-optional-target']
 it.each(expected.flatMap(c=>mutations.map(mutation=>({id:c.id,mutation}))))('$id rejects $mutation runtime mutant',({id,mutation})=>{
  const c=original(id),e=c.skill!.effects[0]
  if(e.kind!=='gain-hp'||!e.condition||!e.target)throw Error('Original gain HP with condition')
  if(mutation==='missing-condition')delete e.condition
  if(mutation==='wrong-threshold'){if(e.condition!.kind==='break-level-at-least')e.condition!.level++;else if(e.condition!.kind==='hand-count-at-most')e.condition!.count++}
  if(mutation==='wrong-amount')e.amount++
  if(mutation==='opponent-target')e.target.side='opponent'
  if(mutation==='wrong-source-filter')e.target.sourceOnly=!e.target.sourceOnly
  if(mutation==='mandatory-or-optional-target')e.target.min=e.target.min===0?1:0
  expect(analyze(record(id),c).contract.status).not.toBe('verified')
 })
})
