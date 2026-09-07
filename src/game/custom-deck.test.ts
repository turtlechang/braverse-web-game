import { describe, expect, it } from 'vitest'
import { getAllCardPoolEntries, hasFlipAbility } from './card-pool'
import {
  OFFICIAL_RED_STARTER_DECK,
} from './starter-deck'
import {
  MAX_FLIP_CARDS,
  createDeckFromCustomDeck,
  exportDeck,
  importDeck,
  validateCustomDeck,
  type CustomDeck,
  type CustomDeckEntry,
} from './custom-deck'

const entriesFromNumbers = (cardNumbers: string[]): CustomDeckEntry[] =>
  cardNumbers.map((cardNumber) => ({ cardNumber, count: 4 }))

describe('validateCustomDeck', () => {
  it('accepts a 60-card starter deck with at least one Cookie and no more than 16 FLIP cards', () => {
    const result = validateCustomDeck(OFFICIAL_RED_STARTER_DECK)

    expect(result.isValid).toBe(true)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.stats.totalCards).toBe(60)
    expect(result.stats.cookieCards).toBeGreaterThan(0)
    expect(result.stats.flipCards).toBeLessThanOrEqual(MAX_FLIP_CARDS)
  })

  it('requires exactly 60 cards', () => {
    const entries = OFFICIAL_RED_STARTER_DECK.map((entry, index) =>
      index === 0 ? { ...entry, count: entry.count - 1 } : entry,
    )
    const result = validateCustomDeck(entries)

    expect(result.isValid).toBe(false)
    expect(result.stats.totalCards).toBe(59)
    expect(result.errors).toContain('牌組必須剛好 60 張，目前為 59 張')
  })

  it.each([
    ['BS8-005', 'standard'],
    ['BS8-005@1', 'standard'],
    ['BS8-005', 'open'],
    ['BS8-005@1', 'open'],
  ] as const)('rejects %s in a 60-card %s main deck at validation, import and construction', (cardNumber, format) => {
    const entries = [
      ...OFFICIAL_RED_STARTER_DECK.map((entry, index) =>
        index === 0 ? { ...entry, count: entry.count - 1 } : entry,
      ),
      { cardNumber, count: 1 },
    ]
    const error = 'BS8-005 是 EXTRA 卡，不能放入主牌組'
    const result = validateCustomDeck(entries, { format })
    expect(result.isValid).toBe(false)
    expect(result.stats.totalCards).toBe(60)
    expect(result.errors).toEqual([error])

    expect(importDeck(JSON.stringify({ name: 'EXTRA in main', entries, format })))
      .toEqual({ deck: null, error })
    const deck: CustomDeck = {
      id: 'extra-in-main', name: 'EXTRA in main', entries, format,
      createdAt: '2026-09-07T00:00:00.000Z', updatedAt: '2026-09-07T00:00:00.000Z',
    }
    expect(() => createDeckFromCustomDeck(deck, 'player-one')).toThrow(error)
  })

  it('rejects more than four copies of the same card number', () => {
    const result = validateCustomDeck([
      { cardNumber: 'ST1-001', count: 5 },
      ...OFFICIAL_RED_STARTER_DECK.slice(1),
    ])

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('ST1-001 超過每卡最多 4 張限制')
  })

  it('rejects duplicate entries whose combined copies exceed four', () => {
    const result = validateCustomDeck([
      { cardNumber: 'ST1-001', count: 4 },
      { cardNumber: 'ST1-001', count: 4 },
      ...OFFICIAL_RED_STARTER_DECK.slice(2),
    ])

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('ST1-001 合計 8 張，超過每卡最多 4 張限制')
  })

  it('requires at least one Cookie card', () => {
    const nonCookieEntries = getAllCardPoolEntries().filter(
      (entry) => entry.type !== 'cookie' && entry.type !== 'flip',
    )
    const result = validateCustomDeck(
      entriesFromNumbers(nonCookieEntries.slice(0, 15).map((entry) => entry.cardNumber)),
    )

    expect(result.stats.totalCards).toBe(60)
    expect(result.stats.cookieCards).toBe(0)
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('牌組至少需要 1 張餅乾卡')
  })

  it('rejects decks with more than 16 FLIP cards', () => {
    const flipEntries = getAllCardPoolEntries().filter(
      (entry) => entry.type === 'flip',
    )
    const cookieEntries = getAllCardPoolEntries().filter(
      (entry) => entry.type === 'cookie' && !hasFlipAbility(entry),
    )
    const result = validateCustomDeck([
      ...entriesFromNumbers(flipEntries.slice(0, 5).map((entry) => entry.cardNumber)),
      ...entriesFromNumbers(cookieEntries.slice(0, 10).map((entry) => entry.cardNumber)),
    ])

    expect(result.stats.totalCards).toBe(60)
    expect(result.stats.flipCards).toBe(20)
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('FLIP 卡不得超過 16 張，目前為 20 張')
  })

  it('counts a normal Cookie with FLIP text toward the 16-card FLIP limit', () => {
    const result = validateCustomDeck([
      { cardNumber: 'BS5-073', count: 4 },
    ])

    expect(result.stats.flipCards).toBe(4)
    expect(result.stats.cookieCards).toBe(4)
  })

  it('treats @ variant and base as the same card and enforces a shared 4-copy limit', () => {
    const result = validateCustomDeck([
      { cardNumber: 'BS2-031@1', count: 4 },
      { cardNumber: 'BS2-031', count: 1 },
    ])

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('BS2-031 合計 5 張，超過每卡最多 4 張限制')
  })

  it('normalizes @ variant entries to their base cardNumber during validation', () => {
    const result = validateCustomDeck([
      { cardNumber: 'BS2-031@1', count: 3 },
      { cardNumber: 'BS2-031', count: 1 },
    ])

    expect(result.errors).not.toContain('BS2-031 合計 4 張，超過每卡最多 4 張限制')
    expect(result.stats.totalCards).toBe(4)
  })

  it('canonicalizes @ variant entries when building a deck', () => {
    const deck: CustomDeck = {
      id: 'test',
      name: 'variant test',
      entries: [{ cardNumber: 'BS2-031@1', count: 2 }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    const cards = createDeckFromCustomDeck(deck, 'player-one')

    expect(cards).toHaveLength(2)
    cards.forEach((card) => {
      expect(card.id).toBe('BS2-031')
    })
  })

  /**
   * 回歸測試：createCard（starter-deck.ts，createDeckFromCustomDeck 實際
   * 呼叫的卡片建構函式）原本用自己的正規表示式 /Deals?\s+(\d+)\s+damage/i
   * 從 attackText 抓攻擊力，但 SR/UR 稀有度卡常見的「{da} N」標記寫法
   * （例如 BS3-017「{da} 3」）不符合這個正規表示式，抓不到就靜默退回預設值
   * 1——即使旁邊的 attackCost/attackEnergyCost 是用 parseOfficialCardText
   * 正確解析出來的。已改成直接使用 parseOfficialCardText 算出的
   * parsedAttack.damage，跟 attackCost 用同一份解析結果。
   */
  it('parses attack damage from the {da} marker format, not only literal "Deals N damage" text', () => {
    const deck: CustomDeck = {
      id: 'test-da-marker',
      name: 'da marker test',
      entries: [{ cardNumber: 'BS3-017', count: 1 }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    const [card] = createDeckFromCustomDeck(deck, 'player-one')
    if (card.type !== 'cookie') throw new Error('BS3-017 should be a cookie card.')

    expect(card.attack).toBe(3)
    expect(card.attackCost).toBe(3)
  })

  it('imports @ variant entries and keeps base and variant as separate rows under shared 4-copy limit', () => {
    const cookieNumbers = getAllCardPoolEntries()
      .filter((entry) => entry.type === 'cookie' && !entry.cardNumber.includes('@'))
      .slice(0, 14)
      .map((entry) => entry.cardNumber)

    const json = JSON.stringify({
      name: 'variant import',
      entries: [
        { cardNumber: 'BS2-031@1', count: 3 },
        { cardNumber: 'BS2-031', count: 2 },
        ...entriesFromNumbers(cookieNumbers),
      ],
    })

    const result = importDeck(json)

    expect(result.error).not.toBeNull()
    expect(result.error).toMatch(/BS2-031 合計 5 張/)
  })

  it('counts item, trap, and stage cards by pool type', () => {
    const itemNumbers = getAllCardPoolEntries()
      .filter((entry) => entry.type === 'item' && !entry.cardNumber.includes('@'))
      .slice(0, 2)
      .map((entry) => entry.cardNumber)
    const trapNumbers = getAllCardPoolEntries()
      .filter((entry) => entry.type === 'trap' && !entry.cardNumber.includes('@'))
      .slice(0, 2)
      .map((entry) => entry.cardNumber)
    const stageNumbers = getAllCardPoolEntries()
      .filter((entry) => entry.type === 'stage' && !entry.cardNumber.includes('@'))
      .slice(0, 1)
      .map((entry) => entry.cardNumber)
    const cookieNumbers = getAllCardPoolEntries()
      .filter((entry) => entry.type === 'cookie' && !entry.cardNumber.includes('@'))
      .slice(0, 10)
      .map((entry) => entry.cardNumber)

    const entries: CustomDeckEntry[] = [
      ...entriesFromNumbers([...itemNumbers, ...trapNumbers, ...stageNumbers]),
      ...entriesFromNumbers(cookieNumbers),
    ]
    const result = validateCustomDeck(entries)

    expect(result.stats.itemCards).toBe(itemNumbers.length * 4)
    expect(result.stats.trapCards).toBe(trapNumbers.length * 4)
    expect(result.stats.stageCards).toBe(stageNumbers.length * 4)
  })

  it('exportDeck preserves base and @ variant entries as separate rows', () => {
    const deck: CustomDeck = {
      id: 'variant-export',
      name: 'variant export',
      entries: [
        { cardNumber: 'BS2-031', count: 2 },
        { cardNumber: 'BS2-031@1', count: 1 },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    const json = exportDeck(deck)
    const parsed = JSON.parse(json) as { name: string; entries: { cardNumber: string; count: number }[] }

    expect(parsed.name).toBe('variant export')
    expect(parsed.entries).toEqual([
      { cardNumber: 'BS2-031', count: 2 },
      { cardNumber: 'BS2-031@1', count: 1 },
    ])
  })

  it('importDeck keeps base and @ variant as separate rows when under the shared 4-copy limit', () => {
    const cookieNumbers = getAllCardPoolEntries()
      .filter((entry) => entry.type === 'cookie' && !entry.cardNumber.includes('@'))
      .map((entry) => entry.cardNumber)
    const fillers = cookieNumbers.filter((n) => n !== 'BS2-031').slice(0, 14)
    const entries: CustomDeckEntry[] = [
      { cardNumber: 'BS2-031@1', count: 2 },
      { cardNumber: 'BS2-031', count: 2 },
      ...entriesFromNumbers(fillers),
    ]
    const validation = validateCustomDeck(entries, { format: 'open' })
    expect(validation.stats.totalCards).toBe(60)

    const json = JSON.stringify({
      name: 'split variant',
      format: 'open',
      entries: [
        { cardNumber: 'BS2-031@1', count: 2 },
        { cardNumber: 'BS2-031', count: 2 },
        ...entriesFromNumbers(fillers),
      ],
    })

    const result = importDeck(json)

    expect(result.error).toBeNull()
    expect(result.deck?.entries).toEqual([
      { cardNumber: 'BS2-031@1', count: 2 },
      { cardNumber: 'BS2-031', count: 2 },
      ...entriesFromNumbers(fillers),
    ])
  })

  it('keeps BS6-091 variant-only runtime normalization when building a custom deck', () => {
    const deck: CustomDeck = {
      id: 'bs6-091-variant-only',
      name: 'BS6-091 variant-only',
      entries: [{ cardNumber: 'BS6-091', count: 1 }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    const [card] = createDeckFromCustomDeck(deck, 'player-one')
    if (card.type !== 'cookie') throw new Error('BS6-091 should be a Cookie')

    expect(card).toMatchObject({
      id: 'BS6-091',
      attack: 2,
      attackEnergyCost: { purple: 2 },
      skill: {
        trigger: 'on-play',
        fromTrashArea: true,
        effects: [
          {
            kind: 'break-to-trash',
            excludeCardId: 'BS6-091',
          },
        ],
      },
    })
  })

  it('uses the selected open format when importing a standard JSON deck', () => {
    const replacementIndex = OFFICIAL_RED_STARTER_DECK.findIndex(
      (entry) => entry.count === 4,
    )
    expect(replacementIndex).toBeGreaterThanOrEqual(0)
    const entries = OFFICIAL_RED_STARTER_DECK.map((entry, index) =>
      index === replacementIndex ? { cardNumber: 'BS3-013', count: 4 } : entry,
    )
    const json = JSON.stringify({
      name: 'open import',
      format: 'standard',
      entries,
    })

    expect(importDeck(json).error).toMatch(/BS3-013 最多只能放入 1 張/)

    const result = importDeck(json, { format: 'open' })

    expect(result.error).toBeNull()
    expect(result.deck?.format).toBe('open')
    expect(result.deck?.entries).toEqual(
      entries.map(({ cardNumber, count }) => ({ cardNumber, count })),
    )
  })

  it('continues to import legacy deck JSON without an EXTRA payload', () => {
    const result = importDeck(JSON.stringify({
      name: 'legacy deck',
      entries: OFFICIAL_RED_STARTER_DECK,
    }))

    expect(result.error).toBeNull()
    expect(result.deck?.name).toBe('legacy deck')
    expect(result.deck?.entries).toEqual(
      OFFICIAL_RED_STARTER_DECK.map(({ cardNumber, count }) => ({
        cardNumber,
        count,
      })),
    )
    expect(result.deck?.candidateStaging).toBeUndefined()
  })

  it('round-trips a candidate staging deck with its ordered six-card EXTRA deck', () => {
    const deck: CustomDeck = {
      id: 'candidate-export',
      name: 'BS8 candidate export',
      entries: OFFICIAL_RED_STARTER_DECK,
      format: 'standard',
      candidateStaging: {
        kind: 'bs8-candidate-staging',
        extraDeckEntries: [
          { cardNumber: 'BS8-005', count: 2 },
          { cardNumber: 'BS8-027', count: 1 },
          { cardNumber: 'BS8-005', count: 2 },
          { cardNumber: 'BS8-069', count: 1 },
        ],
      },
      createdAt: '2026-08-30T00:00:00.000Z',
      updatedAt: '2026-08-30T00:00:00.000Z',
    }

    const exported = JSON.parse(exportDeck(deck)) as {
      candidateStaging?: CustomDeck['candidateStaging']
    }
    expect(exported.candidateStaging).toEqual(deck.candidateStaging)

    const result = importDeck(exportDeck(deck), { allowCandidateStaging: true })
    expect(result.error).toBeNull()
    expect(result.deck?.entries).toEqual(
      OFFICIAL_RED_STARTER_DECK.map(({ cardNumber, count }) => ({
        cardNumber,
        count,
      })),
    )
    expect(result.deck?.candidateStaging).toEqual(deck.candidateStaging)
  })

  it('keeps candidate-only EXTRA JSON out of the Standard import path', () => {
    const json = JSON.stringify({
      name: 'candidate payload in Standard',
      entries: OFFICIAL_RED_STARTER_DECK,
      candidateStaging: {
        kind: 'bs8-candidate-staging',
        extraDeckEntries: [{ cardNumber: 'BS8-005', count: 1 }],
      },
    })

    expect(importDeck(json)).toEqual({
      deck: null,
      error: 'BS8 候選驗收 EXTRA Deck 只能在候選驗收牌組編輯器匯入。',
    })
  })

  it('rejects unsupported top-level EXTRA Deck payloads instead of dropping them in Standard', () => {
    const json = JSON.stringify({
      name: 'unsafe Standard extra',
      entries: OFFICIAL_RED_STARTER_DECK,
      extraDeck: [{ cardNumber: 'BS8-005', count: 1 }],
    })

    expect(importDeck(json)).toEqual({
      deck: null,
      error: '正式牌組 JSON 請使用 extraDeckEntries 卡號與數量，不支援 extraDeck 實體。',
    })
  })

  it('enforces the six-slot limit before importing a candidate EXTRA deck', () => {
    const json = JSON.stringify({
      name: 'too many candidate extras',
      entries: OFFICIAL_RED_STARTER_DECK,
      candidateStaging: {
        kind: 'bs8-candidate-staging',
        extraDeckEntries: [
          { cardNumber: 'BS8-005', count: 4 },
          { cardNumber: 'BS8-027', count: 3 },
        ],
      },
    })

    expect(importDeck(json, { allowCandidateStaging: true })).toMatchObject({
      deck: null,
      error: 'EXTRA Deck 最多只能放入 6 張，目前為 7 張。',
    })
  })
})

