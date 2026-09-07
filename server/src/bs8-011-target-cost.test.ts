import { describe, expect, it } from 'vitest'
import { OFFICIAL_RED_STARTER_DECK, type CustomDeck } from '../../src/game'
import { createBs8011DoubleSkillDemoState } from '../../src/game/demo'
import { RoomStore, maskedStateFor } from './rooms'

describe('authoritative BS8-011 target cost', () => {
  it('rejects incomplete/wrong-owner commands atomically and broadcasts both HP changes', () => {
    const deck: CustomDeck = { id: 'paired-cost', name: 'Paired target transport fixture',
      entries: OFFICIAL_RED_STARTER_DECK, createdAt: '2026-09-05T00:00:00Z', updatedAt: '2026-09-05T00:00:00Z' }
    const store = new RoomStore()
    const room = store.joinRoom(store.createRoom(deck, () => {}).code, deck, () => {}, 1)
    room.status = 'in-progress'
    room.state = createBs8011DoubleSkillDemoState()
    const initial = room.state
    const own = initial.players['player-one']
    const opponent = initial.players['player-two'].battleArea[0]
    const command = { kind: 'begin-activate-skill' as const, playerId: 'player-one' as const,
      sourceInstanceId: own.battleArea[0].card.instanceId, trigger: 'activate' as const,
      paymentIds: [own.supportArea[0].card.instanceId] }
    for (const targetIds of [[], [own.battleArea[0].card.instanceId], own.battleArea.map((cookie) => cookie.card.instanceId)]) {
      expect(() => store.applyCommand(room, 'player-one', { ...command, targetIds })).toThrow()
      expect(room.state).toBe(initial)
    }
    const targetIds = [own.battleArea[0].card.instanceId, opponent.card.instanceId]
    expect(() => store.applyCommand(room, 'player-two', { ...command, targetIds })).toThrow()
    const resolved = store.applyCommand(room, 'player-one', { ...command, targetIds })
    for (const viewer of ['player-one', 'player-two'] as const) {
      const masked = maskedStateFor(room, viewer)!
      expect(masked.players['player-one'].battleArea[0].publicHp).toBe(2)
      expect(masked.players['player-two'].battleArea[0].publicHp).toBe(5)
      expect(masked.players['player-one'].supportArea).toEqual(resolved.players['player-one'].supportArea)
      expect(masked.pendingAbilityEffect).toBeUndefined()
    }
  })
})
