/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { createDemoSetupGame, type GameState } from '../../game'
import type {
  OnlineOpeningAction,
  OnlineOpeningSnapshot,
} from '../../net/onlineProtocol'
import { OnlineOpeningOverlay } from './OnlineOpeningOverlay'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const createOpening = (
  overrides: Partial<OnlineOpeningSnapshot> = {},
): OnlineOpeningSnapshot => ({
  stage: 'rps',
  round: 1,
  actorId: null,
  firstPlayerId: null,
  players: {
    'player-one': { name: 'Host Player', submitted: false },
    'player-two': { name: 'Guest Player', submitted: false },
  },
  rpsResult: null,
  revealedNoCookieHand: [],
  ...overrides,
})

const createSetupGameWithCookie = (): GameState => {
  const game = createDemoSetupGame('player-one', 'red', 7)
  const player = game.players['player-one']
  if (player.hand.some((card) => card.type === 'cookie')) return game

  const cookie = player.deck.find((card) => card.type === 'cookie')!
  const replaced = player.hand[0]
  return {
    ...game,
    players: {
      ...game.players,
      'player-one': {
        ...player,
        hand: [cookie, ...player.hand.slice(1)],
        deck: [
          replaced,
          ...player.deck.filter((card) => card.instanceId !== cookie.instanceId),
        ],
      },
    },
  }
}

const renderOverlay = async (
  opening: OnlineOpeningSnapshot,
  game: GameState | null = null,
) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const onAction = vi.fn<(action: OnlineOpeningAction) => void>()
  const onLeave = vi.fn()

  await act(() =>
    root.render(
      <OnlineOpeningOverlay
        opening={opening}
        game={game}
        viewerPlayerId="player-one"
        roomCode="ABCD"
        onAction={onAction}
        onLeave={onLeave}
      />,
    ),
  )

  return { container, root, onAction }
}

const findButton = (container: HTMLElement, label: string) =>
  [...container.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === label,
  ) as HTMLButtonElement | undefined

const click = async (button: HTMLButtonElement | undefined) => {
  expect(button).toBeDefined()
  await act(() => {
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('OnlineOpeningOverlay', () => {
  it('送出私密猜拳選擇，送出後不顯示任一方選擇', async () => {
    const { container, root, onAction } = await renderOverlay(createOpening())

    await click(findButton(container, '石頭'))
    expect(onAction).toHaveBeenCalledWith({ kind: 'rps', choice: 'rock' })

    await act(() =>
      root.render(
        <OnlineOpeningOverlay
          opening={createOpening({
            players: {
              'player-one': { name: 'Host Player', submitted: true },
              'player-two': { name: 'Guest Player', submitted: false },
            },
          })}
          game={null}
          viewerPlayerId="player-one"
          roomCode="ABCD"
          onAction={onAction}
          onLeave={vi.fn()}
        />,
      ),
    )

    expect(container.textContent).toContain('等待對手完成猜拳')
    expect(container.querySelector('[data-testid="online-rps-result"]')).toBeNull()
    expect(findButton(container, '石頭')).toBeUndefined()

    await act(() => root.unmount())
    container.remove()
  })

  it('只讓猜拳勝者選擇先攻或後攻並顯示雙方順位', async () => {
    const opening = createOpening({
      stage: 'choose-order',
      actorId: 'player-one',
      rpsResult: {
        choices: { 'player-one': 'rock', 'player-two': 'scissors' },
        winnerId: 'player-one',
      },
    })
    const { container, root, onAction } = await renderOverlay(opening)

    expect(container.textContent).toContain('Host Player：石頭')
    expect(container.textContent).toContain('Guest Player：剪刀')
    await click(findButton(container, '選擇後攻'))
    expect(onAction).toHaveBeenCalledWith({
      kind: 'choose-order',
      goFirst: false,
    })

    await act(() =>
      root.render(
        <OnlineOpeningOverlay
          opening={createOpening({
            stage: 'mulligan',
            actorId: 'player-two',
            firstPlayerId: 'player-two',
          })}
          game={null}
          viewerPlayerId="player-one"
          roomCode="ABCD"
          onAction={onAction}
          onLeave={vi.fn()}
        />,
      ),
    )
    expect(container.textContent).toContain('先攻')
    expect(container.textContent).toContain('後攻')
    expect(container.querySelector('[data-testid="online-rps-result"]')).toBeNull()

    await act(() => root.unmount())
    container.remove()
  })

  it('起始餅乾只顯示自己的手牌並送出所選卡片', async () => {
    const game = createSetupGameWithCookie()
    const opening = createOpening({
      stage: 'starting-cookie',
      firstPlayerId: 'player-one',
    })
    const { container, root, onAction } = await renderOverlay(opening, game)

    const cookieButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="online-starting-cookie"]',
    )
    expect(cookieButton).not.toBeNull()
    await click(cookieButton ?? undefined)
    expect(onAction).toHaveBeenCalledWith({
      kind: 'starting-cookie',
      instanceId: game.players['player-one'].hand.find(
        (card) => card.type === 'cookie',
      )!.instanceId,
    })

    await act(() => root.unmount())
    container.remove()
  })
})
