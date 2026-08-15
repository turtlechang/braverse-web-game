import type { OfficialCardRecord } from './types'

/**
 * BS6「Operation Timeguard」的官方英文 API 卡面攻擊傷害大量誤記：與韓文
 * 官方資料及實體卡面不一致。以下逐卡與韓文官方資料核對（BS6-074／079
 * 另經使用者實體卡確認）；key 為基礎卡號，`wrong` 是英文 API 的誤值，
 * `right` 是卡面正確傷害。套用時只把 `{da} wrong` 換成 `{da} right`，
 * 不會動到攻擊費用或其他欄位。
 */
const BS6_DAMAGE_ERRATA: Record<string, { wrong: number; right: number }> = {
  'BS6-001': { wrong: 3, right: 1 },
  'BS6-003': { wrong: 2, right: 3 },
  'BS6-004': { wrong: 1, right: 2 },
  'BS6-005': { wrong: 3, right: 1 },
  'BS6-008': { wrong: 1, right: 3 },
  'BS6-009': { wrong: 3, right: 1 },
  'BS6-010': { wrong: 2, right: 3 },
  'BS6-011': { wrong: 1, right: 2 },
  'BS6-014': { wrong: 2, right: 1 },
  'BS6-016': { wrong: 1, right: 2 },
  'BS6-023': { wrong: 2, right: 1 },
  'BS6-025': { wrong: 1, right: 2 },
  'BS6-026': { wrong: 3, right: 1 },
  'BS6-027': { wrong: 2, right: 3 },
  'BS6-029': { wrong: 3, right: 2 },
  'BS6-032': { wrong: 2, right: 3 },
  'BS6-034': { wrong: 3, right: 2 },
  'BS6-036': { wrong: 2, right: 3 },
  'BS6-037': { wrong: 1, right: 2 },
  'BS6-038': { wrong: 3, right: 1 },
  'BS6-045': { wrong: 2, right: 1 },
  'BS6-046': { wrong: 1, right: 2 },
  'BS6-047': { wrong: 2, right: 1 },
  'BS6-048': { wrong: 1, right: 2 },
  'BS6-049': { wrong: 2, right: 1 },
  'BS6-050': { wrong: 3, right: 2 },
  'BS6-051': { wrong: 2, right: 3 },
  'BS6-052': { wrong: 1, right: 2 },
  'BS6-053': { wrong: 3, right: 1 },
  'BS6-054': { wrong: 2, right: 3 },
  'BS6-055': { wrong: 1, right: 2 },
  'BS6-059': { wrong: 3, right: 1 },
  'BS6-060': { wrong: 2, right: 3 },
  'BS6-068': { wrong: 3, right: 2 },
  'BS6-070': { wrong: 1, right: 3 },
  'BS6-071': { wrong: 2, right: 1 },
  'BS6-072': { wrong: 3, right: 2 },
  'BS6-074': { wrong: 1, right: 3 },
  'BS6-075': { wrong: 2, right: 1 },
  'BS6-078': { wrong: 3, right: 2 },
  'BS6-079': { wrong: 1, right: 3 },
  'BS6-082': { wrong: 2, right: 1 },
  'BS6-087': { wrong: 2, right: 3 },
  'BS6-088': { wrong: 3, right: 2 },
  'BS6-089': { wrong: 2, right: 3 },
  'BS6-092': { wrong: 3, right: 2 },
  'BS6-094': { wrong: 2, right: 3 },
  'BS6-097': { wrong: 1, right: 2 },
  'BS6-099': { wrong: 4, right: 1 },
  'BS6-100': { wrong: 2, right: 4 },
  'BS6-101': { wrong: 1, right: 2 },
  'BS6-103': { wrong: 2, right: 1 },
}

/**
 * BS4 異圖變體的傷害誤記（英文 API 1 → 實體卡面／韓文資料 3）。
 * 基礎版本（BS4-045／BS4-097）本身是正確的 {da} 3，只因 `wrong` 不同，
 * 正規化的 pattern 檢驗不會動到它們。
 */
const BS4_VARIANT_DAMAGE_ERRATA: Record<
  string,
  { wrong: number; right: number }
> = {
  'BS4-045': { wrong: 1, right: 3 },
  'BS4-097': { wrong: 1, right: 3 },
}

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

  const damageErrata =
    BS6_DAMAGE_ERRATA[sourceCard.baseCardNumber] ??
    BS4_VARIANT_DAMAGE_ERRATA[sourceCard.baseCardNumber]
  if (damageErrata && sourceCard.attackText) {
    const wrongDamagePattern = new RegExp(
      `(\\{da\\}\\s*)${damageErrata.wrong}\\b`,
      'i',
    )
    if (wrongDamagePattern.test(sourceCard.attackText)) {
      return {
        ...sourceCard,
        attackText: sourceCard.attackText.replace(
          wrongDamagePattern,
          (_match, prefix: string) => `${prefix}${damageErrata.right}`,
        ),
      }
    }
  }

  return sourceCard
}
