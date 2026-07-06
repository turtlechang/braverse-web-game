import { randomInt } from 'node:crypto'
import {
  GameRuleError,
  applyGameCommand,
  createDeckFromCustomDeck,
  createGame,
  createSeededShuffle,
  maskGameStateForViewer,
  validateCustomDeck,
  type CustomDeck,
  type GameCommand,
  type GameState,
  type PlayerId,
} from '../../src/game'

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_CODE_LENGTH = 4

export interface RoomSlot {
  playerId: PlayerId
  deck: CustomDeck
  send: (data: string) => void
}

export type RoomStatus = 'waiting' | 'in-progress' | 'ended'

export interface Room {
  code: string
  status: RoomStatus
  playerOne: RoomSlot
  playerTwo: RoomSlot | null
  state: GameState | null
  seed: number | null
}

export class RoomNotFoundError extends Error {}
export class RoomNotJoinableError extends Error {}

export class RoomStore {
  private rooms = new Map<string, Room>()

  private generateCode(): string {
    let code: string
    do {
      code = Array.from(
        { length: ROOM_CODE_LENGTH },
        () => ROOM_CODE_CHARS[randomInt(ROOM_CODE_CHARS.length)],
      ).join('')
    } while (this.rooms.has(code))
    return code
  }

  createRoom(deck: CustomDeck, send: (data: string) => void): Room {
    const validation = validateCustomDeck(deck.entries)
    if (!validation.isValid) {
      throw new GameRuleError(validation.errors[0] ?? '牌組不合法。')
    }

    const code = this.generateCode()
    const room: Room = {
      code,
      status: 'waiting',
      playerOne: { playerId: 'player-one', deck, send },
      playerTwo: null,
      state: null,
      seed: null,
    }
    this.rooms.set(code, room)
    return room
  }

  joinRoom(
    code: string,
    deck: CustomDeck,
    send: (data: string) => void,
    seed: number = Date.now(),
  ): Room {
    const room = this.rooms.get(code)
    if (!room) {
      throw new RoomNotFoundError('找不到這個房間代碼。')
    }
    if (room.status !== 'waiting') {
      throw new RoomNotJoinableError('這個房間已經無法加入。')
    }

    const validation = validateCustomDeck(deck.entries)
    if (!validation.isValid) {
      throw new GameRuleError(validation.errors[0] ?? '牌組不合法。')
    }

    room.playerTwo = { playerId: 'player-two', deck, send }
    room.status = 'in-progress'
    room.seed = seed

    const shuffle = createSeededShuffle(seed)
    room.state = createGame(
      {
        id: 'player-one',
        name: 'Player One',
        deck: createDeckFromCustomDeck(room.playerOne.deck, 'player-one'),
      },
      {
        id: 'player-two',
        name: 'Player Two',
        deck: createDeckFromCustomDeck(room.playerTwo.deck, 'player-two'),
      },
      'player-one',
      shuffle,
    )

    return room
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code)
  }

  deleteRoom(code: string): void {
    this.rooms.delete(code)
  }

  /**
   * 驗證指令聲稱的玩家與送出來源(這個 socket 被指派的玩家身分)相符,
   * 再委派給 applyGameCommand。回合/待處理決策等玩家資格驗證已經是
   * applyGameCommand 每個指令 case 自己的職責(例如 advance-phase/attack
   * 有 requireActivePlayer,補位/傷害結算有各自的驗證),這裡不重複判斷,
   * 否則會誤擋 keep-opening-hand 這類雙方各自獨立行動的開局指令。
   */
  applyCommand(room: Room, playerId: PlayerId, command: GameCommand): GameState {
    if (!room.state) {
      throw new GameRuleError('對局尚未開始。')
    }
    if (command.playerId !== playerId) {
      throw new GameRuleError('指令的玩家與送出來源不符。')
    }
    const nextState = applyGameCommand(room.state, command)
    room.state = nextState
    return nextState
  }
}

export const createRoomStore = (): RoomStore => new RoomStore()

export const maskedStateFor = (
  room: Room,
  playerId: PlayerId,
): GameState | null => {
  if (!room.state) return null
  return maskGameStateForViewer(room.state, playerId)
}
