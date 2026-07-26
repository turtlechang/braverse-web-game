import type {
  CookieCard,
  EnergyColor,
  EnergyCost,
  SupportCard,
} from './types'

const ENERGY_COLORS: EnergyColor[] = [
  'red',
  'yellow',
  'green',
  'blue',
  'purple',
  'black',
  'pure',
]

export interface EnergyPaymentValidation {
  valid: boolean
  reason: string
}

export const getEnergyCostTotal = (cost: EnergyCost): number =>
  Object.values(cost).reduce(
    (total, amount) => total + (amount ?? 0),
    0,
  )

/**
 * 將來源卡已提供的指定能量扣除，回傳仍須由支援區支付的費用。
 * 來源能量會優先支付同色指定費用，剩餘部分才可支付 Mix Cost。
 */
export const getRemainingEnergyCost = (
  cost: EnergyCost,
  sourceEnergy: EnergyCost | undefined,
): EnergyCost => {
  if (!sourceEnergy || getEnergyCostTotal(sourceEnergy) === 0) {
    return { ...cost }
  }

  const remaining: EnergyCost = {}
  let unusedSourceEnergy = getEnergyCostTotal(sourceEnergy)

  for (const color of ENERGY_COLORS) {
    const required = cost[color] ?? 0
    const contributed = Math.min(required, sourceEnergy[color] ?? 0)
    const unmet = required - contributed
    unusedSourceEnergy -= contributed
    if (unmet > 0) remaining[color] = unmet
  }

  const remainingNeutral = Math.max(
    0,
    (cost.neutral ?? 0) - unusedSourceEnergy,
  )
  if (remainingNeutral > 0) remaining.neutral = remainingNeutral

  return remaining
}

export const getAttackEnergyCost = (card: CookieCard): EnergyCost =>
  card.attackEnergyCost ?? { neutral: card.attackCost }

/**
 * 判斷支援卡是否值得在目前費用中列為可選候選。
 *
 * 中性費用可以由任何未橫置的支援卡支付；若同時包含指定顏色與中性
 * 費用，其他顏色的卡仍可能支付中性部分，最後的完整合法性仍由
 * `validateEnergyPayment` 確認。
 */
export const isEnergyColorCompatibleWithCost = (
  cost: EnergyCost,
  energyColor: SupportCard['card']['energyColor'],
): boolean => {
  if ((cost.neutral ?? 0) > 0) return true
  if (!energyColor) return false
  if (energyColor === 'wild') return true

  return ENERGY_COLORS.some((color) =>
    color === energyColor && (cost[color] ?? 0) > 0,
  )
}

export const validateEnergyPayment = (
  cost: EnergyCost,
  supports: SupportCard[],
  paymentIds: string[],
): EnergyPaymentValidation => {
  const uniqueIds = [...new Set(paymentIds)]
  const totalCost = getEnergyCostTotal(cost)

  if (uniqueIds.length !== paymentIds.length) {
    return { valid: false, reason: '不能重複選擇同一張支援卡。' }
  }

  if (uniqueIds.length !== totalCost) {
    return {
      valid: false,
      reason: `需要選擇 ${totalCost} 張支援卡，目前已選 ${uniqueIds.length} 張。`,
    }
  }

  const selected = uniqueIds.map((instanceId) =>
    supports.find(
      (support) =>
        support.card.instanceId === instanceId && !support.rested,
    ),
  )

  if (selected.some((support) => !support)) {
    return {
      valid: false,
      reason: '只能使用自己的活躍支援卡支付費用。',
    }
  }

  const selectedSupports = selected as SupportCard[]
  let wildCount = selectedSupports.filter(
    (support) => support.card.energyColor === 'wild',
  ).length

  for (const color of ENERGY_COLORS) {
    const required = cost[color] ?? 0
    const matching = selectedSupports.filter(
      (support) => support.card.energyColor === color,
    ).length
    wildCount -= Math.max(0, required - matching)

    if (wildCount < 0) {
      return {
        valid: false,
        reason: '所選支援卡的能量顏色不符合費用需求。',
      }
    }
  }

  return { valid: true, reason: '能量組合合法，可以選擇攻擊目標。' }
}

export const selectEnergyPayment = (
  cost: EnergyCost,
  supports: SupportCard[],
): string[] | null => {
  const available = supports.filter((support) => !support.rested)
  const selected = new Set<string>()

  for (const color of ENERGY_COLORS) {
    let remaining = cost[color] ?? 0

    for (const support of available) {
      if (
        remaining > 0 &&
        !selected.has(support.card.instanceId) &&
        support.card.energyColor === color
      ) {
        selected.add(support.card.instanceId)
        remaining -= 1
      }
    }

    for (const support of available) {
      if (
        remaining > 0 &&
        !selected.has(support.card.instanceId) &&
        support.card.energyColor === 'wild'
      ) {
        selected.add(support.card.instanceId)
        remaining -= 1
      }
    }

    if (remaining > 0) {
      return null
    }
  }

  for (const support of available) {
    if (selected.size >= getEnergyCostTotal(cost)) break
    if (!selected.has(support.card.instanceId)) {
      selected.add(support.card.instanceId)
    }
  }

  const paymentIds = [...selected]
  return validateEnergyPayment(cost, supports, paymentIds).valid
    ? paymentIds
    : null
}
