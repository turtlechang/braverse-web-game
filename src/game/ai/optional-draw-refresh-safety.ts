import type {PlayerView} from '../player-view'
import type {CardEffect,GameCard} from '../types'

/** Keep the last deck card when visible Refresh candidates prove certain defeat. */
export const selectSafeOptionalDrawCount=(view:PlayerView,max:number,revealedHpCard?:GameCard|null):number=>{
 const count=Math.max(0,Math.min(max,view.self.deckCount))
 if(count===0||count<view.self.deckCount)return count
 const passives=(side:PlayerView['self']):CardEffect[]=>side.battleArea.flatMap(cookie=>{
  const skill=cookie.card.skill
  return skill?.trigger==='passive'?[...skill.effects,...(skill.passiveEffects??[])]:[]
 })
 if(passives(view.self).some(effect=>effect.kind==='prevent-refresh-cookie-break'))return count
 const override=passives(view.opponent).find(effect=>effect.kind==='refresh-cookie-break-count')
 const required=override?.kind==='refresh-cookie-break-count'?Math.max(1,override.count):1
 // The public revealed HP card may join discard during FLIP continuation.
 // Including it gives a conservative lower bound without inspecting any
 // unrevealed HP or deck card; deduplication avoids double counting it.
 const visible=new Map(view.self.discardPile.map(card=>[card.instanceId,card]))
 if(revealedHpCard)visible.set(revealedHpCard.instanceId,revealedHpCard)
 const levels=[...visible.values()].filter(card=>card.type==='cookie'&&card.level>=1).map(card=>card.type==='cookie'?card.level:0).sort((a,b)=>a-b)
 if(levels.length<required)return count
 const breakLevel=view.self.breakArea.reduce((sum,card)=>sum+card.level,0)
 if(breakLevel+levels.slice(0,required).reduce((sum,level)=>sum+level,0)<10)return count
 return Math.max(0,view.self.deckCount-1)
}
