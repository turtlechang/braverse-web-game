import {applyGameCommand} from './commands'
import {createCard} from './starter-deck'
import {getCardPoolEntry} from './card-pool'
import {commandFromLogEntry} from './replay'
import type {GameCommand} from './commands'
import type {GameState} from './types'
import {createSt8007PreviewState} from './st8-007-demo'

const requireValue=<T,>(value:T|null|undefined,label:string):T=>{
 if(value===null||value===undefined)throw Error(`Missing ${label}`)
 return value
}
export const createSt8007HpBlockedPreviewState=(prepareOnly=false,ai=false):GameState=>{
 if(ai){
  const swapText=(text:string)=>text.replaceAll('player-one','player-swap').replaceAll('player-two','player-one').replaceAll('player-swap','player-two')
  const swap=(value:unknown):unknown=>{
   if(typeof value==='string')return swapText(value)
   if(Array.isArray(value))return value.map(swap)
   if(value!==null&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[swapText(key),swap(item)]))
   return value
  }
  let swapped=swap(createSt8007HpBlockedPreviewState(true,false)) as GameState
  if(prepareOnly)return swapped
  const original=createSt8007HpBlockedPreviewState(false,false)
  for(const entry of original.commandLog??[]){
   const command=swap(commandFromLogEntry(entry)) as GameCommand
   swapped=applyGameCommand(swapped,command)
  }
  return swapped
 }
 let state=createSt8007PreviewState('positive',true)
 const foe=state.players['player-two'],self=state.players['player-one']
 const raw=requireValue(getCardPoolEntry('BS9-035'),'original BS9-035')
 if(raw.type!=='cookie'||raw.level!==3||raw.hp!==5)throw Error('BS9-035 printing mismatch')
 const replaced=requireValue(foe.deck.shift(),'original filler replacement')
 if(replaced.flip)throw Error('Expected non-FLIP filler')
 const source=createCard(raw,'player-two',1)
 if(source.type!=='cookie')throw Error('Expected Cookie')
 foe.battleArea.push({card:source,hpCards:foe.deck.splice(0,5),rested:false,battleEntryId:source.instanceId+':entry'})
 foe.hand.push(requireValue(foe.deck.shift(),'original skill cost'))
 if(state.preventHpGainThisTurn?.['player-one'])throw Error('Unexpected prepared prohibition')
 const assertResources=(s:GameState)=>{
  const ids:string[]=[]
  for(const id of ['player-one','player-two'] as const){
   const p=s.players[id],b=s.pendingBattle
   const reveal=b?.revealedHpCard&&!b.detachedFlip&&(b.damagePlayerId??b.defenderPlayerId)===id?[b.revealedHpCard]:[]
   const cards=[...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(x=>x.card),
    ...p.battleArea.flatMap(x=>[x.card,...x.hpCards]),...(p.stage?[p.stage.card]:[]),...reveal]
   if(cards.length!==60||(p.extraDeck??[]).length!==0)throw Error(`Invalid physical card count ${id}`)
   const counts=new Map<string,number>()
   for(const card of cards){ids.push(card.instanceId);counts.set(card.id,(counts.get(card.id)??0)+1)}
   if([...counts.values()].some(n=>n>4))throw Error('Printed copy limit exceeded')
  }
  if(new Set(ids).size!==120)throw Error('Duplicate physical instance')
 }
 assertResources(state)
 if(prepareOnly)return state
 const commands:GameCommand[]=[
  {kind:'begin-activate-skill',playerId:'player-two',sourceInstanceId:source.instanceId,trigger:'activate',paymentIds:[],discardHandIds:[requireValue(foe.hand[0],'skill discard').instanceId]},
  {kind:'resolve-ability-effect',playerId:'player-two',targetIds:[]},
  {kind:'declare-attack',playerId:'player-two',attackerInstanceId:requireValue(foe.battleArea[0],'Devil Cookie').card.instanceId,
   targetInstanceId:requireValue(self.battleArea[0],'Leek Cookie').card.instanceId,supportPaymentIds:foe.supportArea.map(x=>x.card.instanceId)},
  {kind:'skip-trap',playerId:'player-one'},
  {kind:'resolve-next-damage',playerId:'player-one'},
 ]
 for(const [index,command] of commands.entries()){
  state=applyGameCommand(state,command);assertResources(state)
  if(index===0&&state.preventHpGainThisTurn?.['player-one'])throw Error('Prohibition set before skill effect')
  if(index===1&&!state.preventHpGainThisTurn?.['player-one'])throw Error('Skill failed to establish public prohibition')
 }
 if(state.pendingBattle?.stage!=='flip'||state.pendingBattle.revealedHpCard?.id!=='ST8-007')throw Error('Original HP FLIP parent mismatch')
 return state
}
