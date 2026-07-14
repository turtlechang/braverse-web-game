/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createDemoGame, type CustomDeck } from '../../game'
import { OFFICIAL_RED_STARTER_DECK } from '../../game/starter-deck'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const validDeck: CustomDeck = {
  id: 'deck-valid',
  name: '合法紅色牌組',
  entries: OFFICIAL_RED_STARTER_DECK,
  createdAt: '2026-07-04T00:00:00.000Z',
  updatedAt: '2026-07-04T00:00:00.000Z',
}

const {
  mockCreateRoom,
  mockJoinRoom,
  mockLeave,
  mockSendCommand,
  getMockState,
  setMockState,
} = vi.hoisted(() => {
  const mockCreateRoom = vi.fn()
  const mockJoinRoom = vi.fn()
  const mockLeave = vi.fn()
  const mockSendCommand = vi.fn()
  let state: {
    status: string
    roomCode: string | null
    errorMessage: string | null
    matchEndedReason: string | null
    viewerPlayerId: 'player-one' | 'player-two' | null
    maskedGame: ReturnType<typeof createDemoGame> | null
  } = {
    status: 'idle',
    roomCode: null,
    errorMessage: null,
    matchEndedReason: null,
    viewerPlayerId: null,
    maskedGame: null,
  }

  return {
    mockCreateRoom,
    mockJoinRoom,
    mockLeave,
    mockSendCommand,
    getMockState: () => state,
    setMockState: (next: Partial<typeof state>) => {
      state = { ...state, ...next }
    },
  }
})

vi.mock('../../hooks/useOnlineMatch', () => ({
  useOnlineMatch: () => {
    const state = getMockState()
    return {
      status: state.status,
      roomCode: state.roomCode,
      viewerPlayerId: state.viewerPlayerId,
      maskedGame: state.maskedGame,
      errorMessage: state.errorMessage,
      matchEndedReason: state.matchEndedReason,
      createRoom: mockCreateRoom,
      joinRoom: mockJoinRoom,
      sendCommand: mockSendCommand,
      leave: mockLeave,
    }
  },
}))

vi.mock('./OnlineBattleView', () => ({
  OnlineBattleView: ({ commandRejectedReason }: { commandRejectedReason: string | null }) => (
    <div data-testid="mock-battle-view">{commandRejectedReason}</div>
  ),
}))

import { OnlineMatchPanel } from './OnlineMatchPanel'

const renderPanel = async (decks: CustomDeck[], onClose = vi.fn()) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(() =>
    root.render(
      <OnlineMatchPanel decks={decks} onClose={onClose} />,
    ),
  )
  return { container, root, onClose }
}

const findButton = (container: HTMLElement, label: string): HTMLButtonElement | undefined =>
  [...container.querySelectorAll('button')].find((btn) =>
    btn.textContent?.includes(label),
  ) as HTMLButtonElement | undefined

