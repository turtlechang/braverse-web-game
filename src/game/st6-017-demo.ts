import {createSt6012PreviewState} from './st6-012-demo'
import {createCard} from './starter-deck'
import {getCardPoolEntry} from './card-pool'
import {applyGameCommand as apply} from './commands'
const original=getCardPoolEntry('ST6-017')
if(!original)throw Error('Missing original formal ST6-017 record')
export const raw=original
export const createSt6017PreviewState=(scenario='positive')=>{
 const state=createSt6012PreviewState(scenario==='negative'?'negative':scenario==='wrong-color'?'wrong-color':'positive')
 const own=state.players['player-one'],foe=state.players['player-two']
 own.deck.shift();own.hand=[createCard(raw,'player-one',1)]
 const agar=()=>{const record=getCardPoolEntry('ST6-005');if(!record)throw Error('Missing original Agar Agar');const c=createCard(record,'player-one',1);if(c.type!=='cookie'||c.hp!==1)throw Error('Wrong original Agar printing');return c}
 const witness=['positive','other','zero','one-red','defender-one','rested-witness'].includes(scenario)
 if(witness){
  const target=own.battleArea[scenario==='defender-one'?1:0],card=agar()
  target.card=card;target.battleEntryId=card.instanceId+':entry';own.discardPile.push(...target.hpCards.splice(1))
  if(scenario==='rested-witness')target.rested=true
 }
 if(['hand-witness','trash-witness','break-witness','support-witness'].includes(scenario)){
  const card=agar();own.deck.shift()
  if(scenario==='hand-witness')own.hand.push(card)
  if(scenario==='trash-witness')own.discardPile.push(card)
  if(scenario==='break-witness')own.breakArea.push(card)
  if(scenario==='support-witness'){own.deck.push(own.supportArea[3].card);own.supportArea[3].card=card}
 }
 if(scenario==='opponent-witness'){
  const record=getCardPoolEntry('ST6-005');if(!record)throw Error('Missing original Agar printing')
  const card=createCard(record,'player-two',1);if(card.type!=='cookie')throw Error('Wrong original type')
  const target=foe.battleArea[0];target.card=card;target.battleEntryId=card.instanceId+':entry';foe.discardPile.push(...target.hpCards.splice(1))
 }
 if(scenario==='one-red'){own.supportArea[1].rested=true;own.supportArea[2].rested=true}
 if(scenario==='main'||scenario==='wrong-phase'){if(scenario==='wrong-phase')state.phase='support';return state}
 state.activePlayerId='player-two'
 return apply(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:foe.battleArea[1].card.instanceId,targetInstanceId:own.battleArea[1].card.instanceId,supportPaymentIds:foe.supportArea.slice(0,3).map(s=>s.card.instanceId)})
}
