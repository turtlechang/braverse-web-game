/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cookie, createBattleState, item } from '../../game/test-helpers/battle-helpers'
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

  it('does not send an invalid-color support card to attack payment', async () => {
    const game = createBattleState()
    game.players['player-two'].battleArea[0].card.attackEnergyCost = {
      green: 2,
    }
    game.players['player-two'].supportArea = [
      { card: item('red-support', 'red'), rested: false },
      { card: item('green-support-a', 'green'), rested: false },
      { card: item('green-support-b', 'green'), rested: false },
    ]
    const onAttackPayment = vi.fn()
    const onInspectCard = vi.fn()
    const container = document.createElement('div')
    containers.push(container)
    document.body.append(container)
    const root = createRoot(container)

    const props: BattleRowProps = {
      game,
      playerId: 'player-two',
      position: 'bottom',
      selectedAttackerId: 'attacker',
      effectTargetIds: new Set(),
      breakEffectTargetIds: new Set(),
      selectedEffectTargetIds: new Set(),
      selectedSkillPaymentIds: new Set(),
      selectedAttackPaymentIds: new Set(),
      attackPaymentTargetIds: new Set(['green-support-a', 'green-support-b']),
      attackPaymentValid: false,
      interactionLocked: false,
      onAttackPayment,
      onInspectCard,
      onInspectDiscard: vi.fn(),
    }

    await act(() => root.render(<BattleRow {...props} />))
    const redSupportButton = container.querySelector<HTMLButtonElement>(
      '[data-card-instance-id="red-support"] button',
    )
    const greenSupportButton = container.querySelector<HTMLButtonElement>(
      '[data-card-instance-id="green-support-a"] button',
    )
    expect(redSupportButton).not.toBeNull()
    expect(greenSupportButton).not.toBeNull()

    await act(() => redSupportButton!.click())
    expect(onAttackPayment).not.toHaveBeenCalled()
    expect(onInspectCard).toHaveBeenCalledWith(
      game.players['player-two'].supportArea[0].card,
    )

    await act(() => greenSupportButton!.click())
    expect(onAttackPayment).toHaveBeenCalledWith('green-support-a')
    await act(() => root.unmount())
  })

  it('reports hover/focus previews for hand, support, and break-area cards, not just the battle area', async () => {
    const game = createBattleState()
    game.players['player-one'].breakArea = [cookie('p1-break-a')]
    const onHoverCard = vi.fn()
    const onFocusCard = vi.fn()
    const container = document.createElement('div')
    containers.push(container)
    document.body.append(container)
    const root = createRoot(container)

    const props: BattleRowProps = {
      game,
      playerId: 'player-one',
      position: 'bottom',
      selectedAttackerId: null,
      effectTargetIds: new Set(),
      breakEffectTargetIds: new Set(),
      selectedEffectTargetIds: new Set(),
      selectedSkillPaymentIds: new Set(),
      selectedAttackPaymentIds: new Set(),
      attackPaymentValid: true,
      interactionLocked: false,
      onInspectCard: vi.fn(),
      onInspectDiscard: vi.fn(),
      onHoverCard,
      onFocusCard,
    }

    await act(() => root.render(<BattleRow {...props} />))

    const handCardWrap = container.querySelector<HTMLDivElement>(
      '.hand-card-wrap',
    )
    const supportCardWrap = container.querySelector<HTMLDivElement>(
      '[data-card-instance-id="p1-support-a"]',
    )
    const breakCardWrap = container.querySelector<HTMLDivElement>(
      '.break-card-wrap',
    )
    expect(handCardWrap).not.toBeNull()
    expect(supportCardWrap).not.toBeNull()
    expect(breakCardWrap).not.toBeNull()

    const dispatchMouseEnter = (el: Element) =>
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))

    await act(() => dispatchMouseEnter(handCardWrap!))
    expect(onHoverCard).toHaveBeenCalledWith(
      game.players['player-one'].hand[0],
    )

    await act(() => dispatchMouseEnter(supportCardWrap!))
    expect(onHoverCard).toHaveBeenCalledWith(
      game.players['player-one'].supportArea[0].card,
    )

    await act(() => dispatchMouseEnter(breakCardWrap!))
    expect(onHoverCard).toHaveBeenCalledWith(
      game.players['player-one'].breakArea[0],
    )

    await act(() => root.unmount())
  })
})
