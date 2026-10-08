import { describe, expect, it } from 'vitest'
import { createBs12AngelLightstickDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill, getCookieSkillUnavailableReason } from './skills'
import { executeCardEffect } from './effects/execute'
import { getEffectSelectionCandidates } from './effects/targeting'
import { takeAiStep } from './ai'

type State = ReturnType<typeof createBs12AngelLightstickDemoState>
const declare = (state: State, attacker = 'bs12-062-host') => applyGameCommand(state, {
  kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: attacker,
  targetInstanceId: 'bs12-062-opponent', supportPaymentIds: state.players['player-one'].supportArea.map(s => s.card.instanceId),
})
const activate = (state: State) => applyGameCommand(state, { kind: 'resolve-stage-trigger', playerId: 'player-one', action: 'activate' })
const draw = (state: State, drawCount: number) => applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount })
const finish = (state: State) => {
  let next = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; next.pendingBattle?.stage === 'damage' && i < 12; i++) next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return next
}

describe('BS12-062 isolated equipped-host trigger; no Equip lifecycle ruling', () => {
  it.each(['equipped', 'hand-five', 'hand-zero'] as const)('queues draw before traps/damage without B or a skill use: %s', scenario => {
    const before = createBs12AngelLightstickDemoState(scenario)
    const snapshot = structuredClone(before)
    const declared = declare(before)
    expect(declared.pendingStageTrigger).toMatchObject({ sourceKind: 'cookie-equip', sourceInstanceId: 'bs12-062-source', hostInstanceId: 'bs12-062-host' })
    expect(declared.pendingBattle?.stage).toBe('trap')
    expect(declared.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([6, 4])
    expect(declared.players['player-one'].supportArea.every(s => s.rested)).toBe(true)
    expect(declared.players['player-one'].battleArea[0].rested).toBe(true)
    expect(() => applyGameCommand(declared, { kind: 'skip-trap', playerId: 'player-two' })).toThrow()
    const opened = activate(declared)
    expect(opened.pendingDrawUpTo).toMatchObject({ sourceInstanceId: 'bs12-062-source', max: 2 })
    const after = finish(draw(opened, 2))
    expect(after.players['player-one'].hand).toEqual([...before.players['player-one'].hand, ...before.players['player-one'].deck.slice(0, 2)])
    expect(after.players['player-one'].deck).toEqual(before.players['player-one'].deck.slice(2))
    expect(after.skillUsesThisTurn).toEqual(before.skillUsesThisTurn)
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([5, 4])
    expect(after.pendingBattle).toBeNull()
    expect(before).toEqual(snapshot)
  })
  it.each([0, 1, 2])('allows an independent choice to draw %i with five cards already in hand', count => {
    const before = createBs12AngelLightstickDemoState('hand-five')
    const after = finish(draw(activate(declare(before)), count))
    expect(after.players['player-one'].hand).toHaveLength(5 + count)
    expect(after.players['player-one'].deck).toHaveLength(12 - count)
  })
  it.each(['hand-six', 'no-equipment', 'wrong-host'] as const)('does not queue the trigger: %s', scenario => {
    const before = createBs12AngelLightstickDemoState(scenario)
    const declared = declare(before)
    expect(declared.pendingStageTrigger ?? null).toBeNull()
    const after = finish(declared)
    expect(after.players['player-one'].hand).toEqual(before.players['player-one'].hand)
    expect(after.players['player-one'].deck).toEqual(before.players['player-one'].deck)
  })
  it('can skip the trigger while retaining paid attack and damage', () => {
    const before = createBs12AngelLightstickDemoState()
    const skipped = applyGameCommand(declare(before), { kind: 'resolve-stage-trigger', playerId: 'player-one', action: 'skip' })
    const after = finish(skipped)
    expect(after.players['player-one'].hand).toEqual(before.players['player-one'].hand)
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(5)
  })
  it.each([-1, 3, 1.5, NaN, Infinity])('rejects illegal draw count %s', count => {
    expect(() => draw(activate(declare(createBs12AngelLightstickDemoState())), count)).toThrow()
  })
  it('validates resolving player, attached equipment and pending battle host', () => {
    const declared = declare(createBs12AngelLightstickDemoState())
    expect(() => applyGameCommand(declared, { kind: 'resolve-stage-trigger', playerId: 'player-two', action: 'activate' })).toThrow()
    const detached = { ...declared, players: { ...declared.players, 'player-one': { ...declared.players['player-one'],
      battleArea: declared.players['player-one'].battleArea.map(c => ({ ...c, equippedCards: [] })) } } }
    expect(() => activate(detached)).toThrow()
    expect(() => activate({ ...declared, pendingBattle: { ...declared.pendingBattle!, attackerInstanceId: 'other' } })).toThrow()
  })
  it('ignores a tampered pending effect and resolves current attached metadata', () => {
    const declared = declare(createBs12AngelLightstickDemoState())
    const opened = activate({ ...declared, pendingStageTrigger: { ...declared.pendingStageTrigger!, effects: [{ kind: 'draw-up-to', max: 9 }] } })
    expect(opened.pendingDrawUpTo?.max).toBe(2)
  })
  it('does not reuse the Equip once-per-turn limit for a second readied host attack', () => {
    const before = createBs12AngelLightstickDemoState()
    const first = finish(draw(activate(declare({ ...before, skillUsesThisTurn: ['bs12-062-source'] })), 0))
    const readyHost = executeCardEffect(first, { sourcePlayerId: 'player-one', sourceInstanceId: 'bs12-062-source' },
      { kind: 'set-cookie-active', target: { side: 'self', min: 1, max: 1 } }, ['bs12-062-host'])
    const readied = { ...readyHost, players: { ...readyHost.players, 'player-one': { ...readyHost.players['player-one'],
      supportArea: readyHost.players['player-one'].supportArea.map(s => ({ ...s, rested: false })) } } }
    expect(declare(readied).pendingStageTrigger?.sourceKind).toBe('cookie-equip')
  })
  it('continues remaining draws after Refresh before the paid attack damages', () => {
    const before = createBs12AngelLightstickDemoState('refresh')
    const awaiting = draw(activate(declare(before)), 2)
    expect(awaiting.pendingRefresh).toMatchObject({ playerId: 'player-one', remainingDraws: 1 })
    expect(awaiting.players['player-two'].battleArea[0].hpCards).toHaveLength(6)
    const refreshed = applyGameCommand(awaiting, { kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: 'bs12-062-refresh-cookie' })
    expect(refreshed.pendingRefresh).toBeNull()
    expect(refreshed.players['player-one'].hand).toHaveLength(3)
    expect(refreshed.pendingBattle?.stage).toBe('trap')
    expect(finish(refreshed).players['player-two'].battleArea[0].hpCards).toHaveLength(5)
  })
  it('records ordinary Refresh defeat when last draw has no legal Refresh', () => {
    const after = draw(activate(declare(createBs12AngelLightstickDemoState('short-deck'))), 1)
    expect(after.status).toBe('finished')
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(6)
  })
  it('AI resolves equipment activation, optional draw and attack without a new payment', () => {
    let state = declare(createBs12AngelLightstickDemoState())
    for (let i = 0; (state.pendingStageTrigger || state.pendingDrawUpTo || state.pendingBattle) && i < 30; i++) {
      state = takeAiStep(state, state.pendingStageTrigger || state.pendingDrawUpTo ? 'player-one' : 'player-two', { level: 2 }).state
    }
    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].hand).toHaveLength(3)
  })
  it('serialized public commands retain real equipment source and an explicit unmet-condition trace', () => {
    const before = createBs12AngelLightstickDemoState()
    const declared = declare(before)
    const opened = activate(JSON.parse(JSON.stringify(declared)))
    const after = draw(JSON.parse(JSON.stringify(opened)), 2)
    expect(after.commandLog?.filter(entry => ['resolve-stage-trigger', 'resolve-draw-up-to'].includes(entry.commandKind)).map(entry => entry.card?.id)).toEqual(['BS12-062', 'BS12-062'])
    expect(opened.commandLog?.at(-1)?.summary).toContain('裝備觸發效果')
    expect(declare(createBs12AngelLightstickDemoState('hand-six')).commandLog?.at(-1)?.steps?.some(step => step.text.includes('條件不成立，效果未執行'))).toBe(true)
    expect(after).toEqual(draw(activate(declared), 2))
  })
  it.each(['equipped', 'hand-five', 'hand-six', 'hand-zero', 'no-equipment', 'wrong-host', 'short-deck', 'refresh', 'equip-blocked', 'deploy', 'attack', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn'] as const)('keeps legal field/copy/rest capacity: %s', scenario => {
    for (const player of Object.values(createBs12AngelLightstickDemoState(scenario).players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      expect(player.breakArea.reduce((sum, card) => sum + card.level, 0)).toBeLessThan(10)
      const cards = [...player.hand, ...player.deck, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(s => s.card),
        ...player.battleArea.flatMap(c => [c.card, ...c.hpCards, ...(c.equippedCards ?? [])])]
      const counts = cards.reduce<Record<string, number>>((result, card) => ({ ...result, [card.id]: (result[card.id] ?? 0) + 1 }), {})
      expect(Math.max(0, ...Object.values(counts))).toBeLessThanOrEqual(4)
    }
  })
})

