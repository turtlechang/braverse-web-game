import {describe,expect,it} from 'vitest'
import document from '../../data/candidates/st6-st10/official-st8.en.json'
import {getCardPoolEntry} from '../game/card-pool'
import {createCard} from '../game/starter-deck'
import type {CookieCard} from '../game/types'
import type {OfficialCardRecord} from './types'
import {convertOfficialCardToGameCard} from './official-card-adapter'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'

const required=<T,>(value:T|null|undefined,label:string):T=>{
 if(value===null||value===undefined)throw Error(`Missing ${label}`)
 return value
}
const raw:OfficialCardRecord=required(getCardPoolEntry('ST8-009')??
 (document.cards as OfficialCardRecord[]).find(card=>card.cardNumber==='ST8-009'),'original ST8-009')
const converted=():CookieCard=>{
 const result=convertOfficialCardToGameCard(raw,'st8-009-contract-test')
 if(result.status!=='converted'||result.gameCard?.type!=='cookie')throw Error('Original Cucumber must convert to Cookie')
 return result.gameCard
}
const original=():CookieCard=>{
 const card=createCard(raw,'player-one',1)
 if(card.type!=='cookie')throw Error('Original Cucumber must be Cookie')
 return card
}
const flip=(card:CookieCard)=>required(card.flip,'free original FLIP')
const draw=(card:CookieCard)=>{
 const effect=required(flip(card).effects[0],'FLIP draw')
 if(effect.kind!=='draw-up-to')throw Error('Expected optional draw-up-to')
 return effect
}
const mainDraw=(card:CookieCard)=>{
 const effect=required(card.effects?.[0],'main FLIP mirror')
 if(effect.kind!=='draw-up-to')throw Error('Expected draw-up-to mirror')
 return effect
}
const mutants:Record<string,(card:CookieCard)=>void>={
 'wrong name':c=>{c.name='Sugar Swan Cookie'},
 'wrong printed color':c=>{c.cardColor='blue'},
 'wrong energy color':c=>{c.energyColor='red'},
 'wrong level':c=>{c.level=1},
 'wrong HP':c=>{c.hp=4},
 'wrong ordinary damage':c=>{c.attack=4},
 'wrong total attack cost':c=>{c.attackCost=2},
 'GG instead of GGG':c=>{c.attackEnergyCost={green:2}},
 'GGN instead of GGG':c=>{c.attackEnergyCost={green:2,neutral:1}},
 'missing FLIP':c=>{c.flip=undefined},
 'mandatory draw one':c=>{flip(c).effects=[{kind:'draw',amount:1}]},
 'draw up to two':c=>{draw(c).max=2},
 'draw zero only':c=>{draw(c).max=0},
 'hand size restriction':c=>{Reflect.set(draw(c),'condition',{kind:'hand-count-at-most',count:5})},
 'turn restriction':c=>{Reflect.set(draw(c),'condition',{kind:'your-turn'})},
 'Wind Archer restriction':c=>{draw(c).condition={kind:'support-area-has-named-cookie',side:'self',name:'Wind Archer Cookie'}},
 'draw to opponent':c=>{Reflect.set(draw(c),'side','opponent')},
 'extra Cookie target':c=>{Reflect.set(draw(c),'target',{side:'self',min:1,max:1})},
 'alternate draw destination':c=>{Reflect.set(draw(c),'destination','deck-bottom')},
 'mandatory main draw':c=>{c.effects=[{kind:'draw',amount:1}]},
 'main draw up to two':c=>{mainDraw(c).max=2},
 'extra main effect':c=>{required(c.effects,'main effects').push({kind:'draw',amount:1})},
 'missing main effects':c=>{c.effects=[]},
 'empty FLIP effects':c=>{flip(c).effects=[]},
 'two FLIP draws':c=>{flip(c).effects.push({kind:'draw-up-to',max:1})},
 'draw converted to choose-one':c=>{flip(c).effects=[{kind:'choose-one',modes:[{label:'Unprinted mode',effects:[{kind:'draw',amount:1}]}]}]},
 'extra keyword':c=>{c.keywords=['arena']},
 'extra Activate skill':c=>{c.skill={trigger:'activate',oncePerTurn:false,yourTurn:false,restSource:false,cost:{energy:{}},text:'Unprinted skill',effects:[{kind:'draw',amount:1}]}},
 'extra attack Then':c=>{c.attackEffects=[{kind:'draw',amount:1}]},
 'discard after FLIP':c=>{flip(c).effects.push({kind:'discard-hand',count:1})},
 'attached HP gain':c=>{flip(c).attachedHpBonus=1},
 'alternate HP recipient':c=>{flip(c).attachedHpAlternateTarget={side:'self',min:0,max:1}},
 'extra FLIP HP effect':c=>{flip(c).effects.push({kind:'gain-hp',amount:1,target:{side:'self',min:1,max:1,sourceOnly:true}})},
 'extra energy payment':c=>{flip(c).cost.energy={green:1}},
 'extra hand payment':c=>{flip(c).cost.discardHand=1},
 'extra source REST payment':c=>{Reflect.set(flip(c).cost,'restSource',true)},
 'extra source REST flag':c=>{Reflect.set(flip(c),'restSource',true)},
 'extra Once flag':c=>{Reflect.set(flip(c),'oncePerTurn',true)},
 'extra Your Turn flag':c=>{Reflect.set(flip(c),'yourTurn',true)},
 'extra allows flag':c=>{Reflect.set(flip(c),'allowsWithoutCondition',true)},
 'extra only-if flag':c=>{Reflect.set(flip(c),'onlyIfFainted',true)},
 'hand cost deck-bottom destination':c=>{flip(c).handCostDestination='deck-bottom'},
 'extra payment Cookie filter':c=>{flip(c).cost.discardHandType='cookie'},
 'extra support trash payment':c=>{flip(c).cost.supportToTrash=1},
 'extra optional draw field':c=>{Reflect.set(draw(c),'optional',true)},
 'extra draw color filter':c=>{Reflect.set(draw(c),'energyColor','green')},
 'extra draw Cookie filter':c=>{Reflect.set(draw(c),'cardType','cookie')},
 'extra minimum draw one':c=>{Reflect.set(draw(c),'min',1)},
}