const click = async (btn: HTMLButtonElement | null | undefined) => {
  expect(btn).toBeDefined()
  await act(() => {
    btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

beforeEach(() => {
  setMockState({
    status: 'idle',
    roomCode: null,
    errorMessage: null,
    matchEndedReason: null,
    viewerPlayerId: null,
    maskedGame: null,
  })
  mockCreateRoom.mockClear()
  mockJoinRoom.mockClear()
  mockLeave.mockClear()
  mockSendCommand.mockClear()
})

describe('OnlineMatchPanel idle state', () => {
  it('renders online-match-panel with deck select, create room, and join controls', async () => {
    const { container, root } = await renderPanel([validDeck])

    expect(container.querySelector('.online-match-panel')).toBeDefined()
    expect(container.textContent).toContain('線上對戰')
    expect(container.textContent).toContain('待機中')

    const select = container.querySelector<HTMLSelectElement>(
      '.online-match-field select',
    )
    expect(select).toBeDefined()
    expect(select!.value).toBe('deck-valid')

    await act(() => root.unmount())
  })

  it('has 建立房間 button enabled when valid deck selected', async () => {
    const { container, root } = await renderPanel([validDeck])

    const createBtn = findButton(container, '建立房間')
    expect(createBtn).toBeDefined()
    expect(createBtn!.disabled).toBe(false)

    await act(() => root.unmount())
  })

  it('has 加入房間 button disabled when join code is empty', async () => {
    const { container, root } = await renderPanel([validDeck])

    const joinBtn = findButton(container, '加入房間')
    expect(joinBtn).toBeDefined()
    expect(joinBtn!.disabled).toBe(true)

    await act(() => root.unmount())
  })

  it('entering join code enables 加入房間 button', async () => {
    const { container, root } = await renderPanel([validDeck])

    const input = container.querySelector<HTMLInputElement>(
      '.online-match-input',
    )
    expect(input).toBeDefined()

    await act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )!.set!
      nativeInputValueSetter.call(input!, 'ABC123')
      input!.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const joinBtn = findButton(container, '加入房間')
    expect(joinBtn!.disabled).toBe(false)

    await act(() => root.unmount())
  })

  it('clicking 加入房間 calls joinRoom with deck and trim code', async () => {
    const { container, root } = await renderPanel([validDeck])

    const input = container.querySelector<HTMLInputElement>(
      '.online-match-input',
    )
    expect(input).toBeDefined()

    await act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )!.set!
      nativeInputValueSetter.call(input!, '  ABC123  ')
      input!.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await click(findButton(container, '加入房間'))

    expect(mockJoinRoom).toHaveBeenCalledTimes(1)
    expect(mockJoinRoom).toHaveBeenCalledWith('ABC123', validDeck)

    await act(() => root.unmount())
  })
})

describe('OnlineMatchPanel accessibility', () => {
  it('renders section with role="dialog" aria-modal and aria-labelledby pointing to h2 id', async () => {
    const { container, root } = await renderPanel([validDeck])

    const panel = container.querySelector('.online-match-panel')
    expect(panel).toBeDefined()
    expect(panel!.getAttribute('role')).toBe('dialog')
    expect(panel!.getAttribute('aria-modal')).toBe('true')

    const labelledby = panel!.getAttribute('aria-labelledby')
    expect(labelledby).toBeDefined()

    const title = panel!.querySelector('h2')
    expect(title).toBeDefined()
    expect(title!.id).toBe(labelledby)

    await act(() => root.unmount())
  })

  it('has backdrop with role="presentation"', async () => {
    const { container, root } = await renderPanel([validDeck])

    const backdrop = container.querySelector('.modal-backdrop')
    expect(backdrop).toBeDefined()
    expect(backdrop!.getAttribute('role')).toBe('presentation')

    await act(() => root.unmount())
  })

  it('deck select has accessible label via htmlFor/id', async () => {
    const { container, root } = await renderPanel([validDeck])

    const label = container.querySelector('label[for="deck-select"]')
    expect(label).toBeDefined()
    expect(label!.textContent).toContain('選擇牌組')

    await act(() => root.unmount())
  })

  it('room code input has aria-label', async () => {
    const { container, root } = await renderPanel([validDeck])

    const input = container.querySelector<HTMLInputElement>('.online-match-input')
    expect(input).toBeDefined()
    expect(input!.getAttribute('aria-label')).toBe('房號')

    await act(() => root.unmount())
  })
})

describe('OnlineMatchPanel waiting state', () => {
  it('shows room code and waiting message when waiting-for-opponent', async () => {
    setMockState({ status: 'waiting-for-opponent', roomCode: 'ROOM42' })
    const { container, root } = await renderPanel([validDeck])

    expect(container.textContent).toContain('等待對手')
    expect(container.textContent).toContain('ROOM42')
    expect(container.textContent).toContain('請把房號分享給對手')
    expect(container.querySelector('.online-match-notice')).toBeDefined()

    await act(() => root.unmount())
  })
})

describe('OnlineMatchPanel error state', () => {
  it('shows error message and return button in error state', async () => {
    setMockState({
      status: 'error',
      errorMessage: '房間不存在',
    })
    const { container, root } = await renderPanel([validDeck])

    expect(container.textContent).toContain('錯誤')
    expect(container.textContent).toContain('房間不存在')

    const returnBtn = findButton(container, '返回')
    expect(returnBtn).toBeDefined()

    await act(() => root.unmount())
  })
})

describe('OnlineMatchPanel in-progress state', () => {
  it('passes a rejected command reason to the battle view', async () => {
    setMockState({
      status: 'in-progress',
      errorMessage: '現在不是你的回合。',
      viewerPlayerId: 'player-one',
      maskedGame: createDemoGame(),
    })
    const { container, root } = await renderPanel([validDeck])

    expect(container.querySelector('[data-testid="mock-battle-view"]')?.textContent).toBe(
      '現在不是你的回合。',
    )

    await act(() => root.unmount())
  })
})

describe('OnlineMatchPanel close / leave behavior', () => {
  it('calls leave and onClose when close button clicked during waiting-for-opponent', async () => {
    setMockState({ status: 'waiting-for-opponent', roomCode: 'ROOM42' })
    const onClose = vi.fn()
    const { container, root } = await renderPanel([validDeck], onClose)

    const closeBtn = container.querySelector<HTMLButtonElement>(
      '.online-match-close',
    )
    expect(closeBtn).toBeDefined()

    await click(closeBtn)

    expect(mockLeave).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)

    await act(() => root.unmount())
  })

  it('calls onClose but not leave when return button is clicked in error state', async () => {
    setMockState({
      status: 'error',
      errorMessage: '連線失敗',
    })
    const onClose = vi.fn()
    const { container, root } = await renderPanel([validDeck], onClose)

    await click(findButton(container, '返回'))

    expect(mockLeave).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)

    await act(() => root.unmount())
  })

  it('calls leave and onClose when close button clicked during connecting', async () => {
    setMockState({ status: 'connecting' })
    const onClose = vi.fn()
    const { container, root } = await renderPanel([validDeck], onClose)

    const closeBtn = container.querySelector<HTMLButtonElement>(
      '.online-match-close',
    )
    expect(closeBtn).toBeDefined()
    await click(closeBtn)

    expect(mockLeave).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)

    await act(() => root.unmount())
  })

  it('does not call leave in idle state when closing', async () => {
    const onClose = vi.fn()
    const { container, root } = await renderPanel([validDeck], onClose)

    const closeBtn = container.querySelector<HTMLButtonElement>(
      '.online-match-close',
    )
    await click(closeBtn)

    expect(mockLeave).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)

    await act(() => root.unmount())
  })
})
