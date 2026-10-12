import { describe, expect, it } from 'vitest'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { getLegalTurnCommands } from './legal-actions'
import { createCard } from './starter-deck'
import { createBattleState, item } from './test-helpers/battle-helpers'
import { takeAiStep } from './ai'
import { actionIdentityFromCommand } from './ai/strategy/lv3-strategy'
import { actionTieBreakKey } from './ai/strategy/action-score'
import type { CookieCard, GameState, PlayerId } from './types'

const owner = 'player-one' as const
const printed = (id: string, copy = 1, player: PlayerId = owner) => {
  const raw = getCardPoolEntry(id)
  if (!raw) throw new Error(`Missing original printing ${id}`)
  return createCard(raw, player, copy)
}
const cookie = (id: string, copy = 1, player: PlayerId = owner): CookieCard => {
  const card = printed(id, copy, player)
  if (card.type !== 'cookie') throw new Error('Expected original Cookie')
  return card
}

// Original public card definitions with synthetic unknown HP/deck backs.
// This tests legal action space and AI policy, not physical-card acceptance.
const fixture = (handId: string, donorIds: string[]): GameState => {
  const state = createBattleState()
  state.phase = 'main'; state.activePlayerId = owner; state.turnNumber = 5
  for (const player of Object.values(state.players)) {
    player.hand = []; player.battleArea = []; player.supportArea = []
    player.breakArea = []; player.discardPile = []; player.stage = null; player.extraDeck = []
    player.deck = Array.from({ length: 16 }, (_, i) => item(`${player.id}:deck:${i}`))
  }
  state.players[owner].hand = [printed(handId), printed('ST1-020')]
  state.players[owner].battleArea = donorIds.map((id, i) => {
    const card = cookie(id, i + 1)
    return { card, rested: true,
      hpCards: Array.from({ length: card.hp }, (_, j) => item(`hp:${i}:${j}`)),
      battleEntryId: `${card.instanceId}:entry` }
  })
  const defender = cookie('BS12-059', 1, 'player-two')
  state.players['player-two'].battleArea = [{ card: defender, rested: false,
    hpCards: [item('foe:hp')], battleEntryId: `${defender.instanceId}:entry` }]
  return state
}

const specialCommands = (state: GameState) => getLegalTurnCommands(state, owner).filter(
  command => command.kind === 'deploy-cookie' && command.specialPlayCookieInstanceIds,
)

describe('Special Play action enumeration', () => {
  it('keeps ordinary and different Special Play payments distinct in action identities', () => {
    const common = { kind: 'deploy-cookie' as const, playerId: owner, instanceId: 'source' }
    const normal = actionIdentityFromCommand(common)
    const first = actionIdentityFromCommand({ ...common, specialPlayCookieInstanceIds: ['first-cost'] })
    const second = actionIdentityFromCommand({ ...common, specialPlayCookieInstanceIds: ['second-cost'] })
    expect(first.paymentIds).toEqual(['first-cost'])
    expect(second.paymentIds).toEqual(['second-cost'])
    expect(new Set([normal, first, second].map(actionTieBreakKey)).size).toBe(3)
    expect(actionIdentityFromCommand({ ...common, specialPlayCookieInstanceId: 'legacy-cost' }).paymentIds).toEqual(['legacy-cost'])
  })
  it.each([
    ['two alternative LV1 payments', 'BS11-111', ['BS11-094', 'BS11-103'], 2],
    ['two-cookie payment once', 'BS11-115', ['BS11-111', 'BS11-113'], 1],
    ['wrong color with matching level', 'BS11-111', ['ST6-001', 'BS11-115'], 0],
    ['wrong level before Activate', 'BS11-111', ['BS11-092', 'BS11-115'], 0],
    ['two-cookie payment lacks Special Play', 'BS11-115', ['BS11-092', 'BS11-113'], 0],
    ['insufficient two-cookie payment', 'BS11-115', ['BS11-111'], 0],
    ['ordinary and special alternatives', 'BS11-111', ['BS11-094'], 1],
  ] as const)('%s', (_name, hand, donors, count) => {
    const state = fixture(hand, [...donors]), before = structuredClone(state)
    const commands = specialCommands(state)
    expect(commands).toHaveLength(count)
    const signatures = commands.map(command => command.kind === 'deploy-cookie'
      ? [...command.specialPlayCookieInstanceIds ?? []].sort().join('|') : '')
    expect(new Set(signatures).size).toBe(signatures.length)
    const normal = getLegalTurnCommands(state, owner).filter(command =>
      command.kind === 'deploy-cookie' && !command.specialPlayCookieInstanceIds)
    expect(normal).toHaveLength(donors.length < 2 ? 1 : 0)
    for (const command of commands) {
      if (command.kind !== 'deploy-cookie') throw new Error('Expected deployment')
      const paid = command.specialPlayCookieInstanceIds ?? []
      const next = applyGameCommand(state, command)
      expect(next.players[owner].battleArea).toHaveLength(donors.length - paid.length + 1)
      expect(next.players[owner].discardPile.map(card => card.instanceId)).toEqual(expect.arrayContaining(paid))
      expect(next.players[owner].breakArea.some(card => paid.includes(card.instanceId))).toBe(false)
    }
    expect(state).toEqual(before)
    for (const phase of ['support', 'end'] as const) {
      expect(specialCommands({ ...state, phase })).toEqual([])
    }
    expect(getLegalTurnCommands(state, 'player-two')).toEqual([])
  })

  it('uses effective LV after actual Activate, not printed LV', () => {
    const state = fixture('BS11-111', ['BS11-092', 'BS11-115'])
    const source = state.players[owner].battleArea[0]
    expect(specialCommands(state)).toEqual([])
    const lowered = applyGameCommand(state, { kind: 'activate-skill', playerId: owner,
      sourceInstanceId: source.card.instanceId, trigger: 'activate', paymentIds: [],
      effectTargets: [[source.card.instanceId]] })
    expect(source.card.level).toBe(2)
    expect(specialCommands(lowered)).toEqual([{ kind: 'deploy-cookie', playerId: owner,
      instanceId: state.players[owner].hand[0].instanceId,
      specialPlayCookieInstanceIds: [source.card.instanceId] }])
  })
})

