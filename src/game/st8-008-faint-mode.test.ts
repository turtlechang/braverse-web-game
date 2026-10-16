import {describe,expect,it} from 'vitest'
import {
 applyGameCommand,compilePendingDecisionDescriptor,createPlayerView,getPendingDecision,takeAiStep,
 type AiLevel,type GameCommand,type GameState,
} from './index'
import {createSt8008PreviewState} from './st8-008-demo'
import {commandFromLogEntry} from './replay'

const owner='player-one' as const
const required=<T,>(value:T|null|undefined,label:string):T=>{
 if(value===null||value===undefined)throw Error(`Missing ${label}`)
 return value
}
const lastCommand=(s:GameState):GameCommand=>required(commandFromLogEntry(required(required(s.commandLog,'command log').at(-1),'entry')),'typed replay command')
const pendingChoice=(s:GameState)=>{
 const faint=required(s.pendingFaintEffects?.[0],'original faint effect')
 if(faint.effect.kind!=='choose-one')throw Error('Expected original faint choose-one')
 return {...faint,effect:faint.effect}
}
const parent=()=>{
 const initial=createSt8008PreviewState('faint-equal',true),state=createSt8008PreviewState('faint-equal')
 const commands=required(state.commandLog,'real parent command log').map(entry=>required(commandFromLogEntry(entry),'typed parent command'))
 let replay=structuredClone(initial)
 for(const command of commands)replay=applyGameCommand(replay,structuredClone(command))
 expect(replay).toEqual(state)
 const faint=pendingChoice(state)
 expect(faint.sourcePlayerId).toBe(owner)
 expect(state.players[owner].breakArea.find(card=>card.instanceId===faint.sourceInstanceId)).toMatchObject({id:'ST8-008',name:'Sugar Swan Cookie',level:2,hp:4})
 expect(faint.effect.condition).toEqual({kind:'support-count-less-than-opponent',difference:0})
 return {initial,state,commands}
}
const replay=(initial:GameState,commands:readonly GameCommand[])=>{
 let state=structuredClone(initial)
 for(const command of commands)state=applyGameCommand(state,structuredClone(command))
 return state
}
describe('ST8-008 original faint mode command pipeline',()=>{
 it('mechanism isolation: pays a queued deck cost before selecting its faint mode',()=>{
  const {state}=parent(),faint=pendingChoice(state)
  // This cost tests the shared queue protocol; it is not printed on ST8-008.
  const queued:GameState={...state,pendingFaintEffects:[{...faint,cost:{deckToTrash:{amount:1}}}]}
  const before=structuredClone(queued)
  const paid=applyGameCommand(queued,{kind:'resolve-faint-effect',playerId:owner,targetIds:[],payDeckToTrash:true})
  expect(queued).toEqual(before)
  expect(paid.players[owner].deck).toEqual(queued.players[owner].deck.slice(1))
  expect(paid.pendingFaintEffects?.[0].effect.kind).toBe('choose-one')
  const chosen=applyGameCommand(paid,{kind:'resolve-choose-one',playerId:owner,modeIndex:1})
  expect(applyGameCommand(chosen,{kind:'resolve-faint-effect',playerId:owner,targetIds:[]}).pendingFaintEffects??[]).toHaveLength(0)
 })
 for(const [label,playerId,modeIndex] of [
  ['wrong owner','player-two',0],['negative mode','player-one',-1],
  ['out of range','player-one',2],['fractional mode','player-one',0.5],
 ] as const)it(`rejects ${label} without changing state`,()=>{
  const {state}=parent(),before=structuredClone(state)
  expect(()=>applyGameCommand(state,{kind:'resolve-choose-one',playerId,modeIndex})).toThrow()
  expect(state).toEqual(before)
 })
 it('rejects ordinary faint confirmation until a mode is selected',()=>{
  const {state}=parent(),before=structuredClone(state)
  expect(()=>applyGameCommand(state,{kind:'resolve-faint-effect',playerId:owner,targetIds:[]})).toThrow(/先選擇/)
  expect(state).toEqual(before)
 })
 it('compiles a ready choice descriptor with explicit resolve-choose-one actions',()=>{
  const {state}=parent(),before=structuredClone(state),decision=required(getPendingDecision(state),'pending decision')
  expect(decision.kind).toBe('faint-effect')
  const descriptor=required(compilePendingDecisionDescriptor(state,decision,{viewerPlayerId:owner}),'faint descriptor')
  expect(descriptor.status).toBe('ready')
  expect(descriptor.actionKinds).toEqual(['resolve-choose-one'])
  expect(descriptor.steps).toMatchObject([{candidateIds:['0','1'],commandKinds:['resolve-choose-one']}])
  expect(state).toEqual(before)
 })
 for(const modeIndex of [0,1])it(`selects original mode ${modeIndex}, then resolves and exactly replays all parents`,()=>{
  const {initial,state,commands}=parent(),before=structuredClone(state),faint=pendingChoice(state)
  const mode:GameCommand={kind:'resolve-choose-one',playerId:owner,modeIndex}
  const chosen=applyGameCommand(state,mode)
  expect(state).toEqual(before)
  const queued=required(chosen.pendingFaintEffects?.[0],'expanded original mode')
  expect(queued.sourcePlayerId).toBe(faint.sourcePlayerId)
  expect(queued.sourceInstanceId).toBe(faint.sourceInstanceId)
  expect(queued.context).toEqual(faint.context)
  expect(queued.cost).toEqual(faint.cost)
  expect(queued.sourceEnergy).toEqual(faint.sourceEnergy)
  expect(queued.effect).toMatchObject({kind:'deck-to-support',amount:modeIndex===0?1:0,rested:true})
  // Choosing a mode must not already execute its deck-top movement.
  expect(chosen.players[owner].deck).toEqual(state.players[owner].deck)
  expect(chosen.players[owner].supportArea).toEqual(state.players[owner].supportArea)
  const resolve:GameCommand={kind:'resolve-faint-effect',playerId:owner,targetIds:[]}
  const finished=applyGameCommand(chosen,resolve)
  expect(finished.pendingFaintEffects??[]).toHaveLength(0)
  expect(finished.players[owner].supportArea).toHaveLength(state.players[owner].supportArea.length+(modeIndex===0?1:0))
  if(modeIndex===0)expect(finished.players[owner].supportArea.at(-1)).toEqual({card:state.players[owner].deck[0],rested:true})
  expect(replay(initial,[...commands,mode,resolve])).toEqual(finished)
 })
 for(const level of [3,4,5] satisfies AiLevel[])it(`Lv${level} selects a mode and completes it using real parent commands`,()=>{
  const {initial,state,commands}=parent(),before=structuredClone(state)
  const chosen=takeAiStep(state,owner,{level,seed:1})
  expect(chosen.error).toBeUndefined();expect(state).toEqual(before)
  expect(lastCommand(chosen.state)).toMatchObject({kind:'resolve-choose-one',playerId:owner,modeIndex:0})
  const finished=takeAiStep(chosen.state,owner,{level,seed:1})
  expect(finished.error).toBeUndefined()
  expect(lastCommand(finished.state)).toMatchObject({kind:'resolve-faint-effect',playerId:owner})
  expect(finished.state.pendingFaintEffects??[]).toHaveLength(0)
  expect(replay(initial,[...commands,lastCommand(chosen.state),lastCommand(finished.state)])).toEqual(finished.state)
 })
 for(const level of [3,4,5] satisfies AiLevel[])it(`Lv${level} mode choice is invariant under hidden deck / HP identity permutation`,()=>{
  const {state}=parent(),changed=structuredClone(state),p=changed.players[owner]
  const top=required(p.deck[0],'unknown deck top'),bottom=required(p.deck.at(-1),'unknown deck bottom')
  p.deck[0]=bottom;p.deck[p.deck.length-1]=top
  const bearer=required(p.battleArea.find(cookie=>cookie.hpCards.length>0),'unknown HP bearer')
  const hp=required(bearer.hpCards[0],'unknown HP'),newTop=required(p.deck[0],'new unknown top')
  bearer.hpCards[0]=newTop;p.deck[0]=hp
  expect(createPlayerView(changed,owner)).toEqual(createPlayerView(state,owner))
  const original=takeAiStep(state,owner,{level,seed:1}),permuted=takeAiStep(changed,owner,{level,seed:1})
  expect(original.error).toBeUndefined();expect(permuted.error).toBeUndefined()
  expect(lastCommand(original.state)).toEqual(lastCommand(permuted.state))
 })
})
