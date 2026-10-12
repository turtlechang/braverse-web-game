import { describe, expect, it } from 'vitest'
import { createSt6014PreviewState as fixture } from './st6-014-demo'
import { applyGameCommand as apply, type GameCommand } from './commands'
import { getCardPoolEntry } from './card-pool'
import { createCard } from './starter-deck'
import type { GameState } from './types'
const owner = 'player-one', foe = 'player-two'
const pay = (state: GameState, costIndex = 0) => apply(state, {
  kind:'begin-play-item',playerId:owner,instanceId:state.players[owner].hand[0].instanceId,
  paymentIds:state.players[owner].supportArea.filter(s=>!s.rested&&s.card.energyColor==='red').slice(0,2).map(s=>s.card.instanceId),
  hpToTrashTargetIds:[state.players[owner].battleArea[costIndex].card.instanceId],
})
const damage = (state: GameState) => apply(state,{kind:'resolve-ability-effect',playerId:owner,targetIds:[]})
const paths = (['positive','low','no-target'] as const).flatMap(scenario=>
  [0,1].flatMap(costIndex=>[false,true].map(zero=>({scenario,costIndex,zero}))))
describe('ST6-014 exact physical-card commands', () => {
  it.each(['positive','negative','low','no-target','rested-source','attack','wrong-color','wrong-phase','target-faints','reveal'] as const)(
    '%s preserves sixty original cards, unique IDs and four-copy limits', scenario => {
      for (const player of Object.values(fixture(scenario).players)) {
        const cards=[...player.deck,...player.hand,...player.discardPile,...player.breakArea,
          ...player.supportArea.map(s=>s.card),...player.battleArea.flatMap(c=>[c.card,...c.hpCards])]
        expect(cards).toHaveLength(60)
        expect(new Set(cards.map(c=>c.instanceId)).size).toBe(60)
        const counts=new Map<string,number>()
        for(const card of cards){
          expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)
          counts.set(card.id,(counts.get(card.id)??0)+1)
        }
        expect([...counts.values()].every(n=>n<=4)).toBe(true)
      }
    },
  )
  it.each(paths)('pays exact top HP and resolves damage before Then: $scenario/$costIndex/$zero',
    ({scenario,costIndex,zero}) => {
      const state=fixture(scenario),before=structuredClone(state),own=state.players[owner]
      const cost=own.battleArea[costIndex],item=own.hand[0]
      let next=pay(state,costIndex)
      expect(next.players[foe]).toEqual(before.players[foe])
      expect(next.players[owner].discardPile.map(c=>c.instanceId)).toContain(cost.hpCards.at(-1)?.instanceId)
      expect(next.players[owner].discardPile.map(c=>c.instanceId)).toContain(item.instanceId)
      const survivor=next.players[owner].battleArea.find(c=>c.card.instanceId===cost.card.instanceId)
      if(cost.hpCards.length>1)expect(survivor?.hpCards).toEqual(cost.hpCards.slice(0,-1))
      else{
        expect(survivor).toBeUndefined()
        expect(next.players[owner].breakArea.map(c=>c.instanceId)).toContain(cost.card.instanceId)
      }
      expect(next.players[owner].supportArea.filter(s=>s.rested)).toHaveLength(2)
      next=damage(next)
      for(const beforeFoe of before.players[foe].battleArea){
        expect(next.players[foe].battleArea.find(c=>c.card.instanceId===beforeFoe.card.instanceId)?.hpCards)
          .toEqual(beforeFoe.hpCards.slice(0,-1))
      }
      const fire=next.players[owner].battleArea.find(c=>c.card.name==='Fire Spirit Cookie')
      const targets=fire&&!zero?[fire.card.instanceId]:[]
      next=apply(next,{kind:'resolve-ability-effect',playerId:owner,targetIds:targets})
      expect(next.attackModifiers).toEqual(fire&&!zero?[{
        sourceInstanceId:item.instanceId,targetInstanceId:fire.card.instanceId,amount:1,expiresAfterTurn:state.turnNumber,
      }]:[])
      expect(next.pendingAbilityEffect).toBeUndefined()
      expect(state).toEqual(before)
    },
  )
  it.each(['missing-hp-choice','opponent-hp','two-hp-cookies','one-red','mixed-energy','wrong-phase','rested-energy'] as const)(
    'rejects %s before spending resources', name => {
      const state=fixture(name==='wrong-phase'?'wrong-phase':name==='rested-energy'?'negative':'positive')
      const before=structuredClone(state),own=state.players[owner]
      const command: GameCommand={kind:'begin-play-item',playerId:owner,instanceId:own.hand[0].instanceId,
        paymentIds:own.supportArea.slice(0,2).map(s=>s.card.instanceId),
        hpToTrashTargetIds:[own.battleArea[0].card.instanceId]}
      if(name==='missing-hp-choice')command.hpToTrashTargetIds=[]
      if(name==='opponent-hp')command.hpToTrashTargetIds=[state.players[foe].battleArea[0].card.instanceId]
      if(name==='two-hp-cookies')command.hpToTrashTargetIds=own.battleArea.map(c=>c.card.instanceId)
      if(name==='one-red')command.paymentIds=command.paymentIds.slice(0,1)
      if(name==='mixed-energy')command.paymentIds=[own.supportArea[0].card.instanceId,own.supportArea[3].card.instanceId]
      expect(()=>apply(state,command)).toThrow()
      expect(state).toEqual(before)
    },
  )
  it.each(['wrong-name','opponent-fire','two-targets'] as const)('rejects illegal Then %s after valid costs', name=>{
    const initial=fixture('positive'),own=initial.players[owner]
    const state=damage(pay(initial)),before=structuredClone(state)
    const targets=name==='wrong-name'?[own.battleArea[0].card.instanceId]:
      name==='opponent-fire'?[state.players[foe].battleArea[0].card.instanceId]:own.battleArea.map(c=>c.card.instanceId)
    expect(()=>apply(state,{kind:'resolve-ability-effect',playerId:owner,targetIds:targets})).toThrow()
    expect(state).toEqual(before)
  })
  it('puts a real printed FLIP HP card into trash without triggering its FLIP',()=>{
    const state=fixture('positive'),own=state.players[owner]
    const raw=getCardPoolEntry('ST6-006')
    if(!raw?.flipText)throw new Error('Missing original ST6-006 FLIP')
    const flip=createCard(raw,owner,1)
    own.battleArea[0].hpCards[own.battleArea[0].hpCards.length-1]=flip
    const before=structuredClone(state),next=pay(state)
    expect(next.players[owner].discardPile.map(c=>c.instanceId)).toContain(flip.instanceId)
    expect(next.players[foe]).toEqual(before.players[foe])
    expect(next.pendingBattle).toBeNull()
    expect(next.pendingAbilityEffect?.effectIndex).toBe(0)
    expect(next.pendingAbilityEffect?.effects.map(e=>e.kind)).toEqual(['damage-all','modify-attack'])
  })
})


