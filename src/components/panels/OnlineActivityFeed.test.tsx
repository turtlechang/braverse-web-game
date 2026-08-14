/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildReplayIssueBundle } from '../../game'
import type { CommandLogEntry, GameState } from '../../game'
import { createBattleState, item } from '../../game/test-helpers/battle-helpers'
import {
  registerIssueBundleProvider,
  resetIssueBundleProviderForTest,
} from '../../hooks/issueBundleSource'
import { OnlineActivityFeed } from './OnlineActivityFeed'

const containers: HTMLDivElement[] = []

afterEach(() => {
  for (const container of containers.splice(0)) container.remove()
  vi.restoreAllMocks()
  resetIssueBundleProviderForTest()
})

const logEntry = (
  id: number,
  commandKind: string,
  summary: string,
  overrides: Partial<CommandLogEntry> = {},
): CommandLogEntry => ({
  id,
  turnNumber: 2,
  phase: 'main',
  playerId: 'player-two',
  commandKind,
  payload: {},
  summary,
  ...overrides,
})

describe('OnlineActivityFeed', () => {
  it('shows player two a non-blocking prompt while player one chooses a replacement Cookie', async () => {
    const container = document.createElement('div')
    containers.push(container)
    document.body.append(container)
    const root = createRoot(container)
    const base = createBattleState()
    const game: GameState = {
      ...base,
      pendingReplacement: {
        tasks: [{ playerId: 'player-one', remaining: 1 }],
      },
    }

    await act(() =>
      root.render(<OnlineActivityFeed game={game} viewerPlayerId="player-two" />),
    )

    expect(container.querySelector('.online-activity-peek')).not.toBeNull()
    expect(container.textContent).toContain(
      `對手 ${game.players['player-one'].name} 正在補位餅乾`,
    )
    await act(() => root.unmount())
  })

  it('announces opponent item, trap, FLIP, and faint events to both viewers', async () => {
    const container = document.createElement('div')
    containers.push(container)
    document.body.append(container)
    const root = createRoot(container)
    const base = createBattleState()
    const first: GameState = {
      ...base,
      commandLog: [logEntry(1, 'declare-attack', 'Player Two 宣告攻擊。')],
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: 'attacker',
        targetInstanceId: 'defender',
        declaredDamage: 1,
        remainingDamage: 1,
        stage: 'trap',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
    }

    await act(() =>
      root.render(<OnlineActivityFeed game={first} viewerPlayerId="player-one" />),
    )
    expect(container.textContent).toContain('Player Two 宣告攻擊。')

    const flip: GameState = {
      ...first,
      commandLog: [
        ...first.commandLog!,
        logEntry(2, 'play-trap', 'Player One 使用陷阱。'),
        logEntry(3, 'play-item', 'Player Two 使用物品。'),
      ],
      pendingBattle: {
        ...first.pendingBattle!,
        stage: 'flip',
        revealedHpCard: item('flip-hp'),
      },
    }
    await act(() =>
      root.render(<OnlineActivityFeed game={flip} viewerPlayerId="player-one" />),
    )
    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="online-activity-toggle"]',
    )
    expect(toggle).not.toBeNull()
    await act(() => toggle!.click())
    expect(container.textContent).toContain('Player One 使用陷阱')
    expect(container.textContent).toContain('Player Two 使用物品')
    expect(container.textContent).toContain('FLIP 效果觸發')

    const fainted: GameState = {
      ...flip,
      pendingBattle: null,
      players: {
        ...flip.players,
        'player-one': {
          ...flip.players['player-one'],
          battleArea: [],
          breakArea: [flip.players['player-one'].battleArea[0]!.card],
        },
      },
    }
    await act(() =>
      root.render(<OnlineActivityFeed game={fainted} viewerPlayerId="player-one" />),
    )
    expect(container.textContent).toContain('昏厥，移至 Break 區')
    await act(() => root.unmount())
  })

  it('uses a grouped member entry.steps card when rendering history', async () => {
    const base = createBattleState()
    const game: GameState = {
      ...base,
      commandLog: [
        logEntry(1, 'declare-attack', 'group header', { groupId: 1 }),
        logEntry(2, 'resolve-battle', 'fallback summary', {
          groupId: 1,
          card: item('fallback-card'),
          steps: [{
            text: 'detailed step',
            cards: [{
              ...item('step-card'),
              imageUrl: 'https://example.test/cards/step-card.webp',
            }],
          }],
        }),
      ],
    }
    const container = document.createElement('div')
    containers.push(container)
    document.body.append(container)
    const root = createRoot(container)

    await act(() =>
      root.render(<OnlineActivityFeed game={game} viewerPlayerId="player-one" />),
    )
    await act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-testid="online-activity-toggle"]')!
        .click(),
    )
    const historyEntry = container.querySelector<HTMLButtonElement>(
      '.online-activity-history-entry',
    )
    expect(historyEntry).not.toBeNull()
    await act(() => historyEntry!.click())

    expect(container.querySelectorAll('.online-activity-step-card-face')).toHaveLength(1)
    expect(
      container.querySelector('.online-activity-step-card-face img')?.getAttribute('src'),
    ).toBe('https://example.test/cards/step-card.webp')
    expect(
      container.querySelector('.online-activity-history-steps li')?.textContent,
    ).not.toContain('fallback summary')
    await act(() => root.unmount())
  })

  it('copies the current issue bundle to the clipboard when a provider is registered', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const base = createBattleState()
    registerIssueBundleProvider((errorSummary) =>
      buildReplayIssueBundle({
        state: base,
        mode: 'online',
        viewerId: 'player-one',
        decks: { playerOne: 'unknown', playerTwo: 'unknown' },
        errorSummary,
      }),
    )

    const container = document.createElement('div')
    containers.push(container)
    document.body.append(container)
    const root = createRoot(container)
    await act(() =>
      root.render(<OnlineActivityFeed game={base} viewerPlayerId="player-one" />),
    )

    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="online-activity-toggle"]',
    )
    await act(() => toggle!.click())

    const copyButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.includes('複製紀錄'),
    )
    expect(copyButton).toBeDefined()

    await act(() => {
      copyButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {})

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('已複製')
    await act(() => root.unmount())
  })

  it('does nothing when no issue bundle provider is registered', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const base = createBattleState()

    const container = document.createElement('div')
    containers.push(container)
    document.body.append(container)
    const root = createRoot(container)
    await act(() =>
      root.render(<OnlineActivityFeed game={base} viewerPlayerId="player-one" />),
    )

    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="online-activity-toggle"]',
    )
    await act(() => toggle!.click())

    const copyButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.includes('複製紀錄'),
    )
    await act(() => {
      copyButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {})

    expect(writeText).not.toHaveBeenCalled()
    await act(() => root.unmount())
  })
})
