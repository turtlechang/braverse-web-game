/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CommandLogEntry } from '../../game'
import { item } from '../../game/test-helpers/battle-helpers'
import { BattleLogSidebar } from './BattleLogSidebar'

const containers: HTMLDivElement[] = []

afterEach(() => {
  for (const container of containers.splice(0)) container.remove()
  vi.restoreAllMocks()
})

const render = () => {
  const container = document.createElement('div')
  containers.push(container)
  document.body.append(container)
  const root = createRoot(container)
  return { container, root }
}

const click = async (el: Element | null) => {
  if (!el) throw new Error('element not found')
  await act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

const attackGroup: CommandLogEntry[] = [
  {
    id: 1,
    turnNumber: 3,
    phase: 'main',
    playerId: 'player-one',
    commandKind: 'declare-attack',
    payload: {},
    summary: '玩家 使用「Ninja Cookie」攻擊「Onion Cookie」',
    category: 'attack',
    groupId: 1,
    breakLevel: { 'player-one': 2, 'player-two': 0 },
  },
  {
    id: 2,
    turnNumber: 3,
    phase: 'main',
    playerId: 'player-two',
    commandKind: 'skip-trap',
    payload: {},
    summary: 'AI 對手 選擇不發動陷阱',
    category: 'system',
    groupId: 1,
  },
  {
    id: 3,
    turnNumber: 3,
    phase: 'main',
    playerId: 'player-one',
    commandKind: 'resolve-battle',
    payload: {},
    summary: '玩家 自動結算了戰鬥',
    category: 'attack',
    groupId: 1,
  },
]

const trapEntry: CommandLogEntry = {
  id: 4,
  turnNumber: 4,
  phase: 'main',
  playerId: 'player-two',
  commandKind: 'play-trap',
  payload: {},
  summary: 'AI 對手 設置了陷阱卡「Chocolate Altar of the Fallen」',
  category: 'activate',
  groupId: 4,
  breakLevel: { 'player-one': 2, 'player-two': 1 },
  steps: [
    { text: '支付能量（橫置）：Twizzly Gummy Cookie、Fig Cookie' },
    { text: '選擇目標：Ninja Cookie' },
  ],
}

const supportEntry: CommandLogEntry = {
  id: 5,
  turnNumber: 4,
  phase: 'support',
  playerId: 'player-one',
  commandKind: 'place-support',
  payload: {},
  summary: '玩家 放置了支援卡「Twizzly Gummy Cookie」',
  category: 'deploy',
  groupId: 5,
}

const groupedMemberWithSteps: CommandLogEntry[] = [
  {
    id: 6,
    turnNumber: 5,
    phase: 'main',
    playerId: 'player-one',
    commandKind: 'declare-attack',
    payload: {},
    summary: 'group header',
    category: 'attack',
    groupId: 6,
  },
  {
    id: 7,
    turnNumber: 5,
    phase: 'main',
    playerId: 'player-two',
    commandKind: 'resolve-battle',
    payload: {},
    summary: 'fallback summary',
    category: 'damage',
    groupId: 6,
    card: item('fallback-card'),
    steps: [{
      text: 'detailed step',
      cards: [{
        ...item('step-card'),
        imageUrl: 'https://example.test/cards/step-card.webp',
      }],
    }],
  },
]

describe('BattleLogSidebar', () => {
  it('groups entries sharing a groupId under one collapsed row, hiding steps until expanded', async () => {
    const { container, root } = render()
    await act(() => root.render(<BattleLogSidebar entries={attackGroup} />))
    await click(container.querySelector('[data-testid="battle-log-toggle"]'))

    const entryButtons = container.querySelectorAll('.battle-log-entry')
    expect(entryButtons).toHaveLength(1)
    expect(entryButtons[0].textContent).toContain('使用「Ninja Cookie」攻擊「Onion Cookie」')
    expect(container.querySelector('.battle-log-steps')).toBeNull()
  })

  it('expands a group on click to reveal its member entries as numbered steps', async () => {
    const { container, root } = render()
    await act(() => root.render(<BattleLogSidebar entries={attackGroup} />))
    await click(container.querySelector('[data-testid="battle-log-toggle"]'))
    await click(container.querySelector('.battle-log-entry'))

    const steps = container.querySelectorAll('.battle-log-steps li')
    expect(steps).toHaveLength(2)
    expect(steps[0].textContent).toContain('選擇不發動陷阱')
    expect(steps[1].textContent).toContain('自動結算了戰鬥')
  })

  it('uses a grouped member entry.steps card when rendering its step', async () => {
    const { container, root } = render()
    await act(() => root.render(<BattleLogSidebar entries={groupedMemberWithSteps} />))
    await click(container.querySelector('[data-testid="battle-log-toggle"]'))
    await click(container.querySelector('.battle-log-entry'))

    expect(container.querySelectorAll('.battle-log-step-card-face')).toHaveLength(1)
    expect(
      container.querySelector('.battle-log-step-card-face img')?.getAttribute('src'),
    ).toBe('https://example.test/cards/step-card.webp')
    expect(container.querySelector('.battle-log-steps li')?.textContent).not.toContain(
      'fallback summary',
    )
  })

  it('expands a single-entry group using its stored synthesized steps', async () => {
    const { container, root } = render()
    await act(() => root.render(<BattleLogSidebar entries={[trapEntry]} />))
    await click(container.querySelector('[data-testid="battle-log-toggle"]'))
    await click(container.querySelector('.battle-log-entry'))

    const steps = container.querySelectorAll('.battle-log-steps li')
    expect(steps).toHaveLength(2)
    expect(steps[0].textContent).toContain('支付能量')
    expect(steps[1].textContent).toContain('選擇目標')
  })

  it('does not offer an expand affordance for a simple entry with no steps', async () => {
    const { container, root } = render()
    await act(() => root.render(<BattleLogSidebar entries={[supportEntry]} />))
    await click(container.querySelector('[data-testid="battle-log-toggle"]'))

    const button = container.querySelector('.battle-log-entry') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.className).not.toContain('is-expandable')
  })

  it('filters groups by category, keeping a group visible if any member entry matches', async () => {
    const entries = [...attackGroup, trapEntry, supportEntry]
    const { container, root } = render()
    await act(() => root.render(<BattleLogSidebar entries={entries} />))
    await click(container.querySelector('[data-testid="battle-log-toggle"]'))

    const activateChip = [...container.querySelectorAll('.command-log-category-chips button')].find(
      (button) => button.textContent === '陷阱／道具／技能',
    )
    await click(activateChip ?? null)

    const visibleSummaries = [...container.querySelectorAll('.battle-log-entry p')].map(
      (p) => p.textContent,
    )
    expect(visibleSummaries).toEqual(['AI 對手 設置了陷阱卡「Chocolate Altar of the Fallen」'])
  })

  it('shows a turn divider with each player break level when the turn changes', async () => {
    const entries = [...attackGroup, trapEntry]
    const { container, root } = render()
    await act(() =>
      root.render(
        <BattleLogSidebar
          entries={entries}
          playerNames={{ 'player-one': '玩家', 'player-two': 'AI 對手' }}
        />,
      ),
    )
    await click(container.querySelector('[data-testid="battle-log-toggle"]'))

    const dividers = container.querySelectorAll('.battle-log-turn-divider')
    expect(dividers).toHaveLength(2)
    // 新到舊排序：第 4 回合的分隔線先出現，內容取自 trapEntry 的 breakLevel。
    expect(dividers[0].textContent).toContain('第 4 回合')
    expect(dividers[0].textContent).toContain('玩家 LV.2/10')
    expect(dividers[0].textContent).toContain('AI 對手 LV.1/10')
    expect(dividers[1].textContent).toContain('第 3 回合')
  })
})
