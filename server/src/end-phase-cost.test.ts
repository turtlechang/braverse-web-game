import { describe, expect, it } from 'vitest'
import { OFFICIAL_RED_STARTER_DECK, type CustomDeck } from '../../src/game'
import { createEndPhaseCostState } from '../../src/game/test-helpers/end-phase-helpers'
import { RoomStore, maskedStateFor } from './rooms'

const deck: CustomDeck = {
  id: 'end-phase', name: 'End phase transport fixture', entries: OFFICIAL_RED_STARTER_DECK,
  createdAt: '2026-09-05T00:00:00Z', updatedAt: '2026-09-05T00:00:00Z',
}

describe('authoritative end-phase payment', () => {
  it.each(['P-058', 'P-145'])('%s rejects bypasses and publishes the paid result consistently to both viewers', (id) => {
    const store = new RoomStore()
    const room = store.joinRoom(store.createRoom(deck, () => {}).code, deck, () => {}, 1)
    // Isolate transport authority from opening randomness; this is not a complete match test.
    room.status = 'in-progress'
    room.state = createEndPhaseCostState(id, ['BS8-103', 'BS8-020'])
    store.applyCommand(room, 'player-one', { kind: 'advance-phase', playerId: 'player-one' })
    const pending = room.state
    expect(() => store.applyCommand(room, 'player-one', { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })).toThrow()
    expect(() => store.applyCommand(room, 'player-one', { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: 'end-source', trigger: 'passive', paymentIds: [] })).toThrow()
    expect(() => store.applyCommand(room, 'player-two', { kind: 'skip-end-phase-skill', playerId: 'player-one', sourceInstanceId: 'end-source' })).toThrow()
    expect(room.state).toBe(pending)
    store.applyCommand(room, 'player-one', {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: 'end-source', trigger: 'passive',
      paymentIds: id === 'P-145' ? ['pay-0'] : [],
      costSupportToTrashIds: id === 'P-058' ? ['pay-0', 'pay-1'] : [],
    })
    const resolved = store.applyCommand(room, 'player-one', { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    for (const viewer of ['player-one', 'player-two'] as const) {
      const masked = maskedStateFor(room, viewer)!
      expect(masked.pendingAbilityEffect).toBeUndefined()
      expect(masked.players['player-one'].supportArea).toEqual(resolved.players['player-one'].supportArea)
      expect(masked.players['player-one'].discardPile).toEqual(resolved.players['player-one'].discardPile)
      expect(masked.players['player-one'].deck).toHaveLength(id === 'P-145' ? 9 : 10)
    }
  })
})
