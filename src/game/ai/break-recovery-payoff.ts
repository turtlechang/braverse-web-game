import {applyGameCommand} from '../commands'
import {getLegalTurnCommands} from '../legal-actions'
import {maskGameStateForViewer} from '../masked-state'
import {executeCardEffect,isEffectConditionMet} from '../effects'
import {getPublicEffectDamageByTarget} from './public-effect-damage'
import type {CardEffect,EffectContext,GameState} from '../types'

// Public conditional forecast, not a claim that unknown FLIP/traps cannot respond.
// Restrict this first experiment to a pure optional On Play Break recovery.
export const preservesPublicWinningAttack=(state:GameState,context:EffectContext,effect:Extract<CardEffect,{kind:'break-to-trash'}>,selected:readonly string[]):boolean=>{
 if(!selected.length||effect.max<1)return false
 const owner=context.sourcePlayerId,source=state.players[owner].battleArea.find(c=>c.card.instanceId===context.sourceInstanceId)
 if(source?.card.skill?.trigger!=='on-play'||source.card.skill.effects.length!==1||source.card.skill.effects[0].kind!=='break-to-trash')return false
 const masked=maskGameStateForViewer({...state,commandLog:undefined},owner)
 const ready=masked.pendingOnPlay?.playerId===owner
  ?applyGameCommand(masked,{kind:'skip-on-play',playerId:owner,sourceInstanceId:masked.pendingOnPlay.sourceInstanceId})
  :masked
 if(ready.status!=='playing'||ready.activePlayerId!==owner||ready.phase!=='main'||ready.pendingAbilityEffect)return false
 const after=executeCardEffect(ready,context,effect,[...selected])
 for(const command of getLegalTurnCommands(ready,owner)){
  if(command.kind!=='attack')continue
  const attacker=ready.players[owner].battleArea.find(c=>c.card.instanceId===command.attackerInstanceId)
  const opponentId=owner==='player-one'?'player-two':'player-one',opponent=ready.players[opponentId]
  const target=opponent.battleArea.find(c=>c.card.instanceId===command.targetInstanceId)
  if(!attacker||!target)continue
  const breakWin=opponent.breakArea.reduce((sum,c)=>sum+c.level,0)+target.card.level>=10
  const emptyFieldWin=opponent.battleArea.length===1&&opponent.hand.length===0
  if(!breakWin&&!emptyFieldWin)continue
  const conditional=attacker.card.attackEffects?.filter((e):e is Extract<CardEffect,{kind:'damage'}>=>e.kind==='damage'&&e.target?.attackTargetOnly===true&&e.condition?.kind==='break-level-at-least')??[]
  if(!conditional.length)continue
  const declared=applyGameCommand(ready,{...command,kind:'declare-attack'}),battle=declared.pendingBattle
  if(!battle||battle.declaredDamage>=target.hpCards.length)continue
  const attackContext={sourcePlayerId:owner,sourceInstanceId:attacker.card.instanceId}
  let beforeExtra=0,afterExtra=0
  for(const e of conditional){
   const damage=getPublicEffectDamageByTarget(declared,owner,attackContext,e,[target.card.instanceId])?.get(target.card.instanceId)??0
   if(isEffectConditionMet(ready,attackContext,e))beforeExtra+=damage
   if(isEffectConditionMet(after,attackContext,e))afterExtra+=getPublicEffectDamageByTarget({...after,pendingBattle:battle},owner,attackContext,e,[target.card.instanceId])?.get(target.card.instanceId)??0
  }
  if(battle.declaredDamage+beforeExtra>=target.hpCards.length&&battle.declaredDamage+afterExtra<target.hpCards.length)return true
 }
 return false
}
