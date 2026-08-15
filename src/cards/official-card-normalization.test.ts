import { describe, expect, it } from 'vitest'
import officialBs4Dataset from '../../data/cards/official-age-of-heroes-and-kingdoms-bs4.en.json'
import officialBs6Dataset from '../../data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json'
import { normalizeKnownOfficialCardRecord } from './official-card-normalization'
import type { OfficialCardRecord } from './types'

const bs4Cards = officialBs4Dataset.cards as OfficialCardRecord[]
const bs6Cards = officialBs6Dataset.cards as OfficialCardRecord[]

const attackDamage = (attackText: string | null): number | null => {
  const match = attackText?.match(/\{da\}\s*(\d+)/)
  return match ? Number(match[1]) : null
}

describe('normalizeKnownOfficialCardRecord', () => {
  it('P-059 drops the duplicate attack name from flipText', () => {
    const source = {
      baseCardNumber: 'P-059',
      cardNumber: 'P-059',
      type: 'cookie',
      flipText: '<{G}{G}> Floating Flower',
    } as OfficialCardRecord
    expect(normalizeKnownOfficialCardRecord(source).flipText).toBeNull()
  })

  it('keeps the original record untouched when no errata applies', () => {
    const source = {
      baseCardNumber: 'BS6-002',
      cardNumber: 'BS6-002',
      type: 'cookie',
      attackText: '<{R}> Safe Swing {da} 2',
    } as OfficialCardRecord
    expect(normalizeKnownOfficialCardRecord(source)).toBe(source)
  })

  it('corrects every BS6 damage-errata record to the card-face value', () => {
    const corrected: string[] = []
    for (const card of bs6Cards) {
      const normalized = normalizeKnownOfficialCardRecord(card)
      if (normalized.attackText !== card.attackText) {
        corrected.push(card.baseCardNumber)
      }
    }
    // 英文 API 誤記共 52 個基礎卡號；含異圖變體共 64 筆記錄被修正
    // （BS6-074／079 含在內）。
    expect(corrected.length).toBe(64)
  })

  it('does not overwrite an already-correct attack damage', () => {
    // BS6-079 的誤值 1 被修正為 3 後，重跑正規化不應再變動。
    const fixed = normalizeKnownOfficialCardRecord(
      bs6Cards.find((card) => card.cardNumber === 'BS6-079')!,
    )
    const again = normalizeKnownOfficialCardRecord(fixed)
    expect(again.attackText).toBe(fixed.attackText)
    expect(attackDamage(again.attackText)).toBe(3)
  })

  it('corrects BS4 alt-art variant damage while keeping the base cards untouched', () => {
    const bs4045Variant = bs4Cards.find(
      (card) => card.cardNumber === 'BS4-045@1',
    )!
    const bs4045Base = bs4Cards.find((card) => card.cardNumber === 'BS4-045')!
    const bs4097Variant = bs4Cards.find(
      (card) => card.cardNumber === 'BS4-097@1',
    )!
    const bs4097Base = bs4Cards.find((card) => card.cardNumber === 'BS4-097')!

    expect(attackDamage(bs4045Variant.attackText ?? null)).toBe(1)
    expect(
      attackDamage(normalizeKnownOfficialCardRecord(bs4045Variant).attackText),
    ).toBe(3)
    expect(attackDamage(bs4097Variant.attackText ?? null)).toBe(1)
    expect(
      attackDamage(normalizeKnownOfficialCardRecord(bs4097Variant).attackText),
    ).toBe(3)

    // 基礎版本本來就是 {da} 3，正規化不能動到它們。
    expect(attackDamage(bs4045Base.attackText ?? null)).toBe(3)
    expect(normalizeKnownOfficialCardRecord(bs4045Base).attackText).toBe(
      bs4045Base.attackText,
    )
    expect(attackDamage(bs4097Base.attackText ?? null)).toBe(3)
    expect(normalizeKnownOfficialCardRecord(bs4097Base).attackText).toBe(
      bs4097Base.attackText,
    )
  })
})
