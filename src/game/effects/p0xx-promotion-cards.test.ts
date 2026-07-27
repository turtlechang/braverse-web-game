import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { executeCardEffect, type CardEffect, type EffectContext, type GameState } from '..'
import { convertOfficialCardToGameCard } from '../../cards/official-card-adapter'
import type { OfficialCardRecord } from '../../cards/types'
import { isEffectConditionMet } from '../effects/targeting'
import { createBattleState, cookie, item } from '../test-helpers/battle-helpers'

/**
 * P-0XX 卡片文字直接內嵌成固定 fixture，不讀 data/candidates/ 裡那份活的
 * 候選檔——candidates/ 目錄同時被 validate-candidate-cards.test.ts 的
 * fixture 測試整批清空又只在 afterAll 才還原（見該檔案 beforeEach），
 * Vitest 預設跨檔案平行執行，這個時間差會讓同時讀取那份候選檔的測試
 * 穩定拿到 ENOENT，不是單純的 CI 偶發 flaky。改成內嵌固定文字後這個
 * 測試檔完全不依賴 data/candidates/ 目錄當下的實際內容。
 */
const makeOfficialCard = (
  overrides: Partial<OfficialCardRecord> & { cardNumber: string },
): OfficialCardRecord => ({
  sourceId: 90000,
  locale: 'en',
  baseCardNumber: overrides.cardNumber,
  variant: null,
  name: overrides.cardNumber,
  type: 'cookie',
  officialType: 'COOKIE',
  rarity: 'C',
  grade: 'COMMON',
  level: null,
  hp: null,
  energyType: 'RED',
  color: 'RED',
  skill: { name: null, text: null },
  attackText: null,
  flipText: null,
  keywords: [],
  product: { id: 900, title: 'PROMOTION CARD', category: null },
  restrictions: { banned: false, limited: false },
  flags: { enabled: true, hidden: false, extra: false },
  imageUrl: 'https://example.com/p0xx.webp',
  officialUpdatedAt: '2026-01-01T00:00:00.000Z',
  sourceUrl: 'https://example.com/cardList.json',
  ...overrides,
})

