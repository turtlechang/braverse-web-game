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
  // Both complete Peppermint prints have B/1 and the same FLIP. The P API misplaced the attack in skill.
  if (['BS12-058', 'BS12-058@1'].includes(sourceCard.cardNumber) && sourceCard.name === 'Peppermint Cookie' &&
    ['https://cookierunbraverse.com/data/en_storage/YWOZpSkubKPuMduhbpKvyQ.webp', 'https://cookierunbraverse.com/data/en_storage/pIdsbTerZCo9bbYa5ZIfhA.webp'].includes(sourceCard.imageUrl)) {
    sourceCard = { ...sourceCard, skill: { ...sourceCard.skill, text: null },
      attackText: '<{B}> Signed Merch Getup {da} 1',
      flipText: '<Reveal 1 【Arena】 card from your hand and place it on the bottom of your deck.> Draw up to 2 cards from your deck.' }
  }
  // Inspected Clover has GN/2; preserve the raw next-card API text.
  if (sourceCard.cardNumber === 'BS12-045' && sourceCard.name === 'Clover Cookie' &&
    sourceCard.imageUrl === 'https://cookierunbraverse.com/data/en_storage/Zv3em6Q9GP9YYLIcUAflLg.webp') {
    sourceCard = { ...sourceCard, attackText: '<{G}{N}> Small Melody {da} 2' }
  }
  // Inspected Herb Teapot has GG/2; the API repeats Clover's attack.
  if (sourceCard.cardNumber === 'BS12-044' && sourceCard.name === 'Herb Teapot' &&
    sourceCard.imageUrl === 'https://cookierunbraverse.com/data/en_storage/VZsrq8wVJuctrMFFyNAGFA.webp') {
    sourceCard = { ...sourceCard, attackText: '<{G}{G}> Sprinkle Water {da} 2' }
  }
  // Inspected Coffee Candy print has GGG/3; the API repeats Herb Teapot's attack.
  if (sourceCard.cardNumber === 'BS12-043' && sourceCard.name === 'Coffee Candy Cookie' &&
    sourceCard.imageUrl === 'https://cookierunbraverse.com/data/en_storage/gWjb9OIpZalYEUf_NstcwA.webp') {
    sourceCard = { ...sourceCard, attackText: '<{G}{G}{G}> Luggage Carrying {da} 3' }
  }
  // Inspected Chamomile print has G/1; the API repeats Coffee Candy's attack.
  if (sourceCard.cardNumber === 'BS12-042' && sourceCard.name === 'Chamomile Cookie' &&
    sourceCard.imageUrl === 'https://cookierunbraverse.com/data/en_storage/CXEqheEoYrpaakhAqMuHrA.webp') {
    sourceCard = { ...sourceCard, attackText: '<{G}> Chamomile Breeze {da} 1' }
  }
  // Independently inspected Basil Pesto print uses N/1 without a skill or Then.
  if (sourceCard.cardNumber === 'BS12-041' && sourceCard.name === 'Basil Pesto Cookie' &&
    sourceCard.imageUrl === 'https://cookierunbraverse.com/data/en_storage/Qod-fFChavfLfTKstCJeKQ.webp') {
    sourceCard = { ...sourceCard, attackText: '<{N}> Ultimate Culinary Treat {da} 1' }
  }
  if (sourceCard.cardNumber === 'BS12-040' && sourceCard.name === 'Baguette Cookie' &&
    sourceCard.imageUrl === 'https://cookierunbraverse.com/data/en_storage/cuQ0ULLnKmqsMBxHG5csfw.webp') {
    sourceCard = { ...sourceCard, attackText: '<{G}{G}{N}> Troubleshooting {da} 3' }
  }
  // Inspected Melon Soda print has NNN/4 and no skill or Then.
  if (sourceCard.cardNumber === 'BS12-039' && sourceCard.name === 'Melon Soda Cookie' &&
    sourceCard.imageUrl === 'https://cookierunbraverse.com/data/en_storage/4y0FnGvUF5ftjGZyTZZU6A.webp') {
    sourceCard = { ...sourceCard, attackText: '<{N}{N}{N}> Soda Splash Party {da} 4' }
  }
  // Both inspected Greenbell prints use GN/2 without an attack Then.
  if (sourceCard.cardNumber === 'BS12-038' && sourceCard.name === 'Greenbell Cookie' &&
    sourceCard.imageUrl === 'https://cookierunbraverse.com/data/en_storage/EHLaDNwURpOwNf9sKjp8lw.webp') {
    sourceCard = { ...sourceCard, attackText: '<{G}{N}> Vento Marcato {da} 2' }
  }
  // Both inspected Financier prints show YYY/3 and separately paid N/1 Then.
  if (sourceCard.cardNumber === 'BS12-037@1' && sourceCard.name === 'Financier Cookie' &&
    sourceCard.imageUrl === 'https://cookierunbraverse.com/data/en_storage/L7dt66zp3ww2nsTPOK7APw.webp') {
    sourceCard = { ...sourceCard, attackText: "<{Y}{Y}{Y}> Ending Fairy {da} 3\nThen, <{N}> select up to 1 of your opponent's Cookies. That Cookie receives 1 damage." }
  }
  // Both inspected Clotted Cream prints show this attack; its play origin remains R003.
  if (sourceCard.cardNumber === 'BS12-036@1' && sourceCard.name === 'Clotted Cream Cookie' &&
    sourceCard.imageUrl === 'https://cookierunbraverse.com/data/en_storage/xQ0t-RkTTcj3TENaQbwFpw.webp') {
    sourceCard = { ...sourceCard, attackText: '<{Y}{Y}{Y}> aka. Genius Idol {da} 3\nThen, <place 1 other 【Arena】 Cookie from your battle area into your break area.> Play up to 1 LV.1 【Arena】 Cookie with a different card number than the Cookie placed in your break area.' }
  }
  // Both inspected Kouign-Amann prints show Y/1; the omitted Then target remains unresolved.
  if (sourceCard.cardNumber === 'BS12-035@1' && sourceCard.name === 'Kouign-Amann Cookie' &&
    sourceCard.imageUrl === 'https://cookierunbraverse.com/data/en_storage/-u7p-lCY9k_PwJrAmASTQw.webp') {
    sourceCard = { ...sourceCard, attackText: '<{Y}> Shy Ending {da} 1\nThen, if there are 4 【Arena】 Cookies or more in your break area, deals 1 damage.' }
  }
  // Both independently inspected Madeleine prints have the same YY/2 attack and Then.
  if (sourceCard.cardNumber === 'BS12-034@1' && sourceCard.name === 'Madeleine Cookie' &&
    sourceCard.imageUrl === 'https://cookierunbraverse.com/data/en_storage/7If0ZpVdwbTBpbyIzPds2w.webp') {
    sourceCard = { ...sourceCard, attackText: '<{Y}{Y}> Excellent Explosion! {da} 2\nThen, <place 1 【Arena】 Cookie from your hand or battle area into your break area.> Select up to 1 LV.1 Cookie in your battle area. That Cookie gains +2 HP.' }
  }
  // Both BS12-033 prints independently show Bean Scatter YN/1 without Then.
  if (sourceCard.cardNumber === 'BS12-033@1' && sourceCard.name === 'Espresso Cookie' &&
    sourceCard.imageUrl === 'https://cookierunbraverse.com/data/en_storage/_8qtdK4FnBwqfsh5m__K2Q.webp') {
    sourceCard = { ...sourceCard, attackText: '<{Y}{N}> Bean Scatter {da} 1' }
  }
  // Both independently inspected BS12-032 prints use Full of Energy, not Espresso's attack.
  if (sourceCard.cardNumber === 'BS12-032@1' && sourceCard.name === 'Caramel Choux Cookie' &&
    sourceCard.imageUrl === 'https://cookierunbraverse.com/data/en_storage/FHr0LwXF6cp4fcvSbE1wmw.webp') {
    sourceCard = { ...sourceCard, attackText: '<{Y}{N}> Full of Energy {da} 1' }
  }
  // BS12-031's complete printed card spells Fashionista; preserve the raw API record.
  if (sourceCard.cardNumber === 'BS12-031' && sourceCard.name === 'Fashonista Spotlight' &&
    sourceCard.imageUrl === 'https://cookierunbraverse.com/data/en_storage/_OkSPOpnVZR_X8eImX73FQ.webp') {
    sourceCard = { ...sourceCard, name: 'Fashionista Spotlight' }
  }
  // BS12-021 P prints Mango Cookie; the English API mislabeled this one record.
  // https://cookierunbraverse.com/data/en_storage/Rd4Td_KAJPv3ItGRjvE97A.webp
  if (sourceCard.cardNumber === 'BS12-021@1' && sourceCard.name === 'Greenbell Cookie' &&
    sourceCard.imageUrl === 'https://cookierunbraverse.com/data/en_storage/Rd4Td_KAJPv3ItGRjvE97A.webp') {
    sourceCard = { ...sourceCard, name: 'Mango Cookie' }
  }
  // BS8-024 P 的官方實圖與 U 版均為 R 配置、RR 橫置、全體 1 傷害。
  // 英文 JSON 的 @1 誤放 BS8-025 卡文；只修正這筆已核對的錯誤文字。
  // https://cookierunbraverse.com/data/en_storage/RRMhMXvgUbkb1vWw5saNjA.webp
  if (
    sourceCard.cardNumber === 'BS8-024@1' &&
    sourceCard.type === 'stage' &&
    sourceCard.name === 'Land of Fire & Ruin' &&
    sourceCard.skill.text?.replace(/\s+/g, ' ').trim() ===
      "<{R}{R}> Place in your stage area. 【Activate】 <{R}> <Rest this card.> <Make 1 of your Cookies faint.> Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage."
  ) {
    return { ...sourceCard, skill: { ...sourceCard.skill,
      text: '<{R}> Place in your stage area.\r\n\r\n【Activate】 <{R}{R}> <Rest this card.> All Cookies receive 1 damage.',
    } }
  }
  // Missing color is common in official FLIP/alternate-art records. Recover
  // it from structured energyType, so deck construction and adapters agree.
  if (!sourceCard.color || sourceCard.color === 'null') {
    const color = sourceCard.energyType?.trim().split(/\s+/)[0].toUpperCase()
    if (color && /^(RED|YELLOW|GREEN|BLUE|PURPLE|BLACK|PURE)$/.test(color)) {
      sourceCard = { ...sourceCard, color }
    }
  }
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
