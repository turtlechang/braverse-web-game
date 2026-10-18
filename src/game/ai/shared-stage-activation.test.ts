import { describe, expect, it } from 'vitest'
import { getCardPoolEntry } from '../card-pool'
import { canActivateStage, getStageActivationSource } from '../card-abilities'
import { createCard } from '../starter-deck'
import { fixture } from '../st7-020-demo'
import { takeAiStep } from '../ai'
import type { AiLevel } from './types'

const owner = 'player-one'
const opponent = 'player-two'

const fixtureWithOpponentOwnedSharedStage = () => {
  const state = fixture()
  const ownerState = state.players[owner]
  const opponentState = state.players[opponent]
  const stageRecord = getCardPoolEntry('BS9-118')
  if (!stageRecord) throw new Error('Official BS9-118 card data is required')
  if (!ownerState.stage) throw new Error('Fixture requires an owner-controlled Stage')
  if (ownerState.hand.length === 0) {
    const discardableCard = ownerState.deck.pop()
    if (!discardableCard) throw new Error('Fixture requires one discardable hand card')
    ownerState.hand.push(discardableCard)
  }

  const sharedStage = createCard(stageRecord, opponent, 1)
  ownerState.stage.rested = true
  opponentState.stage = { card: sharedStage, rested: false }

  return { state, sharedStage }
}

describe('AI activation of an opponent-owned shared Stage', () => {
  it.each([3, 4, 5] as AiLevel[])(
    'Lv%s evaluates the real BS9-118 activation without failing on its discard cost',
    level => {
      const { state } = fixtureWithOpponentOwnedSharedStage()
      const ownerBefore = structuredClone(state.players[owner])

      expect(getStageActivationSource(state, owner)).toMatchObject({
        ownerId: opponent,
        stage: { card: { id: 'BS9-118' }, rested: false },
      })
      expect(canActivateStage(state, owner)).toBe(true)

      const decision = takeAiStep(state, owner, { level, searchNow: () => 0 })

      expect(decision.action).not.toBe('error')
      expect(decision.error).toBeUndefined()
      expect(state.players[owner]).toEqual(ownerBefore)
    },
  )

  it('Lv2 pays the opponent-owned stage cost and resolves its HP target', () => {
    const { state, sharedStage } = fixtureWithOpponentOwnedSharedStage()
    const ownerBefore = structuredClone(state.players[owner])
    const hpBefore = state.players[opponent].battleArea.reduce(
      (total, cookie) => total + cookie.hpCards.length,
      0,
    )

    const decision = takeAiStep(state, owner, { level: 2, searchNow: () => 0 })

    expect(decision.action).toBe('activate-stage')
    expect(decision.error).toBeUndefined()
    expect(decision.state.players[owner].hand.length).toBe(ownerBefore.hand.length - 1)
    expect(decision.state.players[owner].discardPile.length).toBe(ownerBefore.discardPile.length + 1)
    expect(decision.state.players[opponent].battleArea.reduce(
      (total, cookie) => total + cookie.hpCards.length,
      0,
    )).toBe(hpBefore - 1)
    expect(decision.state.skillUsesThisTurn).toContain(sharedStage.instanceId)
    expect(state.players[owner]).toEqual(ownerBefore)
  })
})
