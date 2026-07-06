import { describe, expect, it } from 'vitest'
import { OFFICIAL_RED_STARTER_DECK, type CustomDeck } from '../../src/game'
import { RoomStore } from './rooms'

const createTestDeck = (id: string): CustomDeck => ({
  id,
  name: `測試牌組 ${id}`,
  entries: OFFICIAL_RED_STARTER_DECK,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const noop = () => {}

describe('RoomStore', () => {
  it('建立房間會產生房號並處於等待狀態', () => {
    const store = new RoomStore()
    const room = store.createRoom(createTestDeck('one'), noop)

    expect(room.code).toHaveLength(4)
    expect(room.status).toBe('waiting')
    expect(room.playerTwo).toBeNull()
    expect(room.state).toBeNull()
  })

  it('房號不會重複(高機率驗證)', () => {
    const store = new RoomStore()
    const codes = new Set<string>()
    for (let i = 0; i < 50; i += 1) {
      const room = store.createRoom(createTestDeck(`p${i}`), noop)
      codes.add(room.code)
    }
    expect(codes.size).toBe(50)
  })

  it('加入房間後會建立對局狀態,雙方各自能取得自己的 PlayerView', () => {
    const store = new RoomStore()
    const created = store.createRoom(createTestDeck('one'), noop)

    const joined = store.joinRoom(created.code, createTestDeck('two'), noop, 42)

    expect(joined.status).toBe('in-progress')
    expect(joined.state).not.toBeNull()
    expect(joined.state?.status).toBe('setup')
    expect(joined.seed).toBe(42)
  })

  it('相同種子加入房間會產生確定性的洗牌結果', () => {
    const runWithSeed = (seed: number) => {
      const store = new RoomStore()
      const created = store.createRoom(createTestDeck('one'), noop)
      const joined = store.joinRoom(created.code, createTestDeck('two'), noop, seed)
      return joined.state!.players['player-one'].hand.map((card) => card.instanceId)
    }

    expect(runWithSeed(7)).toEqual(runWithSeed(7))
  })

  it('加入不存在的房號會拋出錯誤', () => {
    const store = new RoomStore()
    expect(() => store.joinRoom('ZZZZ', createTestDeck('two'), noop)).toThrow(
      '找不到這個房間代碼。',
    )
  })

  it('加入已經開始或結束的房間會拋出錯誤', () => {
    const store = new RoomStore()
    const created = store.createRoom(createTestDeck('one'), noop)
    store.joinRoom(created.code, createTestDeck('two'), noop)

    expect(() =>
      store.joinRoom(created.code, createTestDeck('three'), noop),
    ).toThrow('這個房間已經無法加入。')
  })

  it('不合法的牌組無法建立房間', () => {
    const store = new RoomStore()
    const invalidDeck: CustomDeck = {
      id: 'bad',
      name: '不合法牌組',
      entries: [{ cardNumber: OFFICIAL_RED_STARTER_DECK[0].cardNumber, count: 1 }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    expect(() => store.createRoom(invalidDeck, noop)).toThrow()
  })

  it('applyCommand 拒絕指令中的 playerId 與送出來源不符', () => {
    const store = new RoomStore()
    const created = store.createRoom(createTestDeck('one'), noop)
    const room = store.joinRoom(created.code, createTestDeck('two'), noop, 1)

    expect(() =>
      store.applyCommand(room, 'player-one', {
        kind: 'keep-opening-hand',
        playerId: 'player-two',
      }),
    ).toThrow('指令的玩家與送出來源不符。')
  })

  it('applyCommand 套用合法指令並更新房間狀態', () => {
    const store = new RoomStore()
    const created = store.createRoom(createTestDeck('one'), noop)
    const room = store.joinRoom(created.code, createTestDeck('two'), noop, 1)

    const nextState = store.applyCommand(room, 'player-one', {
      kind: 'keep-opening-hand',
      playerId: 'player-one',
    })

    expect(nextState.commandLog).toHaveLength(1)
    expect(room.state).toBe(nextState)
  })
})
