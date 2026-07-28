import { describe, expect, it } from 'vitest'
import officialBS3Inventory from '../../data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import {
  convertOfficialItemAbility,
  convertOfficialTrapAbility,
  convertOfficialStageAbility,
} from '../cards/official-effect-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import type { GameCard } from './types'
import { createBattleState, cookie, item } from './test-helpers/battle-helpers'

const findBs3Card = (cardNumber: string) => {
  const card = (officialBS3Inventory.cards as OfficialCardRecord[]).find(
    (candidate) => candidate.cardNumber === cardNumber,
  )
  if (!card) throw new Error(`Missing BS3 inventory card ${cardNumber}`)
  return card
}

const asGameCard = (cardNumber: string): GameCard => {
  const conversion = convertOfficialCardToGameCard(findBs3Card(cardNumber))
  if (conversion.status !== 'converted') {
    throw new Error(`${cardNumber} should convert to a GameCard.`)
  }
  return conversion.gameCard
}

// =====================================
// BS3-018 Mushroom Spore Punch - Item
// =====================================
describe('BS3-018 Mushroom Spore Punch (item integration)', () => {
  it('converts to choose-one with disable-block and damage modes', () => {
    const itemAbility = convertOfficialItemAbility(findBs3Card('BS3-018'))
    expect(itemAbility).toBeTruthy()
    expect(itemAbility!.effects).toHaveLength(1)
    expect(itemAbility!.effects[0]).toMatchObject({ kind: 'choose-one' })
  })

  it('can be played and execute disable-block mode', () => {
    const state = createBattleState()
    const bs3Item = asGameCard('BS3-018')
    const itemCard: GameCard = {
      ...bs3Item,
      item: {
        cost: { red: 2 },
        text: bs3Item.item?.text ?? '',
        effects: [{ kind: 'choose-one', modes: [
          { label: 'disable block', effects: [{ kind: 'disable-block', duration: 'this-turn', side: 'opponent' }] },
          { label: 'damage', effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }] },
        ] }],
      },
    }

    const s1 = { ...state, activePlayerId: 'player-two' as const, phase: 'main' as const }
    s1.players['player-two'].hand = [itemCard]
    s1.players['player-two'].supportArea = [
      { card: item('pay-1'), rested: false },
      { card: item('pay-2'), rested: false },
    ]

    const next = applyGameCommand(s1, {
      kind: 'play-item',
      playerId: 'player-two',
      instanceId: itemCard.instanceId,
      paymentIds: ['pay-1', 'pay-2'],
      chooseOneModes: [0],
    })

    expect(next.players['player-two'].discardPile.some(c => c.instanceId === itemCard.instanceId)).toBe(true)
  })

  it('can be played and execute damage mode when no blocker exists', () => {
    const state = createBattleState()
    const bs3Item = asGameCard('BS3-018')
    const itemCard: GameCard = {
      ...bs3Item,
      item: {
        cost: { red: 2 },
        text: bs3Item.item?.text ?? '',
        effects: [{ kind: 'choose-one', modes: [
          { label: 'disable block', effects: [{ kind: 'disable-block', duration: 'this-turn', side: 'opponent' }] },
          { label: 'damage', effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }] },
        ] }],
      },
    }

    const s1 = { ...state, activePlayerId: 'player-two' as const, phase: 'main' as const }
    s1.players['player-two'].hand = [itemCard]
    s1.players['player-two'].supportArea = [
      { card: item('pay-1'), rested: false },
      { card: item('pay-2'), rested: false },
    ]

    const next = applyGameCommand(s1, {
      kind: 'play-item',
      playerId: 'player-two',
      instanceId: itemCard.instanceId,
      paymentIds: ['pay-1', 'pay-2'],
      chooseOneModes: [1],
    })

    expect(next.players['player-two'].discardPile.some(c => c.instanceId === itemCard.instanceId)).toBe(true)
  })
})