describe('ST8-009 independently transcribed original printing',()=>{
 it('retains Cucumber green LV2 HP3, GGG ordinary3 and original artwork',()=>{
  const card=converted()
  expect([raw.cardNumber,card.name,card.cardColor,card.energyColor,card.level,card.hp,card.attack,card.attackCost])
   .toEqual(['ST8-009','Cucumber Cookie','green','green',2,3,3,3])
  expect(card.attackEnergyCost).toEqual({green:3})
  expect(card.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/sMMK3SnjqtUA6rUbtz9F1w.webp')
 })
 it('has exactly a free optional zero-or-one draw without skill, keywords, Then or HP gain',()=>{
  const card=converted(),ability=flip(card)
  expect(card.skill).toBeUndefined();expect(card.keywords??[]).toEqual([])
  expect(card.attackEffects??[]).toEqual([])
  expect(card.effects).toEqual([{kind:'draw-up-to',max:1}])
  expect(ability).toEqual({text:'Draw up to 1 card from your deck.',cost:{energy:{},discardHand:0},effects:[{kind:'draw-up-to',max:1}]})
 })
 it('verifies the original raw conversion',()=>expect(analyze(raw).contract.status).toBe('verified'))
 it('verifies actual createCard runtime with optional metadata omitted',()=>{
  const card=original();expect(card.cardColor).toBeUndefined()
  expect(analyze(raw,card).contract.status).toBe('verified')
 })
 it('keeps forty-eight independent contract mutants',()=>expect(Object.keys(mutants)).toHaveLength(48))
 it.each(Object.keys(mutants))('rejects %s without changing original source',label=>{
  const before=structuredClone(raw),card=original()
  required(mutants[label],'mutant')(card)
  expect(analyze(raw,card).contract.status).not.toBe('verified')
  expect(raw).toEqual(before)
 })
})
