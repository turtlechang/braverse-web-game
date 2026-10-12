import {describe,expect,it} from 'vitest'
import document from '../../data/candidates/st6-st10/official-st7.en.json'
import {getCardPoolEntry} from '../game/card-pool'
import {createCard} from '../game/starter-deck'
import type {GameCard} from '../game/types'
import type {OfficialCardRecord} from './types'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
const raw=(getCardPoolEntry('ST7-017')??document.cards.find(c=>c.cardNumber==='ST7-017')) as OfficialCardRecord
const original=()=>createCard(raw,'player-one',1)
const trap=(c:GameCard)=>{if(!c.trap)throw Error('Original trap');return c.trap}
const base=(c:GameCard)=>{const e=trap(c).effects[0];if(e?.kind!=='modify-attack')throw Error('Original base');return e}
const then=(c:GameCard)=>{const e=base(c).thenEffects?.[0];if(e?.kind!=='modify-attack')throw Error('Original Then');return e}
const mutants:Record<string,(c:GameCard)=>void>={
 activationGate:c=>{trap(c).condition={kind:'break-level-at-least',level:4}},levelFilter:c=>{base(c).target.minLevel=4},ownTarget:c=>{base(c).target.side='self'},mandatory:c=>{base(c).target.min=1},twoTargets:c=>{base(c).target.max=2},hpFilter:c=>{base(c).target.maxRemainingHp=2},colorFilter:c=>{base(c).target.energyColor='yellow'},
 free:c=>{trap(c).cost.energy={}},overpay:c=>{trap(c).cost.energy={yellow:2}},wrongEnergy:c=>{trap(c).cost.energy={red:1}},discard:c=>{trap(c).cost.discardHand=1},wrongColor:c=>{c.energyColor='red'},wrongName:c=>{c.name='Tightly Tied Vine'},
 missingThen:c=>{base(c).thenEffects=[]},unconditionalThen:c=>{then(c).condition=undefined},wrongThreshold:c=>{then(c).condition={kind:'break-level-at-least',level:3}},differentThenTarget:c=>{delete then(c).target.previousEffectTargetOnly},doubleBase:c=>{base(c).amount=-2},doubleThen:c=>{then(c).amount=-2},permanent:c=>{base(c).duration='opponent-next-turn'},extraEffect:c=>{trap(c).effects.push({kind:'draw',amount:1})},
}
describe('ST7-017 original Vined Cavern printed binding',()=>{
 it('preserves yellow Y optional opponent -1 then same target another -1 at own Break4',()=>{
  const card=original(),t=trap(card)
  expect([card.type,card.name,card.energyColor,card.cardColor??card.energyColor]).toEqual(['trap','Vined Cavern','yellow','yellow'])
  expect(card.flip).toBeUndefined();expect(card.keywords??[]).toEqual([])
  expect(t.cost).toEqual({energy:{yellow:1},discardHand:0});expect(t.condition).toBeUndefined()
  expect(t.effects).toEqual([{kind:'modify-attack',amount:-1,duration:'this-turn',target:{side:'opponent',min:0,max:1},thenEffects:[{kind:'modify-attack',amount:-1,duration:'this-turn',target:{side:'opponent',min:0,max:1,previousEffectTargetOnly:true},condition:{kind:'break-level-at-least',level:4}}]}])
 })
 it('verifies complete original runtime',()=>expect(analyze(raw,original()).contract.status).toBe('verified'))
 it.each(Object.keys(mutants))('rejects %s without changing raw source',name=>{const c=original(),before=structuredClone(raw);mutants[name](c);expect(analyze(raw,c).contract.status).not.toBe('verified');expect(raw).toEqual(before)})
})
