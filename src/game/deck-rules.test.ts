import { describe, expect, it } from 'vitest'
import {
  ACTIVE_BANLIST_POLICY,
  ASIA_BANNED_CARD_NUMBERS,
  ASIA_LIMITED_CARD_NUMBERS,
  getCardRestriction,
  getDeckCopyLimit,
} from './deck-rules'

describe('ASIA 2026-02-13 banlist snapshot', () => {
  it('keeps the published source metadata and card counts', () => {
    expect(ACTIVE_BANLIST_POLICY).toMatchObject({
      id: 'braverse-asia-2026-02-13',
      region: 'ASIA',
      updatedAt: '2026-02-13',
      effectiveAt: '2026-02-13',
      sourceUrl: 'https://braversefan.com/cookierun/banlist/',
    })
    expect(ASIA_BANNED_CARD_NUMBERS).toHaveLength(5)
    expect(ASIA_LIMITED_CARD_NUMBERS).toHaveLength(11)
  })

  it('applies banned and limited copy limits in standard only', () => {
    expect(getCardRestriction('BS6-064')).toBe('banned')
    expect(getDeckCopyLimit('BS6-064')).toBe(0)
    expect(getCardRestriction('BS2-003')).toBe('limited')
    expect(getDeckCopyLimit('BS2-003')).toBe(1)
    expect(getCardRestriction('BS6-064', 'open')).toBe('none')
    expect(getDeckCopyLimit('BS6-064', 'open')).toBe(4)
  })
})
