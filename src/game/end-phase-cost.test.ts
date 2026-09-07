import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createEndPhaseCostState as scenario } from './test-helpers/end-phase-helpers'
import { takeAiStep } from './ai'
import { isClientMessage } from '../net/onlineProtocol'
import { replayCommandLog } from './replay'
import type { GameState } from './types'
const end = (state: GameState) => applyGameCommand(state, {kind:'advance-phase',playerId:'player-one'})

describe('end-phase skill costs', () => {
  it.each(['P-058','P-145'])('%s never resolves for free without resources', id => {
    const initial = scenario(id)
    const next = end(initial)
    expect(next.players['player-one'].supportArea).toHaveLength(0)
    expect(next.players['player-one'].deck).toEqual(initial.players['player-one'].deck)
    expect(next.players['player-one'].discardPile).toHaveLength(0)
    expect(next.pendingAbilityEffect).toMatchObject({trigger:'passive',awaitingActivation:true})
    expect(() => applyGameCommand(next,{kind:'resolve-ability-effect',playerId:'player-one',targetIds:[]})).toThrow()
    expect(() => applyGameCommand(next,{kind:'begin-activate-skill',playerId:'player-one',sourceInstanceId:'end-source',trigger:'passive',paymentIds:[]})).toThrow()
  })

  it('P-058 can be declined without removing supports or drawing new ones', () => {
    const initial = scenario('P-058',['BS8-020','BS8-020'])
    const pending = end(initial)
    expect(pending.players['player-one']).toEqual(initial.players['player-one'])
    const skipped = applyGameCommand(pending,{kind:'skip-end-phase-skill',playerId:'player-one',sourceInstanceId:'end-source'})
    expect(skipped.players['player-one']).toEqual(initial.players['player-one'])
    expect(skipped.pendingAbilityEffect).toBeUndefined()
    expect(end(skipped).activePlayerId).toBe('player-two')
  })

  it('P-058 requires both selected supports before adding two active supports', () => {
    const pending = end(scenario('P-058',['BS8-020','BS8-020']))
    const begin = (costSupportToTrashIds: string[]) => applyGameCommand(pending,{kind:'begin-activate-skill',playerId:'player-one',sourceInstanceId:'end-source',trigger:'passive',paymentIds:[],costSupportToTrashIds})
    expect(() => begin(['pay-0'])).toThrow()
    expect(() => begin(['pay-0','pay-0'])).toThrow()
    const paid = begin(['pay-0','pay-1'])
    expect(paid.players['player-one'].supportArea).toHaveLength(0)
    expect(paid.players['player-one'].discardPile.map(card=>card.instanceId)).toEqual(['pay-0','pay-1'])
    const resolved = applyGameCommand(paid,{kind:'resolve-ability-effect',playerId:'player-one',targetIds:[]})
    expect(resolved.players['player-one'].supportArea.map(support=>support.card.instanceId)).toEqual(['deck-0','deck-1'])
    expect(resolved.players['player-one'].supportArea.every(support=>!support.rested)).toBe(true)
    expect(resolved.players['player-one'].deck).toHaveLength(10)
    expect(end(resolved).activePlayerId).toBe('player-two')
  })

  it('P-145 rests a purple support, rejects a red support, then mills three', () => {
    const pending = end(scenario('P-145',['BS8-103','BS8-020']))
    const begin = (paymentIds: string[]) => applyGameCommand(pending,{kind:'begin-activate-skill',playerId:'player-one',sourceInstanceId:'end-source',trigger:'passive',paymentIds})
    expect(() => begin(['pay-1'])).toThrow()
    const paid = begin(['pay-0'])
    expect(paid.players['player-one'].supportArea.map(support=>support.rested)).toEqual([true,false])
    expect(paid.players['player-one'].deck).toHaveLength(12)
    const resolved = applyGameCommand(paid,{kind:'resolve-ability-effect',playerId:'player-one',targetIds:[]})
    expect(resolved.players['player-one'].deck).toHaveLength(9)
    expect(resolved.players['player-one'].discardPile).toHaveLength(3)
  })

  it('rejects the wrong actor and passive activation outside the queued end phase', () => {
    const initial = scenario('P-145',['BS8-103'])
    expect(() => applyGameCommand(initial,{kind:'begin-activate-skill',playerId:'player-one',sourceInstanceId:'end-source',trigger:'passive',paymentIds:['pay-0']})).toThrow()
    const pending = end(initial)
    expect(() => applyGameCommand(pending,{kind:'skip-end-phase-skill',playerId:'player-two',sourceInstanceId:'end-source'})).toThrow()
    expect(() => applyGameCommand(pending,{kind:'skip-end-phase-skill',playerId:'player-one',sourceInstanceId:'wrong-source'})).toThrow()
    expect(() => end(pending)).toThrow()
    expect(() => applyGameCommand(pending,{kind:'resolve-choose-one',playerId:'player-one',modeIndex:0})).toThrow()
  })

  it.each([1, 2, 3, 4, 5] as const)('AI level %i pays or declines each formal end-phase cost and continues', (level) => {
    for (const id of ['P-058', 'P-145']) {
      const unpaid = end(scenario(id))
      const declined = takeAiStep(unpaid, 'player-one', { level }).state
      expect(declined).not.toBe(unpaid)
      expect(declined.pendingAbilityEffect).toBeUndefined()
      expect(declined.players).toEqual(unpaid.players)
      expect(end(declined).activePlayerId).toBe('player-two')

      const pending = end(scenario(id, ['BS8-103', 'BS8-020']))
      const paid = takeAiStep(pending, 'player-one', { level }).state
      expect(paid.pendingAbilityEffect?.awaitingActivation).toBeUndefined()
      expect(paid.players['player-one'].deck).toHaveLength(12)
      const resolved = takeAiStep(paid, 'player-one', { level }).state
      expect(resolved.pendingAbilityEffect).toBeUndefined()
      expect(resolved.players['player-one'].deck).toHaveLength(id === 'P-058' ? 10 : 9)
      if (id === 'P-058') expect(resolved.players['player-one'].discardPile.map((card) => card.instanceId)).toEqual(['pay-0', 'pay-1'])
      else expect(resolved.players['player-one'].supportArea.map((entry) => entry.rested)).toEqual([true, false])
      expect(end(resolved).activePlayerId).toBe('player-two')
    }
  })

  it('online accepts only the dedicated queued passive payment and decline command shapes', () => {
    const command = { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: 'end-source', trigger: 'passive', paymentIds: ['pay-0'] }
    expect(isClientMessage({ type: 'submit-command', command })).toBe(true)
    expect(isClientMessage({ type: 'submit-command', command: { ...command, kind: 'activate-skill' } })).toBe(false)
    expect(isClientMessage({ type: 'submit-command', command: { kind: 'skip-end-phase-skill', playerId: 'player-one', sourceInstanceId: 'end-source' } })).toBe(true)
  })

  it.each(['pay', 'skip'])('replays the %s decision with the same resources and turn continuation', (choice) => {
    const initial = scenario('P-145', ['BS8-103'])
    const pending = end(initial)
    const decided = applyGameCommand(pending, choice === 'pay'
      ? { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: 'end-source', trigger: 'passive', paymentIds: ['pay-0'] }
      : { kind: 'skip-end-phase-skill', playerId: 'player-one', sourceInstanceId: 'end-source' })
    const resolved = choice === 'pay'
      ? applyGameCommand(decided, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
      : decided
    expect(resolved.commandLog?.some((entry) => entry.summary?.includes('回合結束效果'))).toBe(true)
    const finished = end(resolved)
    expect(replayCommandLog(initial, finished.commandLog ?? [])).toEqual(finished)
  })
})
