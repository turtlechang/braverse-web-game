import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  CustomDeck,
  GameCommand,
  GameState,
  PlayerId,
} from '../game'
import type {
  AttackSelectionPreview,
  ClientMessage,
  OnlineOpeningAction,
  OnlineOpeningSnapshot,
  PublicIntent,
  PublicIntentDraft,
  ServerMessage,
} from '../net/onlineProtocol'
import { isPublicIntent } from '../net/onlineProtocol'

export type OnlineMatchStatus =
  | 'idle'
  | 'connecting'
  | 'waiting-for-opponent'
  | 'opening'
  | 'in-progress'
  | 'ended'
  | 'error'

export type OnlineConnectionMode = 'syncing' | null

export const ONLINE_SOCKET_OPEN_TIMEOUT_MS = 90_000
export const ONLINE_SERVER_ACK_TIMEOUT_MS = 10_000

const CONNECT_FAILED_MESSAGE = '無法連線至對戰伺服器，請稍後再試。'
const CONNECT_TIMEOUT_MESSAGE =
  '連線逾時，對戰伺服器可能正在啟動，請稍後再試。'
const SERVER_ACK_TIMEOUT_MESSAGE = '對戰伺服器未回應，請稍後再試。'
const CONNECTION_LOST_MESSAGE =
  '與對戰伺服器的連線已中斷，請重新進入線上對戰。'
const PROTOCOL_ERROR_MESSAGE =
  '對戰伺服器回傳了無法辨識的資料，請稍後再試。'
const PROTOCOL_ERROR_CLOSE_CODE = 4002

const EMPTY_ATTACK_SELECTION: AttackSelectionPreview = {
  attackerInstanceId: null,
  supportPaymentIds: [],
}

const EMPTY_PUBLIC_INTENTS: Partial<Record<PlayerId, PublicIntent>> = {}

type ConnectionPhase =
  | 'opening'
  | 'awaiting-server'
  | 'waiting-for-opponent'
  | 'in-progress'

interface ActiveConnection {
  socket: WebSocket
  phase: ConnectionPhase
  intentional: boolean
  terminal: boolean
  openTimer: ReturnType<typeof setTimeout> | null
  ackTimer: ReturnType<typeof setTimeout> | null
}

