import type { CustomDeck, GameCommand, PlayerId, PlayerView } from '../game'

export type ClientMessage =
  | { type: 'create-room'; deck: CustomDeck }
  | { type: 'join-room'; code: string; deck: CustomDeck }
  | { type: 'submit-command'; command: GameCommand }
  | { type: 'leave-room' }

export type ServerMessage =
  | { type: 'room-created'; code: string }
  | { type: 'room-join-error'; reason: string }
  | { type: 'match-start'; seed: number; viewerId: PlayerId; view: PlayerView }
  | { type: 'state-update'; view: PlayerView }
  | { type: 'command-rejected'; reason: string }
  | {
      type: 'match-ended'
      reason: 'victory' | 'defeat' | 'opponent-disconnected'
    }
