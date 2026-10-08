/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { applyGameCommand } from '../game/commands'
import type { GameState } from '../game/types'
import { createBs12CaramelArrowDemoState } from '../game/demo'
import { useMatchController } from './useMatchController'
import { useOnlineMatchController } from './useOnlineMatchController'
import { DamageEffectModals } from '../components/battle/DamageEffectModals'
import type { BattleUiMatchLike, BattleUiPendingEffectLike } from './battleUiContracts'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const resolvePhysicalArrowDamage=(before:GameState)=>{let state=before;for(let hit=0;state.pendingBattle?.stage==='damage'&&hit<2;hit++)state=applyGameCommand(state,{kind:'resolve-next-damage',playerId:'player-one'});return state}

it.each(['BS12-091', 'BS12-091@1'] as const)('%s keeps the source art and separates top-three payment from fresh recovery in both controllers', async number => {
  vi.useFakeTimers()
  const start = createBs12CaramelArrowDemoState(number, 'faint')
  const redirected = applyGameCommand(start, { kind: 'play-blocker', playerId: 'player-one', sourceInstanceId: 'bs12-091-source', paymentIds: [], discardHandIds: ['bs12-091-cost'] })
  const fainted = resolvePhysicalArrowDamage(redirected)
  const paid = applyGameCommand(fainted, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [], payDeckToTrash: true })
  let local: ReturnType<typeof useMatchController> | undefined
  let online: ReturnType<typeof useOnlineMatchController> | undefined
  let current = fainted
  function Harness() {
    local = useMatchController({ testStateConfig: { kind: 'bs12-091', cardNumber: number, scenario: 'faint' } })
    online = useOnlineMatchController({ game: current, viewerPlayerId: 'player-one', sendCommand: vi.fn() })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    await act(() => local!.setGame(redirected))
    for(let hit=0;hit<2;hit++)await act(() => vi.advanceTimersByTime(50))
    for (const controller of [local!, online!]) {
      expect(controller.hasFaint).toBe(true)
      expect(controller.faintSourceCard?.imageUrl).toBe(start.players['player-one'].battleArea[0].card.imageUrl)
      expect(controller).toHaveProperty('faintCostDeckToTrashAmount', 3)
      expect(controller.faintCardCandidates).toEqual([])
      expect(controller.faintMax).toBe(0)
      expect(controller.faintCostHandAmount).toBe(0)
    }
    current = paid
    await act(() => { local!.setGame(paid); root.render(<Harness />) })
    for (const controller of [local!, online!]) {
      expect(controller).toHaveProperty('faintCostDeckToTrashAmount', 0)
      // The Arena hand cost is Currant Cream, which has no printed Blocker.
      expect(controller.faintCardCandidates.map(card => card.instanceId)).toEqual(['bs12-091-milled-blocker'])
      expect(controller.faintCandidateLabel).toContain('Blocker')
      expect(controller.faintCandidateLabel).toContain('Caramel Arrow Cookie')
      expect(controller.faintMax).toBe(1)
    }
  } finally {
    await act(() => root.unmount())
    vi.useRealTimers()
  }
})

it.each([true, false])('online shared panel explicitly pays or declines before showing targets: pay=%s', async pay => {
  const start = createBs12CaramelArrowDemoState('BS12-091', 'direct-attack')
  const fainted = resolvePhysicalArrowDamage(applyGameCommand(start, { kind: 'skip-trap', playerId: 'player-one' }))
  const sendCommand = vi.fn()
  const container = document.createElement('div')
  const root = createRoot(container)
  function Harness() {
    const match = useOnlineMatchController({ game: fainted, viewerPlayerId: 'player-one', sendCommand })
    return <DamageEffectModals match={match as BattleUiMatchLike} pending={{ faintActive: true, afterDamageActive: false } as BattleUiPendingEffectLike} />
  }
  try {
    await act(() => root.render(<Harness />))
    expect(container.textContent).toMatch(/牌庫頂.*3.*棄牌區/)
    expect(container.textContent).toContain('支付後再選擇')
    expect(container.querySelector('.faint-card-candidates')).toBeNull()
    const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === (pay ? '支付代價' : '不發動'))
    expect(button).toBeDefined()
    await act(() => button!.click())
    expect(sendCommand.mock.calls[0][0]).toMatchObject({ kind: 'resolve-faint-effect', targetIds: [] })
    expect(sendCommand.mock.calls[0][0].payDeckToTrash).toBe(pay ? true : undefined)
  } finally { await act(() => root.unmount()) }
})

it('an unavailable top-three cost disables payment and allows the shared online panel to continue without milling', async () => {
  const start = createBs12CaramelArrowDemoState('BS12-091', 'unpayable')
  const fainted = resolvePhysicalArrowDamage(applyGameCommand(start, { kind: 'skip-trap', playerId: 'player-one' }))
  const sendCommand = vi.fn()
  const container = document.createElement('div')
  const root = createRoot(container)
  function Harness() {
    const match = useOnlineMatchController({ game: fainted, viewerPlayerId: 'player-one', sendCommand })
    return <DamageEffectModals match={match as BattleUiMatchLike} pending={{ faintActive: true, afterDamageActive: false } as BattleUiPendingEffectLike} />
  }
  try {
    await act(() => root.render(<Harness />))
    expect(container.textContent).toContain('無法支付牌庫頂代價')
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('button')]
    expect(buttons.find(button => button.textContent === '支付代價')?.disabled).toBe(true)
    await act(() => buttons.find(button => button.textContent === '繼續')!.click())
    expect(sendCommand.mock.calls[0][0]).toEqual({ kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [] })
  } finally { await act(() => root.unmount()) }
})
