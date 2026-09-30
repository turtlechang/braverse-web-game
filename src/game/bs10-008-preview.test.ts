import { describe, expect, it } from 'vitest'
import {
  BS10_008_FLIP_PREVIEW_SCENARIOS,
  createBs1008FlipPreviewDemoState,
  createCardCheckDemoState,
  createCardNegativeDemoState,
  parseTestStateConfig,
} from './demo'
import { applyGameCommand } from './commands'
import { getActingPlayerId } from './controller'
import type { CookieInBattle, GameState } from './types'

const scenarios = [...BS10_008_FLIP_PREVIEW_SCENARIOS]

const bearerEntry = (state: GameState): CookieInBattle => {
  const entry = state.players['player-one'].battleArea.find(
    (candidate) => candidate.card.id === 'BS6-047',
  )
  if (!entry) throw new Error('BS10-008 preview bearer is missing')
  return entry
}

describe('BS10-008 isolated FLIP preview route', () => {
  it('is localhost-only and rejects an unknown scenario', () => {
    expect(
      parseTestStateConfig(
        '?test-state=bs10-008-flip&scenario=nonlethal',
        'localhost',
      ),
    ).toEqual({ kind: 'bs10-008-flip', scenario: 'nonlethal' })
    expect(
      parseTestStateConfig(
        '?test-state=bs10-008-flip&scenario=nonlethal',
        'example.com',
      ),
    ).toBeNull()
    expect(
      parseTestStateConfig(
        '?test-state=bs10-008-flip&scenario=unknown',
        'localhost',
      ),
    ).toBeNull()
    expect(
      parseTestStateConfig('?test-state=bs10-008-flip', 'localhost'),
    ).toBeNull()
  })

  it('keeps the generic candidate routes fail-closed for BS10-008', () => {
    expect(
      parseTestStateConfig('?test-state=card:BS10-008', 'localhost'),
    ).toEqual({ kind: 'card-check', cardNumber: 'BS10-008' })
    expect(
      parseTestStateConfig('?test-state=card-negative:BS10-008', 'localhost'),
    ).toEqual({ kind: 'card-negative', cardNumber: 'BS10-008' })
    expect(() => createCardCheckDemoState('BS10-008')).toThrow()
    expect(() => createCardNegativeDemoState('BS10-008')).toThrow()
  })

  it.each(scenarios)(
    'opens %s with real cards, printed cost, and the attack command prefix',
    (scenario) => {
      const state = createBs1008FlipPreviewDemoState(scenario)
      const bearer = bearerEntry(state)
      const survivor = state.players['player-one'].battleArea.find(
        (entry) => entry.card.id === 'BS6-079',
      )
      const attacker = state.players['player-two'].battleArea[0]?.card
      const commandKinds = state.commandLog?.map((entry) => entry.commandKind)
      const expected = {
        'nonlethal': { remainingDamage: 0, hand: 1, deck: 2, support: 1 },
        'last-hp': { remainingDamage: 0, hand: 1, deck: 2, support: 1 },
        'no-hand': { remainingDamage: 0, hand: 0, deck: 2, support: 1 },
        'two-damage': { remainingDamage: 1, hand: 1, deck: 2, support: 2 },
        'refresh-one': { remainingDamage: 0, hand: 1, deck: 1, support: 1 },
        'refresh-two': { remainingDamage: 1, hand: 1, deck: 1, support: 2 },
      }[scenario]

      expect(bearer.card).toMatchObject({
        id: 'BS6-047',
        name: 'Lemon Cookie',
        type: 'cookie',
      })
      expect(survivor?.card).toMatchObject({
        id: 'BS6-079',
        name: 'Croissant Cookie',
        type: 'cookie',
      })
      expect(attacker?.id).toBe(
        scenario === 'two-damage' || scenario === 'refresh-two'
          ? 'BS6-015'
          : 'BS6-017',
      )
      expect(attacker?.attackCost).toBe(
        scenario === 'two-damage' || scenario === 'refresh-two' ? 2 : 1,
      )
      expect(state.pendingBattle?.stage).toBe('flip')
      expect(state.pendingBattle?.remainingDamage).toBe(expected.remainingDamage)
      expect(state.players['player-one'].hand).toHaveLength(expected.hand)
      expect(state.players['player-one'].deck).toHaveLength(expected.deck)
      expect(state.players['player-two'].supportArea).toHaveLength(expected.support)
      expect(state.players['player-two'].supportArea.every((support) => support.rested && support.card.energyColor === 'red')).toBe(true)
      expect(state.pendingBattle?.revealedHpCard).toMatchObject({
        id: 'BS10-008',
        name: 'Cherry Cookie',
        type: 'cookie',
        officialType: 'flip',
        flip: {
          cost: { discardHand: 1 },
          attachedHpBonus: 1,
        },
      })
      expect(commandKinds?.slice(0, 3)).toEqual([
        'declare-attack',
        'skip-trap',
        'resolve-next-damage',
      ])
      expect(state.players['player-two'].supportArea).toHaveLength(
        attacker?.attackCost ?? 0,
      )
    },
  )

  it('activates the nonlethal FLIP with exactly one hand discard', () => {
    const state = createBs1008FlipPreviewDemoState('nonlethal')
    const payment = state.players['player-one'].hand[0]
    if (!payment) throw new Error('nonlethal preview has no hand payment')

    const resolved = applyGameCommand(state, {
      kind: 'resolve-flip',
      playerId: 'player-one',
      activate: true,
      discardHandIds: [payment.instanceId],
    })

    expect(resolved.pendingBattle).toBeNull()
    expect(bearerEntry(resolved).hpCards).toHaveLength(2)
    expect(resolved.players['player-one'].hand).toHaveLength(0)
    expect(resolved.players['player-one'].discardPile).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'BS10-008' }),
        expect.objectContaining({ instanceId: payment.instanceId }),
      ]),
    )
  })

  it('blocks no-hand activation and allows the explicit skip to resolve faint', () => {
    const state = createBs1008FlipPreviewDemoState('no-hand')
    expect(() =>
      applyGameCommand(state, {
        kind: 'resolve-flip',
        playerId: 'player-one',
        activate: true,
        discardHandIds: [],
      }),
    ).toThrow()

    const skipped = applyGameCommand(state, {
      kind: 'resolve-flip',
      playerId: 'player-one',
      activate: false,
    })
    const finished = skipped.pendingReplacement
      ? applyGameCommand(skipped, { kind: 'skip-replacement', playerId: 'player-one' })
      : skipped
    expect(finished.pendingBattle).toBeNull()
    expect(
      finished.players['player-one'].battleArea.some(
        (entry) => entry.card.id === 'BS6-047',
      ),
    ).toBe(false)
    expect(finished.players['player-one'].breakArea).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'BS6-047' })]),
    )
    expect(
      finished.players['player-one'].battleArea.some(
        (entry) => entry.card.id === 'BS6-079',
      ),
    ).toBe(true)
  })

  it('opens Refresh after the one-card deck is consumed and resumes the attack', () => {
    const state = createBs1008FlipPreviewDemoState('refresh-one')
    const payment = state.players['player-one'].hand[0]
    const refreshCookie = state.players['player-one'].discardPile.find(
      (card) => card.id === 'BS6-004',
    )
    if (!payment || !refreshCookie) {
      throw new Error('refresh-one preview lacks legal hand or Refresh Cookie')
    }

    const paid = applyGameCommand(state, {
      kind: 'resolve-flip',
      playerId: 'player-one',
      activate: true,
      discardHandIds: [payment.instanceId],
    })
    expect(paid.pendingRefresh?.playerId).toBe('player-one')
    expect(getActingPlayerId(paid)).toBe('player-one')
    expect(paid.pendingBattle?.stage).toBe('damage')

    const refreshed = applyGameCommand(paid, {
      kind: 'refresh-deck',
      playerId: 'player-one',
      cookieInstanceId: refreshCookie.instanceId,
      shuffleSeed: 7,
    })
    expect(refreshed.pendingRefresh).toBeNull()
    const finished = applyGameCommand(refreshed, {
      kind: 'resolve-next-damage',
      playerId: 'player-one',
    })
    expect(finished.pendingBattle).toBeNull()
    expect(getActingPlayerId(finished)).toBe('player-two')
    expect(bearerEntry(finished).hpCards).toHaveLength(1)
  })

  it('refreshes Refresh-two, resumes the second damage, and clears the faint queue', () => {
    const state = createBs1008FlipPreviewDemoState('refresh-two')
    const payment = state.players['player-one'].hand[0]
    const refreshCookie = state.players['player-one'].discardPile.find((card) => card.id === 'BS6-004')
    if (!payment || !refreshCookie) throw new Error('refresh-two preview lacks legal hand or Refresh Cookie')
    const paid = applyGameCommand(state, {
      kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [payment.instanceId],
    })
    expect(paid.pendingRefresh?.playerId).toBe('player-one')
    expect(getActingPlayerId(paid)).toBe('player-one')
    expect(paid.pendingBattle?.remainingDamage).toBe(1)
    const refreshed = applyGameCommand(paid, {
      kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: refreshCookie.instanceId, shuffleSeed: 7,
    })
    const finished = applyGameCommand(refreshed, { kind: 'resolve-next-damage', playerId: 'player-one' })
    const completed = finished.pendingReplacement
      ? applyGameCommand(finished, { kind: 'skip-replacement', playerId: 'player-one' })
      : finished
    expect(completed.pendingRefresh).toBeNull()
    expect(completed.pendingBattle).toBeNull()
    expect(completed.pendingFaintEffects ?? []).toEqual([])
    expect(completed.pendingReplacement).toBeNull()
    expect(getActingPlayerId(completed)).toBe('player-two')
    expect(completed.cookiesFaintedThisTurn?.['player-one']).toBe(1)
    expect(completed.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS6-079')?.hpCards).toHaveLength(1)
    expect(completed.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS6-047')).toBeUndefined()
    expect(completed.players['player-one'].breakArea).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'BS6-004' }),
      expect.objectContaining({ id: 'BS6-047' }),
    ]))
  })
})
