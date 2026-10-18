import {getCardPoolEntry} from './card-pool'
import type {DeckAdditionScenario} from './bs12-deck-addition-demo'
import {createSt6015PreviewState} from './st6-015-demo'
import {createCard} from './starter-deck'
import {applyGameCommand as apply} from './commands'
const original=getCardPoolEntry('ST6-020')
if(!original)throw Error('Missing original formal ST6-020')
export const raw=original
export const createSt6020PreviewState=(scenario='positive')=>{
 const base=['green-arena','low','rested-source','wrong-color','negative','wrong-phase'].includes(scenario)?scenario:'positive'
 const s=createSt6015PreviewState(base as DeckAdditionScenario),own=s.players['player-one']
 own.hand[0]=createCard(raw,'player-one',1)
 if(scenario==='one-red')own.supportArea.forEach((c,i)=>{if(i>0&&c.card.energyColor==='red')c.rested=true})
 if(scenario==='no-battle')for(const c of own.battleArea.splice(0))own.discardPile.push(c.card,...c.hpCards)
 if(scenario==='draw-refresh')own.discardPile.push(...own.deck.splice(1))
 return s
}
export const placeSt6020=(scenario='positive')=>{
 const s=createSt6020PreviewState(scenario),own=s.players['player-one']
 return apply(s,{kind:'play-stage',playerId:'player-one',instanceId:own.hand[0].instanceId,paymentIds:own.supportArea.filter(c=>!c.rested&&c.card.energyColor==='red').slice(0,2).map(c=>c.card.instanceId)})
}
