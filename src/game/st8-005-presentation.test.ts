import { describe, expect, it } from 'vitest'
import { fixture, declare, openThen } from './st8-005-demo'
import { applyGameCommand } from './commands'

describe('ST8-005 support REST and damage presentation', () => {
  it.each([0, 1, 2])('separates %i support cards from the opponent damage target', count => {
    const state = openThen()
    const supports = state.players['player-one'].supportArea.slice(3, 3 + count)
    const target = state.players['player-two'].battleArea[0]
    const next = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-one',
      targetIds: [...supports.map(s => s.card.instanceId), target.card.instanceId] })
    const entry = next.commandLog!.at(-1)!
    const supportStep = entry.steps?.find(step => step.text.startsWith('攻擊後效果額外橫置支援：'))
    const damageStep = entry.steps?.find(step => step.text.startsWith('攻擊後效果傷害目標：'))
    expect(supportStep).toBeDefined()
    expect(damageStep?.cards?.map(card => card.instanceId)).toEqual([target.card.instanceId])
    expect(supportStep?.cards?.map(card => card.instanceId) ?? []).toEqual(supports.map(s => s.card.instanceId))
    expect(next.players['player-one'].battleArea.map(c => c.hpCards)).toEqual(state.players['player-one'].battleArea.map(c => c.hpCards))
    const rests = entry.presentation?.filter(event => event.kind === 'rest' && event.source?.zone === 'support') ?? []
    expect(rests).toHaveLength(count)
    expect(rests.every(event => event.target === undefined)).toBe(true)
    expect(entry.presentation?.filter(event => event.kind === 'hp' && event.amount! < 0)
      .every(event => event.target?.playerId === 'player-two')).toBe(true)
  })

  it('records support-only selection without calling the support a damage target', () => {
    const state = openThen(), support = state.players['player-one'].supportArea[3]
    const next = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [support.card.instanceId] })
    const details = next.commandLog!.at(-1)!.steps ?? []
    expect(details).toContainEqual(expect.objectContaining({ text: '攻擊後效果傷害目標：未選擇餅乾（0 張）' }))
    expect(next.players['player-one'].battleArea.map(c => c.hpCards)).toEqual(state.players['player-one'].battleArea.map(c => c.hpCards))
    expect(next.players['player-two'].battleArea).toEqual(state.players['player-two'].battleArea)
  })

  it('shows effect REST on the support rather than sending it toward the attacking Cookie', () => {
    const state = openThen(), support = state.players['player-one'].supportArea[3]
    const next = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-one',
      targetIds: [support.card.instanceId, state.players['player-two'].battleArea[0].card.instanceId] })
    const rest = next.commandLog!.at(-1)!.presentation?.find(event => event.kind === 'rest' && event.source?.zone === 'support')
    expect(rest?.source?.instanceId).toBe(support.card.instanceId)
    expect(rest?.target).toBeUndefined()
  })

  it('preserves the existing energy-payment animation toward the attacker', () => {
    const state = fixture(), next = declare(state)
    const rests = next.commandLog!.at(-1)!.presentation?.filter(event => event.kind === 'rest' && event.source?.zone === 'support') ?? []
    expect(rests).toHaveLength(3)
    expect(rests.every(event => event.target?.instanceId === state.players['player-one'].battleArea[0].card.instanceId)).toBe(true)
  })
})