// =====================================
// BS3-019 Soul Jam: Light of Passion - Item
// =====================================
describe('BS3-019 Soul Jam: Light of Passion (item integration)', () => {
  it('converts to damage + equip-source effects', () => {
    const effects = convertOfficialItemAbility(findBs3Card('BS3-019'))
    expect(effects).toBeTruthy()
    expect(effects!.effects).toHaveLength(2)
    expect(effects!.effects[0]).toMatchObject({ kind: 'damage', amount: 2 })
    expect(effects!.effects[1]).toMatchObject({ kind: 'equip-source', requiredCookieId: 'BS3-017' })
  })
})

// =====================================
// BS3-020 Miniature Dragon Boat - Item
// =====================================
describe('BS3-020 Miniature Dragon Boat (item integration)', () => {
  it('converts to hp-to-hand effect', () => {
    const effects = convertOfficialItemAbility(findBs3Card('BS3-020'))
    expect(effects).toBeTruthy()
    expect(effects!.effects).toHaveLength(1)
    expect(effects!.effects[0]).toMatchObject({
      kind: 'hp-to-hand',
      amount: 3,
      target: { side: 'self', min: 0, max: 1, energyColor: 'red' },
    })
  })

  it('can be played and returns HP cards to hand', () => {
    const state = createBattleState()
    const bs3Item = asGameCard('BS3-020')
    const redCookie = cookie('red-cookie', 1, 3)
    const itemCard: GameCard = {
      ...bs3Item,
      item: {
        cost: { red: 1 },
        text: bs3Item.item?.text ?? '',
        effects: [{ kind: 'hp-to-hand', amount: 3, target: { side: 'self', min: 0, max: 1, energyColor: 'red' } }],
      },
    }

    const s1 = { ...state, activePlayerId: 'player-two' as const, phase: 'main' as const }
    s1.players['player-two'].hand = [itemCard]
    s1.players['player-two'].battleArea = [{
      card: redCookie,
      hpCards: [item('hp-1'), item('hp-2'), item('hp-3')],
      rested: false,
      battleEntryId: 'red-cookie:battle:1',
    }]
    s1.players['player-two'].supportArea = [{ card: item('pay-1'), rested: false }]

    const handBefore = s1.players['player-two'].hand.length
    const next = applyGameCommand(s1, {
      kind: 'play-item',
      playerId: 'player-two',
      instanceId: itemCard.instanceId,
      paymentIds: ['pay-1'],
      effectTargets: [[redCookie.instanceId]],
    })

    expect(next.players['player-two'].discardPile.some(c => c.instanceId === itemCard.instanceId)).toBe(true)
    expect(next.players['player-two'].hand.length).toBeGreaterThanOrEqual(handBefore)
  })
})

// =====================================
// BS3-021 Oath on the Shield - Trap
// =====================================
describe('BS3-021 Oath on the Shield (trap integration)', () => {
  it('converts to -3 attack + self damage', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-021'))
    expect(trap).toBeTruthy()
    expect(trap!.effects).toHaveLength(2)
    expect(trap!.effects[0]).toMatchObject({ kind: 'modify-attack', amount: -3 })
    expect(trap!.effects[1]).toMatchObject({ kind: 'damage', amount: 1 })
  })
})

// =====================================
// BS3-022 Banquet of Victory - Trap
// =====================================
describe('BS3-022 Banquet of Victory (trap integration)', () => {
  it('converts with break-level condition', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-022'))
    expect(trap).toBeTruthy()
    expect(trap!.condition).toEqual({ kind: 'break-level-at-least', level: 6 })
    expect(trap!.effects[0]).toMatchObject({ kind: 'modify-attack', amount: -1 })
    expect(trap!.effects[1]).toMatchObject({ kind: 'damage', amount: 1 })
  })
})

