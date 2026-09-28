/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import type { GameState, PlayerId } from '../../game'
import { maskGameStateForViewer } from '../../game/masked-state'
import { createBattleState, item } from '../../game/test-helpers/battle-helpers'
import { HandInspectionModal } from './HandInspectionModal'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

type HandInspectionResult = NonNullable<
  NonNullable<GameState['handInspectionResults']>[PlayerId]
>

const stateWithResult = (
  result: HandInspectionResult,
): GameState => ({
  ...createBattleState(),
  handInspectionResults: { 'player-one': result },
})

const mount = async (result: HandInspectionResult | undefined) => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(() => root.render(
    result ? <HandInspectionModal result={result} /> : null,
  ))
  return { host, root }
}

describe('HandInspectionModal', () => {
  it('shows only the owner snapshot, dismisses locally, and reopens for a later or new-match result', async () => {
    const cards = [item('visible snapshot card one'), item('visible snapshot card two')]
    const result: HandInspectionResult = {
      sequence: 1,
      sourceInstanceId: 'stage-first-match',
      targetPlayerId: 'player-two',
      cards,
    }
    const ownerView = maskGameStateForViewer(stateWithResult(result), 'player-one')
    const { host, root } = await mount(ownerView.handInspectionResults?.['player-one'])

    try {
      expect(host.querySelector('[role="dialog"]')).not.toBeNull()
      for (const card of cards) expect(host.textContent).toContain(card.name)

      await act(() => host.querySelector<HTMLButtonElement>('button')!.click())
      expect(host.querySelector('[role="dialog"]')).toBeNull()

      const laterResult = { ...result, sequence: 2 }
      await act(() => root.render(<HandInspectionModal result={laterResult} />))
      expect(host.querySelector('[role="dialog"]')).not.toBeNull()

      await act(() => host.querySelector<HTMLButtonElement>('button')!.click())
      const newMatchResult = {
        ...result,
        sourceInstanceId: 'stage-new-match',
      }
      await act(() => root.render(<HandInspectionModal result={newMatchResult} />))
      expect(host.querySelector('[role="dialog"]')).not.toBeNull()
    } finally {
      await act(() => root.unmount())
      host.remove()
    }
  })

  it('explains that the opponent hand was empty', async () => {
    const emptyResult: HandInspectionResult = {
      sequence: 1,
      sourceInstanceId: 'empty-stage',
      targetPlayerId: 'player-two',
      cards: [],
    }
    const { host, root } = await mount(emptyResult)

    try {
      expect(host.querySelector('[role="status"]')?.textContent).toBe(
        '對手目前沒有手牌。',
      )
    } finally {
      await act(() => root.unmount())
      host.remove()
    }
  })

  it('renders nothing for the opponent masked viewer', async () => {
    const result: HandInspectionResult = {
      sequence: 1,
      sourceInstanceId: 'owner-only-stage',
      targetPlayerId: 'player-two',
      cards: [item('owner only card identity')],
    }
    const opponentView = maskGameStateForViewer(
      stateWithResult(result),
      'player-two',
    )
    expect(opponentView.handInspectionResults).toBeUndefined()
    const { host, root } = await mount(
      opponentView.handInspectionResults?.['player-two'],
    )

    try {
      expect(host.querySelector('[role="dialog"]')).toBeNull()
      expect(host.textContent).not.toContain('owner only card identity')
    } finally {
      await act(() => root.unmount())
      host.remove()
    }
  })

  it('dismisses with Escape, restores focus, and shows the same result after it clears', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = '場景效果'
    document.body.append(trigger)
    trigger.focus()
    const result: HandInspectionResult = {
      sequence: 1,
      sourceInstanceId: 'same-stage-result',
      targetPlayerId: 'player-two',
      cards: [item('same snapshot card')],
    }
    const { host, root } = await mount(result)

    try {
      const close = host.querySelector<HTMLButtonElement>('[data-modal-initial-focus]')!
      expect(document.activeElement).toBe(close)
      const escape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
      await act(() => document.activeElement!.dispatchEvent(escape))
      expect(escape.defaultPrevented).toBe(true)
      expect(host.querySelector('[role="dialog"]')).toBeNull()
      expect(document.activeElement).toBe(trigger)

      await act(() => root.render(null))
      await act(() => root.render(<HandInspectionModal result={result} />))
      expect(host.querySelector('[role="dialog"]')).not.toBeNull()
      expect(document.activeElement?.getAttribute('data-modal-initial-focus')).not.toBeNull()
    } finally {
      await act(() => root.unmount())
      host.remove()
      trigger.remove()
    }
  })
})
