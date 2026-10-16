import { describe, expect, it } from 'vitest'
import { createSt8011PreviewState as fixture, st8011Scenarios } from './st8-011-demo'
import { applyGameCommand as apply } from './commands'
import { getBlockerCandidates } from './battle'
import { selectEnergyPayment } from './energy'
import { commandFromLogEntry } from './replay'
const owner = 'player-one' as const, foe = 'player-two' as const
const kiwi = (state: ReturnType<typeof fixture>) => {
  const source = state.players[owner].battleArea.find(c => c.card.id === 'ST8-011')
  if (!source) throw new Error('Actual Kiwi required')
  return source
}
const block = (state: ReturnType<typeof fixture>, source = kiwi(state).card.instanceId) => {
  const ids = selectEnergyPayment({ green: 1 }, state.players[owner].supportArea)
  if (!ids) throw new Error('Actual G payment required')
  return apply(state, { kind: 'play-blocker', playerId: owner, sourceInstanceId: source, paymentIds: ids })
}
const replay = (scenario: string, final: ReturnType<typeof fixture>) => {
  let state = fixture(scenario, true)
  for (const entry of final.commandLog ?? []) state = apply(state, commandFromLogEntry(entry))
  expect(JSON.parse(JSON.stringify(state))).toEqual(JSON.parse(JSON.stringify(final)))
}
const attack = (state: ReturnType<typeof fixture>) => apply(state, { kind: 'declare-attack', playerId: owner,
  attackerInstanceId: kiwi(state).card.instanceId, targetInstanceId: state.players[foe].battleArea[0].card.instanceId,
  supportPaymentIds: selectEnergyPayment({ green: 1, neutral: 1 }, state.players[owner].supportArea) ?? [] })

