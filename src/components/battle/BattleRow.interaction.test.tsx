/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBattleState } from '../../game/test-helpers/battle-helpers'
import { BattleRow, type BattleRowProps } from './BattleRow'

const containers: HTMLDivElement[] = []

afterEach(() => {
  for (const container of containers.splice(0)) container.remove()
})

describe('BattleRow battle cookie interactions', () => {
  it('lets the active player choose an opponent target without highlighting that target as the attacker', async () => {
    const game = createBattleState()
    const onAttackTarget = vi.fn()
    const container = document.createElement('div')
    containers.push(container)
    document.body.append(container)
    const root = createRoot(container)

    const props: BattleRowProps = {
      game,
      playerId: 'player-one',
      position: 'top',
      selectedAttackerId: null,
      attackTargetingActive: true,
      effectTargetIds: new Set(),
      breakEffectTargetIds: new Set(),
      selectedEffectTargetIds: new Set(),
      selectedSkillPaymentIds: new Set(),
      selectedAttackPaymentIds: new Set(),
      attackPaymentValid: true,
      interactionLocked: false,
      onAttackTarget,
      onInspectCard: vi.fn(),
      onInspectDiscard: vi.fn(),
    }

    await act(() => root.render(<BattleRow {...props} />))
    const targetButton = container.querySelector<HTMLButtonElement>(
      '.combat-card-wrap button',
    )
    expect(targetButton).not.toBeNull()
    expect(container.querySelector('.target-hint')?.textContent).toContain(
      '攻擊目標',
    )

    await act(() => targetButton!.click())

    expect(onAttackTarget).toHaveBeenCalledWith('defender')
    await act(() => root.unmount())
  })

  it('keeps attack selection active when the optional trash-cost handler exists', async () => {
    const game = createBattleState()
    const onSelectAttacker = vi.fn()
    const onSkillTrashBattleCookie = vi.fn()
    const container = document.createElement('div')
    containers.push(container)
    document.body.append(container)
    const root = createRoot(container)

    const props: BattleRowProps = {
      game,
      playerId: 'player-two',
      position: 'bottom',
      selectedAttackerId: null,
      effectTargetIds: new Set(),
      breakEffectTargetIds: new Set(),
      selectedEffectTargetIds: new Set(),
      selectedSkillPaymentIds: new Set(),
      selectedSkillTrashBattleCookieIds: new Set(),
      selectedAttackPaymentIds: new Set(),
      attackPaymentValid: false,
      interactionLocked: false,
      onSelectAttacker,
      onSkillTrashBattleCookie,
      onInspectCard: vi.fn(),
      onInspectDiscard: vi.fn(),
    }

    await act(() => root.render(<BattleRow {...props} />))
    const cardButton = container.querySelector<HTMLButtonElement>(
      '.combat-card-wrap button',
    )
    expect(cardButton).not.toBeNull()

    await act(() => cardButton!.click())

    expect(onSelectAttacker).toHaveBeenCalledWith('attacker')
    expect(onSkillTrashBattleCookie).not.toHaveBeenCalled()
    await act(() => root.unmount())
  })
})
