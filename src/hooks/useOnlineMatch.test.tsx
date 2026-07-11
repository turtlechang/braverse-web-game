/// @vitest-environment jsdom

import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientMessage } from '../net/onlineProtocol'
import { createDemoGame, type CustomDeck } from '../game'
import {
  ONLINE_SERVER_ACK_TIMEOUT_MS,
  ONLINE_SOCKET_OPEN_TIMEOUT_MS,
  useOnlineMatch,
} from './useOnlineMatch'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

type SocketListener = (event: Event) => void

class MockWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: MockWebSocket[] = []
  static throwOnConstruct = false

  readonly url: string
  readyState = MockWebSocket.CONNECTING
  sent: string[] = []
  closeCalls = 0
  closeCode: number | undefined
  private readonly listeners = new Map<string, Set<SocketListener>>()

  constructor(url: string) {
    if (MockWebSocket.throwOnConstruct) {
      throw new Error('WebSocket construction failed')
    }
    this.url = url
    MockWebSocket.instances.push(this)
  }

  addEventListener(type: string, listener: SocketListener): void {
    const listeners = this.listeners.get(type) ?? new Set<SocketListener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new DOMException('Socket is not open', 'InvalidStateError')
    }
    this.sent.push(data)
  }

  close(code?: number): void {
    if (
      code !== undefined &&
      code !== 1000 &&
      (code < 3000 || code > 4999)
    ) {
      throw new DOMException('Invalid WebSocket close code', 'InvalidAccessError')
    }
    this.closeCalls += 1
    this.closeCode = code
    if (
      this.readyState === MockWebSocket.CONNECTING ||
      this.readyState === MockWebSocket.OPEN
    ) {
      this.readyState = MockWebSocket.CLOSING
    }
  }

  emitOpen(): void {
    this.readyState = MockWebSocket.OPEN
    this.dispatch('open', new Event('open'))
  }

  emitMessage(message: unknown): void {
    this.emitRawMessage(JSON.stringify(message))
  }

  emitRawMessage(data: unknown): void {
    this.dispatch('message', new MessageEvent('message', { data }))
  }

  emitError(): void {
    this.dispatch('error', new Event('error'))
  }

  emitClose(): void {
    this.readyState = MockWebSocket.CLOSED
    this.dispatch('close', new Event('close'))
  }

  private dispatch(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }

  static reset(): void {
    MockWebSocket.instances = []
    MockWebSocket.throwOnConstruct = false
  }
}

const deck: CustomDeck = {
  id: 'test-deck',
  name: 'Test Deck',
  entries: [],
  createdAt: '2026-07-12T00:00:00.000Z',
  updatedAt: '2026-07-12T00:00:00.000Z',
}

const originalWebSocket = globalThis.WebSocket
let root: Root | null = null
let captured: ReturnType<typeof useOnlineMatch> | null = null

function TestHarness() {
  const online = useOnlineMatch()
  useEffect(() => {
    captured = online
  }, [online])
  return null
}

const current = (): ReturnType<typeof useOnlineMatch> => {
  if (!captured) throw new Error('Hook is not mounted')
  return captured
}

const mountHook = async (): Promise<void> => {
  const container = document.createElement('div')
  root = createRoot(container)
  await act(() => {
    root?.render(<TestHarness />)
  })
}

const sentMessages = (socket: MockWebSocket): ClientMessage[] =>
  socket.sent.map((message) => JSON.parse(message) as ClientMessage)

beforeEach(() => {
  MockWebSocket.reset()
  captured = null
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
})

afterEach(async () => {
  if (root) {
    await act(() => {
      root?.unmount()
    })
    root = null
  }
  vi.useRealTimers()
  globalThis.WebSocket = originalWebSocket
})

