import {expect,it} from 'vitest'
import {createActualAwakenParent,openActualAwakenReturn,createActualExtraDeckReturnParent,returnActualExtraToDeck,createActualExtraTrashParent,createActualMainDeckCostParent,advanceTo,command,extra} from './bs12-r008-r009.test-helpers'
import {assertBs12PhysicalFixture} from './bs12-physical-fixtures.test-helpers'
import {getExtraDeckCookieUnavailableReason} from './actions'
import {getTrashToDeckCostCandidates,getTrashToDeckBottomCostCandidates,getDiscardHandCostCandidates} from './skills'
import {partitionDeckReturn,getNonFaintAttachmentTrash} from './card-destinations'
import {executeCardEffect} from './effects'
import {refreshDeck} from './refresh'
import type {CardEffect} from './types'
import {BS12_RULING_LIFECYCLE_SCENARIOS,createBs12RulingsDemoState,parseTestStateConfig} from './demo'
it('R008 actual Crunchy -> trash Dark Cacao -> gain2 -> Awaken2 precedes a real Adventurer return',()=>{
 const state=createActualAwakenParent();assertBs12PhysicalFixture(state)
 const awakened=state.players['player-one'].battleArea.find(c=>c.card.instanceId==='life-awaken')!
 expect(awakened.hpCards).toHaveLength(8)
 expect(awakened.awakenedUnderlay?.map(c=>c.instanceId)).toEqual(['life-cacao'])
 expect(state.commandLog?.map(c=>c.commandKind)).toContain('play-extra-deck-cookie')
 const opened=openActualAwakenReturn(),snapshot=structuredClone(opened)
 const after=command(opened,{kind:'resolve-ability-effect',playerId:'player-two',targetIds:['life-awaken']})
 expect(after.players['player-one'].discardPile.some(c=>c.instanceId==='life-cacao')).toBe(true)
 expect(after.players['player-one'].discardPile.filter(c=>awakened.hpCards.some(h=>h.instanceId===c.instanceId))).toHaveLength(8)
 expect(after.commandLog?.at(-1)?.steps?.map(step=>step.text).join(' ')).toContain('Awaken 底卡：「Dark Cacao Cookie」移入棄牌區')
 expect(opened).toEqual(snapshot)
 assertBs12PhysicalFixture(after)
})

it('R009 actual Timekeeper sends the EXTRA body from Break to Trash before Rainbow Headphones returns it',()=>{
 const before=createActualExtraTrashParent();assertBs12PhysicalFixture(before)
 expect(before.players['player-one'].discardPile).toContainEqual(expect.objectContaining({instanceId:'life-glitter',extraDeckOrigin:'extra'}))
 expect(before.commandLog?.map(c=>c.commandKind)).toContain('resolve-attack-effect')
 const snapshot=structuredClone(before)
 const after=command(before,{kind:'begin-play-item',playerId:'player-one',instanceId:'life-rainbow',paymentIds:['life-support-5'],targetIds:[]})
 expect(after.players['player-one'].extraDeck).toContainEqual(extra('BS12-018','life-glitter'))
 expect(after.players['player-one'].discardPile).toEqual([])
 expect(after.players['player-one'].deck.some(c=>c.instanceId==='life-glitter')).toBe(false)
 expect(after.commandLog?.at(-1)?.steps?.map(step=>step.text).join(' ')).toContain('「Shining Glitter Cookie」返回 EXTRA Deck')
 expect(before).toEqual(snapshot);assertBs12PhysicalFixture(after)
})

it('R009 real Kohlrabi Then excludes an otherwise matching EXTRA return cost and rejects forged payment atomically',()=>{
 const pending=createActualMainDeckCostParent();assertBs12PhysicalFixture(pending)
 const cost=pending.pendingOptionalCostAttack!.cost
 expect(cost.trashToDeck).toMatchObject({count:5,keyword:'arena',excludeFlip:true})
 const pile=pending.players['player-one'].discardPile,body=pile.find(c=>c.instanceId==='life-glitter')!
 expect(body.keywords).toContain('arena');expect(body.flip).toBeUndefined()
 const candidates=getTrashToDeckCostCandidates(cost,pile)
 expect(candidates.some(c=>c.instanceId===body.instanceId)).toBe(false)
 const ids=candidates.slice(0,5).map(c=>c.instanceId),snapshot=structuredClone(pending)
 expect(ids).toHaveLength(5)
 expect(()=>command(pending,{kind:'resolve-optional-cost-attack',playerId:'player-one',action:'pay',paymentIds:['life-support-6'],trashToDeckIds:[body.instanceId,...ids.slice(0,4)]})).toThrow()
 expect(pending).toEqual(snapshot)
 const after=command(pending,{kind:'resolve-optional-cost-attack',playerId:'player-one',action:'pay',paymentIds:['life-support-6'],trashToDeckIds:ids})
 expect(after.players['player-one'].discardPile).toContainEqual(body)
 expect(after.players['player-one'].deck.some(c=>c.instanceId===body.instanceId)).toBe(false)
})

