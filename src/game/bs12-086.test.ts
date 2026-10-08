import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { createBs12TrueRockSpiritDemoState, createBs12YappingDemoState, parseTestStateConfig } from './demo'
import { beginAttack, getTrapCandidates } from './battle'
import { applyGameCommand } from './commands'
import { executeCardEffect, getAttackDamageAgainst, getEffectTargetCandidatesForEffect } from './effects'
import { advancePhase } from './turn'
import { describeCommandSteps } from './command-log'
import { deployCookie } from './actions'
import { handleAiPendingBattle } from './ai/battle-handler'
import type { GameCard, GameState } from './types'

const actor = 'player-one' as const
const enemy = 'player-two' as const
const card = (number: string, instanceId: string): GameCard => {
  const converted = convertOfficialCardToGameCard(candidate.cards.find(source => source.cardNumber === number) as OfficialCardRecord, instanceId)
  if (converted.status !== 'converted') throw new Error(`Missing ${number}`)
  return { ...converted.gameCard, instanceId }
}
const setup = (): GameState => {
  const base = createBs12YappingDemoState('main')
  const blocker = card('BS12-081', 'blocker')
  const second = card('BS12-081', 'second')
  const attacker = card('BS12-003', 'bs12-027-attacker')
  const other = card('BS12-016', 'other-opponent')
  if (blocker.type !== 'cookie' || second.type !== 'cookie' || attacker.type !== 'cookie' || other.type !== 'cookie') throw new Error('Missing fixture Cookie')
  const hp = base.players[actor].battleArea[0].hpCards.slice(0, 2)
  const state: GameState = { ...base, activePlayerId: enemy, players: { ...base.players,
    [actor]: { ...base.players[actor], hand: [card('BS12-086', 'trap')], breakArea: [], discardPile: [], stage: null,
      supportArea: [{ card: card('BS12-079', 'payment'), rested: false }],
      battleArea: [{ ...base.players[actor].battleArea[0], card: blocker, hpCards: hp, rested: false },
        { ...base.players[actor].battleArea[1], card: second, hpCards: base.players[actor].battleArea[1].hpCards.slice(0, 2), rested: true }],
    },
    [enemy]: { ...base.players[enemy], battleArea: [
      { ...base.players[enemy].battleArea[0], card: attacker, hpCards: base.players[enemy].battleArea[0].hpCards.slice(0, 2) },
      { ...base.players[enemy].battleArea[1], card: other, hpCards: [...base.players[enemy].battleArea[1].hpCards, card('BS12-002', 'other-hp-3'), card('BS12-002', 'other-hp-4')].slice(0, 4) },
    ] },
  } }
  return beginAttack(state, 'bs12-027-attacker', 'blocker', [state.players[enemy].supportArea[0].card.instanceId])
}
const effect = () => {
  const result = card('BS12-086', 'trap').trap!.effects[0]
  if (result.kind !== 'modify-attack') throw new Error('Missing 086 modifier')
  return result
}
const play = (state = setup(), targetIds = ['blocker'], paymentIds = ['payment']) => applyGameCommand(state,
  { kind: 'play-trap', playerId: actor, trapInstanceId: 'trap', paymentIds, targetIds: [], effectTargets: [targetIds] })
const settle = (before: GameState) => {
  let state = before
  for (let i = 0; state.pendingBattle && i < 12; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: actor })
  return state
}

it('086 selects only printed own Battle Area Blockers including a rested Cookie', () => {
  const before = setup()
  expect(getEffectTargetCandidatesForEffect(before, { sourcePlayerId: actor, sourceInstanceId: 'trap' }, effect()).map(cookie => cookie.card.instanceId)).toEqual(['blocker', 'second'])
  const nonBlocker = card('BS12-075', 'second')
  if (nonBlocker.type !== 'cookie') throw new Error('Expected non-Blocker Cookie')
  before.players[actor].battleArea[1].card = nonBlocker
  expect(getEffectTargetCandidatesForEffect(before, { sourcePlayerId: actor, sourceInstanceId: 'trap' }, effect()).map(cookie => cookie.card.instanceId)).toEqual(['blocker'])
})