describe('useOnlineMatch', () => {
  it('creates a room and stops the server acknowledgement timeout after success', async () => {
    vi.useFakeTimers()
    await mountHook()

    await act(() => current().createRoom(deck))
    expect(current().status).toBe('connecting')
    const socket = MockWebSocket.instances[0]
    expect(socket.url).toBe(`ws://${window.location.host}/ws`)

    await act(() => socket.emitOpen())
    expect(sentMessages(socket)).toEqual([{ type: 'create-room', deck }])

    await act(() => socket.emitMessage({ type: 'room-created', code: 'ABCD' }))
    expect(current().status).toBe('waiting-for-opponent')
    expect(current().roomCode).toBe('ABCD')

    await act(() => vi.advanceTimersByTime(ONLINE_SERVER_ACK_TIMEOUT_MS * 2))
    expect(current().status).toBe('waiting-for-opponent')
  })

  it('joins a room, keeps its code, and closes after a rejected join', async () => {
    await mountHook()

    await act(() => current().joinRoom('WXYZ', deck))
    const socket = MockWebSocket.instances[0]
    expect(current().roomCode).toBe('WXYZ')

    await act(() => socket.emitOpen())
    expect(sentMessages(socket)).toEqual([
      { type: 'join-room', code: 'WXYZ', deck },
    ])

    await act(() =>
      socket.emitMessage({ type: 'room-join-error', reason: '房間不存在' }),
    )
    expect(current().status).toBe('error')
    expect(current().errorMessage).toBe('房間不存在')
    expect(socket.closeCalls).toBe(1)
  })

  it('handles match updates, command rejection, and a terminal result', async () => {
    await mountHook()
    const initialState = createDemoGame()
    const updatedState = { ...initialState, turnNumber: initialState.turnNumber + 1 }

    await act(() => current().joinRoom('PLAY', deck))
    const socket = MockWebSocket.instances[0]
    await act(() => socket.emitOpen())
    await act(() =>
      socket.emitMessage({
        type: 'match-start',
        seed: 7,
        viewerId: 'player-two',
        state: initialState,
      }),
    )
    expect(current().status).toBe('in-progress')
    expect(current().viewerPlayerId).toBe('player-two')
    expect(current().maskedGame).toEqual(initialState)

    await act(() =>
      current().sendCommand({ kind: 'advance-phase', playerId: 'player-two' }),
    )
    expect(sentMessages(socket).at(-1)).toEqual({
      type: 'submit-command',
      command: { kind: 'advance-phase', playerId: 'player-two' },
    })

    await act(() =>
      socket.emitMessage({ type: 'command-rejected', reason: '不合法的操作' }),
    )
    expect(current().errorMessage).toBe('不合法的操作')

    await act(() =>
      socket.emitMessage({ type: 'state-update', state: updatedState }),
    )
    expect(current().maskedGame).toEqual(updatedState)
    expect(current().errorMessage).toBeNull()

    await act(() =>
      socket.emitMessage({ type: 'match-ended', reason: 'victory' }),
    )
    expect(current().status).toBe('ended')
    expect(current().matchEndedReason).toBe('victory')
    expect(socket.closeCalls).toBe(1)

    await act(() => socket.emitClose())
    expect(current().status).toBe('ended')
    expect(current().matchEndedReason).toBe('victory')
  })

  it('reports an unexpected failure once and lets connecting users leave safely', async () => {
    await mountHook()

    await act(() => current().createRoom(deck))
    const failedSocket = MockWebSocket.instances[0]
    await act(() => failedSocket.emitError())
    expect(current().status).toBe('error')
    expect(current().errorMessage).toContain('無法連線')
    expect(failedSocket.closeCalls).toBe(1)

    await act(() => failedSocket.emitClose())
    expect(current().status).toBe('error')
    expect(failedSocket.closeCalls).toBe(1)

    await act(() => current().leave())
    await act(() => current().createRoom(deck))
    const connectingSocket = MockWebSocket.instances[1]
    await act(() => current().leave())
    expect(current().status).toBe('idle')
    expect(connectingSocket.sent).toEqual([])
    expect(connectingSocket.closeCalls).toBe(1)

    await act(() => connectingSocket.emitClose())
    expect(current().status).toBe('idle')
  })

  it('ignores every delayed event from a superseded socket', async () => {
    await mountHook()

    await act(() => current().createRoom(deck))
    const oldSocket = MockWebSocket.instances[0]
    await act(() => current().joinRoom('NEXT', deck))
    const currentSocket = MockWebSocket.instances[1]
    expect(oldSocket.closeCalls).toBe(1)

    await act(() => {
      oldSocket.emitOpen()
      oldSocket.emitMessage({ type: 'room-created', code: 'OLD1' })
      oldSocket.emitError()
      oldSocket.emitClose()
    })
    expect(oldSocket.sent).toEqual([])
    expect(current().status).toBe('connecting')
    expect(current().roomCode).toBe('NEXT')

    await act(() => currentSocket.emitOpen())
    expect(sentMessages(currentSocket)).toEqual([
      { type: 'join-room', code: 'NEXT', deck },
    ])
  })

  it('classifies pure close events while waiting and in progress as connection loss', async () => {
    await mountHook()

    await act(() => current().createRoom(deck))
    const waitingSocket = MockWebSocket.instances[0]
    await act(() => waitingSocket.emitOpen())
    await act(() =>
      waitingSocket.emitMessage({ type: 'room-created', code: 'WAIT' }),
    )
    await act(() => waitingSocket.emitClose())
    expect(current().status).toBe('error')
    expect(current().errorMessage).toContain('連線已中斷')

    await act(() => current().leave())
    await act(() => current().joinRoom('PLAY', deck))
    const playingSocket = MockWebSocket.instances[1]
    await act(() => playingSocket.emitOpen())
    await act(() =>
      playingSocket.emitMessage({
        type: 'match-start',
        seed: 8,
        viewerId: 'player-one',
        state: createDemoGame(),
      }),
    )
    await act(() => playingSocket.emitClose())
    expect(current().status).toBe('error')
    expect(current().errorMessage).toContain('連線已中斷')
    expect(current().matchEndedReason).toBeNull()
  })

  it('sends one leave message from an open socket and ignores its delayed events', async () => {
    await mountHook()

    await act(() => current().createRoom(deck))
    const socket = MockWebSocket.instances[0]
    await act(() => socket.emitOpen())
    await act(() => current().leave())

    expect(sentMessages(socket).map((message) => message.type)).toEqual([
      'create-room',
      'leave-room',
    ])
    expect(socket.closeCalls).toBe(1)
    expect(current().status).toBe('idle')

    await act(() => {
      socket.emitMessage({ type: 'room-created', code: 'LATE' })
      socket.emitError()
      socket.emitClose()
    })
    expect(current().status).toBe('idle')
    expect(current().errorMessage).toBeNull()
  })

  it('clears connection timers and closes the socket on unmount', async () => {
    vi.useFakeTimers()
    await mountHook()

    await act(() => current().createRoom(deck))
    const socket = MockWebSocket.instances[0]
    await act(() => socket.emitOpen())
    expect(vi.getTimerCount()).toBe(1)

    await act(() => {
      root?.unmount()
    })
    root = null
    expect(socket.closeCalls).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('fails bounded open and acknowledgement waits but not opponent waiting', async () => {
    vi.useFakeTimers()
    await mountHook()

    await act(() => current().createRoom(deck))
    const unopenedSocket = MockWebSocket.instances[0]
    await act(() => vi.advanceTimersByTime(ONLINE_SOCKET_OPEN_TIMEOUT_MS))
    expect(current().status).toBe('error')
    expect(current().errorMessage).toContain('連線逾時')
    expect(unopenedSocket.closeCalls).toBe(1)

    await act(() => current().leave())
    await act(() => current().createRoom(deck))
    const unacknowledgedSocket = MockWebSocket.instances[1]
    await act(() => unacknowledgedSocket.emitOpen())
    await act(() => vi.advanceTimersByTime(ONLINE_SERVER_ACK_TIMEOUT_MS))
    expect(current().status).toBe('error')
    expect(current().errorMessage).toContain('未回應')

    await act(() => current().leave())
    await act(() => current().createRoom(deck))
    const waitingSocket = MockWebSocket.instances[2]
    await act(() => waitingSocket.emitOpen())
    await act(() =>
      waitingSocket.emitMessage({ type: 'room-created', code: 'WAIT' }),
    )
    await act(() => vi.advanceTimersByTime(ONLINE_SOCKET_OPEN_TIMEOUT_MS * 2))
    expect(current().status).toBe('waiting-for-opponent')
  })

  it('turns constructor and malformed protocol failures into visible errors', async () => {
    await mountHook()

    MockWebSocket.throwOnConstruct = true
    await act(() => current().createRoom(deck))
    expect(current().status).toBe('error')
    expect(current().errorMessage).toContain('無法連線')

    MockWebSocket.throwOnConstruct = false
    await act(() => current().createRoom(deck))
    const socket = MockWebSocket.instances[0]
    await act(() => socket.emitOpen())
    await act(() => socket.emitRawMessage('{bad-json'))
    expect(current().status).toBe('error')
    expect(current().errorMessage).toContain('無法辨識')
    expect(socket.closeCode).toBe(4002)

    await act(() => current().leave())
    await act(() => current().joinRoom('BAD1', deck))
    const badStateSocket = MockWebSocket.instances[1]
    await act(() => badStateSocket.emitOpen())
    await act(() =>
      badStateSocket.emitMessage({
        type: 'match-start',
        seed: 1,
        viewerId: 'player-one',
        state: {},
      }),
    )
    expect(current().status).toBe('error')
    expect(current().maskedGame).toBeNull()
    expect(badStateSocket.closeCode).toBe(4002)
  })
})
