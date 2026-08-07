/// @vitest-environment jsdom

import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { CookieCard, GameCard } from '../../game'
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

describe('DamageEffectModals', () => {
  it('updates card selections for a card-based faint effect', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    function Harness() {
      const [selectedFaintTargetIds, setSelectedFaintTargetIds] = useState<
        string[]
      >([])
      const match = {
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
