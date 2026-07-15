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
    // 對手手牌長度不變,但內容被遮罩(看不到真實卡牌)。
    const opponentHand = hostStart.state.players['player-two'].hand
    expect(opponentHand.length).toBeGreaterThan(0)
    expect(opponentHand.every((card) => card.name === '???')).toBe(true)
    // 自己的手牌維持真實內容。
    expect(
      hostStart.state.players['player-one'].hand.every(
        (card) => card.name !== '???',
      ),
    ).toBe(true)
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
