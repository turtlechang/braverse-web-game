import {expect,it} from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type {OfficialCardRecord} from './types'
import {analyzeOfficialCardBehavior} from './contracts/ledger'
import {convertOfficialCardToGameCard,convertOfficialCardToExtraDeckCard} from './official-card-adapter'
const numbers=['BS12-109','BS12-109@1','BS12-109@2','BS12-110','BS12-110@1','BS12-111','BS12-111@1','BS12-111@2','BS12-111@3','BS12-112','BS12-112@1']
it.each(numbers)('%s matches independent paper guard including R006 face-up TOP HP',number=>{
 const r=candidate.cards.find(r=>r.cardNumber===number) as OfficialCardRecord,before=structuredClone(r),a=analyzeOfficialCardBehavior(r)
 expect(a.contract.status).toBe('verified');expect(r).toEqual(before)
 expect(a.errors).toEqual([])
})
it.each([['BS12-109','BS12-097'],['BS12-110','BS12-108'],['BS12-111','BS12-018'],['BS12-112','BS12-095']])('%s rejects another original printed card %s', (number,otherNumber)=>{
 const source=candidate.cards.find(r=>r.cardNumber===number) as OfficialCardRecord,other=candidate.cards.find(r=>r.cardNumber===otherNumber) as OfficialCardRecord
 const converted=other.type==='extra'?convertOfficialCardToExtraDeckCard(other):convertOfficialCardToGameCard(other);if(converted.status!=='converted')throw Error(otherNumber)
 const c='extraDeckCard' in converted?converted.extraDeckCard:converted.gameCard,a=analyzeOfficialCardBehavior(source,c)
 expect(a.contract.status).not.toBe('verified');expect(a.errors.some(e=>e.startsWith(number+' lacks'))).toBe(true)
})
it.each(['BS12-111','BS12-111@1','BS12-111@2','BS12-111@3'])('%s original paper EXTRA four opponent support cards and own Special Play Cookie',number=>{
 const r=candidate.cards.find(r=>r.cardNumber===number) as OfficialCardRecord,before=structuredClone(r),c=convertOfficialCardToExtraDeckCard(r)
 expect(c).toMatchObject({status:'converted',extraDeckCard:{name:'Poison Mushroom Cookie',cardColor:'black',level:3,hp:5,keywords:['arena'],attack:2,attackEnergyCost:{black:2},extraDeckPlayMode:'enter-battle',playRequirement:{kind:'all-of',conditions:[{kind:'opponent-support-count-at-least',count:4},{kind:'battle-area-has-special-play-cookie',side:'self'}]},skill:{trigger:'passive',effects:[],passiveEffects:[{kind:'modify-attack',amount:1,duration:'persistent',target:{side:'self',min:0,max:1,allMatching:true,excludeSource:true,energyColor:'black',keyword:'arena'}}]},attackEffects:[{kind:'gain-hp',amount:1,target:{side:'self',min:1,max:1,sourceOnly:true},condition:{kind:'player-started-second'}}]}})
 expect(r).toEqual(before)
})
it.each(['BS12-110','BS12-110@1'])('%s original paper Activate three black support CARDS then selfTrash draw0-1',number=>{
 const record=candidate.cards.find(r=>r.cardNumber===number) as OfficialCardRecord,before=structuredClone(record),conversion=convertOfficialCardToGameCard(record)
 expect(conversion).toMatchObject({status:'converted',gameCard:{name:'Agar Agar Cookie',cardColor:'black',level:1,hp:3,keywords:['arena'],attack:1,attackEnergyCost:{black:1,neutral:1},skill:{trigger:'activate',oncePerTurn:false,restSource:false,cost:{energy:{},discardHand:0,selfToTrash:true},effects:[{kind:'draw-up-to',max:1,condition:{kind:'support-count-at-least',count:3,energyColor:'black'}}]}}})
 if(conversion.status!=='converted'||conversion.gameCard.type!=='cookie')throw Error('Missing printed110')
 expect(conversion.gameCard.attackEffects??[]).toEqual([]);expect(conversion.gameCard.skill?.effects).toHaveLength(1);expect(record).toEqual(before)
})
it.each(['BS12-112','BS12-112@1'])('%s original paper Special blackLV1SpecialCookie and selfTrash Then0-2LV1Arena recovery',number=>{
 const record=candidate.cards.find(r=>r.cardNumber===number) as OfficialCardRecord,before=structuredClone(record),conversion=convertOfficialCardToGameCard(record)
 expect(conversion).toMatchObject({status:'converted',gameCard:{name:'Red Velvet Cookie',cardColor:'black',level:2,hp:4,keywords:['arena'],attack:3,attackEnergyCost:{black:3},skill:{specialPlayCost:{energy:{},discardHand:0,trashBattleCookie:{count:1,energyColor:'black',level:1,hasSpecialPlay:true}}},attackEffects:[{kind:'optional-cost-attack',cost:{energy:{},discardHand:0,selfToTrash:true},effects:[{kind:'trash-to-hand',max:2,cookieOnly:true,keyword:'arena',minLevel:1,maxLevel:1}]}]}})
 if(conversion.status!=='converted'||conversion.gameCard.type!=='cookie')throw Error('Missing printed112')
 expect(conversion.gameCard.attackEffects).toHaveLength(1);expect(record).toEqual(before)
})