it('R009 excludes EXTRA in both generic and Blocker main-deck-bottom costs',()=>{
 const before=createActualExtraTrashParent(),pile=before.players['player-one'].discardPile
 const body=pile.find(c=>c.instanceId==='life-glitter')!
 expect(getTrashToDeckBottomCostCandidates({trashToDeckBottom:{count:1}},pile)).not.toContainEqual(body)
 expect(getTrashToDeckBottomCostCandidates({trashToDeckBottom:{count:2,blockerOnly:true}},pile)).not.toContainEqual(body)
})
it('R009 actual Adventurer-returned EXTRA cannot pay a hand-to-main-bottom cost',()=>{
 let state=advanceTo(createActualExtraDeckReturnParent(),'player-two')
 state=command(state,{kind:'deploy-cookie',playerId:'player-two',instanceId:'life-adventurer'})
 state=command(state,{kind:'begin-activate-skill',playerId:'player-two',sourceInstanceId:'life-adventurer',trigger:'on-play',paymentIds:[]})
 state=command(state,{kind:'resolve-ability-effect',playerId:'player-two',targetIds:['life-clotted']})
 const hand=state.players['player-one'].hand,body=hand.find(c=>c.instanceId==='life-clotted')!
 expect(body.keywords).toContain('arena')
 expect(getDiscardHandCostCandidates({discardHand:1,discardHandKeyword:'arena'},hand)).toContainEqual(body)
 expect(getDiscardHandCostCandidates({discardHand:1,discardHandKeyword:'arena',handCostDestination:'deck-bottom'},hand)).not.toContainEqual(body)
 assertBs12PhysicalFixture(state)
})

it('R009 restores full printed EXTRA data and fails closed on missing origin data',()=>{
 const before=createActualExtraDeckReturnParent(),body=before.players['player-one'].battleArea.at(-1)!.card
 const snapshot=structuredClone(body)
 expect(partitionDeckReturn([body])).toEqual({mainDeck:[],extraDeck:[extra('BS12-036','life-clotted')]})
 expect(partitionDeckReturn([body]).extraDeck[0].playRequirement).toEqual(extra('BS12-036','life-clotted').playRequirement)
 expect(()=>partitionDeckReturn([{...body,extraDeckCard:undefined}])).toThrow('原始 EXTRA')
 expect(body).toEqual(snapshot)
})

it('R008 isolated effect and cost routing preserves actual Awaken attachments exactly once',()=>{
 const before=createActualAwakenParent(),host=before.players['player-one'].battleArea.find(c=>c.card.instanceId==='life-awaken')!
 const after=executeCardEffect(before,{sourcePlayerId:'player-one',sourceInstanceId:'isolated-movement'},{kind:'field-to-trash',target:{side:'self',min:1,max:1}},['life-awaken'])
 const ids=getNonFaintAttachmentTrash(host).map(c=>c.instanceId)
 expect(after.players['player-one'].discardPile.filter(c=>ids.includes(c.instanceId))).toHaveLength(ids.length)
 expect(new Set(after.players['player-one'].discardPile.map(c=>c.instanceId)).size).toBe(after.players['player-one'].discardPile.length)
 expect(after.players['player-one'].breakArea).toEqual(before.players['player-one'].breakArea)
})