const P0XX_FIXTURES: Record<string, OfficialCardRecord> = {
  'P-001': makeOfficialCard({
    cardNumber: 'P-001', level: 1, hp: 3, energyType: 'RED', color: 'RED',
    skill: { name: null, text: '{mt} If there are 3 cards or less in your hand, this Cookie gains +1 attack damage.' },
    attackText: '《{R}{R}》 Deals 1 damage.',
  }),
  'P-002': makeOfficialCard({
    cardNumber: 'P-002', level: 1, hp: 3, energyType: 'YELLOW', color: 'YELLOW',
    skill: { name: null, text: '{mt) If there are 3 cards or less in your hand, this Cookie gains +1 attack damage.' },
    attackText: '《{Y}{Y}》 Deals 1 damage.',
  }),
  'P-003': makeOfficialCard({
    cardNumber: 'P-003', level: 1, hp: 3, energyType: 'GREEN', color: 'GREEN',
    skill: { name: null, text: '{mt) If there are 3 cards or less in your hand, this Cookie gains +1 attack damage.' },
    attackText: '《{G}{G}》 Deals 1 damage.',
  }),
  'P-013': makeOfficialCard({
    cardNumber: 'P-013', level: 1, hp: 3, energyType: 'BLUE', color: 'BLUE',
    skill: { name: null, text: '{mt) If there are 3 cards or less in your hand, this Cookie gains +1 attack damage.' },
    attackText: '《{B}{B}》 Deals 1 damage.',
  }),
  'P-014': makeOfficialCard({
    cardNumber: 'P-014', level: 1, hp: 3, energyType: 'PURPLE', color: 'PURPLE',
    skill: { name: null, text: '{mt) If there are 3 cards or less in your hand, this Cookie gains +1 attack damage.' },
    attackText: '《{P}{P}》 Deals 1 damage.',
  }),
  'P-007': makeOfficialCard({
    cardNumber: 'P-007', level: 2, hp: 1, energyType: 'RED', color: 'RED',
    skill: { name: null, text: "{ap} Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage." },
    attackText: '《{R}》 Deals 1 damage.',
  }),
  'P-008': makeOfficialCard({
    cardNumber: 'P-008', type: 'item', officialType: 'ITEM', energyType: 'RED', color: 'RED',
    attackText: "《{R}》 Select up to 1 of your opponent's Cookies whose remaining HP is 4 or more. That Cookie receives 1 damage.",
  }),
  'P-009': makeOfficialCard({
    cardNumber: 'P-009', level: 3, hp: 6, energyType: 'YELLOW', color: 'YELLOW',
    attackText: "《{Y}{Y}{Y}》 Deals 2 damage. Then, if your break area LV. is higher than your opponent's, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage.",
  }),
  'P-010': makeOfficialCard({
    cardNumber: 'P-010', level: 2, hp: 4, energyType: 'YELLOW', color: 'YELLOW',
    skill: { name: null, text: "{ap} Select up to 1 of your opponent's LV.1 Cookies. That Cookie cannot attack until the start of the next turn." },
    attackText: '《{Y}{Y}》 Deals 1 damage.',
  }),
  'P-011': makeOfficialCard({
    cardNumber: 'P-011', level: 2, hp: 2, energyType: 'GREEN', color: 'GREEN',
    skill: { name: null, text: 'If this Cookie has fainted, take 1 card from your support area to your hand. Then, place 1 card from your hand in your support area as rested.' },
    attackText: '《{G}{G}》 Deals 2 damage.',
  }),
  'P-012': makeOfficialCard({
    cardNumber: 'P-012', type: 'item', officialType: 'ITEM', energyType: 'GREEN', color: 'GREEN',
    attackText: "《{G}{G}{G}》 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. Then, place this card in your support area as rested.",
  }),
  'P-015': makeOfficialCard({
    cardNumber: 'P-015', level: 2, hp: 5, energyType: 'RED', color: 'RED',
    attackText: "《{R}{R}{R}》 Deals 3 damage. Then, 《can be used as {R}.》 Choose 1 of your opponent's Cookies. That Cookie receives 1 damage. Then, select up to 1 of your Cookies and place 2 of their HP attached cards in your trash.",
  }),
  'P-016': makeOfficialCard({
    cardNumber: 'P-016', level: 2, hp: 2, energyType: 'YELLOW', color: 'YELLOW',
    skill: { name: null, text: '{ap} 《{Y}》 Choose 1 {Y} LV.2 Cookie from your trash and place them in your break area. Then, select up to 2 {Y} LV.1 Cookies from your break area and place them in your trash.' },
    attackText: '《{Y}{Y}》 Deals 2 damage.',
  }),
  'P-018': makeOfficialCard({
    cardNumber: 'P-018', level: 3, hp: 4, energyType: 'BLUE', color: 'BLUE',
    skill: { name: null, text: '{mt} {ap} 《Discard 1 card.》 Deals 1 damage to all Cookies other than this Cookie.' },
    attackText: '《{B}{B}》 Deals 2 damage.',
  }),
  'P-019': makeOfficialCard({
    cardNumber: 'P-019', level: 2, hp: 3, energyType: 'PURPLE', color: 'PURPLE',
    attackText: "《{P}》 Deals 1 damage. Then, select up to 3 Cookies from your trash that do not have FLIP, return them to your deck, and shuffle it.",
  }),
  'P-022': makeOfficialCard({
    cardNumber: 'P-022', type: 'flip', officialType: 'FLIP', level: 3, hp: 3, energyType: 'GREEN', color: 'GREEN',
    attackText: '《{G}{G}{G}》 Deals 3 damage.',
    flipText: 'Draw up to 1 card from your deck.',
  }),
  'P-030': makeOfficialCard({
    cardNumber: 'P-030', level: 3, hp: 5, energyType: 'BLUE MIX', color: 'BLUE',
    skill: { name: '{sk} Piercing Blizzard', text: "{mt} {ap} <Discard 2 cards.> Deals 1 damage to all of your opponent's Cookies." },
    attackText: "<{B}{N}> Frost shards, away! {da} 3\nThen <discard 1 card.> Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage.",
  }),
  'P-031': makeOfficialCard({
    cardNumber: 'P-031', type: 'trap', officialType: 'TRAP', energyType: 'PURPLE', color: 'PURPLE',
    attackText: "<{P}{P}> If there are 15 cards or more in your trash, select up to 1 of your opponent's LV.3 Cookies. During this turn, that Cookie deals -1 attack damage. Then, place up to 1 of that Cookie's top HP card in the trash.",
  }),
}

