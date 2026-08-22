import { describe, expect, it } from 'vitest'
import { createPlayerView } from '../../player-view'
import type { PlayerActionCommand } from '../../commands'
import { createBattleState } from '../../test-helpers/battle-helpers'
import {
  assessResourceReservation,
  deriveResourceReservation,
} from './resource-reservation'

describe('R16 resource reservation', () => {
  it('從規則層列出的攻擊付款保留最低所需 active support', () => {
    const state = createBattleState()
    const view = createPlayerView(state, 'player-two')
    const commands: PlayerActionCommand[] = [
      {
        kind: 'attack',
        playerId: 'player-two',
        attackerInstanceId: 'attacker',
        targetInstanceId: 'defender',
        supportPaymentIds: ['p2-support'],
      },
      {
        kind: 'attack',
        playerId: 'player-two',
        attackerInstanceId: 'attacker',
        targetInstanceId: 'defender',
        supportPaymentIds: ['p2-support', 'another-support'],
      },
    ]

    expect(deriveResourceReservation(view, commands)).toMatchObject({
      legalAttackCount: 2,
      minimumAttackPayment: 1,
      activeSupportBefore: 1,
    })
  })

  it('會懲罰 setup 耗盡原本可支付攻擊的公開付款資源', () => {
    const state = createBattleState()
    const view = createPlayerView(state, 'player-two')
    const reservation = deriveResourceReservation(view, [{
      kind: 'attack',
      playerId: 'player-two',
      attackerInstanceId: 'attacker',
      targetInstanceId: 'defender',
      supportPaymentIds: ['p2-support'],
    }])
    const afterView = {
      ...view,
      self: { ...view.self, supportArea: [] },
    }

    const assessment = assessResourceReservation(
      reservation,
      afterView,
      'place-support',
    )

    expect(assessment.reserved).toBe(false)
    expect(assessment.amount).toBeLessThan(0)
  })

  it('不把攻擊本身視為違反預留，且無合法攻擊時不產生扣分', () => {
    const state = createBattleState()
    const view = createPlayerView(state, 'player-two')
    const attackReservation = deriveResourceReservation(view, [{
      kind: 'attack',
      playerId: 'player-two',
      attackerInstanceId: 'attacker',
      targetInstanceId: 'defender',
      supportPaymentIds: ['p2-support'],
    }])

    expect(assessResourceReservation(attackReservation, view, 'attack')).toMatchObject({
      reserved: true,
      amount: 0,
    })
    expect(assessResourceReservation(
      deriveResourceReservation(view, []),
      view,
      'place-support',
    )).toMatchObject({ reserved: true, amount: 0 })
  })

  it('依顏色保留同回合 Combo payoff 的能量，而不只比較張數', () => {
    const state = createBattleState()
    const view = createPlayerView(state, 'player-two')
    const reservation = deriveResourceReservation(view, [])
    const wrongColorView = {
      ...view,
      self: {
        ...view.self,
        supportArea: view.self.supportArea.map((support) => ({
          ...support,
          card: { ...support.card, energyColor: 'red' as const },
        })),
      },
    }

    const assessment = assessResourceReservation(
      reservation,
      wrongColorView,
      'activate-skill',
      { planId: 'blue-payoff', energyCost: { blue: 1 } },
    )

    expect(assessment.reserved).toBe(false)
    expect(assessment.detail).toContain('顏色')
  })
})