const getWsUrl = (): string => {
  const envUrl = import.meta.env.VITE_WS_URL as string | undefined
  if (envUrl) return envUrl
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/ws`
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isPlayerId = (value: unknown): value is PlayerId =>
  value === 'player-one' || value === 'player-two'

const isRpsChoice = (value: unknown): boolean =>
  value === 'rock' || value === 'paper' || value === 'scissors'

const isPlayerStateEnvelope = (
  value: unknown,
  expectedId: PlayerId,
): boolean =>
  isRecord(value) &&
  value.id === expectedId &&
  typeof value.name === 'string' &&
  Array.isArray(value.deck) &&
  Array.isArray(value.hand) &&
  Array.isArray(value.battleArea) &&
  Array.isArray(value.supportArea) &&
  Array.isArray(value.breakArea) &&
  Array.isArray(value.discardPile) &&
  (value.stage === null || isRecord(value.stage)) &&
  typeof value.hasMulliganed === 'boolean' &&
  typeof value.startingCookieSelected === 'boolean'

const isGameStateEnvelope = (value: unknown): value is GameState => {
  if (!isRecord(value) || !isRecord(value.players)) return false

  return (
    isPlayerStateEnvelope(value.players['player-one'], 'player-one') &&
    isPlayerStateEnvelope(value.players['player-two'], 'player-two') &&
    isPlayerId(value.firstPlayerId) &&
    isPlayerId(value.activePlayerId) &&
    typeof value.turnNumber === 'number' &&
    Number.isInteger(value.turnNumber) &&
    typeof value.supportPlacedThisTurn === 'boolean' &&
    Array.isArray(value.skillUsesThisTurn) &&
    typeof value.nextBattleEntrySequence === 'number' &&
    Number.isInteger(value.nextBattleEntrySequence) &&
    Array.isArray(value.attackModifiers) &&
    Array.isArray(value.damageReceivedModifiers) &&
    isRecord(value.departedCookieCounts) &&
    (value.pendingReplacement === null || isRecord(value.pendingReplacement)) &&
    (value.pendingRefresh === null || isRecord(value.pendingRefresh)) &&
    (value.phase === 'active' ||
      value.phase === 'draw' ||
      value.phase === 'support' ||
      value.phase === 'main' ||
      value.phase === 'end') &&
    (value.status === 'setup' ||
      value.status === 'playing' ||
      value.status === 'finished') &&
    (value.result === null || isRecord(value.result))
  )
}

const isOnlineOpeningSnapshotEnvelope = (
  value: unknown,
): value is OnlineOpeningSnapshot => {
  if (!isRecord(value) || !isRecord(value.players)) return false
  const validStage =
    value.stage === 'rps' ||
    value.stage === 'choose-order' ||
    value.stage === 'mulligan' ||
    value.stage === 'forced-mulligan' ||
    value.stage === 'compensation' ||
    value.stage === 'starting-cookie'
  const validProgress = (progress: unknown) =>
    isRecord(progress) &&
    typeof progress.name === 'string' &&
    typeof progress.submitted === 'boolean'

  return (
    validStage &&
    Number.isInteger(value.round) &&
    (value.actorId === null || isPlayerId(value.actorId)) &&
    (value.firstPlayerId === null || isPlayerId(value.firstPlayerId)) &&
    validProgress(value.players['player-one']) &&
    validProgress(value.players['player-two']) &&
    Array.isArray(value.revealedNoCookieHand) &&
    (value.rpsResult === null ||
      (isRecord(value.rpsResult) &&
        isRecord(value.rpsResult.choices) &&
        isRpsChoice(value.rpsResult.choices['player-one']) &&
        isRpsChoice(value.rpsResult.choices['player-two']) &&
        (value.rpsResult.winnerId === null ||
          isPlayerId(value.rpsResult.winnerId))))
  )
}

const parseServerMessage = (data: unknown): ServerMessage | null => {
  if (typeof data !== 'string') return null

  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    return null
  }

  if (!isRecord(parsed) || typeof parsed.type !== 'string') return null

  switch (parsed.type) {
    case 'room-created':
      return typeof parsed.code === 'string' ? (parsed as ServerMessage) : null
    case 'room-join-error':
    case 'command-rejected':
      return typeof parsed.reason === 'string' ? (parsed as ServerMessage) : null
    case 'match-start':
      return Number.isFinite(parsed.seed) &&
        isPlayerId(parsed.viewerId) &&
        isGameStateEnvelope(parsed.state)
        ? (parsed as ServerMessage)
        : null
    case 'state-update':
      return isGameStateEnvelope(parsed.state) &&
        (parsed.updatedBy === undefined || isPlayerId(parsed.updatedBy))
        ? (parsed as ServerMessage)
        : null
    case 'opponent-attack-selection':
      return isRecord(parsed.selection) &&
        (parsed.selection.attackerInstanceId === null ||
          typeof parsed.selection.attackerInstanceId === 'string') &&
        Array.isArray(parsed.selection.supportPaymentIds) &&
        parsed.selection.supportPaymentIds.every(
          (id) => typeof id === 'string',
        )
        ? (parsed as ServerMessage)
        : null
    case 'public-intent-update':
      return isPlayerId(parsed.playerId) &&
        typeof parsed.sequence === 'number' &&
        Number.isInteger(parsed.sequence) &&
        parsed.sequence >= 0 &&
        typeof parsed.stateVersion === 'number' &&
        Number.isInteger(parsed.stateVersion) &&
        parsed.stateVersion >= 0 &&
        (parsed.intent === null ||
          (isPublicIntent(parsed.intent) &&
            parsed.intent.actorId === parsed.playerId &&
            parsed.intent.sequence === parsed.sequence))
        ? (parsed as ServerMessage)
        : null
    case 'opening-update':
      return isPlayerId(parsed.viewerId) &&
        isOnlineOpeningSnapshotEnvelope(parsed.opening) &&
        (parsed.state === null || isGameStateEnvelope(parsed.state))
        ? (parsed as ServerMessage)
        : null
    case 'match-ended':
      return parsed.reason === 'victory' ||
        parsed.reason === 'defeat' ||
        parsed.reason === 'opponent-disconnected'
        ? (parsed as ServerMessage)
        : null
    default:
      return null
  }
}

const clearConnectionTimers = (connection: ActiveConnection): void => {
  if (connection.openTimer !== null) {
    clearTimeout(connection.openTimer)
    connection.openTimer = null
  }
  if (connection.ackTimer !== null) {
    clearTimeout(connection.ackTimer)
    connection.ackTimer = null
  }
}

const safelyCloseSocket = (socket: WebSocket, code?: number): void => {
  if (
    socket.readyState !== WebSocket.CONNECTING &&
    socket.readyState !== WebSocket.OPEN
  ) {
    return
  }

  try {
    socket.close(code)
  } catch {
    // The socket may transition between the readyState check and close().
  }
}

const getUnexpectedDisconnectMessage = (
  phase: ConnectionPhase,
): string =>
  phase === 'opening' || phase === 'awaiting-server'
    ? CONNECT_FAILED_MESSAGE
    : CONNECTION_LOST_MESSAGE

export function useOnlineMatch() {
  const [status, setStatus] = useState<OnlineMatchStatus>('idle')
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [viewerPlayerId, setViewerPlayerId] = useState<PlayerId | null>(null)
  const [maskedGame, setMaskedGame] = useState<GameState | null>(null)
  const [openingSnapshot, setOpeningSnapshot] =
    useState<OnlineOpeningSnapshot | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [opponentAttackSelection, setOpponentAttackSelection] =
    useState<AttackSelectionPreview>(EMPTY_ATTACK_SELECTION)
  const [publicIntents, setPublicIntents] = useState<
    Partial<Record<PlayerId, PublicIntent>>
  >(EMPTY_PUBLIC_INTENTS)
  const [matchEndedReason, setMatchEndedReason] = useState<
    'victory' | 'defeat' | 'opponent-disconnected' | null
  >(null)
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null)
  const [connectionMode, setConnectionMode] = useState<OnlineConnectionMode>(null)

  const connectionRef = useRef<ActiveConnection | null>(null)
  const viewerPlayerIdRef = useRef<PlayerId | null>(null)

  const closeActiveConnection = useCallback(() => {
    const connection = connectionRef.current
    if (!connection) return

    connectionRef.current = null
    connection.intentional = true
    clearConnectionTimers(connection)
    safelyCloseSocket(connection.socket)
  }, [])

  useEffect(() => closeActiveConnection, [closeActiveConnection])

  const connect = useCallback(
    (initialMessage: Extract<ClientMessage, { type: 'create-room' | 'join-room' }>) => {
      closeActiveConnection()
      setStatus('connecting')
      setRoomCode(initialMessage.type === 'join-room' ? initialMessage.code : null)
      setViewerPlayerId(null)
      setMaskedGame(null)
      setOpeningSnapshot(null)
      setErrorMessage(null)
      setConnectionNotice('正在連線')
      setConnectionMode(null)
      viewerPlayerIdRef.current = null
      setOpponentAttackSelection(EMPTY_ATTACK_SELECTION)
      setPublicIntents(EMPTY_PUBLIC_INTENTS)
      setMatchEndedReason(null)

      let socket: WebSocket
      try {
        socket = new WebSocket(getWsUrl())
      } catch {
        setStatus('error')
        setErrorMessage(CONNECT_FAILED_MESSAGE)
        setConnectionNotice('連線失敗，請確認伺服器狀態')
        return
      }

      const connection: ActiveConnection = {
        socket,
        phase: 'opening',
        intentional: false,
        terminal: false,
        openTimer: null,
        ackTimer: null,
      }
      connectionRef.current = connection

      const finishConnection = (): void => {
        if (connectionRef.current === connection) {
          connectionRef.current = null
        }
        connection.terminal = true
        clearConnectionTimers(connection)
        safelyCloseSocket(connection.socket)
      }

      const failConnection = (message: string, closeCode?: number): void => {
        if (
          connectionRef.current !== connection ||
          connection.intentional ||
          connection.terminal
        ) {
          return
        }

        connectionRef.current = null
        connection.terminal = true
        clearConnectionTimers(connection)
        setStatus('error')
        setErrorMessage(message)
        setConnectionMode(null)
        setConnectionNotice('連線已中斷，請重新加入房間')
        safelyCloseSocket(connection.socket, closeCode)
      }

      connection.openTimer = setTimeout(() => {
        failConnection(CONNECT_TIMEOUT_MESSAGE)
      }, ONLINE_SOCKET_OPEN_TIMEOUT_MS)

      socket.addEventListener('open', () => {
        if (connectionRef.current !== connection || connection.terminal) return

        if (connection.openTimer !== null) {
          clearTimeout(connection.openTimer)
          connection.openTimer = null
        }
        connection.phase = 'awaiting-server'

        try {
          socket.send(JSON.stringify(initialMessage))
        } catch {
          failConnection(CONNECT_FAILED_MESSAGE)
          return
        }

        connection.ackTimer = setTimeout(() => {
          failConnection(SERVER_ACK_TIMEOUT_MESSAGE)
        }, ONLINE_SERVER_ACK_TIMEOUT_MS)
      })

      socket.addEventListener('message', (event) => {
        if (connectionRef.current !== connection || connection.terminal) return

        const message = parseServerMessage(event.data)
        if (!message) {
          failConnection(PROTOCOL_ERROR_MESSAGE, PROTOCOL_ERROR_CLOSE_CODE)
          return
        }

        switch (message.type) {
          case 'room-created':
            if (connection.ackTimer !== null) {
              clearTimeout(connection.ackTimer)
              connection.ackTimer = null
            }
            connection.phase = 'waiting-for-opponent'
            setRoomCode(message.code)
            setStatus('waiting-for-opponent')
            setConnectionNotice('房間已建立，等待對手加入')
            break
          case 'room-join-error':
            finishConnection()
            setStatus('error')
            setErrorMessage(message.reason)
            break
          case 'match-start':
            if (connection.ackTimer !== null) {
              clearTimeout(connection.ackTimer)
              connection.ackTimer = null
            }
            connection.phase = 'in-progress'
            viewerPlayerIdRef.current = message.viewerId
            setViewerPlayerId(message.viewerId)
            setMaskedGame(message.state)
            setPublicIntents(EMPTY_PUBLIC_INTENTS)
            setOpeningSnapshot(null)
            setStatus('in-progress')
            setConnectionNotice('已連線，等待對戰同步')
            break
          case 'opening-update':
            if (connection.ackTimer !== null) {
              clearTimeout(connection.ackTimer)
              connection.ackTimer = null
            }
            connection.phase = 'in-progress'
            viewerPlayerIdRef.current = message.viewerId
            setViewerPlayerId(message.viewerId)
            setOpeningSnapshot(message.opening)
            setMaskedGame(message.state)
            setPublicIntents(EMPTY_PUBLIC_INTENTS)
            setErrorMessage(null)
            setStatus('opening')
            setConnectionNotice('開局資訊已同步')
            break
          case 'state-update':
            setMaskedGame(message.state)
            setOpponentAttackSelection(EMPTY_ATTACK_SELECTION)
            setErrorMessage(null)
            setConnectionMode(null)
            setConnectionNotice(
              message.updatedBy && message.updatedBy !== viewerPlayerIdRef.current
                ? '已收到對手操作'
                : '已同步你的操作',
            )
            break
          case 'opponent-attack-selection':
            setOpponentAttackSelection(message.selection)
            break
          case 'public-intent-update':
            setPublicIntents((current) => {
              const previous = current[message.playerId]
              if (
                previous &&
                (message.sequence < previous.sequence ||
                  (message.sequence === previous.sequence &&
                    message.stateVersion < previous.stateVersion))
              ) {
                return current
              }

              const next = { ...current }
              if (message.intent === null) {
                delete next[message.playerId]
              } else {
                next[message.playerId] = message.intent
              }
              return next
            })
            setConnectionNotice(
              message.playerId === viewerPlayerIdRef.current
                ? '操作提示已同步'
                : '已收到對手操作提示',
            )
            break
          case 'command-rejected':
            setErrorMessage(message.reason)
            setConnectionMode(null)
            setConnectionNotice('伺服器拒絕操作')
            break
          case 'match-ended':
            finishConnection()
            setMatchEndedReason(message.reason)
            setStatus('ended')
            setConnectionMode(null)
            setConnectionNotice(
              message.reason === 'opponent-disconnected'
                ? '對手已離線'
                : '對戰已結束',
            )
            break
        }
      })

      socket.addEventListener('error', () => {
        if (connection.intentional || connection.terminal) return
        setConnectionMode(null)
        setConnectionNotice('連線發生錯誤')
        failConnection(getUnexpectedDisconnectMessage(connection.phase))
      })

      socket.addEventListener('close', () => {
        if (connection.intentional || connection.terminal) return
        setConnectionMode(null)
        setConnectionNotice('連線已中斷，請重新加入房間')
        failConnection(getUnexpectedDisconnectMessage(connection.phase))
      })
    },
    [closeActiveConnection],
  )

  const send = useCallback((message: ClientMessage): boolean => {
    const connection = connectionRef.current
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      return false
    }

    try {
      connection.socket.send(JSON.stringify(message))
      return true
    } catch {
      return false
    }
  }, [])

  const createRoom = useCallback(
    (deck: CustomDeck, playerName = 'Player One') => {
      connect({ type: 'create-room', deck, playerName })
    },
    [connect],
  )

  const joinRoom = useCallback(
    (code: string, deck: CustomDeck, playerName = 'Player Two') => {
      connect({ type: 'join-room', code, deck, playerName })
    },
    [connect],
  )

  const sendCommand = useCallback(
    (command: GameCommand) => {
      setConnectionMode('syncing')
      setConnectionNotice('同步中')
      if (!send({ type: 'submit-command', command })) {
        setConnectionMode(null)
        setConnectionNotice('尚未連線，操作未送出')
      }
    },
    [send],
  )

  const sendOpeningAction = useCallback(
    (action: OnlineOpeningAction) => {
      send({ type: 'submit-opening-action', action })
    },
    [send],
  )

  const sendAttackSelection = useCallback(
    (selection: AttackSelectionPreview) => {
      send({ type: 'update-attack-selection', selection })
    },
    [send],
  )

  const sendPublicIntent = useCallback(
    (intent: PublicIntentDraft) => {
      send({ type: 'set-public-intent', intent })
    },
    [send],
  )

  const clearPublicIntent = useCallback(
    (intentId?: string) => {
      send({ type: 'clear-public-intent', intentId })
    },
    [send],
  )

  const leave = useCallback(() => {
    send({ type: 'leave-room' })
    closeActiveConnection()
    setStatus('idle')
    setRoomCode(null)
    setViewerPlayerId(null)
    setMaskedGame(null)
    setOpeningSnapshot(null)
    setErrorMessage(null)
    setConnectionNotice(null)
    setConnectionMode(null)
    viewerPlayerIdRef.current = null
    setOpponentAttackSelection(EMPTY_ATTACK_SELECTION)
    setPublicIntents(EMPTY_PUBLIC_INTENTS)
    setMatchEndedReason(null)
  }, [send, closeActiveConnection])

  return {
    status,
    roomCode,
    viewerPlayerId,
    maskedGame,
    openingSnapshot,
    errorMessage,
    opponentAttackSelection,
    publicIntents,
    matchEndedReason,
    connectionNotice,
    connectionMode,
    createRoom,
    joinRoom,
    sendCommand,
    sendOpeningAction,
    sendAttackSelection,
    sendPublicIntent,
    clearPublicIntent,
    leave,
  } as const
}
