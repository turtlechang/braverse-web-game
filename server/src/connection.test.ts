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

  it('join-room 成功後雙方都會收到各自視角的 match-start', () => {
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
    expect(hostStart).toMatchObject({ type: 'match-start', viewerId: 'player-one' })
    expect(guestStart).toMatchObject({ type: 'match-start', viewerId: 'player-two' })
    if (hostStart?.type !== 'match-start' || guestStart?.type !== 'match-start') {
      throw new Error('unexpected message')
    }
    expect(hostStart.seed).toBe(guestStart.seed)
    // 對手手牌只看到張數,看不到內容。
    expect(hostStart.view.opponent.handCount).toBeGreaterThan(0)
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

    manager.handleMessage(
      hostSocket,
      JSON.stringify({
        type: 'submit-command',
        command: { kind: 'keep-opening-hand', playerId: 'player-one' },
      }),
    )

    expect(hostSocket.last()).toMatchObject({ type: 'state-update' })
    expect(guestSocket.last()).toMatchObject({ type: 'state-update' })
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

    // player-two 冒充 player-one 送出指令,應被拒絕。
    manager.handleMessage(
      guestSocket,
      JSON.stringify({
        type: 'submit-command',
        command: { kind: 'keep-opening-hand', playerId: 'player-one' },
      }),
    )

    expect(guestSocket.last()).toMatchObject({ type: 'command-rejected' })
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
