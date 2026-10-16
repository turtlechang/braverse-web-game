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
// JSON imports widen type/energy literals; this source-boundary assertion mirrors the existing 009 test.
const raw:OfficialCardRecord=required(getCardPoolEntry('ST8-011')??(document.cards as OfficialCardRecord[]).find(card=>card.cardNumber==='ST8-011'),'original Kiwi')
const converted=():CookieCard=>{
 const result=convertOfficialCardToGameCard(raw,'st8-011-contract')
 if(result.status!=='converted'||result.gameCard?.type!=='cookie')throw Error('Kiwi must convert to Cookie')
 return result.gameCard
}
const original=():CookieCard=>{
 const card=createCard(raw,'player-one',1)
 if(card.type!=='cookie')throw Error('Kiwi must be Cookie')
 return card
}
const skill=(card:CookieCard)=>required(card.skill,'G Blocker')
const redirect=(card:CookieCard)=>{
 const effect=required(skill(card).effects[0],'Blocker redirect')
 if(effect.kind!=='redirect-attack')throw Error('Expected redirect-attack')
 return effect
}
const mainRedirect=(card:CookieCard)=>{
 const effect=required(card.effects?.[0],'main redirect mirror')
 if(effect.kind!=='redirect-attack')throw Error('Expected redirect-attack mirror')
 return effect
}
const mutants:Record<string,(card:CookieCard)=>void>={
 'wrong name':c=>{c.name='Cucumber Cookie'},
 'wrong printed color':c=>{c.cardColor='yellow'},
 'wrong energy color':c=>{c.energyColor='yellow'},
 'wrong LV':c=>{c.level=2},
 'wrong HP':c=>{c.hp=4},
 'wrong ordinary damage':c=>{c.attack=2},
 'wrong total attack cost':c=>{c.attackCost=1},
 'GG ordinary attack':c=>{c.attackEnergyCost={green:2}},
 'NN ordinary attack':c=>{c.attackEnergyCost={neutral:2}},
 'only G ordinary attack':c=>{c.attackEnergyCost={green:1}},
 'extra attack color':c=>{c.attackEnergyCost={green:1,neutral:1,red:1}},
 'missing Blocker':c=>{c.skill=undefined},
 'Activate instead of Blocker':c=>{skill(c).trigger='activate'},
 'OnPlay instead of Blocker':c=>{skill(c).trigger='on-play'},
 'opponent attack trigger instead of Blocker':c=>{skill(c).trigger='opponent-attack'},
 'free Blocker':c=>{skill(c).cost.energy={}},
 'neutral Blocker':c=>{skill(c).cost.energy={neutral:1}},
 'GG Blocker':c=>{skill(c).cost.energy={green:2}},
 'extra neutral Blocker energy':c=>{skill(c).cost.energy={green:1,neutral:1}},
 'hand discard cost':c=>{skill(c).cost.discardHand=1},
 'source REST flag':c=>{skill(c).restSource=true},
 'source REST cost key':c=>{Reflect.set(skill(c).cost,'restSource',true)},
 'support trash cost':c=>{skill(c).cost.supportToTrash=1},
 'extra hand type filter':c=>{skill(c).cost.discardHandType='cookie'},
 'Once per turn':c=>{skill(c).oncePerTurn=true},
 'Your Turn':c=>{skill(c).yourTurn=true},
 'Once per game':c=>{skill(c).oncePerGame=true},
 'faint timing':c=>{skill(c).faint=true},
 'end phase timing':c=>{skill(c).endPhase=true},
 'after damage timing':c=>{skill(c).afterDamage=true},
 'from support area':c=>{skill(c).fromSupportArea=true},
 'from break area':c=>{skill(c).fromBreakArea=true},
 'from trash area':c=>{skill(c).fromTrashArea=true},
 'opponent redirect target':c=>{redirect(c).target.side='opponent'},
 'any friendly Cookie':c=>{redirect(c).target.sourceOnly=false},
 'optional zero redirect':c=>{redirect(c).target.min=0},
 'up to two targets':c=>{redirect(c).target.max=2},
 'extra target level filter':c=>{redirect(c).target.maxLevel=1},
 'extra redirect condition':c=>{redirect(c).condition={kind:'support-count-at-least',count:5}},
 'extra target name filter':c=>{Reflect.set(redirect(c).target,'name','Kiwi Cookie')},
 'extra redirect Then':c=>{Reflect.set(redirect(c),'thenEffects',[{kind:'draw',amount:1}])},
 'missing skill effects':c=>{skill(c).effects=[]},
 'extra skill draw':c=>{skill(c).effects.push({kind:'draw',amount:1})},
 'missing main effects':c=>{c.effects=[]},
 'main mirror opponent target':c=>{mainRedirect(c).target.side='opponent'},
 'main mirror optional target':c=>{mainRedirect(c).target.min=0},
 'extra main draw':c=>{required(c.effects,'main effects').push({kind:'draw',amount:1})},
 'extra attack Then':c=>{c.attackEffects=[{kind:'draw',amount:1}]},
 'extra FLIP':c=>{c.flip={text:'Unprinted FLIP',cost:{energy:{},discardHand:0},effects:[{kind:'draw',amount:1}]}},
 'extra keyword':c=>{c.keywords=['arena']},
 'extra OnPlay clause':c=>{skill(c).onPlayEffects=[{kind:'draw',amount:1}]},
 'extra faint clause':c=>{skill(c).faintEffects=[{kind:'draw',amount:1}]},
 'extra passive clause':c=>{skill(c).passiveEffects=[{kind:'draw',amount:1}]},
}

