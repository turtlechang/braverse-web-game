import {getCardPoolEntry} from '../game/card-pool'
import {describe,expect,it} from 'vitest'
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior} from './contracts/ledger'
import type {CookieCard} from '../game/types'
const raw=getCardPoolEntry('ST7-008');if(!raw)throw Error('Original ST7-008 required')
const original=()=>{const card=createCard(raw,'player-one',1);if(card.type!=='cookie')throw Error('Original Cookie required');return card}
const skill=(card:CookieCard)=>{if(!card.skill)throw Error('Original On Play required');return card.skill}
const recovery=(card:CookieCard)=>{const effect=skill(card).effects[0];if(effect?.kind!=='break-to-trash')throw Error('Original recovery required');return effect}
const branches=(card:CookieCard)=>{const condition=recovery(card).condition;if(condition?.kind!=='any-of')throw Error('Original alternatives required');return condition.conditions}
const breakWitness=(card:CookieCard)=>{const condition=branches(card).find(entry=>entry.kind==='break-area-has-card');if(condition?.kind!=='break-area-has-card')throw Error('Original Break witness required');return condition}
const damage=(card:CookieCard)=>{const effect=card.attackEffects?.[0];if(effect?.kind!=='damage')throw Error('Original Then required');return effect}
const target=(card:CookieCard)=>{const result=damage(card).target;if(!result)throw Error('Original defender required');return result}
const mutants:Record<string,(card:CookieCard)=>void>={
 'wrong-hp':card=>{card.hp=3},
 'wrong-level':card=>{card.level=1},
 'wrong-color':card=>{card.energyColor='red'},
 'active-trigger':card=>{skill(card).trigger='activate'},
 'extra-rest-source':card=>{skill(card).restSource=true},
 'extra-once':card=>{skill(card).oncePerTurn=true},
 'extra-your-turn':card=>{skill(card).yourTurn=true},
 'extra-payment':card=>{skill(card).cost.energy={yellow:1}},
 'extra-discard':card=>{skill(card).cost.discardHand=1},
 'wrong-recovery-color':card=>{recovery(card).energyColor='red'},
 'wrong-recovery-level':card=>{recovery(card).exactLevel=2},
 'extra-recovery-target':card=>{recovery(card).max=2},
 'wrong-break-name':card=>{breakWitness(card).name='Rainbow Sherbet Cookie'},
 'wrong-break-level':card=>{breakWitness(card).minLevel=2},
 'opposing-break':card=>{breakWitness(card).side='opponent'},
 'missing-break-alternative':card=>{recovery(card).condition=branches(card)[0]},
 'missing-attack-then':card=>{card.attackEffects=[]},
 'extra-damage':card=>{damage(card).amount=2},
 'wrong-threshold':card=>{damage(card).condition={kind:'break-level-at-least',level:3}},
 'different-defender':card=>{delete target(card).attackTargetOnly},
 'optional-defender':card=>{target(card).min=0},
}
describe('ST7-008 strict contract rejects independent printed-rule mutants',()=>{
 it('accepts actual original conversion',()=>expect(analyzeOfficialCardBehavior(raw,original()).contract.status).toBe('verified'))
 it.each(Object.entries(mutants))('rejects %s',(name,mutate)=>{const card=structuredClone(original());mutate(card);expect(analyzeOfficialCardBehavior(raw,card).contract.status).not.toBe('verified')})
})
