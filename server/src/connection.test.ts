import { describe, expect, it } from 'vitest'
import { OFFICIAL_RED_STARTER_DECK, type CustomDeck } from '../../src/game'
import type { ServerMessage } from '../../src/net/onlineProtocol'
import { ConnectionManager, type SocketLike } from './connection'
import { RoomStore } from './rooms'

const createTestDeck = (id: string): CustomDeck => ({
  id,
  name: `測試牌組 ${id}`,
  entries: OFFICIAL_RED_STARTER_DECK,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

class MockSocket implements SocketLike {
  received: ServerMessage[] = []

  send(data: string): void {
    this.received.push(JSON.parse(data) as ServerMessage)
  }

  last(): ServerMessage | undefined {
    return this.received[this.received.length - 1]
  }
}

const submitOpeningAction = (
  manager: ConnectionManager,
  socket: MockSocket,
  action: Record<string, unknown>,
) =>
  manager.handleMessage(
    socket,
    JSON.stringify({ type: 'submit-opening-action', action }),
  )

const completeOpening = (
  manager: ConnectionManager,
  hostSocket: MockSocket,
  guestSocket: MockSocket,
) => {
  submitOpeningAction(manager, hostSocket, { kind: 'rps', choice: 'rock' })
  submitOpeningAction(manager, guestSocket, {
    kind: 'rps',
    choice: 'scissors',
  })
  submitOpeningAction(manager, hostSocket, {
    kind: 'choose-order',
    goFirst: true,
  })

  for (let step = 0; step < 100; step += 1) {
    if (hostSocket.last()?.type === 'match-start') return
    const update = hostSocket.last()
    if (update?.type !== 'opening-update') {
      throw new Error('missing opening update')
    }
    const actorSocket =
      update.opening.actorId === 'player-two' ? guestSocket : hostSocket
    switch (update.opening.stage) {
      case 'mulligan':
        submitOpeningAction(manager, actorSocket, {
          kind: 'mulligan',
          replaceAll: false,
        })
        break
      case 'forced-mulligan':
        submitOpeningAction(manager, actorSocket, { kind: 'force-mulligan' })
        break
      case 'compensation':
        submitOpeningAction(manager, actorSocket, {
          kind: 'mulligan-compensation',
          draw: false,
        })
        break
      case 'starting-cookie':
        for (const [playerId, socket] of [
          ['player-one', hostSocket],
          ['player-two', guestSocket],
        ] as const) {
          const current = socket.last()
          if (
            current?.type !== 'opening-update' ||
            current.opening.players[playerId].submitted
          ) {
            continue
          }
          const cookie = current.state?.players[playerId].hand.find(
            (card) => card.type === 'cookie',
          )
          if (!cookie) throw new Error('missing opening cookie')
          submitOpeningAction(manager, socket, {
            kind: 'starting-cookie',
            instanceId: cookie.instanceId,
          })
        }
        break
      case 'rps':
      case 'choose-order':
        throw new Error(`unexpected opening stage: ${update.opening.stage}`)
    }
  }
  throw new Error('opening did not finish')
}

describe('ConnectionManager', () => {
  it('create-room 回傳 room-created 並記錄連線為 player-one', () => {
    const manager = new ConnectionManager(new RoomStore())
    const socket = new MockSocket()

    manager.handleMessage(
      socket,
      JSON.stringify({ type: 'create-room', deck: createTestDeck('one') }),
    )

    expect(socket.last()).toMatchObject({ type: 'room-created' })
  })

  it('join-room 成功後雙方收到保密猜拳的 opening-update', () => {
    const manager = new ConnectionManager(new RoomStore())
    const hostSocket = new MockSocket()
    const guestSocket = new MockSocket()

    manager.handleMessage(
      hostSocket,
      JSON.stringify({ type: 'create-room', deck: createTestDeck('one') }),
    )
    const created = hostSocket.last()
    if (created?.type !== 'room-created') throw new Error('unexpected message')

    manager.handleMessage(
      guestSocket,
      JSON.stringify({
        type: 'join-room',
        code: created.code,
        deck: createTestDeck('two'),
      }),
    )

    const hostStart = hostSocket.last()
    const guestStart = guestSocket.last()
    expect(hostStart).toMatchObject({ type: 'opening-update', viewerId: 'player-one' })
    expect(guestStart).toMatchObject({ type: 'opening-update', viewerId: 'player-two' })
    if (
      hostStart?.type !== 'opening-update' ||
      guestStart?.type !== 'opening-update'
    ) {
      throw new Error('unexpected message')
    }
    expect(hostStart.state).toBeNull()
    expect(guestStart.state).toBeNull()
    expect(hostStart.opening.rpsResult).toBeNull()
    expect(guestStart.opening.rpsResult).toBeNull()
  })

  it('加入不存在的房間會收到 room-join-error', () => {
    const manager = new ConnectionManager(new RoomStore())
    const socket = new MockSocket()

    manager.handleMessage(
      socket,
      JSON.stringify({ type: 'join-room', code: 'ZZZZ', deck: createTestDeck('two') }),
    )

    expect(socket.last()).toMatchObject({ type: 'room-join-error' })
  })

  it('會拒絕格式錯誤的初始訊息與已連線玩家的錯誤指令', () => {
    const manager = new ConnectionManager(new RoomStore())
    const socket = new MockSocket()

    manager.handleMessage(socket, '{not-json')
    expect(socket.last()).toMatchObject({
      type: 'room-join-error',
      reason: '用戶端訊息格式無效。',
    })

    manager.handleMessage(
      socket,
      JSON.stringify({ type: 'create-room', deck: createTestDeck('one') }),
    )
    manager.handleMessage(
      socket,
      JSON.stringify({
        type: 'submit-command',
        command: { kind: 'advance-phase', playerId: 'not-a-player' },
      }),
    )

    expect(socket.last()).toMatchObject({
      type: 'command-rejected',
      reason: '用戶端訊息格式無效。',
    })
  })

  it('submit-command 成功後雙方都會收到 state-update', () => {
    const manager = new ConnectionManager(new RoomStore())
    const hostSocket = new MockSocket()
    const guestSocket = new MockSocket()

    manager.handleMessage(
      hostSocket,
      JSON.stringify({ type: 'create-room', deck: createTestDeck('one') }),
    )
    const created = hostSocket.last()
    if (created?.type !== 'room-created') throw new Error('unexpected message')

    manager.handleMessage(
      guestSocket,
      JSON.stringify({
        type: 'join-room',
        code: created.code,
        deck: createTestDeck('two'),
      }),
    )
    completeOpening(manager, hostSocket, guestSocket)

    manager.handleMessage(
      hostSocket,
      JSON.stringify({
        type: 'submit-command',
        command: { kind: 'advance-phase', playerId: 'player-one' },
      }),
    )

    expect(hostSocket.last()).toMatchObject({ type: 'state-update' })
    expect(guestSocket.last()).toMatchObject({ type: 'state-update' })
  })

  it('公開意圖會同步給雙方，成功指令後會清除發動者意圖', () => {
    const manager = new ConnectionManager(new RoomStore())
    const hostSocket = new MockSocket()
    const guestSocket = new MockSocket()

    manager.handleMessage(
      hostSocket,
      JSON.stringify({ type: 'create-room', deck: createTestDeck('one') }),
    )
    const created = hostSocket.last()
    if (created?.type !== 'room-created') throw new Error('unexpected message')
    manager.handleMessage(
      guestSocket,
      JSON.stringify({
        type: 'join-room',
        code: created.code,
        deck: createTestDeck('two'),
      }),
    )
    completeOpening(manager, hostSocket, guestSocket)

    manager.handleMessage(
      hostSocket,
      JSON.stringify({
        type: 'set-public-intent',
        intent: {
          type: 'selecting-target',
          targetScope: 'opponent-battle-cookie',
          requiredCount: 1,
          selectedCount: 0,
        },
      }),
    )

    expect(hostSocket.last()).toMatchObject({
      type: 'public-intent-update',
      playerId: 'player-one',
      intent: { type: 'selecting-target', actorId: 'player-one' },
    })
    expect(guestSocket.last()).toMatchObject({
      type: 'public-intent-update',
      playerId: 'player-one',
    })

    manager.handleMessage(
      hostSocket,
      JSON.stringify({
        type: 'submit-command',
        command: { kind: 'advance-phase', playerId: 'player-one' },
      }),
    )

    expect(hostSocket.received).toContainEqual(
      expect.objectContaining({
        type: 'public-intent-update',
        playerId: 'player-one',
        intent: null,
      }),
    )
  })

  it('submit-command 送出非法指令會收到 command-rejected,不影響另一方', () => {
    const manager = new ConnectionManager(new RoomStore())
    const hostSocket = new MockSocket()
    const guestSocket = new MockSocket()

    manager.handleMessage(
      hostSocket,
      JSON.stringify({ type: 'create-room', deck: createTestDeck('one') }),
    )
    const created = hostSocket.last()
    if (created?.type !== 'room-created') throw new Error('unexpected message')

    manager.handleMessage(
      guestSocket,
      JSON.stringify({
        type: 'join-room',
        code: created.code,
        deck: createTestDeck('two'),
      }),
    )
    completeOpening(manager, hostSocket, guestSocket)

    // player-two 冒充 player-one 送出指令,應被拒絕。
    manager.handleMessage(
      guestSocket,
      JSON.stringify({
        type: 'submit-command',
        command: { kind: 'advance-phase', playerId: 'player-one' },
      }),
    )

    expect(guestSocket.last()).toMatchObject({ type: 'command-rejected' })
    expect(hostSocket.last()).toMatchObject({ type: 'match-start' })
  })

  it('只向對手轉送目前場面中合法的攻擊者與付款支援卡', () => {
    const store = new RoomStore()
    const manager = new ConnectionManager(store)
    const hostSocket = new MockSocket()
    const guestSocket = new MockSocket()

    manager.handleMessage(
      hostSocket,
      JSON.stringify({ type: 'create-room', deck: createTestDeck('one') }),
    )
    const created = hostSocket.last()
    if (created?.type !== 'room-created') throw new Error('unexpected message')
    manager.handleMessage(
      guestSocket,
      JSON.stringify({
        type: 'join-room',
        code: created.code,
        deck: createTestDeck('two'),
      }),
    )
    completeOpening(manager, hostSocket, guestSocket)

    const room = store.getRoom(created.code)
    const player = room?.state?.players['player-one']
    if (!player) throw new Error('missing player state')
    const cards = [...player.hand, ...player.deck]
    const attacker = cards.find((card) => card.type === 'cookie')
    const support = cards.find(
      (card) => card.instanceId !== attacker?.instanceId,
    )
    if (!attacker || attacker.type !== 'cookie' || !support) {
      throw new Error('missing test cards')
    }
    player.battleArea = [{ card: attacker, hpCards: [], rested: false }]
    player.supportArea = [{ card: support, rested: false }]

    manager.handleMessage(
      hostSocket,
      JSON.stringify({
        type: 'update-attack-selection',
        selection: {
          attackerInstanceId: attacker.instanceId,
          supportPaymentIds: [support.instanceId, support.instanceId, 'fake-id'],
        },
      }),
    )

    expect(guestSocket.last()).toEqual({
      type: 'opponent-attack-selection',
      selection: {
        attackerInstanceId: attacker.instanceId,
        supportPaymentIds: [support.instanceId],
      },
    })
    expect(hostSocket.last()).toMatchObject({ type: 'match-start' })
  })

  it('斷線會通知對手 match-ended 並清除房間', () => {
    const store = new RoomStore()
    const manager = new ConnectionManager(store)
    const hostSocket = new MockSocket()
    const guestSocket = new MockSocket()

    manager.handleMessage(
      hostSocket,
      JSON.stringify({ type: 'create-room', deck: createTestDeck('one') }),
    )
    const created = hostSocket.last()
    if (created?.type !== 'room-created') throw new Error('unexpected message')

    manager.handleMessage(
      guestSocket,
      JSON.stringify({
        type: 'join-room',
        code: created.code,
        deck: createTestDeck('two'),
      }),
    )

    manager.handleDisconnect(hostSocket)

    expect(guestSocket.last()).toMatchObject({
      type: 'match-ended',
      reason: 'opponent-disconnected',
    })
    expect(store.getRoom(created.code)).toBeUndefined()
  })
})
