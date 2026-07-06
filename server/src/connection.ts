import type { CustomDeck, GameCommand, PlayerId } from '../../src/game'
import type { ClientMessage, ServerMessage } from '../../src/net/onlineProtocol'
import { RoomStore, playerViewFor, type Room } from './rooms'

export interface SocketLike {
  send(data: string): void
}

interface ConnectionInfo {
  code: string
  playerId: PlayerId
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : '發生未知錯誤。'

const opponentOf = (playerId: PlayerId): PlayerId =>
  playerId === 'player-one' ? 'player-two' : 'player-one'

/**
 * 處理 ws 訊息的核心邏輯,不依賴真實網路連線,方便單元測試直接呼叫 mock socket。
 * server/src/index.ts 只負責把真實的 WebSocket 接上這裡。
 */
export class ConnectionManager {
  private connections = new Map<SocketLike, ConnectionInfo>()

  constructor(private readonly store: RoomStore) {}

  private send(socket: SocketLike, message: ServerMessage): void {
    socket.send(JSON.stringify(message))
  }

  private sendToSlot(room: Room, playerId: PlayerId, message: ServerMessage): void {
    const slot = playerId === 'player-one' ? room.playerOne : room.playerTwo
    slot?.send(JSON.stringify(message))
  }

  handleMessage(socket: SocketLike, raw: string): void {
    let message: ClientMessage
    try {
      message = JSON.parse(raw) as ClientMessage
    } catch {
      return
    }

    switch (message.type) {
      case 'create-room':
        this.handleCreateRoom(socket, message.deck)
        return
      case 'join-room':
        this.handleJoinRoom(socket, message.code, message.deck)
        return
      case 'submit-command':
        this.handleSubmitCommand(socket, message.command)
        return
      case 'leave-room':
        this.handleDisconnect(socket)
        return
    }
  }

  handleDisconnect(socket: SocketLike): void {
    const info = this.connections.get(socket)
    if (!info) return
    this.connections.delete(socket)

    const room = this.store.getRoom(info.code)
    if (!room) return

    this.sendToSlot(room, opponentOf(info.playerId), {
      type: 'match-ended',
      reason: 'opponent-disconnected',
    })
    this.store.deleteRoom(info.code)
  }

  private handleCreateRoom(socket: SocketLike, deck: CustomDeck): void {
    try {
      const room = this.store.createRoom(deck, (data) => socket.send(data))
      this.connections.set(socket, { code: room.code, playerId: 'player-one' })
      this.send(socket, { type: 'room-created', code: room.code })
    } catch (error) {
      this.send(socket, { type: 'room-join-error', reason: errorMessage(error) })
    }
  }

  private handleJoinRoom(socket: SocketLike, code: string, deck: CustomDeck): void {
    let room: Room
    try {
      room = this.store.joinRoom(code, deck, (data) => socket.send(data))
    } catch (error) {
      this.send(socket, { type: 'room-join-error', reason: errorMessage(error) })
      return
    }

    this.connections.set(socket, { code: room.code, playerId: 'player-two' })

    const state = room.state
    if (!state || room.seed === null) return

    this.sendToSlot(room, 'player-one', {
      type: 'match-start',
      seed: room.seed,
      viewerId: 'player-one',
      view: playerViewFor(room, 'player-one')!,
    })
    this.send(socket, {
      type: 'match-start',
      seed: room.seed,
      viewerId: 'player-two',
      view: playerViewFor(room, 'player-two')!,
    })
  }

  private handleSubmitCommand(socket: SocketLike, command: GameCommand): void {
    const info = this.connections.get(socket)
    if (!info) return
    const room = this.store.getRoom(info.code)
    if (!room) return

    try {
      this.store.applyCommand(room, info.playerId, command)
    } catch (error) {
      this.send(socket, { type: 'command-rejected', reason: errorMessage(error) })
      return
    }

    this.sendToSlot(room, 'player-one', {
      type: 'state-update',
      view: playerViewFor(room, 'player-one')!,
    })
    this.sendToSlot(room, 'player-two', {
      type: 'state-update',
      view: playerViewFor(room, 'player-two')!,
    })

    const result = room.state?.result
    if (room.state?.status !== 'playing' && result) {
      this.sendToSlot(room, result.winnerId, { type: 'match-ended', reason: 'victory' })
      this.sendToSlot(room, result.loserId, { type: 'match-ended', reason: 'defeat' })
      this.store.deleteRoom(room.code)
    }
  }
}
