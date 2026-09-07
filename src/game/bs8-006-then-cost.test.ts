import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { takeAiStep } from './ai'
import { getCardPoolEntry } from './card-pool'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { GameState } from './types'

const fixture = (cardNumber = 'BS8-006') => {
  let state = createCardCheckDemoState(cardNumber)
  const own = state.players['player-one']
  const opponent = state.players['player-two']
  const source = own.battleArea.find((cookie) => cookie.card.id === 'BS8-006')!
  state = applyGameCommand(state, {
    kind: 'declare-attack', playerId: 'player-one',
    attackerInstanceId: source.card.instanceId,
    targetInstanceId: opponent.battleArea[0].card.instanceId,
    supportPaymentIds: own.supportArea.slice(0, 2).map((support) => support.card.instanceId),
  })
  for (let step = 0; step < 8 && state.pendingBattle?.stage !== 'attack-effect'; step += 1) {
    state = applyGameCommand(state, state.pendingBattle?.stage === 'trap'
      ? { kind: 'skip-trap', playerId: 'player-two' }
      : { kind: 'resolve-next-damage', playerId: 'player-two' })
  }
  expect(state.pendingBattle?.stage).toBe('attack-effect')
  expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(5)
  return state
}

const resolveThen = (state: GameState, targetIds: string[]) => applyGameCommand(state, {
  kind: 'resolve-attack-effect', playerId: 'player-one', targetIds,
})

describe('BS8-006 optional paired selection cost after an actual RR attack', () => {
  it.each(['BS8-006', 'BS8-006@1'])('%s may decline the entire Then without undoing attack payment or damage', (id) => {
    const state = fixture(id)
    const next = resolveThen(state, [])
    expect(next.players['player-one'].battleArea).toEqual(state.players['player-one'].battleArea)
    expect(next.players['player-two'].battleArea).toEqual(state.players['player-two'].battleArea)
    expect(next.players['player-one'].supportArea.filter((support) => support.rested)).toHaveLength(2)
    expect(next.pendingBattle).toBeNull()
  })

  it('rejects incomplete, duplicate, and same-player pairs before either Cookie receives damage', () => {
    const state = fixture()
    const before = structuredClone(state)
    const own = state.players['player-one'].battleArea
    const opponent = state.players['player-two'].battleArea
    for (const ids of [[own[0].card.instanceId], own.slice(0, 2).map((cookie) => cookie.card.instanceId),
      [opponent[0].card.instanceId, opponent[0].card.instanceId]]) {
      expect(() => resolveThen(state, ids)).toThrow()
      expect(state).toEqual(before)
    }
  })

  it('may select a friendly ally and a different opponent from the attack target', () => {
    const state = fixture()
    const own = state.players['player-one'].battleArea
    const opponent = state.players['player-two'].battleArea
    const next = resolveThen(state, [own[1].card.instanceId, opponent[1].card.instanceId])
    expect(next.players['player-one'].battleArea[0]).toEqual(own[0])
    expect(next.players['player-one'].battleArea[1].hpCards).toHaveLength(own[1].hpCards.length - 1)
    expect(next.players['player-two'].battleArea[0]).toEqual(opponent[0])
    expect(next.players['player-two'].battleArea[1].hpCards).toHaveLength(opponent[1].hpCards.length - 1)
    expect(next.players['player-one'].supportArea.filter((support) => support.rested)).toHaveLength(2)
    expect(next.pendingBattle).toBeNull()
  })

  it('completes the already selected opponent damage even when its source faints first', () => {
    const state = fixture()
    const source = state.players['player-one'].battleArea[0]
    const target = state.players['player-two'].battleArea[0]
    expect(source.hpCards).toHaveLength(1)
    const next = resolveThen(state, [source.card.instanceId, target.card.instanceId])
    expect(next.players['player-one'].battleArea.some((cookie) => cookie.card.instanceId === source.card.instanceId)).toBe(false)
    expect(next.players['player-one'].breakArea.some((card) => card.instanceId === source.card.instanceId)).toBe(true)
    expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
    expect(next.pendingBattle).toBeNull()
  })

  it.each([false, true])('locks both targets across HP FLIP and resumes the original attack (opponent first=%s)', (opponentFirst) => {
    const state = fixture()
    const own = state.players['player-one'].battleArea[1]
    const opponent = state.players['player-two'].battleArea[0]
    const record = getCardPoolEntry('BS8-001')!
    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted' || !converted.gameCard.flip) throw new Error('Missing formal FLIP')
    opponent.hpCards[opponent.hpCards.length - 1] = { ...converted.gameCard, instanceId: 'then-real-flip' }
    const ids = [own.card.instanceId, opponent.card.instanceId]
    if (opponentFirst) ids.reverse()
    let next = resolveThen(state, ids)
    expect(next.pendingBattle?.effectDamageSequence?.remainingTargetInstanceIds).toEqual([ids[1]])
    let sawFlip = false
    for (let step = 0; step < 12 && next.pendingBattle; step += 1) {
      if (next.pendingBattle.stage === 'flip') {
        sawFlip = true
        next = applyGameCommand(next, { kind: 'resolve-flip', playerId: 'player-two', activate: false })
      } else {
        next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: next.pendingBattle.damagePlayerId ?? next.pendingBattle.defenderPlayerId })
      }
    }
    expect(sawFlip).toBe(true)
    expect(next.players['player-one'].battleArea[1].hpCards).toHaveLength(own.hpCards.length - 1)
    expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
    expect(next.pendingBattle).toBeNull()
  })

  it.each([1, 2, 3, 4, 5] as const)('AI Lv.%s completes Then with a legal pair or declines it', (level) => {
    const state = fixture()
    // Keep this selection regression separate from faint replacement strategy.
    state.players['player-one'].battleArea[0].hpCards = state.players['player-one'].battleArea[1].hpCards
      .map((card, index) => ({ ...card, instanceId: `ai-source-hp-${index}` }))
    const result = takeAiStep(state, 'player-one', { level, seed: 1 })
    expect(result.state.pendingBattle).toBeNull()
    const damage = (['player-one', 'player-two'] as const).map((playerId) =>
      state.players[playerId].battleArea.reduce((sum, cookie) => sum + cookie.hpCards.length, 0) -
      result.state.players[playerId].battleArea.reduce((sum, cookie) => sum + cookie.hpCards.length, 0))
    expect([[0, 0], [1, 1]]).toContainEqual(damage)
    expect(result.state.players['player-one'].supportArea.filter((support) => support.rested)).toHaveLength(2)
  })
})