describe('P-0XX promotion candidate conversion (first slice, 19 of 26 cards)', () => {
  it.each(Object.keys(P0XX_FIXTURES))(
    '%s converts without error and produces at least one effect',
    (cardNumber) => {
      const conversion = convertOfficialCardToGameCard(P0XX_FIXTURES[cardNumber])
      expect(conversion.status).toBe('converted')
      if (conversion.status !== 'converted') return
      const { gameCard } = conversion
      const hasAnyEffectPayload = Boolean(
        gameCard.effects?.length ||
          gameCard.skill ||
          gameCard.flip ||
          gameCard.item?.effects.length ||
          gameCard.trap?.effects.length ||
          (gameCard.type === 'cookie' && gameCard.attackEffects?.length),
      )
      expect(hasAnyEffectPayload).toBe(true)
    },
  )

  /**
   * 回歸測試：BS3-025 的 fromBreakArea 靠「this Cookie is in your break
   * area」這個精確前提句式判斷，不能用寬鬆的「文字裡有出現 break area」去比
   * 對——P-016「Choose 1...from your trash and place them in your break
   * area」只是效果的目的地，不是這個技能本身只能從休息區發動的前提。
   */
  it('does not mistake an effect destination mentioning "break area" for a from-break-area skill', () => {
    const p016 = convertOfficialCardToGameCard(P0XX_FIXTURES['P-016'])
    if (p016.status !== 'converted' || p016.gameCard.type !== 'cookie') {
      throw new Error('P-016 should convert to a cookie GameCard.')
    }
    expect(p016.gameCard.skill?.fromBreakArea).toBe(false)
  })

  it('still recognizes BS3-025 as a genuine from-break-area skill', () => {
    const bs3Data = JSON.parse(
      readFileSync('data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json', 'utf8'),
    ) as { cards: OfficialCardRecord[] }
    const bs3025Raw = bs3Data.cards.find((c) => c.cardNumber === 'BS3-025')
    if (!bs3025Raw) throw new Error('Missing BS3-025 in the official pool.')
    const bs3025 = convertOfficialCardToGameCard(bs3025Raw)
    if (bs3025.status !== 'converted' || bs3025.gameCard.type !== 'cookie') {
      throw new Error('BS3-025 should convert to a cookie GameCard.')
    }
    expect(bs3025.gameCard.skill?.fromBreakArea).toBe(true)
  })

  /**
   * 回歸測試：昏厥觸發措辭不一致，P-011 用「If this Cookie has fainted」
   * 而非多數卡的「When this Cookie faints」，兩種都要被判成 faint: true。
   */
  it('recognizes "If this Cookie has fainted" as a faint trigger (P-011)', () => {
    const p011 = convertOfficialCardToGameCard(P0XX_FIXTURES['P-011'])
    if (p011.status !== 'converted' || p011.gameCard.type !== 'cookie') {
      throw new Error('P-011 should convert to a cookie GameCard.')
    }
    expect(p011.gameCard.skill?.faint).toBe(true)
  })
})

