/// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { installBs12DeckPresets } from './bs12-deck-presets'
import {
  deleteCustomDeck, getCustomDeckStorageKey, loadCustomDecks,
  saveCustomDecks, validateCustomDeckDefinition, type CustomDeck,
} from './custom-deck'
import { createDeckForChoice, createExtraDeckForChoice } from './starter-deck'
import { BS12_DECK_PRESETS } from './bs12-deck-recipes'

const expectedMain = [
  ['BS12-057', 4], ['BS12-058', 4], ['BS12-060', 4], ['BS12-063', 4],
  ['BS12-065', 4], ['BS12-066', 4], ['BS12-069', 2], ['BS12-070', 2],
  ['BS12-072', 4], ['BS12-073', 2], ['BS6-085', 4], ['BS7-067', 4],
  ['BS7-070', 4], ['BS7-072', 4], ['BS7-076', 2], ['BS7-078', 4],
  ['BS7-079', 2], ['ST9-016', 2],
]
const expectedExtra = [['BS10-098', 2], ['BS12-074', 2], ['BS8-090', 2]]
const counts = (cards: { id: string }[]) => Object.entries(cards.reduce<Record<string, number>>(
  (result, card) => ({ ...result, [card.id]: (result[card.id] ?? 0) + 1 }), {},
))
const oldDeck: CustomDeck = {
  id: 'existing', name: '既有牌組', entries: [{ cardNumber: 'ST1-001', count: 4 }],
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
}