it.each(['blocker', 'second'])('086 pays P1 and applies +2 only to %s without affecting the opponent current attack', target => {
  const before = setup()
  const snapshot = structuredClone(before)
  expect(getTrapCandidates(before, actor).map(card => card.instanceId)).toEqual(['trap'])
  const after = play(before, [target])
  expect(after.players[actor].hand).toEqual([])
  expect(after.players[actor].discardPile.at(-1)?.instanceId).toBe('trap')
  expect(after.players[actor].supportArea[0].rested).toBe(true)
  expect(after.players[actor].battleArea).toEqual(before.players[actor].battleArea)
  expect(after.players[enemy]).toEqual(before.players[enemy])
  expect(after.attackModifiers).toMatchObject([{ sourceInstanceId: 'trap', targetInstanceId: target, amount: 2, expiresAfterTurn: 3 }])
  expect(after.pendingBattle?.remainingDamage).toBe(before.pendingBattle?.remainingDamage)
  expect(getAttackDamageAgainst(after, target, 'bs12-027-attacker')).toBe(3)
  expect(getAttackDamageAgainst(after, target === 'blocker' ? 'second' : 'blocker', 'bs12-027-attacker')).toBe(1)
  expect(before).toEqual(snapshot)
})

it('086 zero target still pays and trashes its source, with no fallback modifier', () => {
  const before = setup()
  const after = play(before, [])
  expect(after.attackModifiers).toEqual([])
  expect(after.players[actor].supportArea[0].rested).toBe(true)
  expect(after.players[actor].discardPile.at(-1)?.instanceId).toBe('trap')
  expect(after.pendingBattle?.remainingDamage).toBe(before.pendingBattle?.remainingDamage)
})

it('086 retains its modifier through the current opponent turn and removes it at own next turn end', () => {
  let state = settle(play())
  state = advancePhase(advancePhase(state))
  expect(state).toMatchObject({ turnNumber: 3, activePlayerId: actor, phase: 'active' })
  expect(getAttackDamageAgainst(state, 'blocker', 'bs12-027-attacker')).toBe(3)
  state = advancePhase(advancePhase(advancePhase(advancePhase(advancePhase(state)))))
  expect(state).toMatchObject({ turnNumber: 4, activePlayerId: enemy, phase: 'active' })
  expect(state.attackModifiers).toEqual([])
  expect(getAttackDamageAgainst(state, 'blocker', 'bs12-027-attacker')).toBe(1)
})

it.each([actor, enemy])('own-next-turn expiry uses effect owner when active player is %s', activePlayerId => {
  const before = { ...setup(), pendingBattle: undefined, activePlayerId }
  const after = executeCardEffect(before, { sourcePlayerId: actor, sourceInstanceId: 'trap' }, effect(), ['blocker'])
  expect(after.attackModifiers[0].expiresAfterTurn).toBe(activePlayerId === actor ? 4 : 3)
})

it.each([[], ['payment', 'payment'], ['bs12-027-attack-payment-0'], ['blocker'], ['unknown']].map(paymentIds => ({ paymentIds })))('086 rejects invalid payment ids atomically: $paymentIds', ({ paymentIds }) => {
  const before = setup()
  const snapshot = structuredClone(before)
  expect(() => play(before, ['blocker'], paymentIds)).toThrow()
  expect(before).toEqual(snapshot)
})

it.each([['bs12-027-attacker'], ['payment'], ['unknown'], ['blocker', 'second'], ['blocker', 'blocker']].map(targetIds => ({ targetIds })))('086 rejects invalid owner, zone or count: $targetIds', ({ targetIds }) => {
  const before = setup()
  const snapshot = structuredClone(before)
  expect(() => play(before, targetIds)).toThrow()
  expect(before).toEqual(snapshot)
})

it('086 rejects a non-Blocker Cookie despite Arena and P1 availability', () => {
  const before = setup()
  const nonBlocker = card('BS12-075', 'second')
  if (nonBlocker.type !== 'cookie') throw new Error('Expected non-Blocker Cookie')
  before.players[actor].battleArea[1].card = nonBlocker
  const snapshot = structuredClone(before)
  expect(() => play(before, ['second'])).toThrow()
  expect(before).toEqual(snapshot)
})

it('086 public settlement says +2 until own next turn ends', () => {
  const before = setup()
  const command = { kind: 'play-trap' as const, playerId: actor, trapInstanceId: 'trap', paymentIds: ['payment'], targetIds: [], effectTargets: [['blocker']] }
  const after = applyGameCommand(before, command)
  expect(describeCommandSteps(before, after, command)?.map(step => step.text).join(' ')).toMatch(/下個回合結束.*\+2|\+2.*下個回合結束/)
})

it('086 public zero settlement does not report a fictitious +2 result', () => {
  const before = setup()
  const command = { kind: 'play-trap' as const, playerId: actor, trapInstanceId: 'trap', paymentIds: ['payment'], targetIds: [], effectTargets: [[]] }
  const text = describeCommandSteps(before, applyGameCommand(before, command), command)?.map(step => step.text).join(' ')
  expect(text).toContain('未選擇 Blocker 餅乾，未套用攻擊傷害修改')
  expect(text).not.toContain('+2')
})