describe('trash-to-break effect (P-016)', () => {
  const context: EffectContext = {
    sourcePlayerId: 'player-two',
    sourceInstanceId: 'source',
    sourceCardName: 'source',
  }

  it('moves a matching cookie from the discard pile to the break area', () => {
    const state = createBattleState()
    const yellowLv2 = { ...cookie('yellow-lv2', 1, 3), energyColor: 'yellow' as const, level: 2 }
    const redLv2 = { ...cookie('red-lv2', 1, 3), energyColor: 'red' as const, level: 2 }
    state.players['player-two'].discardPile = [yellowLv2, redLv2]

    const effect: CardEffect = {
      kind: 'trash-to-break',
      amount: 1,
      energyColor: 'yellow',
      exactLevel: 2,
    }
    const result = executeCardEffect(state, context, effect, ['yellow-lv2'])

    expect(result.players['player-two'].discardPile.map((c) => c.instanceId)).toEqual([
      'red-lv2',
    ])
    expect(result.players['player-two'].breakArea.map((c) => c.instanceId)).toEqual([
      'yellow-lv2',
    ])
  })

  it('rejects a selection that does not match the color/level filter', () => {
    const state = createBattleState()
    const redLv2 = { ...cookie('red-lv2', 1, 3), energyColor: 'red' as const, level: 2 }
    state.players['player-two'].discardPile = [redLv2]

    const effect: CardEffect = {
      kind: 'trash-to-break',
      amount: 1,
      energyColor: 'yellow',
      exactLevel: 2,
    }
    expect(() => executeCardEffect(state, context, effect, ['red-lv2'])).toThrowError()
  })
})

describe('damage-all with excludeSource (P-018)', () => {
  const context: EffectContext = {
    sourcePlayerId: 'player-two',
    sourceInstanceId: 'source-1',
    sourceCardName: 'source',
  }

  it('damages both battle areas but skips the source cookie on its own side', () => {
    let state: GameState = createBattleState()
    state.players['player-two'].battleArea = [
      { card: cookie('source-1', 1, 3), hpCards: [item('src-hp')], rested: false, battleEntryId: 'source-1:battle:1' },
      { card: cookie('ally-1', 1, 3), hpCards: [item('ally-hp-1'), item('ally-hp-2')], rested: false, battleEntryId: 'ally-1:battle:2' },
    ]
    state.players['player-one'].battleArea = [
      { card: cookie('opp-1', 1, 3), hpCards: [item('opp-hp-1'), item('opp-hp-2')], rested: false, battleEntryId: 'opp-1:battle:3' },
    ]

    state = executeCardEffect(state, context, { kind: 'damage-all', amount: 1, side: 'opponent' }, [])
    state = executeCardEffect(
      state,
      context,
      { kind: 'damage-all', amount: 1, side: 'self', excludeSource: true },
      [],
    )

    const source = state.players['player-two'].battleArea.find((c) => c.card.instanceId === 'source-1')
    const ally = state.players['player-two'].battleArea.find((c) => c.card.instanceId === 'ally-1')
    const opponent = state.players['player-one'].battleArea.find((c) => c.card.instanceId === 'opp-1')

    expect(source?.hpCards).toHaveLength(1)
    expect(ally?.hpCards).toHaveLength(1)
    expect(opponent?.hpCards).toHaveLength(1)
  })
})

describe('break-level-higher-than-opponent condition (P-009)', () => {
  it('is met only when the source player break level exceeds the opponent', () => {
    const state = createBattleState()
    const context: EffectContext = {
      sourcePlayerId: 'player-two',
      sourceInstanceId: 'source',
      sourceCardName: 'source',
    }
    const effect: CardEffect = {
      kind: 'damage',
      amount: 1,
      target: { side: 'opponent', min: 0, max: 1 },
      condition: { kind: 'break-level-higher-than-opponent' },
    }

    expect(isEffectConditionMet(state, context, effect)).toBe(false)

    const higherBreak: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          breakArea: [cookie('break-1', 1, 1)],
        },
      },
    }
    expect(isEffectConditionMet(higherBreak, context, effect)).toBe(true)
  })
})
