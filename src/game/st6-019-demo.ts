import {getCardPoolEntry} from './card-pool'
import {createSt6017PreviewState} from './st6-017-demo'
import {createCard} from './starter-deck'
const original=getCardPoolEntry('ST6-019')
if(!original)throw Error('Missing original formal ST6-019')
export const raw=original
export const createSt6019PreviewState=(scenario='positive')=>{
 const s=createSt6017PreviewState(['draw-zero','target-zero','other','expiry','draw-refresh'].includes(scenario)?'positive':scenario)
 s.players['player-one'].hand[0]=createCard(raw,'player-one',1)
 if(scenario==='draw-refresh')s.players['player-one'].discardPile.push(...s.players['player-one'].deck.splice(1))
 return s
}
