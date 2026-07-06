import type { CustomDeck, GameCommand, GameState, PlayerId } from '../game'

export type ClientMessage =
  | { type: 'create-room'; deck: CustomDeck }
  | { type: 'join-room'; code: string; deck: CustomDeck }
  | { type: 'submit-command'; command: GameCommand }
  | { type: 'leave-room' }

/**
 * `state` 是遮罩版 GameState（見 src/game/masked-state.ts）：型別上是完整
 * GameState，只是對手的隱藏區域內容換成佔位卡，讓既有戰場 UI 不用改就能吃。
 */
export type ServerMessage =
  | { type: 'room-created'; code: string }
  | { type: 'room-join-error'; reason: string }
  | { type: 'match-start'; seed: number; viewerId: PlayerId; state: GameState }
  | { type: 'state-update'; state: GameState }
  | { type: 'command-rejected'; reason: string }
  | {
      type: 'match-ended'
      reason: 'victory' | 'defeat' | 'opponent-disconnected'
    }