it('086 genuine red non-Arena Blocker is eligible even without its Blocker payment', () => {
  const before = createBs12TrueRockSpiritDemoState('rested-target')
  const candidates = getEffectTargetCandidatesForEffect(before, { sourcePlayerId: actor, sourceInstanceId: 'bs12-086-trap' }, effect())
  expect(candidates.map(cookie => cookie.card.instanceId)).toEqual(['bs12-086-blocker', 'bs12-086-second'])
  const red = candidates[1]
  expect(red.card.id).toBe('BS1-009')
  expect(red.card.energyColor).toBe('red')
  expect(red.card.keywords ?? []).not.toContain('arena')
  expect(red.rested).toBe(true)
})

it('086 buff is removed on departure and does not follow the physical Cookie on replay', () => {
  let state = settle(play())
  state = advancePhase(advancePhase(state))
  state = advancePhase(advancePhase(advancePhase(state)))
  expect(state).toMatchObject({ phase: 'main', activePlayerId: actor, turnNumber: 3 })
  const returned = executeCardEffect(state, { sourcePlayerId: actor, sourceInstanceId: 'test-return' },
    { kind: 'return-to-hand', target: { side: 'self', min: 1, max: 1 } }, ['blocker'])
  expect(returned.attackModifiers).toEqual([])
  expect(returned.players[actor].hand.map(card => card.instanceId)).toContain('blocker')
  const replayed = deployCookie(returned, 'blocker')
  expect(replayed.players[actor].battleArea.find(cookie => cookie.card.instanceId === 'blocker')?.hpCards).toHaveLength(2)
  expect(getAttackDamageAgainst(replayed, 'blocker', 'bs12-027-attacker')).toBe(1)
})

it('086 route is isolated to localhost', () => {
  expect(parseTestStateConfig('?test-state=bs12-086:positive', 'localhost')).toEqual({ kind: 'bs12-086', scenario: 'positive' })
  expect(parseTestStateConfig('?test-state=bs12-086:positive', 'example.com')).toBeNull()
})

it.each(['positive', 'non-blocker', 'no-target'] as const)('086 AI uses legal printed Blocker targets: %s', scenario => {
  const before = createBs12TrueRockSpiritDemoState(scenario)
  const snapshot = structuredClone(before)
  const decision = handleAiPendingBattle(before, actor)
  expect(decision?.action).toBe('play-trap')
  expect(decision?.state.players[actor].hand).toEqual([])
  const eligible = scenario === 'positive' ? ['bs12-086-blocker', 'bs12-086-second'] : scenario === 'non-blocker' ? ['bs12-086-second'] : []
  expect(decision?.state.attackModifiers).toHaveLength(eligible.length ? 1 : 0)
  expect(decision?.state.attackModifiers.every(modifier => eligible.includes(modifier.targetInstanceId))).toBe(true)
  expect(before).toEqual(snapshot)
})

it('086 can pay and resolve zero even when all battle Cookies lack printed Blocker', () => {
  const before = createBs12TrueRockSpiritDemoState('no-target')
  expect(getTrapCandidates(before, actor).map(card => card.instanceId)).toEqual(['bs12-086-trap'])
  const after = applyGameCommand(before, { kind: 'play-trap', playerId: actor, trapInstanceId: 'bs12-086-trap', paymentIds: ['bs12-086-payment-0'], targetIds: [], effectTargets: [[]] })
  expect(after.attackModifiers).toEqual([])
  expect(after.players[actor].discardPile.at(-1)?.instanceId).toBe('bs12-086-trap')
  expect(after.players[actor].supportArea[0].rested).toBe(true)
})

it.each(['positive', 'rested-target', 'non-blocker', 'no-target', 'wrong-zones', 'wrong-energy', 'rested-energy', 'no-energy', 'spare-energy', 'disabled', 'used', 'main', 'after-battle', 'next-turn'] as const)('086 fixture has unique identities and legal visible copies: %s', scenario => {
  const state = createBs12TrueRockSpiritDemoState(scenario)
  const identities: string[] = []
  for (const player of Object.values(state.players)) {
    expect(player.battleArea.length).toBeLessThanOrEqual(2)
    const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(support => support.card), ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards])]
    identities.push(...cards.map(card => card.instanceId))
    const counts = new Map<string, number>()
    for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
    expect([...counts.values()].every(count => count <= 4)).toBe(true)
  }
  expect(new Set(identities).size).toBe(identities.length)
})
