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
import { executeCardEffect } from './effects'
import type { CookieCard, GameCard } from './types'
import { createBattleState, item } from './test-helpers/battle-helpers'

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
