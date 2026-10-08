import { describe, expect, it } from 'vitest'
import { createBs12MangoDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill, getCookieSkillUnavailableReason } from './skills'
import { describeCommandSteps } from './command-log'
import { recordArenaBreakEntries } from './helpers'

const playerId = 'player-one' as const
const sourceId = 'bs12-021-source'
const enter = (before: ReturnType<typeof createBs12MangoDemoState>) => applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceId })
const command = { kind: 'activate-skill' as const, playerId, sourceInstanceId: sourceId, trigger: 'on-play' as const, paymentIds: [], effectTargets: [[sourceId]] }

describe.each(['BS12-021', 'BS12-021@1'] as const)('%s real Mango entry and skill', number => {
  it('keeps candidate route local and original art per printing', () => {
    expect(parseTestStateConfig(`?test-state=bs12-021:${number}:positive`, 'localhost')).toEqual({ kind: 'bs12-021', cardNumber: number, scenario: 'positive' })
    expect(parseTestStateConfig(`?test-state=bs12-021:${number}:positive`, 'example.com')).toBeNull()
  })
  it.each(['positive', 'faint', 'green-arena', 'hand-break', 'removed-break', 'no-energy', 'rested-support', 'refresh'] as const)('adds exactly one top HP after ordinary two-HP entry: %s', scenario => {
    const before = createBs12MangoDemoState(scenario, number)
    const snapshot = structuredClone(before)
    const entered = enter(before)
    expect(entered.players[playerId].battleArea.at(-1)?.hpCards).toEqual(before.players[playerId].deck.slice(0, 2))
    expect(entered.players[playerId].deck).toEqual(before.players[playerId].deck.slice(2))
    expect(canActivateCookieSkill(entered, playerId, sourceId, 'on-play')).toBe(true)
    const after = applyGameCommand(entered, command)
    expect(after.players[playerId].battleArea.at(-1)?.hpCards).toEqual(before.players[playerId].deck.slice(0, 3))
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(3))
    expect(after.players[playerId].battleArea[0]).toEqual(before.players[playerId].battleArea[0])
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players[playerId].discardPile).toEqual(before.players[playerId].discardPile)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(after.players[playerId].hand).toEqual([])
    expect(after.pendingOnPlay).toBeNull()
    expect(describeCommandSteps(entered, after, command)?.some(step => /Mango Cookie.*增加 1 點 HP/.test(step.text))).toBe(true)
    expect(before).toEqual(snapshot)
  })
  it.each(['old-break', 'previous-turn', 'non-arena', 'opponent-break', 'trash-arena', 'no-event'] as const)('does not gain HP from false history: %s', scenario => {
    const entered = enter(createBs12MangoDemoState(scenario, number))
    const before = structuredClone(entered)
    expect(canActivateCookieSkill(entered, playerId, sourceId, 'on-play')).toBe(false)
    expect(getCookieSkillUnavailableReason(entered, playerId, sourceId, 'on-play')).toContain('本回合尚未有我方【Arena】餅乾進入休息區')
    expect(() => applyGameCommand(entered, command)).toThrow()
    const after = applyGameCommand(entered, { kind: 'skip-on-play', playerId, sourceInstanceId: sourceId })
    expect(after.players).toEqual(entered.players)
    expect(after.players[playerId].battleArea.at(-1)?.hpCards).toHaveLength(2)
    expect(after.pendingOnPlay).toBeNull()
    expect(entered).toEqual(before)
  })
  it('allows skipping a true On Play without undoing normal HP setup', () => {
    const before = enter(createBs12MangoDemoState('positive', number))
    const after = applyGameCommand(before, { kind: 'skip-on-play', playerId, sourceInstanceId: sourceId })
    expect(after.players).toEqual(before.players)
    expect(after.pendingOnPlay).toBeNull()
  })
  it('records actual +1 HP through the same begin/resolve commands used by the UI without showing new HP identities', () => {
    const entered = enter(createBs12MangoDemoState('positive', number))
    const begun = applyGameCommand(entered, { kind: 'begin-activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'on-play', paymentIds: [] })
    const resolve = { kind: 'resolve-ability-effect' as const, playerId, targetIds: [sourceId] }
    const after = applyGameCommand(begun, resolve)
    expect(after.players[playerId].battleArea.at(-1)?.hpCards).toHaveLength(3)
    const steps = describeCommandSteps(begun, after, resolve) ?? []
    expect(steps.some(step => /Mango Cookie.*增加 1 點 HP/.test(step.text))).toBe(true)
    expect(steps.flatMap(step => step.cards ?? []).some(card => card.instanceId.startsWith('bs12-021-deck-'))).toBe(false)
  })
  it('Your Turn prevents a real opponent-turn effect deployment from gaining HP', () => {
    const before = createBs12MangoDemoState('opponent-turn', number)
    expect(before.pendingOnPlay?.sourceInstanceId).toBe(sourceId)
    expect(before.players[playerId].battleArea.at(-1)?.hpCards).toHaveLength(2)
    expect(canActivateCookieSkill(before, playerId, sourceId, 'on-play')).toBe(false)
    expect(getCookieSkillUnavailableReason(before, playerId, sourceId, 'on-play')).toBe('此技能只能在自己的回合發動。')
    expect(() => applyGameCommand(before, command)).toThrow()
    expect(applyGameCommand(before, { kind: 'skip-on-play', playerId, sourceInstanceId: sourceId }).players).toEqual(before.players)
  })
  it('On Play cannot be reactivated in the main phase or used as Activate', () => {
    const after = applyGameCommand(enter(createBs12MangoDemoState('positive', number)), command)
    expect(canActivateCookieSkill(after, playerId, sourceId, 'on-play')).toBe(false)
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
    expect(() => applyGameCommand(after, command)).toThrow()
  })
  it.each([['bs12-021-ally'], ['bs12-021-opponent'], ['bs12-021-payment-0'], [sourceId, sourceId]].map(ids => ({ ids })))('fixed source-only HP cannot be redirected by extraneous target inputs $ids', ({ ids }) => {
    const before = enter(createBs12MangoDemoState('positive', number))
    const after = applyGameCommand(before, { ...command, effectTargets: [ids] })
    expect(after.players[playerId].battleArea.at(-1)?.hpCards).toHaveLength(3)
    expect(after.players[playerId].battleArea[0]).toEqual(before.players[playerId].battleArea[0])
    expect(after.players['player-two']).toEqual(before.players['player-two'])
  })
  it.each(['wrong-energy', 'few-energy'] as const)('rejects illegal YY attack: %s', scenario => {
    const before = createBs12MangoDemoState(scenario, number)
    expect(() => applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-021-opponent', supportPaymentIds: before.players[playerId].supportArea.map(s => s.card.instanceId) })).toThrow()
  })
  it('pays YY, rests the source and both supports, deals ordinary three without Then', () => {
    const before = createBs12MangoDemoState('attack', number)
    let after = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-021-opponent', supportPaymentIds: before.players[playerId].supportArea.map(s => s.card.instanceId) })
    after = applyGameCommand(after, { kind: 'skip-trap', playerId: 'player-two' })
    for (let i = 0; after.pendingBattle?.stage === 'damage' && i < 10; i++) after = applyGameCommand(after, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 4])
    expect(after.players[playerId].battleArea.at(-1)).toMatchObject({ rested: true, hpCards: before.players[playerId].battleArea.at(-1)?.hpCards })
    expect(after.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(after.pendingBattle).toBeNull()
  })
  it('all fixtures obey battle, break-level and same-card copy limits', () => {
    for (const scenario of ['positive', 'faint', 'green-arena', 'hand-break', 'removed-break', 'old-break', 'previous-turn', 'non-arena', 'opponent-break', 'trash-arena', 'no-event', 'opponent-turn', 'no-energy', 'rested-support', 'attack', 'wrong-energy', 'few-energy', 'full-battle', 'refresh'] as const) {
      const state = createBs12MangoDemoState(scenario, number)
      for (const player of Object.values(state.players)) {
        expect(player.battleArea.length).toBeLessThanOrEqual(2)
        expect(player.breakArea.reduce((sum, c) => sum + c.level, 0)).toBeLessThan(10)
        const counts = [...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile,
          ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
          .reduce<Record<string, number>>((result, card) => ({ ...result, [card.id]: (result[card.id] ?? 0) + 1 }), {})
        expect(Math.max(0, ...Object.values(counts))).toBeLessThanOrEqual(4)
      }
    }
  })
})

it('rechecking the same transition does not double count a recorded Arena arrival', () => {
  const before = createBs12MangoDemoState('no-event')
  const after = createBs12MangoDemoState('positive')
  expect(recordArenaBreakEntries(before, after).arenaCookiesPlacedInBreakThisTurn).toEqual(after.arenaCookiesPlacedInBreakThisTurn)
})
