import type { PlayerActionCommand } from '../../commands'
import type { PlayerView } from '../../player-view'
import { getEnergyCostTotal, selectEnergyPayment } from '../../energy'
import type { EnergyCost } from '../../types'

export interface ResourceReservation {
  legalAttackCount: number
  minimumAttackPayment: number | null
  activeSupportBefore: number
}

export interface ResourceReservationAssessment {
  amount: number
  reserved: boolean
  detail: string
}

export interface ComboResourceReservation {
  planId: string
  energyCost: Readonly<EnergyCost>
}

const activeSupportCount = (view: PlayerView): number =>
  view.self.supportArea.filter((support) => !support.rested).length

/**
 * 從規則層已列出的 attack command 讀取付款張數。這不是自行猜測費用；
 * command 不存在時就不預留資源。
 */
export const deriveResourceReservation = (
  view: PlayerView,
  commands: readonly PlayerActionCommand[],
): ResourceReservation => {
  const attacks = commands.filter(
    (command): command is Extract<PlayerActionCommand, { kind: 'attack' }> =>
      command.kind === 'attack',
  )
  return {
    legalAttackCount: attacks.length,
    minimumAttackPayment: attacks.length > 0
      ? Math.min(...attacks.map((attack) => attack.supportPaymentIds.length))
      : null,
    activeSupportBefore: activeSupportCount(view),
  }
}

/**
 * R16 的單步資源檢查：進行 setup 時不應把已可支付的最便宜攻擊費用耗盡。
 * 只看公開 active support 與規則層 command 的付款 ids，不推測未公開卡。
 */
export const assessResourceReservation = (
  reservation: ResourceReservation,
  afterView: PlayerView,
  actionKind: string,
  combo?: ComboResourceReservation,
): ResourceReservationAssessment => {
  const required = reservation.minimumAttackPayment
  const comboRequired = combo ? getEnergyCostTotal(combo.energyCost) : 0
  const comboPayable = !combo || comboRequired === 0 || selectEnergyPayment(
    combo.energyCost,
    afterView.self.supportArea,
  ) !== null
  if ((required === null || actionKind === 'attack') && comboPayable) {
    return {
      amount: 0,
      reserved: true,
      detail: combo
        ? `行動後仍可支付 Combo ${combo.planId} 的 payoff。`
        : '目前沒有需為後續攻擊保留的付款。',
    }
  }

  const remaining = activeSupportCount(afterView)
  const attackMissing = required === null || actionKind === 'attack'
    ? 0
    : Math.max(0, required - remaining)
  const comboMissing = comboPayable ? 0 : Math.max(1, comboRequired - remaining)
  if (attackMissing > 0 || comboMissing > 0) {
    return {
      amount: -(attackMissing * 18 + comboMissing * 22),
      reserved: false,
      detail: [
        attackMissing > 0
          ? '此行動會讓已可支付的攻擊失去所需 active support。'
          : null,
        comboMissing > 0
          ? `此行動沒有保留 Combo ${combo?.planId ?? ''} payoff 所需的能量或顏色。`
          : null,
      ].filter(Boolean).join(' '),
    }
  }

  return {
    amount: 0,
    reserved: true,
    detail: combo
      ? `行動後仍保留合法攻擊與 Combo ${combo.planId} payoff 的付款資源。`
      : '行動後仍保留至少一個合法攻擊的最小付款資源。',
  }
}
