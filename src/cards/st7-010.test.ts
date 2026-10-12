import {getCardPoolEntry} from '../game/card-pool'
import {describe,expect,it} from 'vitest'
import document from '../../data/candidates/st6-st10/official-st7.en.json'
import type {OfficialCardRecord} from './types'
import type {CookieCard} from '../game/types'
import {createCard} from '../game/starter-deck'
import {analyzeOfficialCardBehavior as analyze} from './contracts/ledger'
const record=getCardPoolEntry('ST7-010')??document.cards.find(card=>card.cardNumber==='ST7-010')
if(!record)throw Error('Original unpromoted ST7-010 required')
const raw=record as OfficialCardRecord
const original=()=>{const card=createCard(raw,'player-one',1);if(card.type!=='cookie')throw Error('Original Cookie required');return card}
const skill=(c:CookieCard)=>{if(!c.skill)throw Error('Printed Activate required');return c.skill}
const heal=(c:CookieCard)=>{const e=skill(c).effects[0];if(e?.kind!=='gain-hp'||!e.target)throw Error('Printed optional heal required');return e}
const then=(c:CookieCard)=>{const e=c.attackEffects?.[0];if(e?.kind!=='optional-cost-attack')throw Error('Printed optional Then required');return e}
const mutants:Record<string,(c:CookieCard)=>void>={
 'wrong-hp':c=>{c.hp=4},'wrong-level':c=>{c.level=2},'wrong-color':c=>{c.energyColor='red'},'wrong-damage':c=>{c.attack=4},'free-attack':c=>{c.attackEnergyCost={};c.attackCost=0},
 'no-once':c=>{skill(c).oncePerTurn=false},'extra-rest':c=>{skill(c).restSource=true},'wrong-trigger':c=>{skill(c).trigger='on-play'},'free-skill-cost':c=>{skill(c).cost.discardHand=0},'colored-hand-cost':c=>{skill(c).cost.discardHandColor='yellow'},'extra-energy':c=>{skill(c).cost.energy={yellow:1}},
 'unlimited-hp':c=>{delete heal(c).target?.maxRemainingHp},'wrong-hp-boundary':c=>{if(heal(c).target)heal(c).target!.maxRemainingHp=5},'opponent-heal':c=>{if(heal(c).target)heal(c).target!.side='opponent'},'mandatory-target':c=>{if(heal(c).target)heal(c).target!.min=1},'extra-heal':c=>{heal(c).amount=2},
 'missing-then':c=>{c.attackEffects=[]},'free-then':c=>{then(c).cost.discardHand=0},'noncookie-then':c=>{delete then(c).cost.discardHandType},'no-flip-restriction':c=>{delete then(c).cost.discardHandHasFlip},'extra-then-energy':c=>{then(c).cost.energy={yellow:1}},'wrong-draw':c=>{then(c).effects=[{kind:'draw-up-to',max:3}]},'mandatory-draw':c=>{then(c).effects=[{kind:'draw',amount:2}]},'activate-discarded-flip':c=>{then(c).effects.push({kind:'activate-discarded-flip'})},
}
describe('ST7-010 independently transcribed printed restrictions',()=>{
 it('preserves yellow LV3 HP5, free Once Activate, HP4 ceiling and YYY ordinary3 Then',()=>{
  const card=original()
  expect([card.name,card.energyColor,card.level,card.hp,card.attack,card.attackCost]).toEqual(['Millennial Tree Cookie','yellow',3,5,3,3])
  expect(card.attackEnergyCost).toEqual({yellow:3});expect(card.flip).toBeUndefined();expect(card.keywords??[]).toEqual([])
  expect(skill(card)).toMatchObject({trigger:'activate',oncePerTurn:true,restSource:false,cost:{energy:{},discardHand:1},effects:[{kind:'gain-hp',amount:1,target:{side:'self',min:0,max:1,maxRemainingHp:4}}]})
  expect(card.attackEffects).toEqual([{kind:'optional-cost-attack',cost:{energy:{},discardHand:1,discardHandType:'cookie',discardHandHasFlip:true},effects:[{kind:'draw-up-to',max:2}],effectText:'Then, <discard 1 Cookie that has FLIP from your hand.> Draw up to 2 cards from your deck.'}])
 })
 it('accepts exact original runtime',()=>expect(analyze(raw,original()).contract.status).toBe('verified'))
 it.each(Object.entries(mutants))('rejects %s',(name,mutate)=>{
  const card=structuredClone(original()),before=structuredClone(raw);mutate(card)
  expect(analyze(raw,card).contract.status).not.toBe('verified');expect(raw).toEqual(before)
 })
})