// =====================================
// BS3-023 Passionate Hollyberry Kingdom - Stage
// =====================================
describe('BS3-023 Passionate Hollyberry Kingdom (stage integration)', () => {
  it('converts to choose-one with modify-attack and hp-to-hand', () => {
    const stage = convertOfficialStageAbility(findBs3Card('BS3-023'))
    expect(stage).toBeTruthy()
    expect(stage!.effects).toHaveLength(1)
    expect(stage!.effects[0]).toMatchObject({ kind: 'choose-one' })
    if (stage!.effects[0].kind === 'choose-one') {
      expect(stage!.effects[0].modes).toHaveLength(2)
      expect(stage!.effects[0].modes[0].effects[0]).toMatchObject({ kind: 'modify-attack' })
      expect(stage!.effects[0].modes[1].effects[0]).toMatchObject({ kind: 'hp-to-hand' })
    }
  })

  it('can be placed and activated with choose-one mode 0 (modify-attack)', () => {
    const state = createBattleState()
    const stageCard = asGameCard('BS3-023')
    const stagePlaced: GameCard = {
      ...stageCard,
      stageAbility: {
        placementCost: { red: 2 },
        cost: { energy: { red: 2 } },
        text: stageCard.stageAbility?.text ?? '',
        restSource: true,
        effects: [{ kind: 'choose-one', modes: [
          { label: '+1 attack', effects: [{ kind: 'modify-attack', amount: 1, duration: 'this-turn', target: { side: 'self', min: 0, max: 1 } }] },
          { label: 'hp-to-hand', effects: [{ kind: 'hp-to-hand', amount: 1, target: { side: 'self', min: 0, max: 1 } }] },
        ] }],
      },
    }

    const s1 = { ...state, activePlayerId: 'player-one' as const, phase: 'main' as const }
    s1.players['player-one'].stage = { card: stagePlaced, rested: false }
    s1.players['player-one'].supportArea = [
      { card: item('pay-1'), rested: false },
      { card: item('pay-2'), rested: false },
    ]

    const next = applyGameCommand(s1, {
      kind: 'activate-stage',
      playerId: 'player-one',
      paymentIds: ['pay-1', 'pay-2'],
      chooseOneModes: [0],
    })

    expect(next.players['player-one'].stage!.rested).toBe(true)
  })

  it('can be placed and activated with choose-one mode 1 (hp-to-hand)', () => {
    const state = createBattleState()
    const stageCard = asGameCard('BS3-023')
    const redCookie = cookie('red-cookie', 1, 3)
    const stagePlaced: GameCard = {
      ...stageCard,
      stageAbility: {
        placementCost: { red: 2 },
        cost: { energy: { red: 2 } },
        text: stageCard.stageAbility?.text ?? '',
        restSource: true,
        effects: [{ kind: 'choose-one', modes: [
          { label: '+1 attack', effects: [{ kind: 'modify-attack', amount: 1, duration: 'this-turn', target: { side: 'self', min: 0, max: 1 } }] },
          { label: 'hp-to-hand', effects: [{ kind: 'hp-to-hand', amount: 1, target: { side: 'self', min: 0, max: 1 } }] },
        ] }],
      },
    }

    const s1 = { ...state, activePlayerId: 'player-one' as const, phase: 'main' as const }
    s1.players['player-one'].stage = { card: stagePlaced, rested: false }
    s1.players['player-one'].battleArea = [{
      card: redCookie,
      hpCards: [item('hp-1'), item('hp-2'), item('hp-3')],
      rested: false,
      battleEntryId: 'red-cookie:battle:1',
    }]
    s1.players['player-one'].supportArea = [
      { card: item('pay-1'), rested: false },
      { card: item('pay-2'), rested: false },
    ]

    const next = applyGameCommand(s1, {
      kind: 'activate-stage',
      playerId: 'player-one',
      paymentIds: ['pay-1', 'pay-2'],
      chooseOneModes: [1],
      effectTargets: [[redCookie.instanceId]],
    })

    expect(next.players['player-one'].stage!.rested).toBe(true)
  })
})

