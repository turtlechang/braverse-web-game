import type { CustomDeck, GameCommand, PlayerId } from '../../src/game'
import {
  isClientMessage,
  type AttackSelectionPreview,
  type ClientMessage,
  type ServerMessage,
} from '../../src/net/onlineProtocol'
import {
  RoomStore,
  maskedStateFor,
  openingSnapshotFor,
  type Room,
} from './rooms'

export interface SocketLike {
  send(data: string): void
}

interface ConnectionInfo {
  code: string
  playerId: PlayerId
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : '發生未知錯誤。'

const INVALID_CLIENT_MESSAGE_REASON = '用戶端訊息格式無效。'

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

  private sendOpeningUpdate(room: Room): void {
    for (const playerId of ['player-one', 'player-two'] as const) {
      const opening = openingSnapshotFor(room, playerId)
      if (!opening) continue
      this.sendToSlot(room, playerId, {
        type: 'opening-update',
        viewerId: playerId,
        opening,
        state: maskedStateFor(room, playerId),
      })
    }
  }

  private sendMatchStart(room: Room): void {
    if (!room.state || room.seed === null) return
    for (const playerId of ['player-one', 'player-two'] as const) {
      this.sendToSlot(room, playerId, {
        type: 'match-start',
        seed: room.seed,
        viewerId: playerId,
        state: maskedStateFor(room, playerId)!,
      })
    }
  }

  private rejectInvalidMessage(socket: SocketLike): void {
    if (this.connections.has(socket)) {
      this.send(socket, {
        type: 'command-rejected',
        reason: INVALID_CLIENT_MESSAGE_REASON,
      })
      return
    }

    this.send(socket, {
      type: 'room-join-error',
      reason: INVALID_CLIENT_MESSAGE_REASON,
    })
  }

  handleMessage(socket: SocketLike, raw: string): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      this.rejectInvalidMessage(socket)
      return
    }

    if (!isClientMessage(parsed)) {
      this.rejectInvalidMessage(socket)
      return
    }

    const message: ClientMessage = parsed

    switch (message.type) {
      case 'create-room':
        this.handleCreateRoom(
          socket,
          message.deck,
          message.playerName ?? 'Player One',
        )
        return
      case 'join-room':
        this.handleJoinRoom(
          socket,
          message.code,
          message.deck,
          message.playerName ?? 'Player Two',
        )
        return
      case 'submit-opening-action':
        this.handleOpeningAction(socket, message.action)
        return
      case 'submit-command':
        this.handleSubmitCommand(socket, message.command)
        return
      case 'update-attack-selection':
        this.handleAttackSelection(socket, message.selection)
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

  private handleCreateRoom(
    socket: SocketLike,
    deck: CustomDeck,
    playerName: string,
  ): void {
    try {
      const room = this.store.createRoom(
        deck,
        (data) => socket.send(data),
        playerName,
      )
      this.connections.set(socket, { code: room.code, playerId: 'player-one' })
      this.send(socket, { type: 'room-created', code: room.code })
    } catch (error) {
      this.send(socket, { type: 'room-join-error', reason: errorMessage(error) })
    }
  }

  private handleJoinRoom(
    socket: SocketLike,
    code: string,
    deck: CustomDeck,
    playerName: string,
  ): void {
    let room: Room
    try {
      room = this.store.joinRoom(
        code,
        deck,
        (data) => socket.send(data),
        undefined,
        playerName,
      )
    } catch (error) {
      this.send(socket, { type: 'room-join-error', reason: errorMessage(error) })
      return
    }

    this.connections.set(socket, { code: room.code, playerId: 'player-two' })

    this.sendOpeningUpdate(room)
  }

  private handleOpeningAction(
    socket: SocketLike,
    action: Extract<ClientMessage, { type: 'submit-opening-action' }>['action'],
  ): void {
    const info = this.connections.get(socket)
    if (!info) return
    const room = this.store.getRoom(info.code)
    if (!room) return

    try {
      this.store.submitOpeningAction(room, info.playerId, action)
    } catch (error) {
      this.send(socket, { type: 'command-rejected', reason: errorMessage(error) })
      return
    }

    if (room.status === 'in-progress') {
      this.sendMatchStart(room)
      return
    }
    this.sendOpeningUpdate(room)
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
      state: maskedStateFor(room, 'player-one')!,
    })
    this.sendToSlot(room, 'player-two', {
      type: 'state-update',
      state: maskedStateFor(room, 'player-two')!,
    })

    const result = room.state?.result
    if (room.state?.status !== 'playing' && result) {
      this.sendToSlot(room, result.winnerId, { type: 'match-ended', reason: 'victory' })
      this.sendToSlot(room, result.loserId, { type: 'match-ended', reason: 'defeat' })
      this.store.deleteRoom(room.code)
    }
  }

  private handleAttackSelection(
    socket: SocketLike,
    selection: AttackSelectionPreview,
  ): void {
    const info = this.connections.get(socket)
    if (!info) return
    const room = this.store.getRoom(info.code)
    const state = room?.state
    if (!room || !state) return

    const player = state.players[info.playerId]
    const canPreviewAttack = state.activePlayerId === info.playerId
    const attackerInstanceId =
      canPreviewAttack &&
      selection.attackerInstanceId !== null &&
      player.battleArea.some(
        (cookie) => cookie.card.instanceId === selection.attackerInstanceId,
      )
        ? selection.attackerInstanceId
        : null
    const availableSupportIds = new Set(
      player.supportArea
        .filter((support) => !support.rested)
        .map((support) => support.card.instanceId),
    )
    const supportPaymentIds = attackerInstanceId
      ? [...new Set(selection.supportPaymentIds)].filter((id) =>
          availableSupportIds.has(id),
        )
      : []

    this.sendToSlot(room, opponentOf(info.playerId), {
      type: 'opponent-attack-selection',
      selection: { attackerInstanceId, supportPaymentIds },
    })
  }
}
