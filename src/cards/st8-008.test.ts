import {describe,expect,it} from 'vitest'
import document from '../../data/candidates/st6-st10/official-st8.en.json'
import {getCardPoolEntry} from '../game/card-pool'
import {createCard} from '../game/starter-deck'
import type {CardEffect,CookieCard} from '../game/types'
import type {OfficialCardRecord} from './types'
import {convertOfficialCardToGameCard} from './official-card-adapter'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'

const required=<T,>(value:T|null|undefined,label:string):T=>{
 if(value===null||value===undefined)throw Error(`Missing ${label}`)
 return value
}
const raw:OfficialCardRecord=required(getCardPoolEntry('ST8-008')??
 (document.cards as OfficialCardRecord[]).find(card=>card.cardNumber==='ST8-008'),'original ST8-008')
const converted=():CookieCard=>{
 const result=convertOfficialCardToGameCard(raw,'st8-008-contract-test')
 if(result.status!=='converted'||result.gameCard?.type!=='cookie')throw Error('Original ST8-008 must convert to Cookie')
 return result.gameCard
}
const original=():CookieCard=>{
 const card=createCard(raw,'player-one',1)
 if(card.type!=='cookie')throw Error('Original ST8-008 must be Cookie')
 return card
}
const skill=(card:CookieCard)=>required(card.skill,'Creator of Life')
const cost=(card:CookieCard)=>required(skill(card).cost,'printed faint cost representation')
const choice=(card:CookieCard)=>{
 const effect=required(skill(card).effects[0],'faint choice')
 if(effect.kind!=='choose-one')throw Error('Expected faint choose-one')
 return effect
}
const supportDifference=(card:CookieCard)=>{
 const condition=required(choice(card).condition,'support difference')
 if(condition.kind!=='support-count-less-than-opponent')throw Error('Expected inclusive support difference')
 return condition
}
const placement=(card:CookieCard,index=0)=>{
 const effect=required(required(choice(card).modes[index],'support placement mode').effects[0],'deck-top placement')
 if(effect.kind!=='deck-to-support')throw Error('Expected rested deck-to-support')
 return effect
}
const attackEffect=(card:CookieCard,index:number):CardEffect=>required(required(card.attackEffects,'attack Then')[index],'attack effect')
const draw=(card:CookieCard)=>{
 const effect=attackEffect(card,0)
 if(effect.kind!=='draw')throw Error('Expected mandatory draw')
 return effect
}
const discard=(card:CookieCard)=>{
 const effect=attackEffect(card,1)
 if(effect.kind!=='discard-hand')throw Error('Expected mandatory discard')
 return effect
}
const namedCondition=(card:CookieCard)=>{
 const condition=required(draw(card).condition,'named support condition')
 if(condition.kind!=='support-area-has-named-cookie')throw Error('Expected named support predicate')
 return condition
}
const mutants:Record<string,(card:CookieCard)=>void>={
 'wrong HP':c=>{c.hp=3},
 'wrong color':c=>{c.cardColor='blue'},
 'wrong energy':c=>{c.energyColor='red'},
 'wrong level':c=>{c.level=1},
 'wrong ordinary damage':c=>{c.attack=4},
 'wrong GGG payment':c=>{c.attackEnergyCost={green:2,neutral:1}},
 'missing faint':c=>{skill(c).faint=false},
 'Activate instead of faint':c=>{skill(c).trigger='activate'},
 'extra Once':c=>{skill(c).oncePerTurn=true},
 'extra source REST':c=>{skill(c).restSource=true},
 'extra Your Turn':c=>{skill(c).yourTurn=true},
 'faint hand payment':c=>{cost(c).discardHand=1},
 'faint energy payment':c=>{cost(c).energy={green:1}},
 'strictly less support':c=>{supportDifference(c).difference=1},
 'active support count filter':c=>{Reflect.set(supportDifference(c),'activeOnly',true)},
 'mandatory support one':c=>{choice(c).modes.pop()},
 'support up to two':c=>{placement(c).amount=2},
 'active support placement':c=>{placement(c).rested=false},
 'optional draw':c=>{
  const effects=required(c.attackEffects,'attack Then')
  effects[0]={kind:'draw-up-to',max:1,condition:draw(c).condition}
 },
 'draw two':c=>{draw(c).amount=2},
 'discard two':c=>{discard(c).count=2},
 'discard at least':c=>{Reflect.set(discard(c),'atLeast',true)},
 'discard Cookie only':c=>{discard(c).cookieOnly=true},
 'optional discard':c=>{Reflect.set(discard(c),'optional',true)},
 'discard wrong destination':c=>{Reflect.set(discard(c),'destination','deck-top')},
 'wrong named zone':c=>{Reflect.set(namedCondition(c),'kind','battle-area-has-named-cookie')},
 'wrong named owner':c=>{namedCondition(c).side='opponent'},
 'wrong named Cookie':c=>{namedCondition(c).name='Sugar Swan Cookie'},
 'active Wind Archer only':c=>{Reflect.set(namedCondition(c),'activeOnly',true)},
 'unconditional Then':c=>{delete draw(c).condition},
 'wrong draw/discard order':c=>{required(c.attackEffects,'attack Then').reverse()},
 'extra Then effect':c=>{required(c.attackEffects,'attack Then').push({kind:'draw',amount:1})},
}

