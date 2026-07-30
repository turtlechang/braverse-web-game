import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  advancePhase,
  applyGameCommand,
  beginAttack,
  executeCardEffect,
  getAttackDamageAgainst,
  getAttackEnergyCostForState,
  playTrap,
  resolveBattleAutomatically,
  resolveFlip,
  type CardEffect,
  type EffectContext,
  type GameState,
} from '..'
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
  'P-017': makeOfficialCard({
    cardNumber: 'P-017', level: 1, hp: 3, energyType: 'GREEN', color: 'GREEN',
    name: 'Purple Yam Cookie',
    skill: { name: null, text: '{mt} {t1} If a card from your support area is placed in your trash, <can be used as {G}.> Take 1 card from the top of your deck and place it in your support area as rested.' },
    attackText: '<{G}{G}> Deals 1 damage.',
  }),
  'P-024': makeOfficialCard({
    cardNumber: 'P-024', type: 'flip', officialType: 'FLIP', level: 2, hp: 2,
    energyType: 'RED', color: 'RED', name: 'Caramel Choux Cookie',
    flipText: '<Discard 1 card.> The Cookie with this card attached for HP gains +1 HP.',
    attackText: null,
  }),
  'P-025': makeOfficialCard({
    cardNumber: 'P-025', type: 'flip', officialType: 'FLIP', level: 3, hp: 3,
    energyType: 'YELLOW', color: 'YELLOW', name: 'Marzipan Cookie 2',
    skill: { name: '{sk} Protect. Protect.', text: 'If you have 2 different kinds of [Marzipan Cookie] cards in your battle area and 4 different kinds of [Marzipan Cookie] cards in your support area, this Cookie gains x2 attack damage.' },
    attackText: '<{Y}{Y}{Y}> Containment Protocol {da} 3',
    flipText: 'Draw up to 1 card from your deck.',
  }),
  'P-026': makeOfficialCard({
    cardNumber: 'P-026', type: 'flip', officialType: 'FLIP', level: 3, hp: 3,
    energyType: 'YELLOW', color: 'YELLOW', name: 'Marzipan Cookie 3',
    skill: { name: '{sk} Protect. Protect.', text: 'If you have 2 different kinds of [Marzipan Cookie] cards in your battle area and 4 different kinds of [Marzipan Cookie] cards in your support area, this Cookie gains x2 attack damage.' },
    attackText: '<{Y}{Y}{Y}> Containment Protocol {da} 3',
    flipText: 'Draw up to 1 card from your deck.',
  }),
  'P-027': makeOfficialCard({
    cardNumber: 'P-027', type: 'flip', officialType: 'FLIP', level: 3, hp: 3,
    energyType: 'YELLOW', color: 'YELLOW', name: 'Marzipan Cookie 4',
    skill: { name: '{sk} Protect. Protect.', text: 'If you have 2 different kinds of [Marzipan Cookie] cards in your battle area and 4 different kinds of [Marzipan Cookie] cards in your support area, this Cookie gains x2 attack damage.' },
    attackText: '<{Y}{Y}{Y}> Containment Protocol {da} 3',
    flipText: 'Draw up to 1 card from your deck.',
  }),
  'P-028': makeOfficialCard({
    cardNumber: 'P-028', type: 'stage', officialType: 'STAGE', energyType: 'YELLOW', color: 'YELLOW',
    name: 'Golden Cheese Warehouse',
    skill: { name: null, text: '<{Y}{Y}> Place in your stage area.' },
    attackText: '{mob} <{Y}> <Rest this card.> <Place 1 {Y} LV.2 or higher Cookie from your hand into your break area.> Return up to 1 {Y} LV.1 Cookie from your break area to your hand.',
  }),
  'P-029': makeOfficialCard({
    cardNumber: 'P-029', type: 'trap', officialType: 'TRAP', energyType: 'GREEN', color: 'GREEN',
    name: 'Ritual of Life',
    attackText: '<{G}{G}> If your Cookie faints during this battle, play 1 {G} Cookie from your trash.',
  }),
  'P-032': makeOfficialCard({
    cardNumber: 'P-032', type: 'stage', officialType: 'STAGE', energyType: 'MIX', color: 'PURE',
    name: 'Hall of Ancient Heroes',
    skill: { name: null, text: '<{R}{Y}{G}{B}{P}> Place in your stage area.' },
    attackText: '{mob} <{N}{N}> <Rest this card.> Select up to 1 of your [Ancient] Cookies in your battle area. During this turn, that Cookie\'s attack costs are all changed to {N}.',
  }),
}

