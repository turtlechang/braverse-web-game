import {describe,expect,it} from 'vitest'
import document from '../../data/candidates/st6-st10/official-st7.en.json'
import {getCardPoolEntry} from '../game/card-pool'
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
import type {OfficialCardRecord} from './types'
import type {GameCard} from '../game/types'
const raw=(getCardPoolEntry('ST7-018')??document.cards.find(c=>c.cardNumber==='ST7-018')) as OfficialCardRecord
const original=()=>createCard(raw,'player-one',1)
const trap=(c:GameCard)=>{if(!c.trap)throw Error('Original trap');return c.trap}
const heal=(c:GameCard)=>{const e=trap(c).effects[0];if(e?.kind!=='gain-hp')throw Error('Original HP gain');return e}
const target=(c:GameCard)=>{const t=heal(c).target;if(!t)throw Error('All own Cookies');return t}
const mutants:Record<string,(c:GameCard)=>void>={
 free:c=>{trap(c).cost.energy={}},oneEnergy:c=>{trap(c).cost.energy={yellow:1}},wrongEnergy:c=>{trap(c).cost.energy={red:2}},discard:c=>{trap(c).cost.discardHand=1},condition:c=>{trap(c).condition={kind:'break-level-at-least',level:4}},
 chooseOne:c=>{target(c).allMatching=false;target(c).max=1},opponent:c=>{target(c).side='opponent'},sourceOnly:c=>{target(c).sourceOnly=true},color:c=>{target(c).energyColor='yellow'},level:c=>{target(c).maxLevel=2},hpCap:c=>{target(c).maxRemainingHp=4},excludeSource:c=>{target(c).excludeSource=true},
 doubleHp:c=>{heal(c).amount=2},missing:c=>{trap(c).effects=[]},extra:c=>{trap(c).effects.push({kind:'draw',amount:1})},wrongName:c=>{c.name='Vined Cavern'},wrongColor:c=>{c.energyColor='red'},
}
describe('ST7-018 independently transcribed original printed binding',()=>{
 it('is original yellow YY Trap: all own Cookies each gain1 HP without selection or restrictions',()=>{
  const c=original()
  expect([c.type,c.name,c.energyColor,c.cardColor??c.energyColor]).toEqual(['trap',"Millennial Tree Cookie's Gift",'yellow','yellow'])
  expect(c.flip).toBeUndefined();expect(c.keywords??[]).toEqual([])
  expect(trap(c).cost).toEqual({energy:{yellow:2},discardHand:0});expect(trap(c).condition).toBeUndefined()
  expect(trap(c).effects).toEqual([{kind:'gain-hp',amount:1,target:{side:'self',min:0,max:2,allMatching:true}}])
 })
 it('verifies the exact original runtime',()=>expect(analyze(raw,original()).contract.status).toBe('verified'))
 it.each(Object.keys(mutants))('rejects %s without altering source',name=>{const c=original(),before=structuredClone(raw);mutants[name](c);expect(analyze(raw,c).contract.status).not.toBe('verified');expect(raw).toEqual(before)})
})
