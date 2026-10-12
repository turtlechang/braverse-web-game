import {selectEnergyPayment} from '../energy'
import type {PlayerSideView} from '../player-view'
import type {CookieInBattleView} from '../player-view'
import type {SupportCard} from '../types'

// Compare the ordinary attacks affordable from known support after its normal
// Active Phase. No future support card, hand identity, HP face or Then effect
// is invented. Shared support can pay at most one attack in this allocation.
const maximumDamage=(cookies:CookieInBattleView[],supports:SupportCard[]):number=>{
 let best=0
 for(const cookie of cookies){
  if(cookie.card.nonAttackable||cookie.card.attack<=0)continue
  const cost=cookie.card.attackEnergyCost??{neutral:cookie.card.attackCost}
  const payment=selectEnergyPayment(cost,supports)
  if(!payment)continue
  const paid=new Set(payment)
  const remaining=supports.map(s=>paid.has(s.card.instanceId)?{...s,rested:true}:s)
  best=Math.max(best,cookie.card.attack+maximumDamage(cookies.filter(c=>c!==cookie),remaining))
 }
 return best
}

export const nextActivePressureLost=(side:PlayerSideView):number=>{
 if(!side.battleArea.some(c=>c.rested&&c.nextActivePhasePrevented))return 0
 const supportLocks=new Set(side.nextActivePhasePreventedSupportIds??[])
 const supports=side.supportArea.map(s=>({...s,rested:s.rested&&supportLocks.has(s.card.instanceId)}))
 const otherwiseReady=side.battleArea.filter(c=>!c.rested||!c.activePhasePreventedBySkill)
 const withoutLock=maximumDamage(otherwiseReady,supports)
 const withLock=maximumDamage(otherwiseReady.filter(c=>!c.rested||!c.nextActivePhasePrevented),supports)
 return Math.max(0,withoutLock-withLock)*15
}
