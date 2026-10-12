import {describe,expect,it} from 'vitest'
import {createCard} from '../game/starter-deck'
import {getCardPoolEntry} from '../game/card-pool'
import {createSt7012PreviewState} from '../game/st7-012-demo'
import {isEffectConditionMet} from '../game/effects'
const raw=getCardPoolEntry('ST7-008')
if(!raw)throw Error('Formal original ST7-008 required')
const original=()=>{const card=createCard(raw,'player-one',1);if(card.type!=='cookie')throw Error('Original Cookie required');return card}
const condition={kind:'any-of' as const,conditions:[
 {kind:'battle-area-has-named-cookie' as const,side:'self' as const,name:'Millennial Tree Cookie',minLevel:3,maxLevel:3},
 {kind:'break-area-has-card' as const,side:'self' as const,name:'Millennial Tree Cookie',minLevel:3,maxLevel:3},
]}
describe('ST7-008 original print independent expectations',()=>{
 it('preserves yellow LV2 HP4 YYY ordinary3 without FLIP or invented keywords',()=>{
  const card=original();expect([card.name,card.energyColor,card.level,card.hp,card.attack,card.attackEnergyCost]).toEqual(['Elder Faerie Cookie','yellow',2,4,3,{yellow:3}]);expect(card.flip).toBeUndefined();expect(card.keywords??[]).toEqual([])
 })
 it('binds free On Play to same named LV3 own battle-or-Break witness and optional own yellow LV1 recovery',()=>{
  const card=original();expect(card.skill?.trigger).toBe('on-play');expect(card.skill?.cost).toEqual({energy:{},discardHand:0})
  expect(card.skill?.effects).toEqual([{kind:'break-to-trash',max:1,energyColor:'yellow',exactLevel:1,condition}])
 })
 it('binds the independent Then to own Break total four and original defender damage',()=>{
  expect(original().attackEffects).toEqual([{kind:'damage',amount:1,target:{side:'opponent',min:1,max:1,attackTargetOnly:true},condition:{kind:'break-level-at-least',level:4}}])
 })
 it('does not let an actual differently named LV3 Break Cookie satisfy the named witness',()=>{
  const state=createSt7012PreviewState('attack-yellow',true),before=structuredClone(state)
  const rawOther=getCardPoolEntry('ST7-003');if(!rawOther)throw Error('Original Rainbow Sherbet required')
  const other=createCard(rawOther,'player-one',1);if(other.type!=='cookie')throw Error('Original LV3 Cookie required')
  expect(other.level).toBe(3);state.players['player-one'].deck.shift();state.players['player-one'].breakArea.push(other)
  expect(isEffectConditionMet(state,{sourcePlayerId:'player-one',sourceInstanceId:'player-one-ST7-008-1'},{kind:'break-to-trash',max:1,condition})).toBe(false)
  expect(before.players['player-one'].breakArea).toHaveLength(0)
 })
})
