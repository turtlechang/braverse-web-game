import {createSt7003PreviewState} from './st7-003-demo'
import {applyGameCommand} from './commands'
import {getCardPoolEntry} from './card-pool'
import {createCard} from './starter-deck'
import type {GameCard,PlayerId,PlayerState} from './types'

export const createOptionalDrawRefreshFixture=(breakLevel=9,deckCount=1,winningAttack=false)=>{
 let state=createSt7003PreviewState('positive',true)
 const rose=getCardPoolEntry('BS1-015');if(!rose)throw Error('Missing formal Rose Cookie');const hp=state.players['player-one'].battleArea[0].hpCards;hp[hp.length-1]=createCard(rose,'player-one',1)
 const self=state.players['player-one'],foe=state.players['player-two']
 const original=(number:string,owner:PlayerId)=>{const raw=getCardPoolEntry(number);if(!raw)throw Error('Missing original '+number);return createCard(raw,owner,1)}
 const selectBreak=(player:PlayerState,total:number)=>{
  const sums=new Map<number,GameCard[]>([[0,[]]])
  for(const card of player.deck){
   if(card.type!=='cookie')continue
   for(const [sum,cards]of [...sums])if(sum+card.level<=total&&!sums.has(sum+card.level))sums.set(sum+card.level,[...cards,card])
  }
  const selected=sums.get(total);if(!selected)throw Error('Insufficient original LV sum '+total)
  const ids=new Set(selected.map(c=>c.instanceId));player.breakArea=selected.filter(c=>c.type==='cookie');player.deck=player.deck.filter(c=>!ids.has(c.instanceId))
 }
 if(winningAttack){
  const payment=original('ST1-020','player-one');self.deck.shift();self.supportArea=[{card:payment,rested:false}]
  const target=original('BS6-017','player-two'),old=foe.battleArea[0]
  if(target.type!=='cookie'||target.hp!==1)throw Error('Original Pink Choco HP1 required')
  foe.deck.shift();foe.deck.push(old.card,...old.hpCards.slice(1))
  foe.battleArea[0]={card:target,hpCards:old.hpCards.slice(0,1),rested:false,battleEntryId:target.instanceId+':entry'}
  const trap=original('BS10-039','player-two');foe.deck.shift();foe.hand=[trap]
  selectBreak(foe,9)
 }else{
  const attacker=original('ST1-011','player-two'),old=foe.battleArea[0]
  if(attacker.type!=='cookie'||attacker.hp!==2||attacker.attack!==1)throw Error('Original GingerBrave required')
  foe.deck.shift();foe.deck.push(old.card,...old.hpCards.slice(2))
  foe.battleArea[0]={card:attacker,hpCards:old.hpCards.slice(0,2),rested:false,battleEntryId:attacker.instanceId+':entry'}
 }
 selectBreak(self,breakLevel);self.discardPile.push(...self.deck.slice(deckCount));self.deck=self.deck.slice(0,deckCount)
 for(const player of [self,foe]){
  const cards=[...player.deck,...player.hand,...player.discardPile,...player.breakArea,...player.supportArea.map(s=>s.card),...player.battleArea.flatMap(c=>[c.card,...c.hpCards])]
  if(cards.length!==60||new Set(cards.map(c=>c.instanceId)).size!==60)throw Error('Original sixty unique cards required')
  const counts=new Map<string,number>();for(const card of cards)counts.set(card.id,(counts.get(card.id)??0)+1)
  if([...counts.values()].some(n=>n>4))throw Error('Original four-copy limit')
 }
 if(winningAttack){
  state.activePlayerId='player-one'
  state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:self.battleArea[0].card.instanceId,targetInstanceId:foe.battleArea[0].card.instanceId,supportPaymentIds:[self.supportArea[0].card.instanceId]})
  state=applyGameCommand(state,{kind:'play-trap',playerId:'player-two',trapInstanceId:foe.hand[0].instanceId,paymentIds:[foe.supportArea[1].card.instanceId],targetIds:[self.battleArea[0].card.instanceId]})
 }else{
  state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:foe.battleArea[0].card.instanceId,targetInstanceId:self.battleArea[0].card.instanceId,supportPaymentIds:[foe.supportArea[0].card.instanceId]})
  state=applyGameCommand(state,{kind:'skip-trap',playerId:'player-one'})
 }
 if(state.pendingBattle?.stage==='damage')state=applyGameCommand(state,{kind:'resolve-next-damage',playerId:'player-one'})
 if(state.pendingBattle?.stage!=='flip'||state.pendingBattle.revealedHpCard?.id!=='BS1-015')throw Error('Original Rainbow Sherbet reveal required')
 return state
}
