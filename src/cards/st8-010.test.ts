import {describe,expect,it} from 'vitest'
import document from '../../data/candidates/st6-st10/official-st8.en.json'
import {getCardPoolEntry} from '../game/card-pool'
import {createCard} from '../game/starter-deck'
import type {CookieCard,CardEffect} from '../game/types'
import type {OfficialCardRecord} from './types'
import {convertOfficialCardToGameCard} from './official-card-adapter'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'

const required=<T,>(value:T|null|undefined,label:string):T=>{
 if(value===null||value===undefined)throw Error(`Missing ${label}`)
 return value
}
const raw:OfficialCardRecord=required(getCardPoolEntry('ST8-010')??(document.cards as OfficialCardRecord[]).find(c=>c.cardNumber==='ST8-010'),'original Cookiemals')
const original=():CookieCard=>{
 const card=createCard(raw,'player-one',1)
 if(card.type!=='cookie')throw Error('Cookiemals must be Cookie')
 return card
}
const converted=():CookieCard=>{
 const result=convertOfficialCardToGameCard(raw,'st8-010-contract')
 if(result.status!=='converted'||result.gameCard?.type!=='cookie')throw Error('Cookiemals conversion required')
 return result.gameCard
}
// Independent printed contract, not copied from adapter output. Used to distinguish
// a correct implementation from mutants while the initial actual skill is absent.
const expectedRuntime=():CookieCard=>{
 const card=original()
 const effects:CardEffect[]=[{kind:'choose-one',modes:[
  {label:'Place 1 card',effects:[{kind:'deck-to-support',amount:1,rested:true}]},
  {label:'Place 0 cards',effects:[{kind:'deck-to-support',amount:0,rested:true}]},
 ]}]
 card.effects=structuredClone(effects)
 card.skill={trigger:'passive',oncePerTurn:false,yourTurn:false,restSource:false,faint:true,
  text:required(raw.skill.text,'printed Quick Roll'),
  cost:{energy:{},discardHand:0,supportToHand:1,supportToHandType:'item'},effects}
 return card
}
const skill=(card:CookieCard)=>required(card.skill,'Quick Roll')
const choice=(card:CookieCard)=>{
 const effect=required(skill(card).effects[0],'Quick Roll choice')
 if(effect.kind!=='choose-one')throw Error('Expected choose-one')
 return effect
}
const placement=(card:CookieCard,index:number)=>{
 const effect=required(required(choice(card).modes[index],'mode').effects[0],'placement')
 if(effect.kind!=='deck-to-support')throw Error('Expected deck-to-support')
 return effect
}
const mutants:Record<string,(card:CookieCard)=>void>={
 'wrong name':c=>{c.name='Kiwi Cookie'},
 'wrong card color':c=>{c.cardColor='red'},
 'wrong energy color':c=>{c.energyColor='red'},
 'wrong level':c=>{c.level=2},
 'wrong HP':c=>{c.hp=3},
 'wrong ordinary damage':c=>{c.attack=2},
 'wrong attackCost':c=>{c.attackCost=2},
 'GG ordinary payment':c=>{c.attackEnergyCost={green:2}},
 'neutral ordinary payment':c=>{c.attackEnergyCost={neutral:1}},
 'missing skill':c=>{c.skill=undefined},
 'Activate timing':c=>{skill(c).trigger='activate'},
 'OnPlay timing':c=>{skill(c).trigger='on-play'},
 'missing faint timing':c=>{skill(c).faint=false},
 'extra AfterDamage timing':c=>{skill(c).afterDamage=true},
 'extra EndPhase timing':c=>{skill(c).endPhase=true},
 'extra source area':c=>{skill(c).fromSupportArea=true},
 'extra Once per turn':c=>{skill(c).oncePerTurn=true},
 'extra Your Turn':c=>{skill(c).yourTurn=true},
 'extra REST source':c=>{skill(c).restSource=true},
 'extra Once per game':c=>{skill(c).oncePerGame=true},
 'missing Item return cost':c=>{skill(c).cost.supportToHand=0},
 'two Item return cost':c=>{skill(c).cost.supportToHand=2},
 'any support return cost':c=>{skill(c).cost.supportToHandType=undefined},
 'Cookie return cost':c=>{skill(c).cost.supportToHandType='cookie'},
 'Trap return cost':c=>{skill(c).cost.supportToHandType='trap'},
 'Stage return cost':c=>{skill(c).cost.supportToHandType='stage'},
 'green only Item cost':c=>{skill(c).cost.supportToHandColor='green'},
 'Arena only Item cost':c=>{skill(c).cost.supportToHandKeyword='arena'},
 'extra energy cost':c=>{skill(c).cost.energy={green:1}},
 'extra hand cost':c=>{skill(c).cost.discardHand=1},
 'extra support trash cost':c=>{skill(c).cost.supportToTrash=1},
 'wrong return destination':c=>{Reflect.set(skill(c).cost,'supportToHandDestination','trash')},
 'active only cost':c=>{Reflect.set(skill(c).cost,'supportToHandRested',false)},
 'mandatory one no choice':c=>{skill(c).effects=[{kind:'deck-to-support',amount:1,rested:true}]},
 'missing zero mode':c=>{choice(c).modes.splice(1,1)},
 'missing one mode':c=>{choice(c).modes.splice(0,1)},
 'third mode':c=>{choice(c).modes.push({label:'Unprinted',effects:[{kind:'draw',amount:1}]})},
 'mode one amount2':c=>{placement(c,0).amount=2},
 'mode zero amount1':c=>{placement(c,1).amount=1},
 'one enters active':c=>{placement(c,0).rested=false},
 'zero mode active':c=>{placement(c,1).rested=false},
 'extra type restriction':c=>{Reflect.set(placement(c,0),'cardType','cookie')},
 'extra color restriction':c=>{Reflect.set(placement(c,0),'energyColor','green')},
 'opponent support destination':c=>{Reflect.set(placement(c,0),'side','opponent')},
 'hand instead of deck origin':c=>{Reflect.set(placement(c,0),'source','hand')},
 'extra condition':c=>{placement(c,0).condition={kind:'support-count-at-least',count:5}},
 'extra mode draw':c=>{required(choice(c).modes[0],'mode').effects.push({kind:'draw',amount:1})},
 'extra skill effect':c=>{skill(c).effects.push({kind:'draw',amount:1})},
 'missing main effects':c=>{c.effects=[]},
 'extra main effects':c=>{required(c.effects,'mirror').push({kind:'draw',amount:1})},
 'extra attack Then':c=>{c.attackEffects=[{kind:'draw',amount:1}]},
 'extra FLIP':c=>{c.flip={text:'Unprinted',cost:{energy:{},discardHand:0},effects:[{kind:'draw',amount:1}]}},
 'extra keyword':c=>{c.keywords=['arena']},
 'extra OnPlay clause':c=>{skill(c).onPlayEffects=[{kind:'draw',amount:1}]},
 'extra passive clause':c=>{skill(c).passiveEffects=[{kind:'draw',amount:1}]},
}