describe('P-0XX promotion card conversion (all 26 cards)', () => {
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
          gameCard.stageAbility?.effects.length ||
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

const getP0xxGameCard = (cardNumber: string) => {
  const conversion = convertOfficialCardToGameCard(P0XX_FIXTURES[cardNumber])
  if (conversion.status !== 'converted') {
    throw new Error(`${cardNumber} should convert to a GameCard.`)
  }
  return conversion.gameCard
}

describe('P-017 passive support-area trigger', () => {
  it('queues the skill after support-to-trash and resolves it once per turn', () => {
    const p017 = getP0xxGameCard('P-017')
    if (p017.type !== 'cookie') throw new Error('P-017 should be a Cookie.')

    let state: GameState = createBattleState()
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          hand: [],
          deck: [item('p017-top-a', 'blue'), item('p017-top-b', 'red')],
          battleArea: [
            {
              card: p017,
              hpCards: [item('p017-hp')],
              rested: false,
              battleEntryId: 'p017:battle:1',
            },
          ],
          supportArea: [
            { card: item('p017-trash-a', 'green'), rested: false },
            { card: item('p017-trash-b', 'yellow'), rested: false },
          ],
        },
      },
    }

    const context: EffectContext = {
      sourcePlayerId: 'player-two',
      sourceInstanceId: p017.instanceId,
      sourceCardName: p017.name,
    }
    state = executeCardEffect(
      state,
      context,
      { kind: 'support-to-trash', amount: 1 },
      ['p017-trash-a'],
    )

    expect(state.pendingStageTrigger).toMatchObject({
      sourceKind: 'cookie-skill',
      sourceInstanceId: p017.instanceId,
    })

    state = applyGameCommand(state, {
      kind: 'resolve-stage-trigger',
      playerId: 'player-two',
      action: 'activate',
    })

    expect(state.pendingStageTrigger).toBeFalsy()
    expect(state.players['player-two'].supportArea).toContainEqual({
      card: expect.objectContaining({ instanceId: 'p017-top-a' }),
      rested: true,
    })
    expect(state.skillUsesThisTurn).toContain('p017:battle:1')

    state = executeCardEffect(
      state,
      context,
      { kind: 'support-to-trash', amount: 1 },
      ['p017-trash-b'],
    )
    expect(state.pendingStageTrigger).toBeFalsy()
    expect(state.players['player-two'].supportArea).not.toContainEqual(
      expect.objectContaining({ card: expect.objectContaining({ instanceId: 'p017-trash-b' }) }),
    )
  })

  it('records support-area decrease without triggering when a support card returns to hand', () => {
    const p017 = getP0xxGameCard('P-017')
    if (p017.type !== 'cookie') throw new Error('P-017 should be a Cookie.')

    let state: GameState = createBattleState()
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: [
            {
              card: p017,
              hpCards: [item('p017-hand-hp')],
              rested: false,
              battleEntryId: 'p017:hand:battle',
            },
          ],
          supportArea: [{ card: item('p017-return'), rested: false }],
        },
      },
    }

    state = executeCardEffect(
      state,
      {
        sourcePlayerId: 'player-two',
        sourceInstanceId: p017.instanceId,
      },
      { kind: 'support-to-hand', amount: 1 },
      ['p017-return'],
    )

    expect(state.supportAreaDecreasedThisTurn?.['player-two']).toBe(true)
    expect(state.pendingStageTrigger).toBeFalsy()
  })
})

describe('P-024 HP-only FLIP', () => {
  it('discards its activation cost and adds one HP to the attached Cookie', () => {
    const p024 = getP0xxGameCard('P-024')
    if (p024.type !== 'cookie') throw new Error('P-024 should be a Cookie.')

    let state: GameState = createBattleState()
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: [item('p024-new-hp')],
          hand: [item('p024-discard')],
          battleArea: state.players['player-one'].battleArea.map((cookie) => ({
            ...cookie,
            hpCards: [item('p024-existing-hp')],
          })),
        },
      },
    }
    state = beginAttack(state, 'attacker', 'defender', ['p2-support'])
    state = {
      ...state,
      pendingBattle: {
        ...state.pendingBattle!,
        stage: 'flip',
        damagePlayerId: 'player-one',
        damageTargetInstanceId: 'defender',
        revealedHpCard: p024,
        remainingDamage: 1,
      },
    }

    state = resolveFlip(state, 'player-one', {
      activate: true,
      discardHandIds: ['p024-discard'],
    })

    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
    expect(state.players['player-one'].deck).toHaveLength(0)
    expect(state.players['player-one'].discardPile.map((card) => card.instanceId)).toEqual(
      expect.arrayContaining(['p024-discard', p024.instanceId]),
    )
  })

  it('cannot be declared as an attacker', () => {
    const p024 = getP0xxGameCard('P-024')
    if (p024.type !== 'cookie') throw new Error('P-024 should be a Cookie.')

    const state: GameState = {
      ...createBattleState(),
      players: {
        ...createBattleState().players,
        'player-two': {
          ...createBattleState().players['player-two'],
          battleArea: [
            {
              card: p024,
              hpCards: [item('p024-attacker-hp')],
              rested: false,
              battleEntryId: 'p024:battle:1',
            },
          ],
        },
      },
    }

    expect(() => beginAttack(state, p024.instanceId, 'defender', ['p2-support'])).toThrow(
      'Invalid battle action.',
    )
  })
})

