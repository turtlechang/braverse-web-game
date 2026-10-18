import { describe, expect, it } from 'vitest'
import { createSt6012PreviewState } from './st6-012-demo'
import { takeAiStep } from './ai'

describe('ST6-012 AI actual paid named HP gain', () => {
  it.each([4,5] as const)('Lv.%s heals the one-HP Fire Spirit with one R', level => {
    const state = createSt6012PreviewState('low'), before = structuredClone(state), own = state.players['player-one']
    expect(own.battleArea[1].hpCards).toHaveLength(1)
    const decision = takeAiStep(state,'player-one',{level,seed:2026101112,searchNow:()=>0})
    const command = decision.state.commandLog?.slice(state.commandLog?.length ?? 0)
      .find(entry => entry.commandKind === 'activate-skill')?.payload
    expect(decision.action).toBe('activate-skill')
    if (command?.kind !== 'activate-skill') throw new Error('Expected actual paid skill')
    expect(command.sourceInstanceId).toBe(own.battleArea[0].card.instanceId)
    expect(command.effectTargets).toEqual([[own.battleArea[1].card.instanceId]])
    expect(command.paymentIds).toEqual([own.supportArea[0].card.instanceId])
    expect(decision.state.players['player-one'].battleArea[1].hpCards)
      .toEqual([...own.battleArea[1].hpCards,own.deck[0]])
    expect(decision.state.players['player-one'].supportArea[0].rested).toBe(true)
    expect(decision.state.players['player-one'].battleArea[0].rested).toBe(false)
    expect(state).toEqual(before)
  })
})
