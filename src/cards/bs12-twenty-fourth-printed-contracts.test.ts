import {expect,it} from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type {OfficialCardRecord} from './types'
import {convertOfficialCardToGameCard} from './official-card-adapter'
import {analyzeOfficialCardBehavior} from './contracts/ledger'
it('106 original printed KK Trap keeps independent minus2 then exact1 anyHand cost and SpecialPlayArena recovery',()=>{
 const r=candidate.cards.find(c=>c.cardNumber==='BS12-106') as OfficialCardRecord,before=structuredClone(r),result=convertOfficialCardToGameCard(r)
 expect(result).toMatchObject({status:'converted',gameCard:{id:'BS12-106',name:'Bad and Dark',type:'trap',cardColor:'black',energyColor:'black',keywords:['arena'],imageUrl:r.imageUrl,trap:{cost:{energy:{black:2},discardHand:0},effects:[
  {kind:'modify-attack',amount:-2,duration:'this-turn',target:{side:'opponent',min:0,max:1}},
  {kind:'optional-cost-attack',resolution:'ability',cost:{energy:{},discardHand:1},effects:[{kind:'trash-to-hand',max:1,cookieOnly:true,keyword:'arena',hasSpecialPlay:true}]}
 ]}}})
 if(result.status!=='converted'||result.gameCard.type!=='trap')throw Error('Missing printed106')
 expect(result.gameCard.trap?.effects).toHaveLength(2);expect(result.gameCard.trap?.condition).toBeUndefined();expect(analyzeOfficialCardBehavior(r).contract.status).toBe('verified');expect(r).toEqual(before)
})
it.each(['BS12-107','BS12-107@1'])('%s original printed KN2 then exact1 anyHand discard recovers Arena Cookie without SpecialPlay restriction',number=>{
 const r=candidate.cards.find(c=>c.cardNumber===number) as OfficialCardRecord,before=structuredClone(r),result=convertOfficialCardToGameCard(r)
 expect(result).toMatchObject({status:'converted',gameCard:{id:'BS12-107',name:'Pomegranate Cookie',type:'cookie',cardColor:'black',energyColor:'black',level:1,hp:2,keywords:['arena'],imageUrl:r.imageUrl,attack:2,attackCost:2,attackEnergyCost:{black:1,neutral:1},attackEffects:[{kind:'optional-cost-attack',cost:{energy:{},discardHand:1},effects:[{kind:'trash-to-hand',max:1,cookieOnly:true,keyword:'arena'}]}]}})
 if(result.status!=='converted'||result.gameCard.type!=='cookie')throw Error('Missing printed107')
 expect(result.gameCard.skill).toBeUndefined();expect(result.gameCard.attackEffects).toHaveLength(1);expect(analyzeOfficialCardBehavior(r).contract.status).toBe('verified');expect(r).toEqual(before)
})
it.each(['BS12-108','BS12-108@1'])('%s original printed free ActivateOnce draw0-1 requires Hand<=5 and another SAME blackArena Cookie',number=>{
 const r=candidate.cards.find(c=>c.cardNumber===number) as OfficialCardRecord,before=structuredClone(r),result=convertOfficialCardToGameCard(r)
 expect(result).toMatchObject({status:'converted',gameCard:{id:'BS12-108',name:'Schwarzwälder',type:'cookie',cardColor:'black',energyColor:'black',level:1,hp:2,keywords:['arena'],imageUrl:r.imageUrl,attack:1,attackCost:1,attackEnergyCost:{black:1},skill:{trigger:'activate',oncePerTurn:true,cost:{energy:{},discardHand:0},effects:[{kind:'draw-up-to',max:1,condition:{kind:'all-of',conditions:[{kind:'hand-count-at-most',count:5},{kind:'battle-area-has-color',side:'self',color:'black',keyword:'arena',excludeSource:true}]}}]}}})
 if(result.status!=='converted'||result.gameCard.type!=='cookie')throw Error('Missing printed108')
 expect(result.gameCard.skill?.restSource??false).toBe(false);expect(result.gameCard.attackEffects??[]).toEqual([]);expect(result.gameCard.skill?.effects).toHaveLength(1);expect(analyzeOfficialCardBehavior(r).contract.status).toBe('verified');expect(r).toEqual(before)
})

it.each([['BS12-106','BS12-105'],['BS12-107','BS12-101'],['BS12-108','BS12-097']])('%s rejects mapping another actual printed card %s instead of the printed source', (number,otherNumber)=>{
 const source=candidate.cards.find(c=>c.cardNumber===number) as OfficialCardRecord,other=candidate.cards.find(c=>c.cardNumber===otherNumber) as OfficialCardRecord,result=convertOfficialCardToGameCard(other)
 if(result.status!=='converted')throw Error('Missing actual counterexample card')
 const audit=analyzeOfficialCardBehavior(source,result.gameCard)
 expect(audit.contract.status).not.toBe('verified');expect(audit.errors.some(error=>error.startsWith(number+' lacks'))).toBe(true)
})
