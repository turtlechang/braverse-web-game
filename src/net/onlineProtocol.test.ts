import { describe, expect, it } from 'vitest'
import {
  isClientMessage,
  isPublicIntent,
  isPublicIntentDraft,
} from './onlineProtocol'

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

  it('validates every server-authoritative opening action shape', () => {
    for (const action of [
      { kind: 'rps', choice: 'rock' },
      { kind: 'choose-order', goFirst: true },
      { kind: 'mulligan', replaceAll: false },
      { kind: 'force-mulligan' },
      { kind: 'mulligan-compensation', draw: true },
      { kind: 'starting-cookie', instanceId: 'cookie-1' },
    ]) {
      expect(
        isClientMessage({ type: 'submit-opening-action', action }),
      ).toBe(true)
    }
    expect(
      isClientMessage({
        type: 'submit-opening-action',
        action: { kind: 'rps', choice: 'fire' },
      }),
    ).toBe(false)
    expect(
      isClientMessage({
        type: 'submit-opening-action',
        action: { kind: 'starting-cookie', instanceId: 123 },
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

  it('validates online trap trash-to-deck target ids', () => {
    expect(
      isClientMessage({
        type: 'submit-command',
        command: {
          kind: 'play-trap',
          playerId: 'player-one',
          trapInstanceId: 'bs2-079-online',
          paymentIds: ['purple-support'],
          targetIds: ['attacker'],
          trashToDeckIds: ['trash-1', 'trash-2'],
        },
      }),
    ).toBe(true)
    expect(
      isClientMessage({
        type: 'submit-command',
        command: {
          kind: 'play-trap',
          playerId: 'player-one',
          trapInstanceId: 'bs2-079-online',
          paymentIds: ['purple-support'],
          targetIds: ['attacker'],
          trashToDeckIds: ['trash-1', 2],
        },
      }),
    ).toBe(false)
  })

  it('validates the stage activation faint cost (BS3-024)', () => {
    expect(
      isClientMessage({
        type: 'submit-command',
        command: {
          kind: 'activate-stage',
          playerId: 'player-one',
          paymentIds: ['red-support-1', 'red-support-2'],
          trashBattleCookieIds: ['red-cookie'],
        },
      }),
    ).toBe(true)
    expect(
      isClientMessage({
        type: 'submit-command',
        command: {
          kind: 'begin-activate-stage',
          playerId: 'player-one',
          paymentIds: ['red-support-1', 'red-support-2'],
          trashBattleCookieIds: [42],
        },
      }),
    ).toBe(false)
  })

  it('accepts BS3-029 faint-effect payment ids and rejects non-string ids', () => {
    expect(
      isClientMessage({
        type: 'submit-command',
        command: {
          kind: 'resolve-faint-effect',
          playerId: 'player-one',
          targetIds: ['yellow-cookie'],
          paymentIds: ['yellow-support'],
        },
      }),
    ).toBe(true)
    expect(
      isClientMessage({
        type: 'submit-command',
        command: {
          kind: 'resolve-faint-effect',
          playerId: 'player-one',
          targetIds: ['yellow-cookie'],
          paymentIds: [42],
        },
      }),
    ).toBe(false)
  })
})

describe('公開互動意圖協定', () => {
  it('接受不含敏感牌面資料的公開意圖草稿', () => {
    const draft = {
      type: 'selecting-target',
      sourceInstanceId: 'cookie-instance',
      targetScope: 'opponent-battle-cookie',
      requiredCount: 1,
      selectedCount: 0,
      progress: [
        { key: 'payment', label: '能量', state: 'done' },
        { key: 'target', label: '目標', state: 'active' },
      ],
    }

    expect(isPublicIntentDraft(draft)).toBe(true)
    expect(
      isClientMessage({ type: 'set-public-intent', intent: draft }),
    ).toBe(true)
  })

  it('拒絕把未定義的目標範圍或非整數進度送上線', () => {
    expect(
      isPublicIntentDraft({
        type: 'selecting-target',
        targetScope: 'opponent-hand',
        requiredCount: 1,
        selectedCount: 0,
      }),
    ).toBe(false)
    expect(
      isPublicIntentDraft({
        type: 'selecting-payment',
        requiredCount: 1.5,
        selectedCount: 0,
      }),
    ).toBe(false)
  })

  it('只接受伺服器補齊序號與版本後的公開意圖', () => {
    expect(
      isPublicIntent({
        type: 'selecting-payment',
        intentId: 'player-one-1',
        actorId: 'player-one',
        sequence: 1,
        stateVersion: 4,
        updatedAt: '2026-07-16T00:00:00.000Z',
        requiredCount: 1,
        selectedCount: 0,
      }),
    ).toBe(true)
    expect(
      isPublicIntent({
        type: 'selecting-payment',
        intentId: 'player-one-1',
        actorId: 'player-one',
        sequence: 1,
        stateVersion: 4,
        requiredCount: 1,
        selectedCount: 0,
      }),
    ).toBe(false)
  })
})
