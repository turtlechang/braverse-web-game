/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBattleState, cookie, item } from '../../game/test-helpers/battle-helpers'
import { getOptionalCostAttackPrompt } from './optionalCostAttackPrompt'
import { OptionalCostAttackModal } from './PendingDecisionModals'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it('requires every eligible opponent Cookie before confirming sequential damage-all', async () => {
  const state = createBattleState()
  state.players['player-one'].battleArea = ['first', 'second'].map((id, index) => ({
    card: cookie(`sequential-${id}`),
    hpCards: [item(`${id}-hp-1`), item(`${id}-hp-2`)],
    rested: false,
    battleEntryId: `${id}:battle:${index + 1}`,
  }))
  state.players['player-two'].hand = [item('discard-one'), item('discard-two')]
  state.pendingOptionalCostAttack = {
    playerId: 'player-two',
    sourceInstanceId: 'attacker',
    sourceCardName: 'Sea Fairy Cookie',
    cost: { energy: {}, discardHand: 2 },
    effects: [{
      kind: 'damage-all',
      amount: 1,
      side: 'opponent',
      sequential: true,
      target: { side: 'opponent', min: 1, max: 2 },
      minRemainingHp: 2,
    }],
    effectText: 'Discard 2 cards, then each opponent Cookie receives 1 damage.',
  }
  const prompt = getOptionalCostAttackPrompt(state, 'player-two')!
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const onPay = vi.fn()
  const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')]
    .find(entry => entry.textContent?.trim() === text)!

  try {
    await act(() => root.render(<OptionalCostAttackModal {...prompt} onSkip={() => undefined} onPay={onPay} />))
    await act(() => button('支付').click())
    const discards = host.querySelectorAll<HTMLButtonElement>('.optional-cost-col .modal-card-options > button')
    expect(discards).toHaveLength(2)
    await act(() => { discards[0].click(); discards[1].click() })
    await act(() => button('下一步').click())

    const targets = host.querySelectorAll<HTMLButtonElement>('.optional-cost-col .modal-card-options > button')
    expect(targets).toHaveLength(2)
    const confirm = button('確認')
    expect(confirm.disabled).toBe(true)
    await act(() => targets[0].click())
    expect(confirm.disabled).toBe(true)
    await act(() => targets[1].click())
    expect(confirm.disabled).toBe(false)
    await act(() => confirm.click())
    expect(onPay).toHaveBeenCalledWith(
      ['discard-one', 'discard-two'],
      ['sequential-first', 'sequential-second'],
      [], [], [], [], [],
    )
  } finally {
    await act(() => root.unmount())
    host.remove()
  }
})
