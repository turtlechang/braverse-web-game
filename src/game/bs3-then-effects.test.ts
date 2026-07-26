import { describe, expect, it } from 'vitest'
import officialBS3Inventory from '../../data/candidates/official-age-of-heroes-and-kingdoms-bs3.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  beginAttack,
  resolveAttackEffect,
  resolveOptionalCostAttack,
  resolveNextDamage,
  skipTrap,
} from './battle'
import { applyGameCommand } from './commands'
import { executeCardEffect } from './effects'
import { simulateAbilityEffects } from './ai/ability-effects'
import type { CardEffect, CookieCard, EffectContext, GameCard, GameState } from './types'
import { createBattleState, cookie as baseCookie, item } from './test-helpers/battle-helpers'

const findBs3Card = (cardNumber: string) => {
  const card = (officialBS3Inventory.cards as OfficialCardRecord[]).find(
    (candidate) => candidate.cardNumber === cardNumber,
  )

  if (!card) throw new Error(`Missing BS3 inventory card ${cardNumber}`)
  return card
}

const asCookie = (cardNumber: string): CookieCard => {
  const conversion = convertOfficialCardToGameCard(findBs3Card(cardNumber))
  if (conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie') {
    throw new Error(`${cardNumber} should convert to a CookieCard.`)
  }
  return conversion.gameCard
}

