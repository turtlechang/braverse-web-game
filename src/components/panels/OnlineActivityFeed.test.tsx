/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { CommandLogEntry, GameState } from '../../game'
import { createBattleState, item } from '../../game/test-helpers/battle-helpers'
import { OnlineActivityFeed } from './OnlineActivityFeed'

const containers: HTMLDivElement[] = []

afterEach(() => {
  for (const container of containers.splice(0)) container.remove()
})

const logEntry = (
  id: number,
  commandKind: string,
  summary: string,
): CommandLogEntry => ({
  id,
  turnNumber: 2,
  phase: 'main',
  playerId: 'player-two',
  commandKind,
  payload: {},
  summary,
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
})
