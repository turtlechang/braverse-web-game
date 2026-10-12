import {describe,it,expect} from 'vitest'
import fixtureJson from '../fixtures/bs12-yellow-hand-break-cost.json'
import {takeAiStep} from '../../ai'
import {chooseAiHandToBreakCostIds} from '../hand-break-cost-selection'
import {createCard} from '../../starter-deck'
import {getCardPoolEntry} from '../../card-pool'
import type {GameState} from '../../types'
const fixture=(lowFirst=false)=>{const s=structuredClone(fixtureJson) as unknown as GameState;if(lowFirst)s.players['player-one'].hand.reverse();return s}
const options=(level:3|4|5)=>({level,seed:2026101135,searchNow:()=>0})
describe('AI public hand-to-Break cost survival',()=>{
 for(const level of [3,4,5] as const){
  for(const lowFirst of [false,true])it(`Lv${level} wins through the safe original On Play cost, low first=${lowFirst}`,()=>{const s=fixture(lowFirst),before=structuredClone(s),n=takeAiStep(s,'player-one',options(level));expect(n.action).toBe('activate-skill');expect(n.state.result?.winnerId).toBe('player-one');expect(n.state.players['player-one'].breakArea.reduce((n,c)=>n+c.level,0)).toBe(8);expect(n.state.players['player-two'].breakArea.reduce((n,c)=>n+c.level,0)).toBe(10);expect(n.state.commandLog?.at(-1)?.payload).toMatchObject({kind:'activate-skill',handToBreakAreaIds:['player-one-BS12-034-1']});expect(s).toEqual(before)})
  it(`Lv${level} declines an optional effect if every legal hand cost immediately loses`,()=>{const s=fixture(),own=s.players['player-one'];own.discardPile.push(...own.hand.filter(c=>c.id==='BS12-034'));own.hand=own.hand.filter(c=>c.id!=='BS12-034');const before=structuredClone(s),n=takeAiStep(s,'player-one',options(level));expect(n.action).not.toBe('activate-skill');expect(n.state.status).toBe('playing');expect(n.state.pendingOnPlay).toBeNull();expect(n.state.players['player-one'].breakArea.reduce((n,c)=>n+c.level,0)).toBe(7);expect(n.state.players['player-one'].supportArea.every(c=>!c.rested)).toBe(true);expect(s).toEqual(before)})
  it(`Lv${level} does not use unknown HP/deck identities to choose this public cost`,()=>{const s=fixture(),hidden=structuredClone(s);const raw=getCardPoolEntry('ST6-006');if(!raw)throw Error('Original FLIP');for(const p of Object.values(hidden.players)){p.deck=p.deck.map(c=>({...createCard(raw,p.id,1),instanceId:c.instanceId}));for(const c of p.battleArea)c.hpCards=c.hpCards.map(h=>({...createCard(raw,p.id,1),instanceId:h.instanceId}))}const a=takeAiStep(s,'player-one',options(level)),b=takeAiStep(hidden,'player-one',options(level));expect(a.state.commandLog?.at(-1)?.payload).toEqual(b.state.commandLog?.at(-1)?.payload)})
 }
 it('shares safe original Arena hand cost selection with the item path and excludes another hand payment',()=>{const s=fixture(),raw=getCardPoolEntry('BS12-028');if(!raw)throw Error('Original item');const c=createCard(raw,'player-one',1);if(c.type!=='item'||!c.item)throw Error('Item');const source=s.pendingOnPlay!.sourceInstanceId;expect(chooseAiHandToBreakCostIds(s,'player-one',c.item.cost,source)).toEqual(['player-one-BS12-034-1']);expect(chooseAiHandToBreakCostIds(s,'player-one',c.item.cost,source,['player-one-BS12-034-1'])).toBeNull()})
})
