import { describe, expect, it } from 'vitest'
import { createBs12MelodyDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canPlayItem } from './card-abilities'
import { getTrashToSupportCandidates } from './effects'
import { hasPendingCardResolution } from './pending'
import { selectEnergyPayment } from './energy'
import { describeCommandSteps } from './command-log'

const playerId = 'player-one' as const
const itemId = 'bs12-050-item'
type State = ReturnType<typeof createBs12MelodyDemoState>
const begin = (state: State, paymentIds = [0, 1, 2].map(i => `bs12-050-support-${i}`)) => applyGameCommand(state, { kind: 'begin-play-item', playerId, instanceId: itemId, paymentIds })
const resolve = (state: State, ids: string[] = []) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds: ids })

describe('BS12-050 fixed GGG optional Arena Cookie trash recovery into rested support', () => {
  it('keeps fixtures local', () => {
    expect(parseTestStateConfig('?test-state=bs12-050:positive', 'localhost')).toEqual({ kind: 'bs12-050', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-050:positive', 'example.com')).toBeNull()
  })
  it.each([0, 1, 2, 3])('recovers own Arena Cookie of any color/level after actual GGG payment: %s', i => {
    const before = createBs12MelodyDemoState()
    const snapshot = structuredClone(before)
    expect(canPlayItem(before, playerId, itemId)).toBe(true)
    const paid = begin(before)
    expect(paid.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(paid.players[playerId].hand).toEqual([])
    expect(paid.players[playerId].discardPile.at(-1)?.instanceId).toBe(itemId)
    expect(paid.players[playerId].discardPile).toHaveLength(8)
    const target = before.players[playerId].discardPile[i]
    const after = resolve(paid, [target.instanceId])
    expect(after.players[playerId].supportArea.at(-1)).toEqual({ card: target, rested: true })
    expect(after.players[playerId].supportArea).toHaveLength(5)
    expect(after.players[playerId].discardPile.map(c => c.instanceId)).toEqual([...before.players[playerId].discardPile.filter(c => c !== target).map(c => c.instanceId), itemId])
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(after.cookiesPlayedFromSupportThisTurn?.[playerId]).not.toBe(true)
    expect(selectEnergyPayment({ neutral: 1 }, after.players[playerId].supportArea)).toBeNull()
    expect(hasPendingCardResolution(after)).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it.each(['empty-trash', 'non-arena-only', 'opponent-only', 'battle-only', 'last-deck'] as const)('may pay and choose zero without drawing or changing another zone: %s', scenario => {
    const before = createBs12MelodyDemoState(scenario)
    expect(canPlayItem(before, playerId, itemId)).toBe(true)
    const paid = begin(before)
    const after = resolve(paid)
    expect(after.players[playerId].supportArea).toEqual(paid.players[playerId].supportArea)
    expect(after.players[playerId].discardPile).toEqual(paid.players[playerId].discardPile)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.pendingRefresh).toBeNull()
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('shares Cookie and Arena intersection with UI/AI candidates and normal movement restrictions', () => {
    const paid = begin(createBs12MelodyDemoState())
    const effect = paid.pendingAbilityEffect!.effects[0]
    if (effect.kind !== 'trash-to-support') throw new Error('Missing recovery')
    const context = { sourcePlayerId: playerId, sourceInstanceId: itemId }
    expect(getTrashToSupportCandidates(paid, context, effect).map(c => c.instanceId)).toEqual([0, 1, 2, 3].map(i => `bs12-050-trash-${i}`))
    expect(getTrashToSupportCandidates(paid, context, { ...effect, energyColor: 'blue' }).map(c => c.instanceId)).toEqual(['bs12-050-trash-2'])
    expect(getTrashToSupportCandidates(paid, context, { ...effect, minLevel: 3 }).every(c => c.type === 'cookie' && c.level >= 3)).toBe(true)
    // Other cards with unrestricted recovery retain their prior behavior.
    expect(getTrashToSupportCandidates(paid, context, { ...effect, keyword: undefined }).map(c => c.instanceId)).toContain('bs12-050-trash-4')
    expect(getTrashToSupportCandidates(paid, context, { ...effect, cookieOnly: false }).map(c => c.instanceId)).toContain(itemId)
  })
  it.each(['bs12-050-trash-4', 'bs12-050-trash-5', 'bs12-050-trash-6', itemId, 'unknown', 'bs12-050-support-0', 'bs12-044-source'])('rejects non-Arena/non-Cookie/wrong-zone target %s', id => {
    expect(() => resolve(begin(createBs12MelodyDemoState()), [id])).toThrow()
  })
  it('rejects the opponent Arena Cookie and two distinct selected Cookies', () => {
    expect(() => resolve(begin(createBs12MelodyDemoState('opponent-only')), ['bs12-050-opponent-trash'])).toThrow()
    expect(() => resolve(begin(createBs12MelodyDemoState()), ['bs12-050-trash-0', 'bs12-050-trash-2'])).toThrow()
  })
  it('records actual public recovery and an explicit zero-selection result', () => {
    const before = begin(createBs12MelodyDemoState())
    const selected = { kind: 'resolve-ability-effect' as const, playerId, targetIds: ['bs12-050-trash-2'] }
    const steps = describeCommandSteps(before, applyGameCommand(before, selected), selected)!
    expect(steps.some(s => /1 張卡移入支援區（疲勞）：Stardust Cookie/.test(s.text))).toBe(true)
    expect(steps.flatMap(s => s.cards ?? []).some(c => c.instanceId === 'bs12-050-trash-2')).toBe(true)
    const zero = { ...selected, targetIds: [] }
    expect(describeCommandSteps(before, applyGameCommand(before, zero), zero)!.some(s => /選擇 0 張，此段未移動卡牌/.test(s.text))).toBe(true)
  })
  it.each(['no-energy', 'wrong-energy', 'few-energy', 'rested-energy', 'opponent-turn', 'outside-main'] as const)('blocks payment or timing %s', scenario => {
    const before = createBs12MelodyDemoState(scenario)
    expect(canPlayItem(before, playerId, itemId)).toBe(false)
    expect(() => begin(before)).toThrow()
  })
})
