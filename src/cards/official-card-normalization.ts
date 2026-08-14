import type { OfficialCardRecord } from './types'

/**
 * 修正已知的官方 API 欄位錯置，但不修改原始匯入 JSON。
 *
 * P-059 是普通 Cookie；官方英文 API 把攻擊名稱的前半段重複寫進
 * flipText。若直接採用會讓牌組驗證與戰鬥流程誤把它視為 FLIP。
 */
export const normalizeKnownOfficialCardRecord = (
  sourceCard: OfficialCardRecord,
): OfficialCardRecord => {
  if (
    sourceCard.baseCardNumber === 'P-059' &&
    sourceCard.type === 'cookie' &&
    sourceCard.flipText === '<{G}{G}> Floating Flower'
  ) {
    return { ...sourceCard, flipText: null }
  }

  // BS6-074 的官方 API 資料把卡面攻擊傷害誤記為 1；實體卡面為 3。
  // 保留三個藍色能量的攻擊費用，只修正 {da} 後的傷害數值。
  if (
    sourceCard.baseCardNumber === 'BS6-074' &&
    sourceCard.type === 'cookie' &&
    /Don't get in my way\s+\{da\}\s*1\b/i.test(sourceCard.attackText ?? '')
  ) {
    return {
      ...sourceCard,
      attackText: sourceCard.attackText!.replace(
        /(Don't get in my way\s+\{da\}\s*)1\b/i,
        (_match, prefix: string) => `${prefix}3`,
      ),
    }
  }

  return sourceCard
}
