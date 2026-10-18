import {getCardPoolEntry} from './card-pool'
import {createSt6017PreviewState} from './st6-017-demo'
import {createCard} from './starter-deck'
const original=getCardPoolEntry('ST6-018')
if(!original)throw Error('Missing original formal ST6-018')
export const raw=original
export const createSt6018PreviewState=(scenario='positive')=>{
 const s=createSt6017PreviewState(['negative','wrong-color','main','wrong-phase'].includes(scenario)?scenario:'false')
 s.players['player-one'].hand=[createCard(raw,'player-one',1)]
 if(scenario==='rested-target')s.players['player-one'].battleArea[0].rested=true
 if(scenario==='one-red')for(const support of s.players['player-one'].supportArea.slice(1))support.rested=true
 return s
}
