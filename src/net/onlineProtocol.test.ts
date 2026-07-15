import { describe, expect, it } from 'vitest'
import { isClientMessage } from './onlineProtocol'

describe('online protocol validation', () => {
  it('accepts a bounded player name and rejects blank or oversized names', () => {
    const deck = {
      id: 'deck',
      name: 'Deck',
      entries: [],
      createdAt: '2026-07-15T00:00:00.000Z',
      updatedAt: '2026-07-15T00:00:00.000Z',
    }

    expect(
      isClientMessage({ type: 'create-room', deck, playerName: '玩家一號' }),
    ).toBe(true)
    expect(
      isClientMessage({ type: 'create-room', deck, playerName: '   ' }),
    ).toBe(false)
    expect(
      isClientMessage({ type: 'create-room', deck, playerName: 'a'.repeat(21) }),
    ).toBe(false)
  })

  it('validates transient attack selection payloads', () => {
    expect(
      isClientMessage({
        type: 'update-attack-selection',
        selection: {
          attackerInstanceId: 'attacker-1',
          supportPaymentIds: ['support-1'],
        },
      }),
    ).toBe(true)
    expect(
      isClientMessage({
        type: 'update-attack-selection',
        selection: {
          attackerInstanceId: 'attacker-1',
          supportPaymentIds: [123],
        },
      }),
    ).toBe(false)
  })

  it('accepts guided begin commands with a first-effect target selection', () => {
    expect(
      isClientMessage({
        type: 'submit-command',
        command: {
          kind: 'begin-activate-skill',
          playerId: 'player-one',
          sourceInstanceId: 'cookie-1',
          trigger: 'activate',
          paymentIds: ['support-1'],
          targetIds: ['target-1'],
        },
      }),
    ).toBe(true)
    expect(
      isClientMessage({
        type: 'submit-command',
        command: {
          kind: 'begin-play-item',
          playerId: 'player-one',
          instanceId: 'item-1',
          paymentIds: [],
          targetIds: [123],
        },
      }),
    ).toBe(false)
  })
})
