import type {PlayerView} from '../player-view'
import type {CardEffect,GameCard,PendingBattle} from '../types'

/** A lower bound from visible cards only, never a hidden deck/HP simulation. */
export const shouldSkipHpFlipForFatalRefresh=(view:PlayerView,battle:PendingBattle,discardHandIds:readonly string[],hpGainPrevented=false):boolean=>{
 const revealed=battle.revealedHpCard,flip=revealed?.flip
 if(!revealed||!flip||battle.detachedFlip||battle.effectDamageSequence||hpGainPrevented||
    (flip.attachedHpBonus??0)<=0||flip.effects.length||flip.attachedHpAlternateTarget||flip.handCostDestination||
    Object.entries(flip.cost).some(([key,value])=>value!==undefined&&!['energy','discardHand'].includes(key))||
    Object.values(flip.cost.energy??{}).some(value=>(value??0)!==0))return false
 if((battle.damagePlayerId??battle.defenderPlayerId)!==view.viewerId)return false
 const targetId=battle.damageTargetInstanceId??battle.targetInstanceId,target=view.self.battleArea.find(c=>c.card.instanceId===targetId)
 // A conservative safe decline: the original bearer survives every remaining
 // ordinary damage point without relying on another unknown FLIP.
 if(!target||target.hpCount<=battle.remainingDamage||view.self.deckCount>(flip.attachedHpBonus??0))return false
 const costCards=discardHandIds.map(id=>view.hand.find(card=>card.instanceId===id))
 if(costCards.some(card=>!card)||costCards.length!==(flip.cost.discardHand??0))return false
 const passives=(side:PlayerView['self']):CardEffect[]=>side.battleArea.flatMap(cookie=>{
  const skill=cookie.card.skill
  return skill?.trigger==='passive'?[...skill.effects,...(skill.passiveEffects??[])]:[]
 })
 if(passives(view.self).some(effect=>effect.kind==='prevent-refresh-cookie-break'))return false
 const override=passives(view.opponent).find(effect=>effect.kind==='refresh-cookie-break-count')
 const count=override?.kind==='refresh-cookie-break-count'?Math.max(1,override.count):1
 const visibleDiscard:GameCard[]=[...view.self.discardPile,...costCards.filter((card):card is GameCard=>Boolean(card)),revealed]
 const levels=visibleDiscard.filter(card=>card.type==='cookie'&&card.level>=1).map(card=>card.type==='cookie'?card.level:0).sort((a,b)=>a-b)
 if(levels.length<count)return false
 const breakLevel=view.self.breakArea.reduce((sum,card)=>sum+card.level,0)
 return breakLevel+levels.slice(0,count).reduce((sum,level)=>sum+level,0)>=10
}
