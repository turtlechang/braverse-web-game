import assert from 'node:assert/strict'
import {describe,it} from 'vitest'
import document from '../../data/cards/official-st6-006.en.json'
import type {OfficialCardRecord} from '../cards/types'
import type {PlayerId} from './types'
import * as game from './index'
const raw=document.cards.find(card=>card.cardNumber==='ST6-006') as OfficialCardRecord
const printed=(id:string,owner:PlayerId='player-one',copy=1)=>game.createCard(game.getCardPoolEntry(id)!,owner,copy)
const back=(id:string)=>({...printed('ST1-020'),instanceId:id})
// Real BS9-030 parent actions with synthetic unknown backs; not physical acceptance.
describe('ST6-006 detached FLIP from the BS9-030 Then',()=>{
it.each([false,true])('moves the discarded revealed instance exactly once (activate=%s)',activate=>{
 let state=game.createDemoGame(1);state.activePlayerId='player-one';state.phase='main';state.turnNumber=3
 for(const player of Object.values(state.players)){player.hand=[];player.battleArea=[];player.supportArea=[];player.breakArea=[];player.discardPile=[];player.stage=null;player.extraDeck=[];player.deck=Array.from({length:16},(_,i)=>back(`${player.id}:deck:${i}`))}
 const extra=game.createAiPresetBs9YellowExtraDeck('player-one').find(card=>card.id==='BS9-030'),flip=game.createCard(raw,'player-one',1),foe=printed('BS12-059','player-two')
 assert.ok(extra);state.players['player-one'].extraDeck=[extra];state.players['player-one'].hand=[...Array.from({length:3},(_,i)=>printed('BS9-026','player-one',i+1)),flip]
 state.players['player-one'].supportArea=[1,2,3].map(copy=>({card:printed('ST2-020','player-one',copy),rested:false}))
 assert.ok(foe.type === 'cookie')
 state.players['player-two'].battleArea=[{card:foe,rested:false,battleEntryId:`${foe.instanceId}:entry`,hpCards:Array.from({length:foe.hp},(_,i)=>back(`foe:${i}`))}]
 state=game.applyGameCommand(state,{kind:'play-extra-deck-cookie',playerId:'player-one',instanceId:extra.instanceId})
 assert.ok(state.pendingOptionalCostAttack?.mandatory)
 state=game.applyGameCommand(state,{kind:'resolve-optional-cost-attack',playerId:'player-one',action:'pay',discardCardIds:state.players['player-one'].hand.slice(0,3).map(card=>card.instanceId),paymentIds:[]})
 if(state.pendingOnPlay)state=game.applyGameCommand(state,{kind:'skip-on-play',playerId:'player-one',sourceInstanceId:state.pendingOnPlay.sourceInstanceId})
 state=game.applyGameCommand(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:extra.instanceId,targetInstanceId:foe.instanceId,supportPaymentIds:state.players['player-one'].supportArea.map(s=>s.card.instanceId)})
 state=game.applyGameCommand(state,{kind:'skip-trap',playerId:'player-two'})
 while(state.pendingBattle?.stage==='damage')state=game.applyGameCommand(state,{kind:'resolve-next-damage',playerId:'player-two'})
 if(!state.pendingOptionalCostAttack)state=game.applyGameCommand(state,{kind:'resolve-attack-effect',playerId:'player-one',targetIds:[]})
 assert.ok(state.pendingOptionalCostAttack);assert.equal(state.pendingOptionalCostAttack.effects[0].kind,'activate-discarded-flip')
 state=game.applyGameCommand(state,{kind:'resolve-optional-cost-attack',playerId:'player-one',action:'pay',discardCardIds:[flip.instanceId],paymentIds:[]})
 assert.ok(state.pendingBattle);assert.equal(state.pendingBattle.detachedFlip,true);assert.ok(state.players['player-one'].discardPile.some(card=>card.instanceId===flip.instanceId))
 const before=structuredClone(state)
 const after=game.applyGameCommand(state,{kind:'resolve-flip',playerId:'player-one',activate})
 assert.equal(after.players['player-one'].hand.filter(card=>card.instanceId===flip.instanceId).length,activate?1:0)
 assert.equal(after.players['player-one'].discardPile.filter(card=>card.instanceId===flip.instanceId).length,activate?0:1)
 assert.equal(after.players['player-one'].battleArea[0].hpCards.length,6);assert.equal(after.players['player-two'].battleArea[0].hpCards.length,1)
 assert.deepEqual(state,before)
})
})
