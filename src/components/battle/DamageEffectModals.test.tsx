/// @vitest-environment jsdom

import { act, StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { CookieCard, GameCard } from '../../game'
import { createDemoGame } from '../../game'
import type {
  BattleUiMatchLike,
  BattleUiPendingEffectLike,
} from '../../hooks/battleUiContracts'
import { DamageEffectModals } from './DamageEffectModals'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const sourceCard: CookieCard = {
  id: 'BS3-061',
  instanceId: 'silverbell-instance',
  name: 'Silverbell Cookie',
  type: 'cookie',
  level: 1,
  hp: 2,
  attack: 1,
  attackCost: 1,
}

const supportCard: GameCard = {
  id: 'support-card',
  instanceId: 'support-pay-0',
  name: '支援卡',
  type: 'item',
}

it('opens a standby draw choice once in StrictMode without a Cookie-target prompt', async () => {
  const container = document.createElement('div')
  const root = createRoot(container)
  const game = createDemoGame()
  const card = { ...sourceCard, id: 'BS12-033', name: 'Espresso Cookie' }
  game.pendingAfterDamageEffects = [{ triggerReason: 'break-by-arena-effect', sourcePlayerId: 'player-one',
    sourceInstanceId: card.instanceId, sourceCardName: card.name, effect: { kind: 'draw-up-to', max: 1 },
    context: { sourcePlayerId: 'player-one', sourceInstanceId: card.instanceId },
  }]
  const dispatch = vi.fn()
  const match = { game, viewerPlayerId: 'player-one', afterDamageSourceCard: card,
    afterDamageMin: 0, afterDamageMax: 0, selectedAfterDamageTargetIds: [], afterDamageCandidates: [], dispatch,
  } as unknown as BattleUiMatchLike
  const pending = { faintActive: false, afterDamageActive: true } as BattleUiPendingEffectLike
  await act(() => root.render(<StrictMode><DamageEffectModals match={match} pending={pending} /></StrictMode>))
  expect(dispatch).toHaveBeenCalledTimes(1)
  expect(dispatch).toHaveBeenCalledWith({ kind: 'resolve-after-damage-effect', playerId: 'player-one', targetIds: [] }, expect.stringContaining('抽牌'))
  expect(container.textContent).not.toMatch(/餅乾作為目標|確認略過/)
  await act(() => root.unmount())
})

describe('DamageEffectModals', () => {
  it.each([false, true])('labels a Break-entry HP choice as friendly and dispatches the chosen targets: selected=%s', async selected => {
    const container = document.createElement('div')
    const root = createRoot(container)
    const card: CookieCard = { ...sourceCard, id: 'BS12-032', name: 'Caramel Choux Cookie' }
    const game = createDemoGame()
    const target = game.players['player-one'].battleArea[0]
    const selectedIds = selected ? [target.card.instanceId] : []
    const dispatch = vi.fn()
    const clear = vi.fn()
    game.pendingAfterDamageEffects = [{
      triggerReason: 'break-by-arena-effect', sourcePlayerId: 'player-one', sourceInstanceId: card.instanceId,
      effect: { kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 1 } },
      context: { sourcePlayerId: 'player-one', sourceInstanceId: card.instanceId },
    }]
    const match = { game, afterDamageSourceCard: card, afterDamageMin: 0, afterDamageMax: 1,
      afterDamageCandidates: [target], selectedAfterDamageTargetIds: selectedIds, setSelectedAfterDamageTargetIds: clear,
      viewerPlayerId: 'player-one', dispatch,
    } as unknown as BattleUiMatchLike
    const pending = { faintActive: false, afterDamageActive: true } as BattleUiPendingEffectLike
    await act(() => root.render(<DamageEffectModals match={match} pending={pending} />))
    expect(container.querySelector('h2')?.textContent).toBe('Caramel Choux Cookie 發動休息區移入效果')
    expect(container.querySelector('.faint-target-hint')?.textContent).toContain('最多 1 個己方餅乾')
    const confirm = container.querySelector<HTMLButtonElement>('button.primary')
    expect(confirm?.disabled).toBe(false)
    await act(() => confirm?.click())
    expect(dispatch).toHaveBeenCalledWith({ kind: 'resolve-after-damage-effect', playerId: 'player-one', targetIds: selectedIds }, expect.stringContaining('休息區移入效果'))
    expect(clear).toHaveBeenCalledWith([])
    await act(() => root.unmount())
  })

  it('updates card selections for a card-based faint effect', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    function Harness() {
      const [selectedFaintTargetIds, setSelectedFaintTargetIds] = useState<
        string[]
      >([])
      const match = {
        game: createDemoGame(),
        faintActive: true,
        faintSourceCard: sourceCard,
        faintMin: 1,
        faintMax: 1,
        selectedFaintTargetIds,
        setSelectedFaintTargetIds,
        faintCandidates: [],
        faintCardCandidates: [supportCard],
        faintCandidateLabel: '支援區卡',
        faintEnergyCost: {},
        faintEnergyCostTotal: 0,
        faintPaymentCandidates: [],
        selectedFaintPaymentIds: [],
        faintPaymentValid: true,
        toggleFaintPayment: vi.fn(),
        viewerPlayerId: 'player-one',
        dispatch: vi.fn(),
      } as unknown as BattleUiMatchLike
      const pending = {
        faintActive: true,
        afterDamageActive: false,
      } as BattleUiPendingEffectLike

      return <DamageEffectModals match={match} pending={pending} />
    }

    await act(() => root.render(<Harness />))
    const candidate = container.querySelector<HTMLButtonElement>(
      '.faint-card-candidates button',
    )
    expect(candidate?.getAttribute('aria-pressed')).toBe('false')

    await act(() => candidate?.click())

    expect(
      container
        .querySelector<HTMLButtonElement>('.faint-card-candidates button')
        ?.getAttribute('aria-pressed'),
    ).toBe('true')

    await act(() => root.unmount())
  })
})
