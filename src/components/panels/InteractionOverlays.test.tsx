/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameCard } from '../../game'
import { CardPreviewPanel, StatusToast } from './InteractionOverlays'

const containers: HTMLDivElement[] = []

afterEach(() => {
  vi.useRealTimers()
  for (const container of containers.splice(0)) container.remove()
})

const previewCard: GameCard = {
  id: 'ST1-001',
  instanceId: 'preview-card',
  name: '快速預覽卡',
  type: 'cookie',
  level: 1,
  hp: 3,
  attack: 1,
  attackCost: 1,
  effects: [],
}

describe('interaction overlays', () => {
  it('renders the selected card', async () => {
    const container = document.createElement('div')
    containers.push(container)
    document.body.append(container)
    const root = createRoot(container)

    await act(() => root.render(<CardPreviewPanel card={previewCard} />))

    expect(container.querySelector('.card-preview-panel')).not.toBeNull()
    expect(container.textContent).toContain('快速預覽卡')
    await act(() => root.unmount())
  })

  it('renders nothing when no card is given', async () => {
    const container = document.createElement('div')
    containers.push(container)
    document.body.append(container)
    const root = createRoot(container)

    await act(() => root.render(<CardPreviewPanel card={null} />))

    expect(container.querySelector('.card-preview-panel')).toBeNull()
    await act(() => root.unmount())
  })

  it('announces a status message and dismisses it after the duration', async () => {
    vi.useFakeTimers()
    const container = document.createElement('div')
    containers.push(container)
    document.body.append(container)
    const root = createRoot(container)

    await act(() =>
      root.render(<StatusToast message="已進入主要階段" duration={1000} />),
    )
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      '已進入主要階段',
    )

    await act(() => vi.advanceTimersByTime(1000))
    expect(container.querySelector('[role="status"]')).toBeNull()

    await act(() =>
      root.render(<StatusToast message="已進入戰鬥階段" duration={1000} />),
    )
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      '已進入戰鬥階段',
    )
    await act(() => root.unmount())
  })
})
