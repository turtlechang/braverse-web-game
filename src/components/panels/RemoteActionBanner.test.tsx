/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { ActionStatus } from './actionStatus'
import { RemoteActionBanner } from './RemoteActionBanner'

const containers: HTMLDivElement[] = []

afterEach(() => {
  for (const container of containers.splice(0)) container.remove()
})

const status: ActionStatus = {
  mode: 'opponent-thinking',
  actorId: 'player-two',
  actorLabel: 'Alice',
  phaseLabel: '主要階段',
  headline: 'Alice 正在選擇攻擊目標',
  sourceCard: {
    instanceId: 'source-1',
    id: 'BS2-015',
    name: 'Hydrangea Cookie',
    type: 'cookie',
    ownerId: 'player-two',
  },
  progress: [
    { key: 'declare', label: '宣告', state: 'done' },
    { key: 'payment', label: '能量', state: 'done' },
    { key: 'target', label: '目標', state: 'active' },
    { key: 'resolve', label: '結算', state: 'pending' },
  ],
  expiresAt: new Date(Date.now() + 30_000).toISOString(),
}

describe('RemoteActionBanner', () => {
  it('compact 模式也顯示玩家、階段、卡牌與完整進度', async () => {
    const container = document.createElement('div')
    containers.push(container)
    document.body.append(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <RemoteActionBanner
          status={status}
          compact
          connectionNotice="已收到對手操作"
        />,
      ),
    )

    expect(container.textContent).toContain('Alice')
    expect(container.textContent).toContain('主要階段')
    expect(container.textContent).toContain('Hydrangea Cookie')
    expect(container.textContent).toContain('宣告')
    expect(container.textContent).toContain('結算')
    expect(container.textContent).toContain('已收到對手操作')

    await act(() => root.unmount())
  })
})