describe('BS12 AI 預設牌組', () => {
  beforeEach(() => localStorage.clear())

  it('BS12 預設牌組皆為60張主牌，Arena紅色Extra4張、黑色5張，其餘6張', () => {
    const decks = installBs12DeckPresets()
    expect(decks.map((deck) => deck.id)).toEqual(Object.keys(BS12_DECK_PRESETS).map((choice) => `preset-${choice}`))
    for (const [choice, recipe] of Object.entries(BS12_DECK_PRESETS)) {
      const deck = decks.find((entry) => entry.id === `preset-${choice}`)!
      expect(validateCustomDeckDefinition(deck).errors).toEqual([])
      const main = createDeckForChoice(choice as keyof typeof BS12_DECK_PRESETS, 'player-two')
      const extra = createExtraDeckForChoice(choice as keyof typeof BS12_DECK_PRESETS, 'player-two')
      expect(main).toHaveLength(60)
      expect(extra).toHaveLength(choice === 'bs12-red-arena' ? 4 : choice === 'bs12-black-arena' ? 5 : 6)
      expect(counts(main)).toEqual(recipe.entries.map(({cardNumber,count}) => [cardNumber,count]))
      expect(counts(extra)).toEqual(recipe.extraDeckEntries.map(({cardNumber,count}) => [cardNumber,count]))
      expect(new Set([...main,...extra].map((card) => card.instanceId)).size).toBe(main.length + extra.length)
    }
  })

  it('完整載入指定 60 張主牌與 6 張 Extra，且符合標準賽制', () => {
    const [deck] = installBs12DeckPresets()
    expect(deck.entries.map(({ cardNumber, count }) => [cardNumber, count])).toEqual(expectedMain)
    expect(deck.extraDeckEntries?.map(({ cardNumber, count }) => [cardNumber, count])).toEqual(expectedExtra)
    expect(validateCustomDeckDefinition(deck).errors).toEqual([])
    const main = createDeckForChoice('bs12-blue-arena', 'player-two')
    const extra = createExtraDeckForChoice('bs12-blue-arena', 'player-two')
    expect(counts(main)).toEqual(expectedMain)
    expect(counts(extra)).toEqual(expectedExtra)
    expect(new Set([...main, ...extra].map((card) => card.instanceId)).size).toBe(66)
  })

  it('保留既有資料，BS12 優先；重复載入、編輯及刪除不重建預設牌組', () => {
    saveCustomDecks([oldDeck])
    const persisted = loadCustomDecks()[0]
    const decks = installBs12DeckPresets()
    expect(decks).toHaveLength(8)
    expect(decks.find((deck) => deck.id === persisted.id)).toEqual(persisted)
    expect(installBs12DeckPresets()).toEqual(decks)
    saveCustomDecks([oldDeck, { ...decks[0], name: '我的調整' }])
    expect(loadCustomDecks()[0].name).toBe('我的調整')
    expect(installBs12DeckPresets()[0].name).toBe('我的調整')
    deleteCustomDeck(decks[0].id)
    expect(installBs12DeckPresets()).toEqual([persisted])
  })

  it('黑色牌組逐張符合使用者清單，Extra保持五張', () => {
    expect(counts(createDeckForChoice('bs12-black-arena', 'player-two'))).toEqual([
      ['BS11-095', 2], ['BS11-096', 4], ['BS11-103', 4], ['BS11-106', 4],
      ['BS11-107', 2], ['BS11-108', 3], ['BS11-110', 4], ['BS11-113', 4],
      ['BS11-115', 3], ['BS12-096', 4], ['BS12-098', 4], ['BS12-099', 4],
      ['BS12-100', 2], ['BS12-105', 3], ['BS12-107', 3], ['BS12-108', 3],
      ['BS12-109', 3], ['BS12-112', 4],
    ])
    expect(counts(createExtraDeckForChoice('bs12-black-arena', 'player-two'))).toEqual([
      ['BS11-091', 1], ['BS11-116', 1], ['BS12-111', 3],
    ])
  })

  it('PVP KR 圖片牌表逐張一致，60張主牌與6張Extra均來自正式卡池', () => {
    const expectedKoreanMain = [
      ['BS8-009', 1], ['BS3-017', 4], ['ST6-002', 4], ['BS11-016', 4], ['BS6-010', 1],
      ['BS8-014', 4], ['BS8-012', 3], ['BS8-002', 4], ['BS4-004', 1], ['BS3-006', 4],
      ['BS1-002', 2], ['P-157', 4], ['P-151', 4], ['BS1-018', 2], ['ST1-004', 4],
      ['BS3-019', 3], ['BS2-006', 3], ['BS1-023', 2], ['BS2-007', 1], ['ST1-020', 4],
      ['ST6-020', 1],
    ]
    const expectedKoreanExtra = [['BS11-091', 1], ['BS10-024', 1], ['BS8-005', 1], ['BS9-010', 3]]
    const recipe = BS12_DECK_PRESETS['bs12-red-korean-starter']
    expect(recipe.entries.map(({ cardNumber, count }) => [cardNumber, count])).toEqual(expectedKoreanMain)
    expect(recipe.extraDeckEntries.map(({ cardNumber, count }) => [cardNumber, count])).toEqual(expectedKoreanExtra)
    const deck = installBs12DeckPresets().find(({ id }) => id === 'preset-bs12-red-korean-starter')!
    expect(validateCustomDeckDefinition(deck).errors).toEqual([])
    expect(counts(createDeckForChoice('bs12-red-korean-starter', 'player-two'))).toEqual(expectedKoreanMain)
    expect(counts(createExtraDeckForChoice('bs12-red-korean-starter', 'player-two'))).toEqual(expectedKoreanExtra)
  })

  it('已安裝五色的玩家只新增黑色，不復原已刪除或修改的牌組', () => {
    for (const choice of Object.keys(BS12_DECK_PRESETS)) {
      if (choice !== 'bs12-black-arena') {
        localStorage.setItem(`braverse-${choice.replace('-arena', '')}-preset-installed`, '1')
      }
    }
    saveCustomDecks([oldDeck])
    const persisted = loadCustomDecks()[0]
    const decks = installBs12DeckPresets()
    expect(decks.map(deck => deck.id)).toEqual(['preset-bs12-black-arena', 'existing'])
    expect(decks[1]).toEqual(persisted)
    expect(installBs12DeckPresets()).toEqual(decks)
  })

  it.each(['{broken', '{"version":999,"decks":[]}', '[{"id":"incomplete"}]'])(
    '不覆寫無法讀取的既有資料 %s', (raw) => {
      localStorage.setItem(getCustomDeckStorageKey(), raw)
      expect(installBs12DeckPresets()).toEqual([])
      expect(localStorage.getItem(getCustomDeckStorageKey())).toBe(raw)
    },
  )
})
