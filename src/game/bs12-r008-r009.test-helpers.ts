import {readFileSync,readdirSync} from 'node:fs'
import {createBs12FinalPhysicalDemoState} from './demo'
import {convertOfficialCardToExtraDeckCard} from '../cards/official-card-adapter'
import {printedFixtureCard} from './bs12-physical-fixtures.test-helpers'
import type {OfficialCardRecord} from '../cards/types'
const records:OfficialCardRecord[]=[...JSON.parse(readFileSync('data/candidates/official-festival-arena-bs12.en.json','utf8')).cards,...readdirSync('data/cards').filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync('data/cards/'+f,'utf8')).cards??[])]
import {createBs12RulingLifecycleFactories} from './bs12-rulings-demo'
export const printed=printedFixtureCard
export const extra=(number:string,id:string)=>{const record=records.find(c=>c.cardNumber===number);if(!record)throw Error('Missing EXTRA '+number);const c=convertOfficialCardToExtraDeckCard(record,id);if(c.status!=='converted')throw Error('Unconverted EXTRA '+number);return {...c.extraDeckCard,instanceId:id}}
export const {lifecycleBase,command,declineReplacement,advanceTo,createActualAwakenParent,openActualAwakenReturn,createActualExtraDeckReturnParent,returnActualExtraToDeck,createActualExtraTrashParent,createActualMainDeckCostParent}=createBs12RulingLifecycleFactories({base:()=>createBs12FinalPhysicalDemoState('BS12-109','positive'),printed,extra})