describe('ST8-010 original Cookiemals precise contract',()=>{
 it('retains green LV1 HP2 G ordinary1 and original art',()=>{
  const c=converted()
  expect([c.id,c.name,c.cardColor,c.energyColor,c.level,c.hp,c.attack,c.attackCost])
   .toEqual(['ST8-010','Cookiemals','green','green',1,2,1,1])
  expect(c.attackEnergyCost).toEqual({green:1})
  expect(c.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/3WcZPA86yU7-IyEKanPV9Q.webp')
 })
 it('has faint Quick Roll exact Item support return cost and rested zero/one modes',()=>{
  const c=converted(),s=skill(c),modes=choice(c).modes
  expect([s.trigger,s.faint,s.restSource,s.oncePerTurn,s.yourTurn]).toEqual(['passive',true,false,false,false])
  expect(s.cost).toEqual({energy:{},discardHand:0,supportToHand:1,supportToHandType:'item'})
  expect(modes.map(m=>m.effects)).toEqual([[{kind:'deck-to-support',amount:1,rested:true}],[{kind:'deck-to-support',amount:0,rested:true}]])
  expect(c.effects).toEqual(s.effects)
  expect(c.flip).toBeUndefined();expect(c.attackEffects??[]).toEqual([]);expect(c.keywords??[]).toEqual([])
 })
 it('verifies original raw conversion',()=>expect(analyze(raw).contract.status).toBe('verified'))
 it('verifies actual metadata-omitted createCard',()=>{
  const c=original();expect(c.cardColor).toBeUndefined();expect(analyze(raw,c).contract.status).toBe('verified')
 })
 it('verifies independently modeled correct runtime without requiring faintOptional flag',()=>expect(analyze(raw,expectedRuntime()).contract.status).toBe('verified'))
 it('preserves the printed Item restriction in classified support-to-hand cost metadata',()=>{
  const cost=required(analyze(raw,expectedRuntime()).contract.costs.find(c=>c.kind==='support-to-hand'),'classified support-to-hand cost')
  expect(cost.runtime?.supportToHandType).toBe('item')
 })
 it('keeps fifty-five independent mutants',()=>expect(Object.keys(mutants)).toHaveLength(55))
 it.each(Object.keys(mutants))('rejects %s without source mutation or ineffective change',label=>{
  const source=structuredClone(raw),c=expectedRuntime(),before=structuredClone(c)
  required(mutants[label],'mutant')(c)
  expect(c).not.toEqual(before);expect(analyze(raw,c).contract.status).not.toBe('verified');expect(raw).toEqual(source)
 })
})