describe('ST6-014 damage-all faint and FLIP continuation',()=>{
  it.each([false,true])('resumes named Then after original Cherry FLIP activation=%s',activate=>{
    const initial=fixture('reveal'),before=structuredClone(initial)
    const own=initial.players[owner],targetId=own.battleArea[1].card.instanceId
    let state=damage(pay(initial))
    let sawFlip=false
    for(let i=0;i<12;i++){
      if(state.pendingBattle?.stage==='damage')
        state=apply(state,{kind:'resolve-next-damage',playerId:foe})
      else if(state.pendingBattle?.stage==='flip'){
        expect(state.pendingBattle.revealedHpCard?.id).toBe('ST6-006')
        sawFlip=true
        state=apply(state,{kind:'resolve-flip',playerId:foe,activate})
      }else if(!state.pendingBattle&&state.pendingAbilityEffect){
        expect(state.pendingAbilityEffect.effectIndex).toBe(1)
        state=apply(state,{kind:'resolve-ability-effect',playerId:owner,targetIds:[targetId]})
      }else break
    }
    expect(sawFlip).toBe(true)
    expect(state.pendingBattle).toBeNull()
    expect(state.pendingAbilityEffect).toBeUndefined()
    expect(state.players[foe].battleArea.map(c=>[c.card.id,c.hpCards.length])).toEqual([['ST6-002',5]])
    expect(state.players[foe].breakArea.map(c=>c.id)).toEqual(['ST6-005'])
    expect(state.players[foe].hand.map(c=>c.id)).toEqual(activate?['ST6-006']:[])
    expect(state.players[foe].discardPile.some(c=>c.id==='ST6-006')).toBe(!activate)
    expect(state.attackModifiers).toEqual([{
      sourceInstanceId:own.hand[0].instanceId,targetInstanceId:targetId,amount:1,expiresAfterTurn:initial.turnNumber,
    }])
    expect(initial).toEqual(before)
  })
  it('faints a printed one-HP Cookie and continues Then when no FLIP occurs',()=>{
    const initial=fixture('target-faints'),own=initial.players[owner]
    expect(initial.players[foe].battleArea[1].card.hp).toBe(1)
    let state=damage(pay(initial))
    expect(state.players[foe].breakArea.map(c=>c.id)).toEqual(['ST6-005'])
    expect(state.players[foe].battleArea.map(c=>[c.card.id,c.hpCards.length])).toEqual([['ST6-002',5]])
    expect(state.pendingAbilityEffect?.effectIndex).toBe(1)
    state=apply(state,{kind:'resolve-ability-effect',playerId:owner,targetIds:[own.battleArea[1].card.instanceId]})
    expect(state.attackModifiers[0].amount).toBe(1)
  })
})
