import { describe, expect, it } from 'vitest'
import { createSt6010PreviewState } from './st6-010-demo'
import { takeAiStep } from './ai'
import { applyGameCommand } from './commands'

describe('ST6-010 AI paid Blocker against a real lethal attack', () => {
  it.each([4, 5] as const)('Lv.%s redirects a lethal attack from GingerBrave without resting Peperoncino', level => {
    const state = createSt6010PreviewState('low'), before = structuredClone(state)
    const own = state.players['player-one']
    expect(own.battleArea[0].hpCards).toHaveLength(3)
    expect(own.battleArea[1].hpCards).toHaveLength(1)
    expect(state.pendingBattle?.declaredDamage).toBe(1)
    const decision = takeAiStep(state, 'player-one', { level, seed: 2026101110, searchNow: () => 0 })
    const command = decision.state.commandLog?.slice(state.commandLog?.length ?? 0)
      .find(entry => entry.commandKind === 'play-blocker')?.payload
    expect(command?.kind).toBe('play-blocker')
    if (command?.kind !== 'play-blocker') throw new Error('Expected paid Blocker')
    expect(command.sourceInstanceId).toBe(own.battleArea[0].card.instanceId)
    expect(command.paymentIds).toHaveLength(1)
    if (!Array.isArray(command.paymentIds)) throw new Error('Expected actual payment IDs')
    const paymentId = command.paymentIds[0]
    if (typeof paymentId !== 'string') throw new Error('Expected a payment instance ID')
    expect(own.supportArea.find(s => s.card.instanceId === paymentId)?.card.energyColor).toBe('red')
    expect(decision.state.pendingBattle?.targetInstanceId).toBe(own.battleArea[0].card.instanceId)
    const settled = applyGameCommand(decision.state, { kind: 'resolve-battle', playerId: 'player-two' })
    expect(settled.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
    expect(settled.players['player-one'].battleArea[0].rested).toBe(false)
    expect(settled.players['player-one'].battleArea[1]).toEqual(own.battleArea[1])
    expect(state).toEqual(before)
  })
})