describe('BS12-062 printed ordinary branch and deferred Equip boundary', () => {
  it('deploys exactly three HP then pays BN for ordinary one', () => {
    const before = createBs12AngelLightstickDemoState('deploy')
    const entered = applyGameCommand(before, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: 'bs12-062-source' })
    expect(entered.players['player-one'].battleArea[0].hpCards).toEqual(before.players['player-one'].deck.slice(0, 3))
    const after = finish(declare(entered, 'bs12-062-source'))
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([5, 4])
    expect(after.pendingStageTrigger ?? null).toBeNull()
    expect(parseTestStateConfig('?test-state=bs12-062:equipped', 'localhost')).toEqual({ kind: 'bs12-062', scenario: 'equipped' })
    expect(parseTestStateConfig('?test-state=bs12-062:equipped', 'example.com')).toBeNull()
  })
  it.each(['wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn'] as const)('rejects illegal ordinary attack %s', scenario => {
    expect(() => declare(createBs12AngelLightstickDemoState(scenario), 'bs12-062-source')).toThrow()
  })
  it('naturally equips after printed deployment and trashes source HP without replacement', () => {
    const before = createBs12AngelLightstickDemoState('equip-blocked'), snapshot = structuredClone(before)
    const source = before.players['player-one'].battleArea.find(c => c.card.instanceId === 'bs12-062-source')!
    const host = before.players['player-one'].battleArea.find(c => c.card.instanceId === 'bs12-062-host')!
    expect(canActivateCookieSkill(before, 'player-one', source.card.instanceId, 'activate')).toBe(true)
    expect(getCookieSkillUnavailableReason(before, 'player-one', source.card.instanceId, 'activate')).toBeUndefined()
    const paid = applyGameCommand(before, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.card.instanceId, trigger: 'activate', paymentIds: ['bs12-062-payment-0'] })
    expect(paid.players['player-one'].battleArea).toHaveLength(2)
    expect(getEffectSelectionCandidates(paid, { sourcePlayerId: 'player-one', sourceInstanceId: source.card.instanceId }, source.card.skill!.effects[0]).map(c => c.instanceId)).toEqual([host.card.instanceId])
    const equipped = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [host.card.instanceId] })
    expect(equipped.players['player-one'].battleArea).toHaveLength(1)
    expect(equipped.players['player-one'].battleArea[0].hpCards).toEqual(host.hpCards)
    expect(equipped.players['player-one'].battleArea[0].equippedCards).toEqual([source.card])
    expect(equipped.players['player-one'].discardPile).toEqual(source.hpCards)
    expect(equipped.pendingReplacement).toBeNull()
    expect(equipped.players['player-one'].breakArea).toEqual([])
    expect(before).toEqual(snapshot)
  })
})