describe('ST8-008 independently transcribed original printing',()=>{
 it('retains Sugar Swan green LV2 HP4, GGG ordinary3 and original artwork',()=>{
  const card=converted()
  expect([raw.cardNumber,card.name,card.cardColor,card.energyColor,card.level,card.hp,card.attack,card.attackCost])
   .toEqual(['ST8-008','Sugar Swan Cookie','green','green',2,4,3,3])
  expect(card.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/q77XO42d8Kpyspi8BOUjFQ.webp')
  expect(card.attackEnergyCost).toEqual({green:3})
  expect(card.keywords??[]).toEqual([])
 })
 it('represents actual own-faint inclusive support count with exactly zero or one rested deck-top card',()=>{
  const card=converted(),s=skill(card),effect=choice(card)
  expect(s).toMatchObject({trigger:'passive',faint:true,oncePerTurn:false,yourTurn:false,restSource:false})
  expect(s.cost).toEqual({energy:{},discardHand:0})
  expect(s.effects).toHaveLength(1)
  expect(effect.condition).toEqual({kind:'support-count-less-than-opponent',difference:0})
  expect(effect.modes).toHaveLength(2)
  expect(effect.modes.map(mode=>mode.effects)).toEqual([
   [{kind:'deck-to-support',amount:1,rested:true}],
   [{kind:'deck-to-support',amount:0,rested:true}],
  ])
 })
 it('draws exactly one before mandatory arbitrary discard one, gated by own named support',()=>{
  expect(converted().attackEffects).toEqual([
   {kind:'draw',amount:1,condition:{kind:'support-area-has-named-cookie',side:'self',name:'Wind Archer Cookie'}},
   {kind:'discard-hand',count:1,condition:{kind:'support-area-has-named-cookie',side:'self',name:'Wind Archer Cookie'}},
  ])
 })
 it('verifies the original raw conversion',()=>expect(analyze(raw).contract.status).toBe('verified'))
 it('verifies actual createCard runtime with optional metadata omitted',()=>{
  const card=original()
  expect(card.cardColor).toBeUndefined()
  expect(analyze(raw,card).contract.status).toBe('verified')
 })
 it('keeps the independent mutant inventory at thirty-two',()=>expect(Object.keys(mutants)).toHaveLength(32))
 it.each(Object.keys(mutants))('rejects %s without altering original source',label=>{
  const before=structuredClone(raw),card=original()
  required(mutants[label],'mutant')(card)
  expect(analyze(raw,card).contract.status).not.toBe('verified')
  expect(raw).toEqual(before)
 })
})
