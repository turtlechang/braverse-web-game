import { describe, expect, it } from 'vitest'
import { createBs12AppleFaerieDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canPlayExtraDeckCookie, getExtraDeckCookieUnavailableReason } from './actions'
import { isEffectConditionMet } from './effects'
import { createPlayerView } from './player-view'
import { assessPublicCondition } from './ai/strategy/public-condition'
import { describeCommandSteps } from './command-log'
import { getOptionalCostAttackPrompt } from '../components/modals/optionalCostAttackPrompt'

const playerId = 'player-one' as const
const sourceId = 'bs12-056-source'
const foeId = 'bs12-054-opponent'
type State = ReturnType<typeof createBs12AppleFaerieDemoState>
const entry = (state: State) => applyGameCommand(state, { kind: 'play-extra-deck-cookie', playerId, instanceId: sourceId })
const attack = (before: State) => {
  let state = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: foeId, supportPaymentIds: before.players[playerId].supportArea.slice(0, 2).map(s => s.card.instanceId) })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 10; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  if (state.pendingReplacement) state = applyGameCommand(state, { kind: 'skip-replacement', playerId: 'player-two' })
  return applyGameCommand(state, { kind: 'resolve-attack-effect', playerId, targetIds: [] })
}
const pay = (state: State, discardCardIds = ['bs12-056-hand-1'], targetIds: string[] = ['bs12-056-support-2']) => applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId, action: 'pay', discardCardIds, targetIds, paymentIds: [] })