// =====================================
// BS3-024 Dragon's Valley - Stage
// =====================================
describe('BS3-024 Dragon\'s Valley (stage integration)', () => {
  it('converts to modify-attack +2 effect', () => {
    const stage = convertOfficialStageAbility(findBs3Card('BS3-024'))
    expect(stage).toBeTruthy()
    expect(stage!.effects).toHaveLength(1)
    expect(stage!.effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: 2,
      duration: 'this-turn',
    })
  })

  it('has trashBattleCookie cost with red energy color', () => {
    const stage = convertOfficialStageAbility(findBs3Card('BS3-024'))
    expect(stage).toBeTruthy()
    expect(stage!.cost.trashBattleCookie).toMatchObject({
      count: 1,
      energyColor: 'red',
    })
  })

  it('can be activated with trashBattleCookie cost', () => {
    const state = createBattleState()
    const stageCard = asGameCard('BS3-024')
    const redCookie = cookie('red-sacrifice', 1, 2)
    redCookie.energyColor = 'red'
    const stagePlaced: GameCard = {
      ...stageCard,
      stageAbility: {
        placementCost: { red: 2 },
        cost: {
          energy: { red: 2 },
          trashBattleCookie: { count: 1, energyColor: 'red' },
        },
        text: stageCard.stageAbility?.text ?? '',
        restSource: true,
        effects: [{ kind: 'modify-attack', amount: 2, duration: 'this-turn', target: { side: 'self', min: 0, max: 1 } }],
      },
    }

    const s1 = { ...state, activePlayerId: 'player-one' as const, phase: 'main' as const }
    s1.players['player-one'].stage = { card: stagePlaced, rested: false }
    s1.players['player-one'].battleArea = [{
      card: redCookie,
      hpCards: [item('hp-1')],
      rested: false,
      battleEntryId: 'red-sacrifice:battle:1',
    }]
    s1.players['player-one'].supportArea = [
      { card: item('pay-1'), rested: false },
      { card: item('pay-2'), rested: false },
    ]

    const next = applyGameCommand(s1, {
      kind: 'activate-stage',
      playerId: 'player-one',
      paymentIds: ['pay-1', 'pay-2'],
      trashBattleCookieIds: ['red-sacrifice'],
    })

    expect(next.players['player-one'].stage!.rested).toBe(true)
    expect(next.players['player-one'].battleArea).toHaveLength(0)
    expect(next.players['player-one'].discardPile.some(c => c.instanceId === 'red-sacrifice')).toBe(true)
  })

  it('rejects activation without trashBattleCookie payment', () => {
    const state = createBattleState()
    const stageCard = asGameCard('BS3-024')
    const redCookie = cookie('red-sacrifice', 1, 2)
    redCookie.energyColor = 'red'
    const stagePlaced: GameCard = {
      ...stageCard,
      stageAbility: {
        placementCost: { red: 2 },
        cost: {
          energy: { red: 2 },
          trashBattleCookie: { count: 1, energyColor: 'red' },
        },
        text: stageCard.stageAbility?.text ?? '',
        restSource: true,
        effects: [{ kind: 'modify-attack', amount: 2, duration: 'this-turn', target: { side: 'self', min: 0, max: 1 } }],
      },
    }

    const s1 = { ...state, activePlayerId: 'player-one' as const, phase: 'main' as const }
    s1.players['player-one'].stage = { card: stagePlaced, rested: false }
    s1.players['player-one'].battleArea = [{
      card: redCookie,
      hpCards: [item('hp-1')],
      rested: false,
      battleEntryId: 'red-sacrifice:battle:1',
    }]
    s1.players['player-one'].supportArea = [
      { card: item('pay-1'), rested: false },
      { card: item('pay-2'), rested: false },
    ]

    expect(() => applyGameCommand(s1, {
      kind: 'activate-stage',
      playerId: 'player-one',
      paymentIds: ['pay-1', 'pay-2'],
      trashBattleCookieIds: [],
    })).toThrow()
  })
})