describe('BS3 attack Then effects', () => {
  it('resolves BS3-009 only when a Soul Jam card is in its support area', () => {
    const wildberry = asCookie('BS3-009')
    let state = createBattleState()

    state.players['player-one'].battleArea[0].hpCards = Array.from(
      { length: 5 },
      (_, index) => item(`defender-hp-${index + 1}`),
    )
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: wildberry,
    }
    state.players['player-two'].supportArea = [
      {
        card: { ...item('soul-jam-support', 'red'), keywords: ['soul-jam'] },
        rested: false,
      },
      { card: item('wildberry-support-2', 'blue'), rested: false },
      { card: item('wildberry-support-3', 'green'), rested: false },
    ]

    state = beginAttack(
      state,
      wildberry.instanceId,
      'defender',
      ['soul-jam-support', 'wildberry-support-2', 'wildberry-support-3'],
    )
    state = skipTrap(state, 'player-one')
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }

    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
    state = resolveAttackEffect(state, 'player-two', ['defender'])
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
  })

  /**
   * 官方 Q&A：BS3-111 的「支援區有 [靈魂果醬]」可由五色任一張靈魂果醬滿足，
   * 條件只看 soul-jam keyword，不限顏色。
   */
  it('BS3-111 accepts any-color Soul Jam in support (official Q&A)', () => {
    const chocoChip = asCookie('BS3-111')
    const yellowSoulJam = convertOfficialCardToGameCard(findBs3Card('BS3-043'))
    if (
      yellowSoulJam.status !== 'converted' ||
      yellowSoulJam.gameCard.type !== 'item'
    ) {
      throw new Error('BS3-043 should convert to an item with soul-jam')
    }
    expect(yellowSoulJam.gameCard.keywords).toContain('soul-jam')
    expect(yellowSoulJam.gameCard.energyColor).toBe('yellow')

    let state = createBattleState()
    state.players['player-one'].battleArea[0].hpCards = Array.from(
      { length: 4 },
      (_, index) => item(`defender-hp-${index + 1}`),
    )
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: { ...chocoChip, instanceId: 'choco-chip' },
      hpCards: [item('choco-hp')],
    }
    state.players['player-two'].supportArea = [
      {
        card: {
          ...yellowSoulJam.gameCard,
          instanceId: 'yellow-soul-jam-support',
        },
        rested: false,
      },
      // 攻擊費用 {P}{N}：紫色支付指定色，黃色靈魂果醬同時當 {N} 與條件來源
      { card: item('choco-pay-p', 'purple'), rested: false },
    ]

    state = beginAttack(state, 'choco-chip', 'defender', [
      'choco-pay-p',
      'yellow-soul-jam-support',
    ])
    state = skipTrap(state, 'player-one')
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }

    // 攻擊本體 1 傷害後剩 3；Then 再選對手造成 2 傷害 → 剩 1
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
    state = resolveAttackEffect(state, 'player-two', ['defender'])
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
  })

  it('BS3-111 skips Then damage when support has no Soul Jam', () => {
    const chocoChip = asCookie('BS3-111')
    let state = createBattleState()
    state.players['player-one'].battleArea[0].hpCards = Array.from(
      { length: 4 },
      (_, index) => item(`defender-hp-${index + 1}`),
    )
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: { ...chocoChip, instanceId: 'choco-chip' },
      hpCards: [item('choco-hp')],
    }
    state.players['player-two'].supportArea = [
      { card: item('choco-pay-p', 'purple'), rested: false },
      { card: item('choco-pay-n', 'red'), rested: false },
    ]

    state = beginAttack(state, 'choco-chip', 'defender', [
      'choco-pay-p',
      'choco-pay-n',
    ])
    state = skipTrap(state, 'player-one')
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }

    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
    // 無靈魂果醬時 Then 自動略過
    if (state.pendingBattle?.stage === 'attack-effect') {
      state = resolveAttackEffect(state, 'player-two', ['defender'])
    }
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
  })

  it('resolves BS3-028 after normal damage when its source has five or fewer HP', () => {
    const mozzarella = asCookie('BS3-028')
    let state = createBattleState()

    state.players['player-one'].battleArea[0].hpCards = Array.from(
      { length: 5 },
      (_, index) => item(`defender-hp-${index + 1}`),
    )
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: mozzarella,
      hpCards: Array.from(
        { length: 5 },
        (_, index) => item(`mozzarella-hp-${index + 1}`),
      ),
    }
    state.players['player-two'].supportArea = [
      { card: item('mozzarella-support-1', 'yellow'), rested: false },
      { card: item('mozzarella-support-2', 'yellow'), rested: false },
      { card: item('mozzarella-support-3', 'yellow'), rested: false },
    ]

    state = beginAttack(
      state,
      mozzarella.instanceId,
      'defender',
      [
        'mozzarella-support-1',
        'mozzarella-support-2',
        'mozzarella-support-3',
      ],
    )
    state = skipTrap(state, 'player-one')
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }

    state = resolveAttackEffect(state, 'player-two', [mozzarella.instanceId])

    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(6)
  })

  it('uses BS3-011 source energy for its full optional follow-up cost', () => {
    const knight = asCookie('BS3-011')
    let state = createBattleState()

    state.players['player-one'].battleArea[0].hpCards = Array.from(
      { length: 4 },
      (_, index) => item(`defender-hp-${index + 1}`),
    )
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: knight,
    }
    state.players['player-two'].supportArea[0].card.energyColor = 'red'

    state = beginAttack(
      state,
      knight.instanceId,
      'defender',
      ['p2-support'],
    )
    state = skipTrap(state, 'player-one')
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }

    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toMatchObject({
      cost: { energy: { red: 2 } },
      sourceEnergy: { red: 2 },
    })

    state = resolveOptionalCostAttack(
      state,
      'player-two',
      'pay',
      [],
      ['defender'],
      [],
    )

    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
  })

  it('resolves BS3-041 only after normal attack damage, then moves its source to break', () => {
    const fettuccine = asCookie('BS3-041')
    let state = createBattleState()
    const defenderHpCards: GameCard[] = Array.from({ length: 4 }, (_, index) =>
      item(`defender-hp-${index + 1}`),
    )

    state.players['player-one'].battleArea[0].hpCards = defenderHpCards
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: fettuccine,
      hpCards: [item('fettuccine-hp-1'), item('fettuccine-hp-2')],
    }
    state.players['player-two'].supportArea = [
      { card: item('yellow-support-1', 'yellow'), rested: false },
      { card: item('yellow-support-2', 'yellow'), rested: false },
    ]

    state = beginAttack(
      state,
      fettuccine.instanceId,
      'defender',
      ['yellow-support-1', 'yellow-support-2'],
    )
    state = skipTrap(state, 'player-one')
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }

    expect(state.pendingBattle?.stage).toBe('attack-effect')
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(1)

    state = resolveAttackEffect(state, 'player-two', [fettuccine.instanceId])

    expect(
      state.players['player-two'].battleArea.some(
        (cookie) => cookie.card.instanceId === fettuccine.instanceId,
      ),
    ).toBe(false)
    expect(
      state.players['player-two'].breakArea.map((card) => card.instanceId),
    ).toContain(fettuccine.instanceId)
  })

  it('uses BS3-033 source energy to place a one-HP opponent Cookie in break', () => {
    const stardust = asCookie('BS3-033')
    let state = createBattleState()

    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: stardust,
    }
    state.players['player-two'].supportArea = [
      { card: item('stardust-support-1', 'yellow'), rested: false },
      { card: item('stardust-support-2', 'yellow'), rested: false },
    ]

    state = beginAttack(
      state,
      stardust.instanceId,
      'defender',
      ['stardust-support-1', 'stardust-support-2'],
    )
    state = skipTrap(state, 'player-one')
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }

    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toMatchObject({
      cost: { energy: { yellow: 1 } },
      sourceEnergy: { yellow: 1 },
    })

    state = resolveOptionalCostAttack(
      state,
      'player-two',
      'pay',
      [],
      ['defender'],
      [],
    )

    expect(state.players['player-one'].battleArea).toHaveLength(0)
    expect(state.players['player-one'].breakArea.map((card) => card.instanceId))
      .toContain('defender')
  })

  it('uses BS3-088 to restore HP to a selected Cookie in its own battle area', () => {
    const pureVanilla = asCookie('BS3-088')
    let state = createBattleState()
    const discard = item('pure-vanilla-discard')

    state.players['player-one'].battleArea[0].hpCards = Array.from(
      { length: 5 },
      (_, index) => item(`defender-hp-${index + 1}`),
    )
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: pureVanilla,
    }
    state.players['player-two'].hand = [discard]
    state.players['player-two'].supportArea = Array.from(
      { length: 4 },
      (_, index) => ({
        card: item(`pure-vanilla-support-${index + 1}`, 'blue'),
        rested: false,
      }),
    )

    state = beginAttack(
      state,
      pureVanilla.instanceId,
      'defender',
      [
        'pure-vanilla-support-1',
        'pure-vanilla-support-2',
        'pure-vanilla-support-3',
        'pure-vanilla-support-4',
      ],
    )
    state = skipTrap(state, 'player-one')
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }

    state = resolveAttackEffect(state, 'player-two', [])
    state = resolveOptionalCostAttack(
      state,
      'player-two',
      'pay',
      [discard.instanceId],
      [pureVanilla.instanceId],
    )

    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    expect(state.players['player-two'].discardPile.map((card) => card.instanceId))
      .toContain(discard.instanceId)
  })

  it('uses BS3-101 source energy to trash an opponent Cookie with two or less HP', () => {
    const moonRabbit = asCookie('BS3-101')
    let state = createBattleState()

    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: moonRabbit,
    }
    state.players['player-two'].supportArea = [
      { card: item('moon-rabbit-support-1', 'purple'), rested: false },
      { card: item('moon-rabbit-support-2', 'purple'), rested: false },
    ]

    state = beginAttack(
      state,
      moonRabbit.instanceId,
      'defender',
      ['moon-rabbit-support-1', 'moon-rabbit-support-2'],
    )
    state = skipTrap(state, 'player-one')
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }

    state = resolveAttackEffect(state, 'player-two', [])
    state = resolveOptionalCostAttack(
      state,
      'player-two',
      'pay',
      [],
      ['defender'],
      [],
    )

    expect(state.players['player-one'].battleArea).toHaveLength(0)
    expect(state.players['player-one'].discardPile.map((card) => card.instanceId))
      .toContain('defender')
  })

  it('uses BS3-086 only with a LV.3 Cookie in its own battle area', () => {
    const kouignAmann = asCookie('BS3-086')
    let state = createBattleState()
    const discard = item('kouign-amann-discard')

    state.players['player-one'].battleArea[0].hpCards = Array.from(
      { length: 5 },
      (_, index) => item(`defender-hp-${index + 1}`),
    )
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: kouignAmann,
    }
    state.players['player-two'].battleArea.push({
      ...state.players['player-two'].battleArea[0],
      card: {
        ...state.players['player-two'].battleArea[0].card,
        id: 'friendly-lv3',
        instanceId: 'friendly-lv3',
        level: 3,
      },
      hpCards: [item('friendly-lv3-hp')],
      battleEntryId: 'friendly-lv3:battle:1',
    })
    state.players['player-two'].hand = [discard]
    state.players['player-two'].supportArea = [
      { card: item('kouign-amann-support-1', 'blue'), rested: false },
      { card: item('kouign-amann-support-2', 'blue'), rested: false },
    ]

    state = beginAttack(
      state,
      kouignAmann.instanceId,
      'defender',
      ['kouign-amann-support-1', 'kouign-amann-support-2'],
    )
    state = skipTrap(state, 'player-one')
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }

    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeDefined()

    state = resolveOptionalCostAttack(
      state,
      'player-two',
      'pay',
      [discard.instanceId],
      ['defender'],
    )

    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
    expect(state.players['player-two'].discardPile.map((card) => card.instanceId))
      .toContain(discard.instanceId)
  })

  it('uses BS3-102 to place two top cards from each player deck into trash', () => {
    const poisonMushroom = asCookie('BS3-102')
    let state = createBattleState()
    const ownTopCards = [item('poison-own-1'), item('poison-own-2')]
    const opponentTopCards = [item('poison-opponent-1'), item('poison-opponent-2')]

    state.players['player-one'].battleArea[0].hpCards = Array.from(
      { length: 5 },
      (_, index) => item(`defender-hp-${index + 1}`),
    )
    state.players['player-one'].deck = [...opponentTopCards, item('poison-opponent-3')]
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: poisonMushroom,
    }
    state.players['player-two'].deck = [...ownTopCards, item('poison-own-3')]
    state.players['player-two'].supportArea = [
      { card: item('poison-support-1', 'purple'), rested: false },
      { card: item('poison-support-2', 'purple'), rested: false },
      { card: item('poison-support-3', 'red'), rested: false },
    ]

    state = beginAttack(
      state,
      poisonMushroom.instanceId,
      'defender',
      ['poison-support-1', 'poison-support-2', 'poison-support-3'],
    )
    state = skipTrap(state, 'player-one')
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }

    state = resolveAttackEffect(state, 'player-two', [])
    state = resolveAttackEffect(state, 'player-two', [])

    expect(state.players['player-two'].deck.map((card) => card.instanceId))
      .toEqual(['poison-own-3'])
    expect(state.players['player-one'].deck.map((card) => card.instanceId))
      .toEqual(['poison-opponent-3'])
    expect(state.players['player-two'].discardPile.map((card) => card.instanceId))
      .toEqual(expect.arrayContaining(['poison-own-1', 'poison-own-2']))
    expect(state.players['player-one'].discardPile.map((card) => card.instanceId))
      .toEqual(expect.arrayContaining(['poison-opponent-1', 'poison-opponent-2']))
  })

  it('uses BS3-105 to place the top opponent deck card into trash', () => {
    const affogato = asCookie('BS3-105')
    let state = createBattleState()
    const opponentTopCard = item('affogato-opponent-top')

    state.players['player-one'].battleArea[0].hpCards = Array.from(
      { length: 5 },
      (_, index) => item(`defender-hp-${index + 1}`),
    )
    state.players['player-one'].deck = [opponentTopCard, item('affogato-opponent-next')]
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: affogato,
    }
    state.players['player-two'].supportArea = [
      { card: item('affogato-support-1', 'purple'), rested: false },
      { card: item('affogato-support-2', 'purple'), rested: false },
    ]

    state = beginAttack(
      state,
      affogato.instanceId,
      'defender',
      ['affogato-support-1', 'affogato-support-2'],
    )
    state = skipTrap(state, 'player-one')
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }

    state = resolveAttackEffect(state, 'player-two', [])

    expect(state.players['player-one'].deck.map((card) => card.instanceId))
      .toEqual(['affogato-opponent-next'])
    expect(state.players['player-one'].discardPile.map((card) => card.instanceId))
      .toContain(opponentTopCard.instanceId)
  })

  it('uses BS3-113 to place its own top deck card into trash', () => {
    const caramelArrow = asCookie('BS3-113')
    let state = createBattleState()
    const ownTopCard = item('caramel-arrow-own-top')

    state.players['player-one'].battleArea[0].hpCards = Array.from(
      { length: 5 },
      (_, index) => item(`defender-hp-${index + 1}`),
    )
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: caramelArrow,
    }
    state.players['player-two'].deck = [ownTopCard, item('caramel-arrow-own-next')]
    state.players['player-two'].supportArea = [
      { card: item('caramel-arrow-support-1', 'purple'), rested: false },
      { card: item('caramel-arrow-support-2', 'purple'), rested: false },
      { card: item('caramel-arrow-support-3', 'purple'), rested: false },
    ]

    state = beginAttack(
      state,
      caramelArrow.instanceId,
      'defender',
      [
        'caramel-arrow-support-1',
        'caramel-arrow-support-2',
        'caramel-arrow-support-3',
      ],
    )
    state = skipTrap(state, 'player-one')
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }

    state = resolveAttackEffect(state, 'player-two', [])

    expect(state.players['player-two'].deck.map((card) => card.instanceId))
      .toEqual(['caramel-arrow-own-next'])
    expect(state.players['player-two'].discardPile.map((card) => card.instanceId))
      .toContain(ownTopCard.instanceId)
  })

  it('converts the remaining six Then effects to executable effect chains', () => {
    const expectedKinds: Record<string, string> = {
      'BS3-032': 'optional-cost-attack',
      'BS3-037': 'optional-cost-attack',
      'BS3-055': 'optional-cost-attack',
      'BS3-060': 'hp-to-trash',
      'BS3-076': 'optional-cost-attack',
      'BS3-080': 'optional-cost-attack',
    }

    for (const [cardNumber, expectedKind] of Object.entries(expectedKinds)) {
      const card = asCookie(cardNumber)
      expect(card.attackEffects?.[0]?.kind).toBe(expectedKind)
    }

    const smokedCheese = asCookie('BS3-032')
    const smokedFollowUp = smokedCheese.attackEffects?.[0]
    expect(smokedFollowUp).toMatchObject({
      kind: 'optional-cost-attack',
      sourceEnergy: { yellow: 1 },
      effects: [{ kind: 'break-to-battle', exactLevel: 1, energyColor: 'yellow' }],
    })

    const strawberryCrepe = asCookie('BS3-076')
    expect(strawberryCrepe.attackEffects?.[0]).toMatchObject({
      kind: 'optional-cost-attack',
      effects: [{
        kind: 'reveal-top-deck',
        match: { type: 'cookie', energyColor: 'blue', level: 2 },
      }],
    })
  })

  /**
   * 官方 Q&A：BS3-080 的 reveal-top-deck peek 後卡留在牌庫頂，
   * 條件匹配時才執行 nested draw-up-to。
   */
  it('BS3-080 reveal keeps card on top and draws only when matched', () => {
    const espresso = asCookie('BS3-080')
    const optionalCost = espresso.attackEffects?.[0]
    expect(optionalCost).toBeDefined()
    expect(optionalCost!.kind).toBe('optional-cost-attack')

    // optional-cost-attack 的 nested effects 包含 reveal-top-deck
    const optionalCostEffect = optionalCost as Extract<CardEffect, { kind: 'optional-cost-attack' }>
    const revealEffect = optionalCostEffect.effects[0]
    expect(revealEffect).toBeDefined()
    expect(revealEffect.kind).toBe('reveal-top-deck')

    const context: EffectContext = {
      sourcePlayerId: 'player-two',
      sourceInstanceId: 'espresso',
      sourceCardName: 'Espresso Cookie',
    }

    const blueLv2: CookieCard = {
      ...baseCookie('blue-lv2'),
      level: 2,
      energyColor: 'blue',
    }
    const blueLv1: CookieCard = {
      ...baseCookie('blue-lv1'),
      level: 1,
      energyColor: 'blue',
    }

    // 匹配場景：牌庫頂為 Blue LV.2
    let state = createBattleState()
    state.players['player-two'].deck = [
      blueLv2,
      item('draw-1'),
      item('draw-2'),
      item('draw-3'),
    ]
    const beforeDeck = state.players['player-two'].deck.map((c) => c.instanceId)
    const matched = executeCardEffect(state, context, revealEffect, ['defender'])
    expect(matched.players['player-two'].deck.map((c) => c.instanceId)).toEqual(
      beforeDeck,
    )
    expect(matched.pendingDrawUpTo).toBeDefined()
    expect(matched.pendingDrawUpTo?.max).toBe(2)

    // 不匹配場景：牌庫頂為 Blue LV.1
    state = createBattleState()
    state.players['player-two'].deck = [blueLv1, item('under-miss')]
    const handBefore = state.players['player-two'].hand.length
    const missed = executeCardEffect(state, context, revealEffect, ['defender'])
    expect(missed.players['player-two'].deck[0].instanceId).toBe('blue-lv1')
    expect(missed.pendingDrawUpTo).toBeUndefined()
    expect(missed.players['player-two'].hand.length).toBe(handBefore)
  })

  it('attaches a Soul Jam below its matching Ancient Cookie and applies its bonus', () => {
    const hollyberry = asCookie('BS3-017')
    const soulJam = convertOfficialCardToGameCard(findBs3Card('BS3-019'))
    if (soulJam.status !== 'converted') throw new Error('Soul Jam must convert.')
    const state = createBattleState()
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: hollyberry,
    }
    state.players['player-two'].discardPile = [soulJam.gameCard]

    const result = executeCardEffect(
      state,
      {
        sourcePlayerId: 'player-two',
        sourceInstanceId: soulJam.gameCard.instanceId,
      },
      {
        kind: 'equip-source',
        target: { side: 'self', min: 1, max: 1 },
        requiredCookieId: 'BS3-017',
        attackBonus: 1,
      },
      [hollyberry.instanceId],
    )

    expect(result.players['player-two'].battleArea[0].equippedCards)
      .toContainEqual(soulJam.gameCard)
    expect(result.players['player-two'].discardPile).not.toContainEqual(soulJam.gameCard)
    expect(result.attackModifiers).toContainEqual(
      expect.objectContaining({
        sourceInstanceId: soulJam.gameCard.instanceId,
        targetInstanceId: hollyberry.instanceId,
        amount: 1,
      }),
    )
  })
})