describe('ST8-011 Kiwi original physical rules', () => {
  it.each(st8011Scenarios)('%s starts with original 60/60, 120 unique, <=4 copies and printed HP', scenario => {
    const initial = fixture(scenario, true), allIds: string[] = []
    for (const player of Object.values(initial.players)) {
      const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(s => s.card),
        ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
      expect(cards).toHaveLength(60); allIds.push(...cards.map(c => c.instanceId))
      const counts = new Map<string, number>()
      for (const c of cards) { expect(c.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//); counts.set(c.id, (counts.get(c.id) ?? 0) + 1) }
      expect([...counts.values()].every(n => n <= 4)).toBe(true)
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      for (const c of player.battleArea) expect(c.hpCards).toHaveLength(c.card.hp)
    }
    expect(new Set(allIds).size).toBe(120)
  })
  it.each(['positive', 'rested-source', 'no-hand', 'damage-two'])('G Blocker redirects actual ordinary damage only to its source: %s', scenario => {
    const start = fixture(scenario), before = structuredClone(start), source = kiwi(start), originalTarget = start.players[owner].battleArea[1]
    const redirected = block(start)
    expect(redirected.pendingBattle?.targetInstanceId).toBe(source.card.instanceId)
    expect(redirected.players[owner].supportArea.map(s => s.rested)).toEqual([true, false, false])
    expect(kiwi(redirected).rested).toBe(scenario === 'rested-source')
    const final = apply(redirected, { kind: 'resolve-battle', playerId: foe })
    expect(kiwi(final).hpCards).toHaveLength(scenario === 'damage-two' ? 1 : 2)
    expect(final.players[owner].battleArea.find(c => c.card.instanceId === originalTarget.card.instanceId)).toEqual(originalTarget)
    expect(final.players[owner].hand).toEqual(start.players[owner].hand)
    expect(start).toEqual(before); replay(scenario, start); replay(scenario, redirected); replay(scenario, final)
  })
  it('true NNN3 after redirect faints printed HP3 while original defender remains unhurt', () => {
    const start = fixture('damage-three'), source = kiwi(start), defender = start.players[owner].battleArea[1]
    let state = apply(block(start), { kind: 'resolve-battle', playerId: foe })
    expect(state.players[owner].breakArea.some(c => c.instanceId === source.card.instanceId)).toBe(true)
    expect(state.players[owner].battleArea[0]).toEqual(defender)
    expect(state.pendingFaintEffects?.length ?? 0).toBe(0)
    state = apply(state, { kind: 'skip-replacement', playerId: owner })
    expect(state.players[owner].battleArea[0]).toEqual(defender); replay('damage-three', state)
  })
  it('skipping a real response preserves Kiwi/resources and original target takes one', () => {
    const start = fixture('positive'), source = kiwi(start)
    const final = apply(apply(start, { kind: 'skip-trap', playerId: owner }), { kind: 'resolve-battle', playerId: foe })
    expect(kiwi(final)).toEqual(source); expect(final.players[owner].battleArea[1].hpCards).toHaveLength(1)
    expect(final.players[owner].supportArea).toEqual(start.players[owner].supportArea); replay('positive', final)
  })
  const blocked = ['wrong-color', 'rested-energy', 'no-energy', 'already-target', 'wrong-zone-hand', 'wrong-zone-support', 'wrong-zone-break', 'wrong-zone-trash']
  it.each(blocked)('unavailable Blocker cannot pay or redirect: %s', scenario => {
    const state = fixture(scenario), before = structuredClone(state)
    expect(getBlockerCandidates(state, owner).some(c => c.card.id === 'ST8-011')).toBe(false)
    if (['wrong-color', 'rested-energy', 'no-energy'].includes(scenario)) expect(selectEnergyPayment({ green: 1 }, state.players[owner].supportArea)).toBeNull()
    const source = [...state.players[owner].battleArea.map(c => c.card), ...state.players[owner].hand, ...state.players[owner].breakArea,
      ...state.players[owner].discardPile, ...state.players[owner].supportArea.map(s => s.card)].find(c => c.id === 'ST8-011')
    if (!source) throw new Error('Actual Kiwi in declared zone required')
    expect(() => apply(state, { kind: 'play-blocker', playerId: owner, sourceInstanceId: source.instanceId,
      paymentIds: state.players[owner].supportArea.slice(0, 1).map(s => s.card.instanceId) })).toThrow()
    expect(state).toEqual(before); replay(scenario, state)
  })
  it.each(['wrong-owner', 'wrong-source', 'opponent-payment', 'duplicate-payment', 'over-payment', 'missing-payment'])('malformed Blocker %s is immutable', variant => {
    const state = fixture('positive'), before = structuredClone(state), ids = state.players[owner].supportArea.map(s => s.card.instanceId)
    const paymentIds = variant === 'opponent-payment' ? [state.players[foe].supportArea[0].card.instanceId] : variant === 'duplicate-payment' ? [ids[0], ids[0]] : variant === 'over-payment' ? ids.slice(0, 2) : variant === 'missing-payment' ? [] : ids.slice(0, 1)
    expect(() => apply(state, { kind: 'play-blocker', playerId: variant === 'wrong-owner' ? foe : owner,
      sourceInstanceId: variant === 'wrong-source' ? state.players[owner].battleArea[1].card.instanceId : kiwi(state).card.instanceId, paymentIds })).toThrow()
    expect(state).toEqual(before)
  })
  it('Blocker cannot activate during own main or after a real response has closed', () => {
    const main = fixture('attack-green'), before = structuredClone(main)
    expect(() => block(main)).toThrow(); expect(main).toEqual(before)
    const after = apply(fixture('positive'), { kind: 'skip-trap', playerId: owner }), snapshot = structuredClone(after)
    expect(() => block(after)).toThrow(); expect(after).toEqual(snapshot)
  })
  it('same real Kiwi pays G a second time in one turn without Once or source REST', () => {
    const start = fixture('second-response'), source = kiwi(start)
    expect(source.hpCards).toHaveLength(2); expect(source.rested).toBe(false)
    expect(start.commandLog?.filter(e => e.commandKind === 'play-blocker')).toHaveLength(1)
    const final = apply(block(start), { kind: 'resolve-battle', playerId: foe })
    expect(kiwi(final).hpCards).toHaveLength(1); expect(kiwi(final).rested).toBe(false)
    expect(final.players[owner].supportArea.map(s => s.rested)).toEqual([true, true, false])
    expect(final.commandLog?.filter(e => e.commandKind === 'play-blocker')).toHaveLength(2)
    expect(final.turnNumber).toBe(fixture('second-response', true).turnNumber); replay('second-response', start); replay('second-response', final)
  })
  it('two physical Kiwi sources independently redirect to their own instances', () => {
    const start = fixture('two-kiwis'), first = start.players[owner].battleArea[0], second = start.players[owner].battleArea[1]
    let state = apply(block(start, first.card.instanceId), { kind: 'resolve-battle', playerId: foe })
    const payment = state.players[foe].supportArea.find(s => !s.rested)
    if (!payment) throw new Error('Actual second payment required')
    state = apply(state, { kind: 'declare-attack', playerId: foe, attackerInstanceId: state.players[foe].battleArea[1].card.instanceId,
      targetInstanceId: first.card.instanceId, supportPaymentIds: [payment.card.instanceId] })
    state = block(state, second.card.instanceId)
    expect(state.pendingBattle?.targetInstanceId).toBe(second.card.instanceId)
    state = apply(state, { kind: 'resolve-battle', playerId: foe })
    expect(state.players[owner].battleArea.map(c => c.hpCards.length)).toEqual([2, 2]); replay('two-kiwis', state)
  })
  const legalAttacks = ['attack-green', 'attack-red', 'attack-yellow', 'attack-blue', 'attack-purple', 'attack-black']
  it.each(legalAttacks)('printed GN ordinary1 pays G plus any other actual color: %s', scenario => {
    const start = fixture(scenario), target = start.players[foe].battleArea[0]
    expect(start.players[owner].supportArea[0].card.energyColor).toBe('green')
    expect(start.players[owner].supportArea[1].card.energyColor).toBe(scenario.replace('attack-', ''))
    const attacked = attack(start)
    expect(attacked.commandLog?.at(-1)?.payload).toMatchObject({ supportPaymentIds: start.players[owner].supportArea.slice(0, 2).map(s => s.card.instanceId) })
    const final = apply(apply(attacked, { kind: 'skip-trap', playerId: foe }), { kind: 'resolve-battle', playerId: owner })
    expect(final.players[foe].battleArea[0].hpCards).toHaveLength(target.hpCards.length - 1)
    expect(kiwi(final).hpCards).toHaveLength(3); expect(final.players[owner].hand).toEqual(start.players[owner].hand)
    expect(final.pendingBattle).toBeNull(); expect(final.commandLog?.some(e => e.commandKind === 'resolve-attack-effect')).toBe(false)
    replay(scenario, final)
  })
  it.each(['attack-insufficient', 'attack-wrong-color', 'attack-rested-energy', 'attack-rested-source', 'attack-wrong-phase', 'attack-first-turn'])('ordinary GN rejects actual invalid payment/timing: %s', scenario => {
    const state = fixture(scenario), before = structuredClone(state)
    if (['attack-insufficient', 'attack-wrong-color', 'attack-rested-energy'].includes(scenario)) expect(selectEnergyPayment({ green: 1, neutral: 1 }, state.players[owner].supportArea)).toBeNull()
    expect(() => attack(state)).toThrow(); expect(state).toEqual(before)
  })
  it.each(['duplicate', 'one-only', 'three-payment', 'opponent-energy'])('ordinary GN malformed %s preserves state', variant => {
    const state = fixture('attack-green'), before = structuredClone(state), ids = state.players[owner].supportArea.map(s => s.card.instanceId)
    const supportPaymentIds = variant === 'duplicate' ? [ids[0], ids[0]] : variant === 'one-only' ? ids.slice(0, 1) : variant === 'three-payment' ? ids : [ids[0], state.players[foe].deck[0].instanceId]
    expect(() => apply(state, { kind: 'declare-attack', playerId: owner, attackerInstanceId: kiwi(state).card.instanceId,
      targetInstanceId: state.players[foe].battleArea[0].card.instanceId, supportPaymentIds })).toThrow()
    expect(state).toEqual(before)
  })
  it('actual hand deployment supplies exactly printed HP3 without OnPlay', () => {
    const start = fixture('play'), source = start.players[owner].hand[0]
    const final = apply(start, { kind: 'deploy-cookie', playerId: owner, instanceId: source.instanceId })
    expect(final.players[owner].battleArea.find(c => c.card.instanceId === source.instanceId)?.hpCards).toHaveLength(3)
    expect(final.pendingOnPlay).toBeNull(); expect(final.players[owner].hand).toEqual(start.players[owner].hand.slice(1)); replay('play', final)
  })
  it.each(['only-source-faint', 'last-deck'])('true targeted NNN3 requires replacement and resumes Refresh if applicable: %s', scenario => {
    const start = fixture(scenario), source = kiwi(start)
    expect(getBlockerCandidates(start, owner).some(c => c.card.instanceId === source.card.instanceId)).toBe(false)
    let state = apply(apply(start, { kind: 'skip-trap', playerId: owner }), { kind: 'resolve-battle', playerId: foe })
    expect(state.players[owner].battleArea).toHaveLength(0); expect(state.players[owner].breakArea.some(c => c.instanceId === source.card.instanceId)).toBe(true)
    const before = structuredClone(state)
    expect(() => apply(state, { kind: 'skip-replacement', playerId: owner })).toThrow(); expect(state).toEqual(before)
    const replacement = state.players[owner].hand.find(c => c.type === 'cookie')
    if (!replacement || replacement.type !== 'cookie') throw new Error('Actual replacement required')
    state = apply(state, { kind: 'replace-cookie', playerId: owner, instanceId: replacement.instanceId })
    if (scenario === 'last-deck') {
      expect(state.pendingRefresh?.playerId).toBe(owner)
      const cost = state.players[owner].discardPile.find(c => c.type === 'cookie')
      if (!cost) throw new Error('Actual Refresh Cookie required')
      state = apply(state, { kind: 'refresh-deck', playerId: owner, cookieInstanceId: cost.instanceId, shuffleSeed: 1 })
      expect(state.pendingRefresh).toBeNull()
    }
    expect(state.players[owner].battleArea.find(c => c.card.instanceId === replacement.instanceId)?.hpCards).toHaveLength(replacement.hp)
    if (state.pendingBattle) state = apply(state, { kind: 'resolve-battle', playerId: foe })
    replay(scenario, state)
  })
})
