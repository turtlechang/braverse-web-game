import { describe, expect, it } from 'vitest'
import { OFFICIAL_RED_STARTER_DECK, type CustomDeck } from '../../src/game'
import {
  RoomStore,
  openingSnapshotFor,
  publicIntentFor,
  publicIntentSequenceFor,
  type Room,
} from './rooms'

const createTestDeck = (id: string): CustomDeck => ({
  id,
  name: `測試牌組 ${id}`,
  entries: OFFICIAL_RED_STARTER_DECK,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const noop = () => {}

const beginOpeningGame = (store: RoomStore, room: Room): Room => {
  store.submitOpeningAction(room, 'player-one', {
    kind: 'rps',
    choice: 'rock',
  })
  store.submitOpeningAction(room, 'player-two', {
    kind: 'rps',
    choice: 'scissors',
  })
  store.submitOpeningAction(room, 'player-one', {
    kind: 'choose-order',
    goFirst: true,
  })
  return room
}

const completeOpening = (store: RoomStore, room: Room): Room => {
  if (!room.state) beginOpeningGame(store, room)

  while (room.status === 'opening') {
    const opening = openingSnapshotFor(room, 'player-one')!
    switch (opening.stage) {
      case 'mulligan':
        store.submitOpeningAction(room, opening.actorId!, {
          kind: 'mulligan',
          replaceAll: false,
        })
        break
      case 'forced-mulligan':
        store.submitOpeningAction(room, opening.actorId!, {
          kind: 'force-mulligan',
        })
        break
      case 'compensation':
        store.submitOpeningAction(room, opening.actorId!, {
          kind: 'mulligan-compensation',
          draw: false,
        })
        break
      case 'starting-cookie':
        for (const playerId of ['player-one', 'player-two'] as const) {
          const current = openingSnapshotFor(room, playerId)
          if (!current || current.players[playerId].submitted) continue
          const cookie = room.state!.players[playerId].hand.find(
            (card) => card.type === 'cookie',
          )!
          store.submitOpeningAction(room, playerId, {
            kind: 'starting-cookie',
            instanceId: cookie.instanceId,
          })
        }
        break
      case 'rps':
      case 'choose-order':
        throw new Error(`unexpected opening stage: ${opening.stage}`)
    }
  }
  return room
}

describe('RoomStore', () => {
  it('公開意圖只解析公開區域，並以序號保護清除事件', () => {
    const store = new RoomStore()
    const created = store.createRoom(createTestDeck('one'), noop)
    const room = store.joinRoom(created.code, createTestDeck('two'), noop, 42)
    completeOpening(store, room)

    const source = room.state!.players['player-one'].battleArea[0].card
    const opponentCookie = room.state!.players['player-two'].battleArea[0].card
    const hiddenCard = room.state!.players['player-one'].hand[0]
    const intent = store.setPublicIntent(room, 'player-one', {
      type: 'selecting-target',
      sourceInstanceId: source.instanceId,
      targetScope: 'opponent-battle-cookie',
      requiredCount: 1,
      selectedCount: 1,
      highlightedTargetInstanceIds: [
        opponentCookie.instanceId,
        hiddenCard.instanceId,
      ],
    })

    expect(intent.source?.instanceId).toBe(source.instanceId)
    expect(intent.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(intent.highlightedTargetInstanceIds).toEqual([
      opponentCookie.instanceId,
    ])
    expect(publicIntentFor(room, 'player-one')).toEqual(intent)
    const updatedIntent = store.setPublicIntent(room, 'player-one', {
      type: 'selecting-target',
      sourceInstanceId: source.instanceId,
      targetScope: 'opponent-battle-cookie',
      requiredCount: 1,
      selectedCount: 0,
      highlightedTargetInstanceIds: [],
    })
    expect(updatedIntent.expiresAt).toBe(intent.expiresAt)
    expect(publicIntentSequenceFor(room, 'player-one')).toBe(2)

    expect(store.clearPublicIntent(room, 'player-one', 'stale-id')).toBe(false)
    expect(store.clearPublicIntent(room, 'player-one', updatedIntent.intentId)).toBe(true)
    expect(publicIntentFor(room, 'player-one')).toBeNull()
    expect(publicIntentSequenceFor(room, 'player-one')).toBe(3)
  })

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

  it('加入房間後先進入保密猜拳,尚未建立對局狀態', () => {
    const store = new RoomStore()
    const created = store.createRoom(createTestDeck('one'), noop)

    const joined = store.joinRoom(created.code, createTestDeck('two'), noop, 42)

    expect(joined.status).toBe('opening')
    expect(joined.state).toBeNull()
    expect(openingSnapshotFor(joined, 'player-one')).toMatchObject({
      stage: 'rps',
      round: 1,
      firstPlayerId: null,
    })
    expect(joined.seed).toBe(42)
  })

  it('會保留雙方輸入並去除首尾空白的玩家名稱', () => {
    const store = new RoomStore()
    const created = store.createRoom(createTestDeck('one'), noop, '  餅乾隊長  ')
    const joined = store.joinRoom(
      created.code,
      createTestDeck('two'),
      noop,
      42,
      '奶油騎士',
    )

    expect(joined.playerOne.playerName).toBe('餅乾隊長')
    expect(joined.playerTwo?.playerName).toBe('奶油騎士')
  })

  it('相同種子加入房間會產生確定性的洗牌結果', () => {
    const runWithSeed = (seed: number) => {
      const store = new RoomStore()
      const created = store.createRoom(createTestDeck('one'), noop)
      const joined = store.joinRoom(created.code, createTestDeck('two'), noop, seed)
      beginOpeningGame(store, joined)
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
    const room = completeOpening(
      store,
      store.joinRoom(created.code, createTestDeck('two'), noop, 1),
    )

    expect(() =>
      store.applyCommand(room, 'player-one', {
        kind: 'advance-phase',
        playerId: 'player-two',
      }),
    ).toThrow('指令的玩家與送出來源不符。')
  })

  it('applyCommand 套用合法指令並更新房間狀態', () => {
    const store = new RoomStore()
    const created = store.createRoom(createTestDeck('one'), noop)
    const room = completeOpening(
      store,
      store.joinRoom(created.code, createTestDeck('two'), noop, 1),
    )
    const previousLogLength = room.state?.commandLog?.length ?? 0

    const nextState = store.applyCommand(room, 'player-one', {
      kind: 'advance-phase',
      playerId: 'player-one',
    })

    expect(nextState.commandLog).toHaveLength(previousLogLength + 1)
    expect(room.state).toBe(nextState)
  })

  it('雙方送出前不公開猜拳選擇,送出後同時揭曉並由勝者選先後攻', () => {
    const store = new RoomStore()
    const room = store.joinRoom(
      store.createRoom(createTestDeck('one'), noop).code,
      createTestDeck('two'),
      noop,
      7,
    )

    store.submitOpeningAction(room, 'player-one', {
      kind: 'rps',
      choice: 'rock',
    })
    const waiting = openingSnapshotFor(room, 'player-two')!
    expect(waiting.players['player-one'].submitted).toBe(true)
    expect(waiting.rpsResult).toBeNull()

    store.submitOpeningAction(room, 'player-two', {
      kind: 'rps',
      choice: 'scissors',
    })
    const revealed = openingSnapshotFor(room, 'player-two')!
    expect(revealed.stage).toBe('choose-order')
    expect(revealed.actorId).toBe('player-one')
    expect(revealed.rpsResult).toEqual({
      choices: {
        'player-one': 'rock',
        'player-two': 'scissors',
      },
      winnerId: 'player-one',
    })
    expect(() =>
      store.submitOpeningAction(room, 'player-two', {
        kind: 'choose-order',
        goFirst: true,
      }),
    ).toThrow('只有猜拳勝者')
  })

  it('猜拳平手會保留揭曉結果並開始下一輪', () => {
    const store = new RoomStore()
    const room = store.joinRoom(
      store.createRoom(createTestDeck('one'), noop).code,
      createTestDeck('two'),
      noop,
      7,
    )
    store.submitOpeningAction(room, 'player-one', {
      kind: 'rps',
      choice: 'paper',
    })
    store.submitOpeningAction(room, 'player-two', {
      kind: 'rps',
      choice: 'paper',
    })

    const snapshot = openingSnapshotFor(room, 'player-one')!
    expect(snapshot.stage).toBe('rps')
    expect(snapshot.round).toBe(2)
    expect(snapshot.rpsResult?.winnerId).toBeNull()
    expect(snapshot.players['player-one'].submitted).toBe(false)
  })

  it('猜拳勝者選擇後攻時由對手成為先攻並先進行調度', () => {
    const store = new RoomStore()
    const room = store.joinRoom(
      store.createRoom(createTestDeck('one'), noop).code,
      createTestDeck('two'),
      noop,
      1,
    )
    store.submitOpeningAction(room, 'player-one', {
      kind: 'rps',
      choice: 'rock',
    })
    store.submitOpeningAction(room, 'player-two', {
      kind: 'rps',
      choice: 'scissors',
    })
    store.submitOpeningAction(room, 'player-one', {
      kind: 'choose-order',
      goFirst: false,
    })

    expect(room.state?.firstPlayerId).toBe('player-two')
    expect(openingSnapshotFor(room, 'player-one')).toMatchObject({
      stage: 'mulligan',
      actorId: 'player-two',
      firstPlayerId: 'player-two',
    })
  })

  it('調度依先攻再後攻進行,起始餅乾在雙方送出前不進入公開狀態', () => {
    const store = new RoomStore()
    const room = beginOpeningGame(
      store,
      store.joinRoom(
        store.createRoom(createTestDeck('one'), noop).code,
        createTestDeck('two'),
        noop,
        1,
      ),
    )

    expect(openingSnapshotFor(room, 'player-one')?.actorId).toBe('player-one')
    expect(() =>
      store.submitOpeningAction(room, 'player-two', {
        kind: 'mulligan',
        replaceAll: false,
      }),
    ).toThrow('請等待目前的調度玩家')

    completeOpening(store, room)
    expect(room.status).toBe('in-progress')
    expect(room.state?.status).toBe('playing')
    expect(room.state?.firstPlayerId).toBe('player-one')
  })

  it('起始餅乾選擇在雙方送出前只公開完成狀態，完成後才同時進場', () => {
    const store = new RoomStore()
    const room = beginOpeningGame(
      store,
      store.joinRoom(
        store.createRoom(createTestDeck('one'), noop).code,
        createTestDeck('two'),
        noop,
        1,
      ),
    )
    store.submitOpeningAction(room, 'player-one', {
      kind: 'mulligan',
      replaceAll: false,
    })
    store.submitOpeningAction(room, 'player-two', {
      kind: 'mulligan',
      replaceAll: false,
    })
    const playerOneCookie = room.state!.players['player-one'].hand.find(
      (card) => card.type === 'cookie',
    )!
    const playerTwoCookie = room.state!.players['player-two'].hand.find(
      (card) => card.type === 'cookie',
    )!

    store.submitOpeningAction(room, 'player-one', {
      kind: 'starting-cookie',
      instanceId: playerOneCookie.instanceId,
    })
    const waiting = openingSnapshotFor(room, 'player-two')!
    expect(waiting.players['player-one'].submitted).toBe(true)
    expect(JSON.stringify(waiting)).not.toContain(playerOneCookie.instanceId)
    expect(room.state!.players['player-one'].battleArea).toHaveLength(0)

    store.submitOpeningAction(room, 'player-two', {
      kind: 'starting-cookie',
      instanceId: playerTwoCookie.instanceId,
    })
    expect(room.status).toBe('in-progress')
    expect(room.state!.players['player-one'].battleArea[0].card.instanceId).toBe(
      playerOneCookie.instanceId,
    )
    expect(room.state!.players['player-two'].battleArea[0].card.instanceId).toBe(
      playerTwoCookie.instanceId,
    )
  })

  it('沒有餅乾時公開原手牌並讓對手決定是否抽取補償', () => {
    const store = new RoomStore()
    const room = beginOpeningGame(
      store,
      store.joinRoom(
        store.createRoom(createTestDeck('one'), noop).code,
        createTestDeck('two'),
        noop,
        1,
      ),
    )
    const playerOne = room.state!.players['player-one']
    const allCards = [...playerOne.hand, ...playerOne.deck]
    const noCookieHand = allCards
      .filter((card) => card.type !== 'cookie')
      .slice(0, 6)
    const noCookieIds = new Set(noCookieHand.map((card) => card.instanceId))
    room.state = {
      ...room.state!,
      players: {
        ...room.state!.players,
        'player-one': {
          ...playerOne,
          hand: noCookieHand,
          deck: allCards.filter((card) => !noCookieIds.has(card.instanceId)),
        },
      },
    }

    store.submitOpeningAction(room, 'player-one', {
      kind: 'mulligan',
      replaceAll: false,
    })
    expect(openingSnapshotFor(room, 'player-one')?.stage).toBe(
      'forced-mulligan',
    )

    store.submitOpeningAction(room, 'player-one', { kind: 'force-mulligan' })
    const compensation = openingSnapshotFor(room, 'player-two')!
    expect(compensation.stage).toBe('compensation')
    expect(compensation.actorId).toBe('player-two')
    expect(compensation.revealedNoCookieHand.map((card) => card.instanceId)).toEqual(
      noCookieHand.map((card) => card.instanceId),
    )

    const previousHandSize = room.state!.players['player-two'].hand.length
    store.submitOpeningAction(room, 'player-two', {
      kind: 'mulligan-compensation',
      draw: true,
    })
    expect(room.state!.players['player-two'].hand).toHaveLength(
      previousHandSize + 1,
    )
    expect(openingSnapshotFor(room, 'player-two')?.revealedNoCookieHand).toEqual(
      [],
    )
  })
})
