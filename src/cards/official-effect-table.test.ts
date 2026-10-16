import { describe, expect, it } from 'vitest'
import st8005 from '../../data/cards/official-st8-005.en.json'
import bs12 from '../../data/cards/official-festival-arena-bs12.en.json'
import { convertOfficialCardEffects } from './official-effect-adapter'
import type { OfficialCardRecord } from './types'

const original = (number: string): OfficialCardRecord => {
  const record = [...st8005.cards, ...bs12.cards].find(card => card.cardNumber === number)
  if (!record) throw Error(`Original ${number} required`)
  return record as OfficialCardRecord
}

describe('exact effect table conversion isolation', () => {
  it('returns independent nested effects across repeated conversions', () => {
    const source = original('ST8-005')
    const first = convertOfficialCardEffects(source)
    const second = convertOfficialCardEffects(source)
    expect(first).toEqual(second)
    if (first.status !== 'supported' || second.status !== 'supported') throw Error('Supported effects required')
    const expected = structuredClone(second.effects)
    first.effects.splice(0)
    expect(second.effects).toEqual(expected)
    expect(convertOfficialCardEffects(source)).toEqual(second)
  })

  it('keeps dynamic optional-cost text tied to the current record', () => {
    const source = original('BS12-106')
    for (const text of [source.skill.text, `${source.skill.text}\n[conversion isolation probe]`, source.skill.text]) {
      const result = convertOfficialCardEffects({ ...source, skill: { ...source.skill, text } })
      if (result.status !== 'supported') throw Error('Supported effects required')
      expect(result.effects).toContainEqual(expect.objectContaining({ kind: 'optional-cost-attack', effectText: text }))
    }
  })

  it.each(['BS12-095', 'BS12-096', 'BS12-098', 'BS12-100'])('keeps %s Cookie versus FLIP behavior independent of call order', number => {
    const source = original(number)
    const cookie = { ...source, type: 'cookie' as const }
    const flip = { ...source, type: 'flip' as const }
    const first = convertOfficialCardEffects(cookie)
    const second = convertOfficialCardEffects(flip)
    expect(first).toMatchObject({ status: 'supported', effects: [] })
    expect(second).toMatchObject({ status: 'supported', effects: [expect.any(Object)] })
    expect(convertOfficialCardEffects(cookie)).toEqual(first)
    expect(convertOfficialCardEffects(flip)).toEqual(second)
  })
})