describe.each(['BS12-056', 'BS12-056@1'] as const)('%s ordinary EXTRA entry and second-player paid support readiness', number => {
  it('keeps fixture local and materializes through a real EXTRA command', () => {
    expect(parseTestStateConfig(`?test-state=bs12-056:${number}:extra-named`, 'localhost')).toEqual({ kind: 'bs12-056', cardNumber: number, scenario: 'extra-named' })
    expect(parseTestStateConfig(`?test-state=bs12-056:${number}:positive`, 'example.com')).toBeNull()
    const state = createBs12AppleFaerieDemoState('positive', number)
    expect(state.players[playerId].battleArea[1]).toMatchObject({ enteredFrom: 'extra-deck', enteredTurn: state.turnNumber, hpCards: expect.any(Array), card: { extraDeckOrigin: 'extra' } })
    expect(state.players[playerId].battleArea[1].hpCards).toHaveLength(3)
    expect(state.players[playerId].deck).toHaveLength(13)
  })
  it.each(['extra-named', 'extra-named-rested', 'extra-seven', 'extra-seven-rested'] as const)('OR branch enters independently with three HP and no payment: %s', scenario => {
    const before = createBs12AppleFaerieDemoState(scenario, number)
    const snapshot = structuredClone(before)
    expect(canPlayExtraDeckCookie(before, playerId, sourceId)).toBe(true)
    const after = entry(before)
    expect(after.players[playerId].battleArea[1].hpCards).toEqual(before.players[playerId].deck.slice(0, 3))
    expect(after.players[playerId].battleArea[1]).toMatchObject({ rested: false, card: { extraDeckOrigin: 'extra' } })
    expect(after.players[playerId].battleArea[1].card.awakenHpBonus).toBeUndefined()
    expect(after.players[playerId].battleArea[0]).toEqual(before.players[playerId].battleArea[0])
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(after.players[playerId].discardPile).toEqual([])
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players[playerId].extraDeck).toEqual([])
    expect(after.players[playerId].deck).toHaveLength(13)
    expect(after.extraDeckPlayUsedThisTurn).toBe(true)
    expect(after.pendingOnPlay).toBeNull()
    expect(after.pendingOptionalCostAttack ?? null).toBeNull()
    expect(before).toEqual(snapshot)
  })
  it.each(['extra-six', 'extra-seven-mixed', 'extra-non-arena', 'extra-wrong-name', 'extra-support-name', 'extra-opponent-name', 'extra-equipment', 'extra-full', 'extra-used', 'extra-outside-main', 'extra-opponent-turn'] as const)('rejects entry without both a legal OR branch and normal timing/capacity: %s', scenario => {
    const before = createBs12AppleFaerieDemoState(scenario, number)
    const snapshot = structuredClone(before)
    expect(canPlayExtraDeckCookie(before, playerId, sourceId)).toBe(false)
    expect(getExtraDeckCookieUnavailableReason(before, playerId, sourceId)).not.toBeNull()
    expect(() => entry(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('cannot satisfy Candy Apple AND Arena with two different Cookies; AI uses the same public intersection', () => {
    const before = createBs12AppleFaerieDemoState('extra-non-arena', number)
    const arena = createBs12AppleFaerieDemoState('extra-wrong-name', number).players[playerId].battleArea[0]
    before.players[playerId].battleArea.push(arena)
    const condition = { kind: 'battle-area-has-named-cookie' as const, side: 'self' as const, name: 'Candy Apple Cookie', keyword: 'arena' as const }
    expect(isEffectConditionMet(before, { sourcePlayerId: playerId, sourceInstanceId: sourceId }, { kind: 'draw', amount: 0, condition })).toBe(false)
    expect(assessPublicCondition(createPlayerView(before, playerId), condition).state).toBe('unmet')
    const actual = createBs12AppleFaerieDemoState('extra-named', number)
    expect(assessPublicCondition(createPlayerView(actual, playerId), condition).state).toBe('met')
    // A legacy named condition still accepts the non-Arena printing.
    expect(isEffectConditionMet(before, { sourcePlayerId: playerId, sourceInstanceId: sourceId }, { kind: 'draw', amount: 0, condition: { ...condition, keyword: undefined } })).toBe(true)
  })
  it('seven green supports include REST, item and stage, without counting blue or the opponent', () => {
    const before = createBs12AppleFaerieDemoState('extra-seven-rested', number)
    expect(before.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(new Set(before.players[playerId].supportArea.map(s => s.card.type))).toEqual(new Set(['cookie', 'item', 'stage']))
    expect(canPlayExtraDeckCookie(before, playerId, sourceId)).toBe(true)
    const mixed = createBs12AppleFaerieDemoState('extra-seven-mixed', number)
    mixed.players['player-two'].supportArea = before.players[playerId].supportArea
    expect(canPlayExtraDeckCookie(mixed, playerId, sourceId)).toBe(false)
  })
  it.each(['positive', 'all-blue'] as const)('pays two real any-color supports for ordinary two before Then: %s', scenario => {
    const before = createBs12AppleFaerieDemoState(scenario, number)
    const after = attack(before)
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([4, 3])
    expect(after.players[playerId].supportArea.map(s => s.rested)).toEqual([true, true, true, true])
    expect(after.players[playerId].battleArea[1].rested).toBe(true)
    expect(after.pendingOptionalCostAttack).toMatchObject({ cost: { energy: {}, discardHand: 1 }, sourceInstanceId: sourceId })
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
  })
  it.each([0, 1, 2])('discards exactly one arbitrary hand card, then readies any own support: %s', index => {
    const before = attack(createBs12AppleFaerieDemoState('positive', number))
    const after = pay(before, [`bs12-056-hand-${index}`], [`bs12-056-support-${index}`])
    expect(after.players[playerId].hand).toHaveLength(2)
    expect(after.players[playerId].discardPile.map(c => c.instanceId)).toEqual([`bs12-056-hand-${index}`])
    expect(after.players[playerId].supportArea.map(s => s.rested)).toEqual([0, 1, 2, 3].map(i => i !== index))
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(after.pendingOptionalCostAttack ?? null).toBeNull()
  })
  it('can choose a stage, an already active support, or paid zero without another cost', () => {
    const opened = attack(createBs12AppleFaerieDemoState('positive', number))
    expect(pay(opened, undefined, ['bs12-056-support-3']).players[playerId].supportArea[3].rested).toBe(false)
    const active = attack(createBs12AppleFaerieDemoState('active-target', number))
    expect(active.players[playerId].supportArea[2].rested).toBe(false)
    const readied = pay(active)
    expect(readied.players[playerId].supportArea).toEqual(active.players[playerId].supportArea)
    expect(readied.players[playerId].hand).toHaveLength(2)
    const zero = pay(opened, undefined, [])
    expect(zero.players[playerId].hand).toHaveLength(2)
    expect(zero.players[playerId].supportArea).toEqual(opened.players[playerId].supportArea)
    expect(zero.players[playerId].discardPile).toHaveLength(1)
  })
  it('optional skip preserves the ordinary damage, hand and support payment', () => {
    const opened = attack(createBs12AppleFaerieDemoState('positive', number))
    const after = applyGameCommand(opened, { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' })
    expect(after.players).toEqual(opened.players)
    expect(after.pendingBattle).toBeNull()
  })
  it('first-player condition stops before discard, regardless of current turn number', () => {
    const before = createBs12AppleFaerieDemoState('first-player', number)
    const after = attack({ ...before, turnNumber: 30 })
    expect(after.pendingOptionalCostAttack ?? null).toBeNull()
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
  })
  it('normal attack can faint its target and Then still readies support', () => {
    const after = pay(attack(createBs12AppleFaerieDemoState('target-faints', number)))
    expect(after.players['player-two'].battleArea).toHaveLength(1)
    expect(after.players[playerId].supportArea[2].rested).toBe(false)
  })
  it('cannot pay the optional effect without a hand card', () => {
    const after = attack(createBs12AppleFaerieDemoState('no-hand', number))
    expect(() => pay(after)).toThrow()
    if (after.pendingOptionalCostAttack) expect(applyGameCommand(after, { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' }).players).toEqual(after.players)
  })
  it.each([[], ['bs12-056-hand-0', 'bs12-056-hand-1'], ['bs12-056-hand-0', 'bs12-056-hand-0'], ['bs12-056-support-0'], [sourceId]].map(ids => ({ ids })))('rejects invalid discard $ids without partial payment', ({ ids }) => {
    const before = attack(createBs12AppleFaerieDemoState('positive', number))
    const snapshot = structuredClone(before)
    expect(() => pay(before, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[sourceId], ['bs12-056-hand-0'], ['bs12-054-foe-support-0'], ['bs12-056-support-0', 'bs12-056-support-1'], ['bs12-056-support-0', 'bs12-056-support-0']].map(ids => ({ ids })))('rejects wrong zone/side, excess and duplicate ready target $ids immutably', ({ ids }) => {
    const before = attack(createBs12AppleFaerieDemoState('positive', number))
    const snapshot = structuredClone(before)
    expect(() => pay(before, undefined, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each(['few-energy', 'rested-energy', 'source-rested', 'outside-main', 'opponent-turn'] as const)('blocks illegal ordinary attack: %s', scenario => {
    const before = createBs12AppleFaerieDemoState(scenario, number)
    const snapshot = structuredClone(before)
    expect(() => attack(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('entry with only two deck cards pauses for Refresh before allocating remaining HP', () => {
    const before = createBs12AppleFaerieDemoState('extra-refresh', number)
    const after = entry(before)
    expect(after.pendingRefresh).toBeTruthy()
    expect(after.players[playerId].battleArea.find(c => c.card.instanceId === sourceId)?.hpCards).toHaveLength(2)
    const refreshed = applyGameCommand(after, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-056-refresh-0', shuffleSeed: 3 })
    expect(refreshed.players[playerId].battleArea[1].hpCards).toHaveLength(3)
    expect(refreshed.players[playerId].deck).toHaveLength(1)
    expect(refreshed.players[playerId].breakArea.map(c => c.instanceId)).toEqual(['bs12-056-refresh-0'])
    expect(refreshed.pendingRefresh).toBeNull()
  })
  it('public command receipt records the paid hand and support target', () => {
    const before = attack(createBs12AppleFaerieDemoState('positive', number))
    const command = { kind: 'resolve-optional-cost-attack' as const, playerId, action: 'pay' as const, discardCardIds: ['bs12-056-hand-1'], targetIds: ['bs12-056-support-2'], paymentIds: [] }
    const after = applyGameCommand(before, command)
    const texts = describeCommandSteps(before, after, command)?.map(step => step.text).join('\n') ?? ''
    expect(texts).toContain('Wonderful Melody')
    expect(texts).toMatch(/活躍/)
    const zeroCommand = { ...command, targetIds: [] }
    const zeroTexts = describeCommandSteps(before, applyGameCommand(before, zeroCommand), zeroCommand)?.map(step => step.text).join('\n') ?? ''
    expect(zeroTexts).toContain('選擇 0 張支援卡')
    expect(zeroTexts).not.toContain('將 1 張支援卡')
  })
  it('paid zero receipt does not claim one support was readied', () => {
    const before = attack(createBs12AppleFaerieDemoState('positive', number))
    const command = { kind: 'resolve-optional-cost-attack' as const, playerId, action: 'pay' as const, discardCardIds: ['bs12-056-hand-1'], targetIds: [], paymentIds: [] }
    const texts = describeCommandSteps(before, applyGameCommand(before, command), command)?.map(step => step.text).join('\n') ?? ''
    expect(texts).toContain('選擇 0 張支援卡')
    expect(texts).not.toContain('將 1 張支援卡')
  })
  it('Then UI describes zero-to-one own support card and includes every type/color', () => {
    const opened = attack(createBs12AppleFaerieDemoState('positive', number))
    const prompt = getOptionalCostAttackPrompt(opened, playerId)
    expect(prompt).toMatchObject({ needsTarget: true, targetMin: 0, targetMax: 1, targetLabel: '己方支援區的卡', targetInstruction: '從自己的支援區選擇最多 1 張卡牌，設為活躍', discardHandCost: 1, energyCostTotal: 0 })
    expect(prompt?.targetCandidates.map(c => c.instanceId)).toEqual([0, 1, 2, 3].map(i => `bs12-056-support-${i}`))
    expect(prompt?.discardHandCandidates.map(c => c.instanceId)).toEqual([0, 1, 2].map(i => `bs12-056-hand-${i}`))
  })
})