it('R009 Refresh also returns a discarded actual EXTRA body to EXTRA Deck',()=>{
 const actual=createActualExtraTrashParent(),before={...actual,players:{...actual.players,'player-one':{...actual.players['player-one'],deck:[]}}}
 // Isolate Refresh after the printed parent; empty-deck preparation is not Browser acceptance.
 const after=refreshDeck(before,'player-one','life-blocker-0',cards=>cards)
 expect(after.players['player-one'].extraDeck).toContainEqual(extra('BS12-018','life-glitter'))
 expect(after.players['player-one'].deck.some(c=>c.instanceId==='life-glitter')).toBe(false)
})
it.each([
 ['field-to-deck-bottom',{kind:'field-to-deck-bottom',target:{side:'self',min:1,max:1}},'player-one',true],
 ['return-to-deck-bottom',{kind:'return-to-deck-bottom',target:{side:'self',min:1,max:1}},'player-one',true],
 ['battle-to-deck-top',{kind:'battle-to-deck-top',target:{side:'self',min:1,max:1}},'player-one',true],
 ['field-to-deck-bottom-all',{kind:'field-to-deck-bottom-all'},'player-two',true],
 ['field-to-trash-all',{kind:'field-to-trash-all'},'player-two',false],
] as const)('isolated shared %s routes real Awaken attachments once, without treating it as a printed parent',(_name,effect,sourcePlayerId,returnsExtra)=>{
 const before=createActualAwakenParent(),snapshot=structuredClone(before)
 const host=before.players['player-one'].battleArea.find(c=>c.card.instanceId==='life-awaken')!
 const after=executeCardEffect(before,{sourcePlayerId,sourceInstanceId:'isolated-movement'},effect satisfies CardEffect,['life-awaken'])
 const player=after.players['player-one'],attachments=getNonFaintAttachmentTrash(host)
 for(const card of attachments)expect(player.discardPile.filter(c=>c.instanceId===card.instanceId)).toEqual([card])
 expect(player.battleArea.some(c=>c.card.instanceId==='life-awaken')).toBe(false)
 expect(player.deck.some(c=>c.instanceId==='life-awaken')).toBe(false)
 if(returnsExtra)expect(player.extraDeck).toContainEqual(extra('BS8-104','life-awaken'))
 else expect(player.discardPile).toContainEqual(host.card)
 expect(before).toEqual(snapshot)
})
it.each(BS12_RULING_LIFECYCLE_SCENARIOS)('local Browser route %s preserves real printed parent commands and legal HP',scenario=>{
 expect(parseTestStateConfig('?test-state=bs12-rulings:'+scenario,'localhost')).toEqual({kind:'bs12-rulings',scenario})
 expect(parseTestStateConfig('?test-state=bs12-rulings:'+scenario,'example.com')).toBeNull()
 const state=createBs12RulingsDemoState(scenario);assertBs12PhysicalFixture(state)
 if(scenario.startsWith('r008-'))expect(state.pendingAbilityEffect?.playerId).toBe('player-one')
 expect(state.commandLog?.length).toBeGreaterThan(0)
 for(const player of Object.values(state.players))for(const host of player.battleArea){
   if(host.card.instanceId==='life-awaken')expect(host.hpCards).toHaveLength(8)
   else if(scenario.startsWith('r009-cost')&&host.card.instanceId==='life-foe'){
     expect(host.hpCards).toHaveLength(5)
     expect(state.commandLog?.some(c=>c.commandKind==='resolve-next-damage')).toBe(true)
   }
   else expect(host.hpCards).toHaveLength(host.card.hp)
 }
})
it.each(['BS12-036','BS12-036@1'] as const)('R009 actual Cream Soda returns original %s to EXTRA, not main bottom',number=>{
 const before=createActualExtraDeckReturnParent(number);assertBs12PhysicalFixture(before)
 const source=before.players['player-one'].battleArea.find(c=>c.card.instanceId==='life-clotted')!,after=returnActualExtraToDeck(before)
 expect(source.hpCards).toHaveLength(4)
 expect(after.players['player-one'].deck).toEqual(before.players['player-one'].deck)
 expect(after.players['player-one'].extraDeck).toContainEqual(extra(number,'life-clotted'))
 expect(after.players['player-one'].discardPile).toEqual(source.hpCards)
 expect(getExtraDeckCookieUnavailableReason(after,'player-one','life-next-extra')).not.toBeNull()
 expect(after.arenaCookiesPlacedFromBattleToDeckBottomThisTurn?.['player-one']).not.toBe(true)
 expect(after.cookiesPlacedFromBattleToDeckThisTurn?.['player-one']).not.toBe(true)
 const text=after.commandLog?.at(-1)?.steps?.map(step=>step.text).join(' ') ?? ''
 expect(text).toContain('「Clotted Cream Cookie」返回 EXTRA Deck')
 expect(text).not.toContain('「Clotted Cream Cookie」放到持有者牌庫底')
 assertBs12PhysicalFixture(after)
})
