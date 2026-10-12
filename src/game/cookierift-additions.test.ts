import { describe, expect, it } from 'vitest'
import { createCookieriftAdditionState as fixture } from './cookierift-addition-demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { getEffectTargetCandidates, getEffectiveAttack } from './effects'
import { analyzeOfficialCardBehavior } from '../cards/contracts'
import records from '../../data/cards/official-cookierift-additions.en.json'
import type { OfficialCardRecord } from '../cards/types'

const playerId='player-one' as const
const activate = (state:ReturnType<typeof fixture>, targetIds:string[]) => applyGameCommand(state,{
  kind:'activate-skill',playerId,sourceInstanceId:state.players[playerId].battleArea[0].card.instanceId,
  trigger:'activate',paymentIds:state.players[playerId].supportArea.map(s=>s.card.instanceId),effectTargets:[targetIds,targetIds],
})
describe('Cookierift physical additions',()=>{
  it.each(['positive','low','green-arena','non-arena','negative','wrong-color','zero','attack','attack-negative'] as const)('P-163 %s uses a legal original 60-card state',scenario=>{
    const state=fixture('P-163',scenario)
    for(const p of Object.values(state.players)){
      expect(p.battleArea.length).toBeLessThanOrEqual(2)
      const cards=[...p.deck,...p.hand,...p.supportArea.map(s=>s.card),...p.battleArea.flatMap(s=>[s.card,...s.hpCards])]
      expect(cards).toHaveLength(60)
      expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60)
      const counts=new Map<string,number>()
      for(const c of cards)counts.set(c.id,(counts.get(c.id)??0)+1)
      expect([...counts.values()].every(n=>n<=4)).toBe(true)
      for(const source of p.battleArea)expect(source.hpCards).toHaveLength(source.card.hp)
    }
  })
  it.each([['P-163',3],['ST7-005',2]] as const)('%s normal printed attack pays its full colored cost and deals %s', (number, damage)=>{
    const attack=(state:ReturnType<typeof fixture>)=>applyGameCommand(state,{kind:'declare-attack',playerId,
      attackerInstanceId:state.players[playerId].battleArea[0].card.instanceId,
      targetInstanceId:state.players['player-two'].battleArea[0].card.instanceId,
      supportPaymentIds:state.players[playerId].supportArea.map(s=>s.card.instanceId)})
    let state=attack(fixture(number,'attack'))
    expect(state.players[playerId].supportArea.every(s=>s.rested)).toBe(true)
    state=applyGameCommand(state,{kind:'skip-trap',playerId:'player-two'})
    for(let i=0;i<damage;i++)state=applyGameCommand(state,{kind:'resolve-next-damage',playerId:'player-two'})
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(4-damage)
    expect(()=>attack(fixture(number,'attack-negative'))).toThrow()
  })
  it.each(records.cards)('$cardNumber original source has a verified behavior contract',raw=>{
    const audit=analyzeOfficialCardBehavior(raw as OfficialCardRecord)
    expect(audit.errors).toEqual([])
    expect(audit.contract.status).toBe('verified')
  })
  it.each(['P-163','ST7-005'])('%s every zone retains original art, unique instances and copy limit',number=>{
    const state=fixture(number,'positive')
    for(const p of Object.values(state.players)){
      expect(p.battleArea.length).toBeLessThanOrEqual(2)
      const cards=[...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(s=>s.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards]),...(p.id===state.pendingBattle?.defenderPlayerId&&state.pendingBattle.revealedHpCard?[state.pendingBattle.revealedHpCard]:[])]
      expect(new Set(cards.map(c=>c.instanceId)).size).toBe(cards.length)
      const counts=new Map<string,number>()
      for(const c of cards){counts.set(c.id,(counts.get(c.id)??0)+1);expect(c.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)}
      expect([...counts.values()].every(n=>n<=4)).toBe(true)
    }
  })
  it('P-163 pays R, boosts and readies the same other Arena, even when source is rested',()=>{
    const state=fixture('P-163','positive'), self=state.players[playerId]
    self.battleArea[0].rested=true
    const target=self.battleArea[1], source=self.battleArea[0]
    const before=getEffectiveAttack(state,target.card.instanceId)
    const result=activate(state,[target.card.instanceId])
    expect(result.players[playerId].supportArea[0].rested).toBe(true)
    expect(result.players[playerId].battleArea[1].rested).toBe(false)
    expect(result.players[playerId].battleArea[0].rested).toBe(true)
    expect(getEffectiveAttack(result,target.card.instanceId)).toBe(before+1)
    expect(getEffectiveAttack(result,source.card.instanceId)).toBe(source.card.attack)
    expect(canActivateCookieSkill(result,playerId,self.battleArea[0].card.instanceId,'activate')).toBe(false)
  })
  it('P-163 allows a green Arena, excludes self and non-Arena, and pays even when choosing zero',()=>{
    const state=fixture('P-163','low'), self=state.players[playerId]
    const effect=self.battleArea[0].card.skill!.effects[0]
    if(!('target' in effect)||!effect.target)throw new Error('Expected target selector')
    const targets=getEffectTargetCandidates(state,{sourcePlayerId:playerId,sourceInstanceId:self.battleArea[0].card.instanceId},effect.target)
    expect(targets.map(c=>c.card.instanceId)).toEqual([])
    expect(()=>activate(state,[self.battleArea[1].card.instanceId])).toThrow()
    expect(()=>activate(state,[self.battleArea[0].card.instanceId])).toThrow()
    const zero=activate(state,[])
    expect(zero.players[playerId].supportArea[0].rested).toBe(true)
    expect(zero.attackModifiers).toEqual([])
    const greenState=fixture('P-163','green-arena'), greenTarget=greenState.players[playerId].battleArea[1]
    const green=activate(greenState,[greenTarget.card.instanceId])
    expect(getEffectiveAttack(green,greenTarget.card.instanceId)).toBe(greenTarget.card.attack+1)
    expect(green.players[playerId].battleArea[1].rested).toBe(false)
  })
  it('P-163 cannot pay rested or wrong-color energy or activate outside own main phase',()=>{
    const state=fixture('P-163','negative'), id=state.players[playerId].battleArea[0].card.instanceId
    expect(()=>activate(state,[])).toThrow()
    const wrong=fixture('P-163','wrong-color')
    expect(()=>activate(wrong,[])).toThrow()
    expect(canActivateCookieSkill({...state,phase:'support'},playerId,id,'activate')).toBe(false)
  })
  it.each(['positive','low'] as const)('ST7-005 actual damage FLIP restores original HP holder, including last HP (%s)',scenario=>{
    const state=fixture('ST7-005',scenario), self=state.players[playerId]
    expect(state.pendingBattle?.stage).toBe('flip')
    const before=self.battleArea[0].hpCards.length
    const result=applyGameCommand(state,{kind:'resolve-flip',playerId,activate:true,discardHandIds:[self.hand[0].instanceId]})
    expect(result.players[playerId].battleArea[0].hpCards).toHaveLength(before+1)
    expect(result.players[playerId].hand).toHaveLength(0)
    expect(result.players[playerId].discardPile.some(c=>c.instanceId===self.hand[0].instanceId)).toBe(true)
  })
  it('ST7-005 cannot activate without discard; skip pays nothing',()=>{
    const state=fixture('ST7-005','negative')
    expect(()=>applyGameCommand(state,{kind:'resolve-flip',playerId,activate:true,discardHandIds:[]})).toThrow()
    const before=state.players[playerId].battleArea[0].hpCards.length
    const result=applyGameCommand(state,{kind:'resolve-flip',playerId,activate:false})
    expect(result.players[playerId].battleArea[0].hpCards).toHaveLength(before)
  })
})