describe('Lv5 Special Play continuation', () => {
  it.each([
    ['BS11-111', false], ['BS11-111', true],
    ['BS11-113', false], ['BS11-113', true],
  ] as const)('low-HP Licorice enables %s (rested=%s)', (hand, rested) => {
    const state = fixture(hand, ['BS11-092', 'BS11-115'])
    const source = state.players[owner].battleArea[0]
    source.hpCards = source.hpCards.slice(0, 1); source.rested = rested
    state.players[owner].supportArea = [1, 2].map(i => ({ card: printed('BS11-110', i), rested: false }))
    const before = structuredClone(state)
    const options = { level: 5 as const, seed: 2026121993, searchNow: () => 0 }
    const lower = takeAiStep(state, owner, options)
    expect(lower.action).toBe('activate-skill')
    expect(lower.state.players[owner].battleArea[0].levelOverride).toBe(1)
    const deploy = takeAiStep(lower.state, owner, { ...options, memory: lower.reason?.strategyMemory })
    expect(deploy.action).toBe('deploy-cookie')
    expect(deploy.state.players[owner].battleArea.map(entry => entry.card.id)).toEqual(['BS11-115', hand])
    expect(deploy.state.players[owner].discardPile.map(card => card.instanceId)).toContain(source.card.instanceId)
    const onPlay = takeAiStep(deploy.state, owner, { ...options, memory: deploy.reason?.strategyMemory })
    expect(onPlay.action).toBe('activate-skill')
    if (hand === 'BS11-111') expect(onPlay.state.players['player-two'].battleArea).toEqual([])
    expect(state).toEqual(before)
  })

  it('retains a healthy source when there is no public finishing line', () => {
    const state = fixture('BS11-111', ['BS11-092', 'BS11-115'])
    // The one-HP defender in the positive cases can be finished by On Play;
    // do not lock a missed winning line into this conservative negative case.
    state.players['player-two'].battleArea[0].hpCards = Array.from({ length: 4 }, (_, i) => item(`healthy-foe:hp:${i}`))
    state.players[owner].supportArea = [1, 2].map(i => ({ card: printed('BS11-110', i), rested: false }))
    const decision = takeAiStep(state, owner, { level: 5, seed: 2026121993, searchNow: () => 0 })
    expect(decision.action).toBe('advance-phase')
    expect(decision.state.players[owner].battleArea.map(c => c.card.id)).toEqual(['BS11-092', 'BS11-115'])
  })

  it('unknown HP/deck and opponent hand faces do not alter public setup choice', () => {
    const state = fixture('BS11-111', ['BS11-092', 'BS11-115'])
    state.players[owner].battleArea[0].hpCards = [item('source:last-hp')]
    state.players[owner].supportArea = [1, 2].map(i => ({ card: printed('BS11-110', i), rested: false }))
    state.players['player-two'].hand = [item('foe:hidden-hand')]
    const hidden = structuredClone(state)
    for (const player of Object.values(hidden.players)) {
      player.deck = player.deck.map(card => ({ ...printed('BS12-014'), instanceId: card.instanceId }))
      for (const source of player.battleArea) source.hpCards = source.hpCards.map(card =>
        ({ ...printed('BS12-014'), instanceId: card.instanceId }))
    }
    hidden.players['player-two'].hand = hidden.players['player-two'].hand.map(card =>
      ({ ...printed('BS12-014'), instanceId: card.instanceId }))
    for (const input of [state, hidden]) {
      expect(takeAiStep(input, owner, { level: 5, seed: 2026121993, searchNow: () => 0 }).action).toBe('activate-skill')
    }
  })
})
