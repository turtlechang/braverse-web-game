import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  CustomDeck,
  GameCommand,
  PlayerId,
  PlayerView,
} from '../game'
import type { ClientMessage, ServerMessage } from '../net/onlineProtocol'

export type OnlineMatchStatus =
  | 'idle'
  | 'connecting'
  | 'waiting-for-opponent'
  | 'in-progress'
  | 'ended'
  | 'error'

const getWsUrl = (): string => {
  const envUrl = import.meta.env.VITE_WS_URL as string | undefined
  if (envUrl) return envUrl
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/ws`
}

export function useOnlineMatch() {
  const [status, setStatus] = useState<OnlineMatchStatus>('idle')
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [viewerPlayerId, setViewerPlayerId] = useState<PlayerId | null>(null)
  const [playerView, setPlayerView] = useState<PlayerView | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [matchEndedReason, setMatchEndedReason] = useState<
    'victory' | 'defeat' | 'opponent-disconnected' | null
  >(null)

  const socketRef = useRef<WebSocket | null>(null)
  const pendingDeckRef = useRef<{ code?: string; deck: CustomDeck } | null>(
    null,
  )

  const closeSocket = useCallback(() => {
    socketRef.current?.close()
    socketRef.current = null
  }, [])

  useEffect(() => closeSocket, [closeSocket])

  const connect = useCallback((onOpen: () => void) => {
    closeSocket()
    setStatus('connecting')
    setErrorMessage(null)
    const socket = new WebSocket(getWsUrl())
    socketRef.current = socket

    socket.addEventListener('open', onOpen)

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data as string) as ServerMessage
      switch (message.type) {
        case 'room-created':
          setRoomCode(message.code)
          setStatus('waiting-for-opponent')
          break
        case 'room-join-error':
          setStatus('error')
          setErrorMessage(message.reason)
          break
        case 'match-start':
          setViewerPlayerId(message.viewerId)
          setPlayerView(message.view)
          setStatus('in-progress')
          break
        case 'state-update':
          setPlayerView(message.view)
          break
        case 'command-rejected':
          setErrorMessage(message.reason)
          break
        case 'match-ended':
          setMatchEndedReason(message.reason)
          setStatus('ended')
          break
      }
    })

    socket.addEventListener('close', () => {
      socketRef.current = null
    })
  }, [closeSocket])

  const send = useCallback((message: ClientMessage) => {
    socketRef.current?.send(JSON.stringify(message))
  }, [])

  const createRoom = useCallback(
    (deck: CustomDeck) => {
      pendingDeckRef.current = { deck }
      connect(() => send({ type: 'create-room', deck }))
    },
    [connect, send],
  )

  const joinRoom = useCallback(
    (code: string, deck: CustomDeck) => {
      pendingDeckRef.current = { code, deck }
      connect(() => send({ type: 'join-room', code, deck }))
    },
    [connect, send],
  )

  const sendCommand = useCallback(
    (command: GameCommand) => {
      send({ type: 'submit-command', command })
    },
    [send],
  )

  const leave = useCallback(() => {
    send({ type: 'leave-room' })
    closeSocket()
    setStatus('idle')
    setRoomCode(null)
    setViewerPlayerId(null)
    setPlayerView(null)
    setErrorMessage(null)
    setMatchEndedReason(null)
  }, [send, closeSocket])

  return {
    status,
    roomCode,
    viewerPlayerId,
    playerView,
    errorMessage,
    matchEndedReason,
    createRoom,
    joinRoom,
    sendCommand,
    leave,
  } as const
}