describe('P-025/P-026/P-027 Marzipan FLIP skills', () => {
  it('doubles attack damage only when both distinct-name requirements are met', () => {
    const p025 = getP0xxGameCard('P-025')
    const p026 = getP0xxGameCard('P-026')
    const p027 = getP0xxGameCard('P-027')
    if (p025.type !== 'cookie' || p026.type !== 'cookie' || p027.type !== 'cookie') {
      throw new Error('Marzipan cards should convert to Cookie cards.')
    }

    const marzipanSupport = (instanceId: string, name: string) => ({
      card: {
        ...cookie(instanceId, 1, 2),
        name,
        energyColor: 'yellow' as const,
        level: 3,
      },
      rested: false,
    })

    let state: GameState = createBattleState()
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: [
            {
              card: p025,
              hpCards: [item('p025-hp')],
              rested: false,
              battleEntryId: 'p025:battle:1',
            },
            {
              card: p026,
              hpCards: [item('p026-hp')],
              rested: false,
              battleEntryId: 'p026:battle:2',
            },
          ],
          supportArea: [
            marzipanSupport('marzipan-base', 'Marzipan Cookie'),
            marzipanSupport('marzipan-2', 'Marzipan Cookie 2'),
            marzipanSupport('marzipan-3', 'Marzipan Cookie 3'),
            marzipanSupport('marzipan-4', 'Marzipan Cookie 4'),
          ],
        },
      },
    }

    for (const card of [p025, p026, p027]) {
      expect(card.skill?.effects.some((effect) => effect.kind === 'multiply-attack-damage')).toBe(true)
    }
    expect(getAttackDamageAgainst(state, p025.instanceId, 'defender')).toBe(6)

    const missingSupport = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          supportArea: state.players['player-two'].supportArea.slice(0, 3),
        },
      },
    }
    expect(getAttackDamageAgainst(missingSupport, p025.instanceId, 'defender')).toBe(3)
  })
})

describe('P-028 Golden Cheese Warehouse', () => {
  it('moves a yellow LV.2 Cookie from hand to break and returns a yellow LV.1 Cookie', () => {
    const p028 = getP0xxGameCard('P-028')
    if (p028.type !== 'stage') throw new Error('P-028 should be a Stage.')
    const handLv2 = { ...cookie('p028-hand-lv2', 1, 4), energyColor: 'yellow' as const, level: 2 }
    const breakLv1 = { ...cookie('p028-break-lv1', 1, 2), energyColor: 'yellow' as const, level: 1 }

    let state: GameState = createBattleState()
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          hand: [p028, handLv2],
          breakArea: [breakLv1],
          supportArea: [
            { card: item('p028-place-a', 'yellow'), rested: false },
            { card: item('p028-place-b', 'yellow'), rested: false },
            { card: item('p028-activate', 'yellow'), rested: false },
          ],
        },
      },
    }

    state = applyGameCommand(state, {
      kind: 'play-stage',
      playerId: 'player-two',
      instanceId: p028.instanceId,
      paymentIds: ['p028-place-a', 'p028-place-b'],
    })
    state = applyGameCommand(state, {
      kind: 'activate-stage',
      playerId: 'player-two',
      paymentIds: ['p028-activate'],
      effectTargets: [[handLv2.instanceId], [breakLv1.instanceId]],
    })

    expect(state.players['player-two'].stage?.rested).toBe(true)
    expect(state.players['player-two'].breakArea.map((card) => card.instanceId)).toEqual([
      handLv2.instanceId,
    ])
    expect(state.players['player-two'].hand.map((card) => card.instanceId)).toContain(
      breakLv1.instanceId,
    )
  })
})

