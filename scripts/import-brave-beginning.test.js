import { describe, expect, it } from 'vitest'
import { validateSeriesNotEmpty } from './import-brave-beginning.mjs'

describe('validateSeriesNotEmpty', () => {
  const title = 'BOOSTER PACK [BRAVE BEGINNING]'

  it('throws when both series have zero cards', () => {
    expect(() => validateSeriesNotEmpty([], [], title)).toThrow(
      /沒有任何卡片/,
    )
  })

  it('throws when BS1 series has zero cards but BS2 has cards', () => {
    expect(() => validateSeriesNotEmpty([], [{ cardNumber: 'BS2-001' }], title)).toThrow(
      /BS1.*沒有任何卡片/,
    )
  })

  it('throws when BS2 series has zero cards but BS1 has cards', () => {
    expect(() =>
      validateSeriesNotEmpty([{ cardNumber: 'BS1-001' }], [], title),
    ).toThrow(/BS2.*沒有任何卡片/)
  })

  it('does not throw when both series have cards', () => {
    expect(() =>
      validateSeriesNotEmpty(
        [{ cardNumber: 'BS1-001' }],
        [{ cardNumber: 'BS2-001' }],
        title,
      ),
    ).not.toThrow()
  })
})
