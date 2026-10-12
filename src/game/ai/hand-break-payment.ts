import type {AbilityCost,GameState,PlayerId} from '../types'

/** A Break cost ends the game before its effect can rescue the payer. */
export const selectSafeHandBreakPayment = (
  state:GameState,playerId:PlayerId,cost:AbilityCost,sourceInstanceId:string,
  orderedCandidateIds:readonly string[],
):string[]|null=>{
  const payment=cost.handToBreakArea
  if(!payment||payment.count===0)return []
  const player=state.players[playerId]
  const breakLevel=player.breakArea.reduce((sum,card)=>sum+card.level,0)
  const candidates=[...new Set(orderedCandidateIds)].flatMap(id=>{
    const card=player.hand.find(card=>card.instanceId===id)
    return card?.type==='cookie'&&id!==sourceInstanceId&&
      (payment.energyColor===undefined||card.energyColor===payment.energyColor)&&
      (payment.minLevel===undefined||card.level>=payment.minLevel)&&
      (payment.maxLevel===undefined||card.level<=payment.maxLevel)&&
      (payment.keyword===undefined||card.keywords?.includes(payment.keyword))?[card]:[]
  })
  const choose=(start:number,selected:string[],level:number):string[]|null=>{
    if(selected.length===payment.count)return level<10?selected:null
    for(let i=start;i<candidates.length;i++){
      const card=candidates[i]
      if(level+card.level>=10)continue
      const result=choose(i+1,[...selected,card.instanceId],level+card.level)
      if(result)return result
    }
    return null
  }
  return choose(0,[],breakLevel)
}