describe('ST8-011 independently transcribed Kiwi original printing',()=>{
 it('retains original green LV1 HP3 GN ordinary1 and artwork',()=>{
  const card=converted()
  expect([card.id,card.name,card.cardColor,card.energyColor,card.level,card.hp,card.attack,card.attackCost])
   .toEqual(['ST8-011','Kiwi Cookie','green','green',1,3,1,2])
  expect(card.attackEnergyCost).toEqual({green:1,neutral:1})
  expect(card.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/M64-fU95XFH3U0r-o6YN8g.webp')
 })
 it('has exactly one G Blocker redirect to this source, without extra abilities',()=>{
  const card=converted(),ability=skill(card)
  const expected={kind:'redirect-attack',target:{side:'self',min:1,max:1,sourceOnly:true}}
  expect([ability.trigger,ability.oncePerTurn,ability.yourTurn,ability.restSource]).toEqual(['block',false,false,false])
  expect(ability.cost).toEqual({energy:{green:1},discardHand:0})
  expect(ability.effects).toEqual([expected]);expect(card.effects).toEqual([expected])
  expect(card.flip).toBeUndefined();expect(card.attackEffects??[]).toEqual([]);expect(card.keywords??[]).toEqual([])
  expect(ability.onPlayEffects).toBeUndefined();expect(ability.faintEffects).toBeUndefined();expect(ability.passiveEffects).toBeUndefined()
 })
 it('verifies original raw conversion',()=>expect(analyze(raw).contract.status).toBe('verified'))
 it('verifies actual createCard with optional metadata omitted',()=>{
  const card=original();expect(card.cardColor).toBeUndefined();expect(analyze(raw,card).contract.status).toBe('verified')
 })
 it('retains fifty-three distinct mutation cases',()=>expect(Object.keys(mutants)).toHaveLength(53))
 it.each(Object.keys(mutants))('rejects %s without ineffective mutations or changing source',label=>{
  const source=structuredClone(raw),card=original(),before=structuredClone(card)
  required(mutants[label],'mutant')(card)
  expect(card).not.toEqual(before)
  expect(analyze(raw,card).contract.status).not.toBe('verified')
  expect(raw).toEqual(source)
 })
})
