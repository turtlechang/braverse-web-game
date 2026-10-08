import { describe, expect, it } from 'vitest'
import { createBs12AttackDemoState, createBs12FlipDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'

const resolve = (scenario: 'positive' | 'no-hand' | 'no-arena', targetIds: string[], activate = true) => {
  const before = createBs12FlipDemoState(scenario)
  const after = applyGameCommand(before, { kind: 'resolve-flip', playerId: 'player-one', activate,
    discardHandIds: activate ? ['bs12-flip-hand-cost'] : [], targetIds })
  return { before, after }
}

describe('BS12-001 and 002 real command paths', () => {
  it('uses a candidate-only localhost route and mixed neutral payment', () => {
    expect(parseTestStateConfig('?test-state=bs12-attack:BS12-001:positive', 'localhost')).toEqual({ kind: 'bs12-attack', cardNumber: 'BS12-001', payable: true })
    expect(parseTestStateConfig('?test-state=bs12-attack:BS12-001:positive', 'example.com')).toBeNull()
    const state = createBs12AttackDemoState('BS12-001', true)
    const supports = state.players['player-one'].supportArea
    expect(supports.map(({ card }) => card.energyColor)).toEqual(['yellow', 'green', 'blue'])
    expect(createBs12AttackDemoState('BS12-001', false).players['player-one'].supportArea).toHaveLength(2)
  })
  it.each([
    ['BS12-001', false, true], ['BS12-002', true, false],
    ['BS12-002', false, true], ['BS12-004', true, false],
  ] as const)('rejects %s payment with wrong colour=%s or rested=%s', (number, wrongColor, rested) => {
    const state = createBs12AttackDemoState(number, true, wrongColor, rested)
    expect(() => applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one',
      attackerInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
      targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
      supportPaymentIds: state.players['player-one'].supportArea.map(({ card }) => card.instanceId),
    })).toThrow()
  })

  it('pays one hand card, gains one HP from deck and discards the revealed FLIP', () => {
    const { before, after } = resolve('positive', ['bs12-flip-bearer'])
    expect(before.pendingBattle?.stage).toBe('flip')
    expect(before.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
    expect(after.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
    expect(after.players['player-one'].battleArea[1].hpCards).toHaveLength(3)
    expect(after.players['player-one'].deck).toHaveLength(9)
    expect(after.players['player-one'].hand).toHaveLength(0)
    expect(after.players['player-one'].discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining(['bs12-flip-hand-cost', 'bs12-flip-revealed']))
    expect(before.players['player-one'].hand).toHaveLength(1)
  })

  it('rejects a non-Arena target even when the discard payment is valid', () => {
    expect(() => resolve('positive', ['bs12-non-arena'])).toThrow()
  })

  it('rejects a missing hand cost while retaining the valid Arena target', () => {
    expect(() => resolve('no-hand', ['bs12-flip-bearer'])).toThrow()
  })

  it('allows zero targets but still pays the selected hand cost', () => {
    const { after } = resolve('positive', [])
    expect(after.players['player-one'].battleArea.map((entry) => entry.hpCards.length)).toEqual([1, 3])
    expect(after.players['player-one'].hand).toHaveLength(0)
    expect(after.players['player-one'].deck).toHaveLength(10)
  })

  it('declines without paying and clears the FLIP window', () => {
    const { after } = resolve('positive', [], false)
    expect(after.players['player-one'].hand).toHaveLength(1)
    expect(after.players['player-one'].deck).toHaveLength(10)
    expect(after.pendingBattle?.stage).not.toBe('flip')
  })
  it('can heal the other Arena Cookie, but rejects selecting both legal targets', () => {
    const before = createBs12FlipDemoState('two-targets')
    const command = { kind: 'resolve-flip' as const, playerId: 'player-one' as const, activate: true, discardHandIds: ['bs12-flip-hand-cost'] }
    const after = applyGameCommand(before, { ...command, targetIds: ['bs12-arena-companion'] })
    expect(after.players['player-one'].battleArea.map((entry) => entry.hpCards.length)).toEqual([1, 4])
    expect(() => applyGameCommand(before, { ...command, targetIds: ['bs12-flip-bearer', 'bs12-arena-companion'] })).toThrow()
    expect(() => applyGameCommand(before, { ...command, targetIds: ['bs12-arena-companion', 'bs12-arena-companion'] })).toThrow()
  })
})

describe('BS12-004 FLIP count and colour condition', () => {
  it.each([
    ['BS12-002', 'positive'], ['BS12-002', 'two-targets'],
    ['BS12-004', 'positive'], ['BS12-004', 'no-arena'], ['BS12-004', 'wrong-color'], ['BS12-004', 'two-targets'],
  ] as const)('starts with the printed one-HP Pink Choco attacker for %s %s', (number, scenario) => {
    const before = createBs12FlipDemoState(scenario, number)
    const attacker = before.players['player-two'].battleArea[0]
    expect(attacker.card).toMatchObject({ id: 'BS6-017', name: 'Pink Choco Cookie', hp: 1 })
    expect(attacker.hpCards).toHaveLength(attacker.card.hp)
  })
  it('faints the printed one-HP Pink Choco when both friendly Cookies are red Arena', () => {
    const before = createBs12FlipDemoState('positive', 'BS12-004')
    expect(before.pendingBattle?.stage).toBe('flip')
    const attacker = before.players['player-two'].battleArea[0]
    expect(attacker.card).toMatchObject({ id: 'BS6-017', name: 'Pink Choco Cookie', hp: 1 })
    expect(attacker.hpCards).toHaveLength(1)
    const other = before.players['player-two'].battleArea[1]
    expect(other.card).toMatchObject({ id: 'BS12-019', name: 'Muscle Cookie', hp: 4 })
    expect(other.hpCards).toHaveLength(other.card.hp)
    let after = applyGameCommand(before, { kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [], targetIds: ['bs12-flip-attacker'] })
    expect(after.players['player-two'].battleArea.map((cookie) => cookie.card.instanceId)).toEqual(['bs12-opponent-other'])
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
    expect(after.players['player-two'].breakArea.map((card) => card.instanceId)).toContain('bs12-flip-attacker')
    expect(after.players['player-two'].discardPile).toEqual([...attacker.hpCards].reverse())
    expect(after.pendingReplacement?.tasks).toEqual([{ playerId: 'player-two', remaining: 1 }])
    after = applyGameCommand(after, { kind: 'skip-replacement', playerId: 'player-two' })
    expect(after.pendingReplacement).toBeNull()
    expect(after.pendingBattle).toBeNull()
    expect(after.status).toBe('playing')
    expect(after.players['player-two'].battleArea.map((cookie) => cookie.card.instanceId)).toEqual(['bs12-opponent-other'])
    expect(after.players['player-one'].hand).toHaveLength(1)
  })
  it.each(['no-arena', 'wrong-color'] as const)('blocks %s while retaining both Cookies and all resources', (scenario) => {
    const state = createBs12FlipDemoState(scenario, 'BS12-004')
    expect(state.players['player-one'].battleArea).toHaveLength(2)
    expect(state.players['player-two'].battleArea[0].card).toMatchObject({ id: 'BS6-017', name: 'Pink Choco Cookie', hp: 1 })
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
    const companion = state.players['player-one'].battleArea[1]
    expect(companion.card).toMatchObject(scenario === 'wrong-color'
      ? { id: 'BS12-024', name: 'GingerBrave', hp: 2 }
      : { id: 'ST4-001', name: 'Candy Diver Cookie', hp: 3 })
    expect(companion.hpCards).toHaveLength(companion.card.hp)
    expect(state.pendingBattle?.stage).not.toBe('flip')
    expect(state.players['player-one'].discardPile.some((card) => card.id === 'BS12-004')).toBe(true)
  })
  it('does not damage on optional zero selection', () => {
    const before = createBs12FlipDemoState('positive', 'BS12-004')
    const after = applyGameCommand(before, { kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [], targetIds: [] })
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
    expect(after.players['player-two'].battleArea[0].card.id).toBe('BS6-017')
  })
  it('damages only the selected other opponent when both targets are legal', () => {
    const before = createBs12FlipDemoState('two-targets', 'BS12-004')
    const pinkChoco = before.players['player-two'].battleArea[0]
    const other = before.players['player-two'].battleArea[1]
    expect(pinkChoco.card).toMatchObject({ id: 'BS6-017', name: 'Pink Choco Cookie', hp: 1 })
    expect(pinkChoco.hpCards).toHaveLength(1)
    expect(other.card).toMatchObject({ id: 'BS12-019', hp: 4 })
    expect(other.hpCards).toHaveLength(4)
    const after = applyGameCommand(before, { kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [], targetIds: ['bs12-opponent-other'] })
    expect(after.players['player-two'].battleArea.map((cookie) => cookie.card.instanceId)).toEqual(['bs12-flip-attacker', 'bs12-opponent-other'])
    expect(after.players['player-two'].battleArea.map((cookie) => cookie.hpCards.length)).toEqual([1, 3])
    expect(after.players['player-two'].discardPile).toEqual([...other.hpCards].reverse().slice(0, 1))
  })
  it('rejects two otherwise legal opponents and a friendly target', () => {
    const before = createBs12FlipDemoState('two-targets', 'BS12-004')
    const command = { kind: 'resolve-flip' as const, playerId: 'player-one' as const, activate: true, discardHandIds: [] }
    expect(() => applyGameCommand(before, { ...command, targetIds: ['bs12-flip-attacker', 'bs12-opponent-other'] })).toThrow()
    expect(() => applyGameCommand(before, { ...command, targetIds: ['bs12-flip-bearer'] })).toThrow()
  })
})