describe('P-029 Ritual of Life', () => {
  it('waits for a friendly faint and then plays a green Cookie from the trash', () => {
    const p029 = getP0xxGameCard('P-029')
    if (p029.type !== 'trap') throw new Error('P-029 should be a Trap.')
    const greenTrashCookie = {
      ...cookie('p029-green-trash', 1, 2),
      energyColor: 'green' as const,
    }

    let state: GameState = createBattleState()
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: [p029],
          deck: [item('p029-hp-a'), item('p029-hp-b'), item('p029-hp-c')],
          battleArea: [
            {
              ...state.players['player-one'].battleArea[0],
              hpCards: [item('p029-target-hp')],
            },
            {
              card: cookie('p029-alive', 1, 2),
              hpCards: [item('p029-alive-hp')],
              rested: false,
              battleEntryId: 'p029:alive:battle',
            },
          ],
          supportArea: [
            { card: item('p029-cost-a', 'green'), rested: false },
            { card: item('p029-cost-b', 'green'), rested: false },
          ],
          discardPile: [greenTrashCookie],
        },
        'player-two': {
          ...state.players['player-two'],
          supportArea: [{ card: item('p029-attack-cost', 'red'), rested: false }],
        },
      },
    }

    state = beginAttack(state, 'attacker', 'defender', ['p029-attack-cost'])
    state = playTrap(state, 'player-one', {
      trapInstanceId: p029.instanceId,
      paymentIds: ['p029-cost-a', 'p029-cost-b'],
      targetIds: [],
    })
    expect(state.pendingBattle?.delayedTrap?.anyFriendlyCookie).toBe(true)

    state = resolveBattleAutomatically(state)
    expect(state.pendingBattle).toBeNull()
    expect(state.pendingAbilityEffect?.effects[0]).toMatchObject({
      kind: 'trash-to-battle',
      energyColor: 'green',
    })

    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [greenTrashCookie.instanceId],
    })

    expect(state.pendingAbilityEffect).toBeFalsy()
    expect(state.players['player-one'].battleArea).toContainEqual(
      expect.objectContaining({ card: expect.objectContaining({ instanceId: greenTrashCookie.instanceId }) }),
    )
  })
})

describe('P-032 Hall of Ancient Heroes', () => {
  it('changes an Ancient Cookie attack cost to neutral for this turn only', () => {
    const p032 = getP0xxGameCard('P-032')
    if (p032.type !== 'stage') throw new Error('P-032 should be a Stage.')
    const ancient = {
      ...cookie('p032-ancient', 2, 3),
      name: 'Ancient Cookie',
      keywords: ['ancient'] as ['ancient'],
      attackEnergyCost: { red: 2 },
      attackCost: 2,
    }

    let state: GameState = createBattleState()
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          hand: [p032],
          battleArea: [
            {
              card: ancient,
              hpCards: [item('p032-ancient-hp')],
              rested: false,
              battleEntryId: 'p032:ancient:battle',
            },
          ],
          supportArea: [
            { card: item('p032-red', 'red'), rested: false },
            { card: item('p032-yellow', 'yellow'), rested: false },
            { card: item('p032-green', 'green'), rested: false },
            { card: item('p032-blue', 'blue'), rested: false },
            { card: item('p032-purple', 'purple'), rested: false },
            { card: item('p032-activate-a', 'red'), rested: false },
            { card: item('p032-activate-b', 'yellow'), rested: false },
          ],
        },
      },
    }

    state = applyGameCommand(state, {
      kind: 'play-stage',
      playerId: 'player-two',
      instanceId: p032.instanceId,
      paymentIds: ['p032-red', 'p032-yellow', 'p032-green', 'p032-blue', 'p032-purple'],
    })
    state = applyGameCommand(state, {
      kind: 'activate-stage',
      playerId: 'player-two',
      paymentIds: ['p032-activate-a', 'p032-activate-b'],
      effectTargets: [[ancient.instanceId]],
    })

    expect(getAttackEnergyCostForState(state, ancient.instanceId)).toEqual({ neutral: 1 })
    expect(state.attackCostModifiers).toContainEqual(
      expect.objectContaining({ targetInstanceId: ancient.instanceId, energyCost: { neutral: 1 } }),
    )

    state = advancePhase(state)
    state = advancePhase(state)
    expect(state.attackCostModifiers).toEqual([])
    expect(getAttackEnergyCostForState(state, ancient.instanceId)).toEqual({ red: 2 })
  })
})