/**
 * 回歸測試：官方 Q&A（BS3-019 vs BS3-115）要求「Select…Then equip」在沒有
 * 合法目標時整段中止，但這個中止**只**能綁定在緊接著的 equip-source 上。
 * BS3-081「對手 0～1 傷害，然後把來源自己送回牌庫頂」是同樣「傷害＋後續
 * 效果」的形狀，但兩段彼此獨立——對手戰鬥區剛好淨空只代表傷害沒有目標可選，
 * 不代表後面的自身效果也不該執行。commands.ts 的 executeAbilityEffects 與
 * ai/ability-effects.ts 的 simulateAbilityEffects 必須用同一份判斷條件，
 * 否則 AI 算出的 effectTargets 會跟正式執行時的中止時機對不上而丟錯。
 */
describe('independent multi-effect chains do not abort on an unrelated empty opponent side', () => {
  const bs3081 = (instanceId: string): CookieCard => ({
    ...baseCookie(instanceId, 2, 3),
    id: 'BS3-081',
    level: 2,
    energyColor: 'blue',
    skill: {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: true,
      restSource: false,
      cost: { energy: { blue: 2 }, discardHand: 1 },
      text: 'BS3-081',
      effects: [
        { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } },
        {
          kind: 'battle-to-deck-top',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        },
      ],
    },
  })

  it('still sends the source to the deck top when the opponent battle area is empty', () => {
    const base = createBattleState()
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': { ...base.players['player-one'], battleArea: [] },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            {
              card: bs3081('gcc-081'),
              hpCards: [item('hp-a'), item('hp-b'), item('hp-c')],
              rested: false,
              battleEntryId: 'gcc-081:battle:1',
            },
          ],
          supportArea: [
            { card: item('p2-blue-1', 'blue'), rested: false },
            { card: item('p2-blue-2', 'blue'), rested: false },
          ],
          hand: [item('p2-discard-fodder')],
        },
      },
    }

    const result = applyGameCommand(state, {
      kind: 'activate-skill',
      playerId: 'player-two',
      sourceInstanceId: 'gcc-081',
      trigger: 'activate',
      paymentIds: ['p2-blue-1', 'p2-blue-2'],
      discardHandIds: ['p2-discard-fodder'],
      effectTargets: [[], ['gcc-081']],
    })

    const player = result.players['player-two']
    expect(player.battleArea.some((entry) => entry.card.instanceId === 'gcc-081')).toBe(
      false,
    )
    expect(player.deck[0]?.instanceId).toBe('gcc-081')
  })

  it('the AI-simulation path computes the same effectTargets shape as execution expects', () => {
    const base = createBattleState()
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': { ...base.players['player-one'], battleArea: [] },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            {
              card: bs3081('gcc-081'),
              hpCards: [item('hp-a'), item('hp-b'), item('hp-c')],
              rested: false,
              battleEntryId: 'gcc-081:battle:1',
            },
          ],
        },
      },
    }
    const context: EffectContext = {
      sourcePlayerId: 'player-two',
      sourceInstanceId: 'gcc-081',
      sourceCardName: 'gcc-081',
    }

    // 兩份模擬邏輯必須用同一個「何時中止」判斷；這裡不需要真的選出對手目標
    // （對手戰鬥區已清空，理應選不到），重點是第二個效果仍要拿到自己的
    // sourceOnly 目標，不能因為第一個效果沒有候選就整段被跳過。
    const sim = simulateAbilityEffects(
      state,
      context,
      bs3081('gcc-081').skill!.effects,
      (_s, _ctx, effect) => (effect.kind === 'battle-to-deck-top' ? ['gcc-081'] : []),
      () => true,
      { sourceInstanceId: 'gcc-081', paymentIds: [] },
    )

    expect(sim.aborted).toBe(false)
    expect(sim.effectTargets).toHaveLength(2)
    expect(sim.effectTargets[1]).toEqual(['gcc-081'])
    expect(
      sim.effectSelections.some((selection) => selection.effect.kind === 'battle-to-deck-top'),
    ).toBe(true)
  })
})
