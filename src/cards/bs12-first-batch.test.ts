import { describe, expect, it } from 'vitest'
import document from '../../data/candidates/official-festival-arena-bs12.en.json'
import { convertOfficialCardToGameCard, normalizeOfficialCardRecord } from './official-card-adapter'
import { convertOfficialFlipAbility } from './official-effect-adapter'
import type { OfficialCardRecord } from './types'

const records = document.cards as OfficialCardRecord[]
const find = (number: string) => {
  const record = records.find((card) => card.cardNumber === number)
  if (!record) throw new Error(`Missing ${number}`)
  return record
}

// Expectations transcribed from the official full card images on 2026-09-30.
describe('BS12 first printed cards', () => {
  it.each([
    ['BS12-001', 3, 4, 4, { neutral: 3 }, '<{N}{N}{N}> Defense on Vacation {da} 4'],
    ['BS12-002', 2, 2, 2, { red: 2 }, '<{R}{R}> Come with me, darling! {da} 2'],
    ['BS12-003', 1, 2, 1, { neutral: 1 }, '<{N}> Guided Strike {da} 1'],
    ['BS12-004', 1, 1, 1, { red: 1 }, '<{R}> Jump Bang! {da} 1'],
  ] as const)('%s separates the English attack from the appended translation', (number, level, hp, attack, cost, text) => {
    const source = find(number)
    const original = structuredClone(source)
    expect(normalizeOfficialCardRecord(source).attackText).toBe(text)
    expect(convertOfficialCardToGameCard(source)).toMatchObject({
      status: 'converted',
      gameCard: { id: number, level, hp, attack, attackEnergyCost: cost, attackText: text, keywords: ['arena'] },
    })
    expect(source).toEqual(original)
    expect(source.attackText).toContain('Card Name :')
  })

  it('002 preserves hand cost and the Arena-only optional target', () => {
    expect(convertOfficialFlipAbility(find('BS12-002'))).toMatchObject({
      cost: { energy: {}, discardHand: 1 },
      effects: [{ kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 1, keyword: 'arena' } }],
    })
  })

  it('004 counts exactly two red Arena Cookies rather than any two Cookies', () => {
    expect(convertOfficialFlipAbility(find('BS12-004'))).toMatchObject({
      cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'battle-area-cookie-count', side: 'self', count: 2, energyColor: 'red', keyword: 'arena' } }],
    })
  })
})
