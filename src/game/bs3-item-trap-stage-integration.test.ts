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
import type { CookieCard, GameCard } from './types'
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
    expect(itemAbility!.effects[0]).toMatchObject({
      modes: [
        {
          label: 'During this turn, your opponent cannot activate Blocker.',
        },
        {
          label:
            'If there are no Cookies that have Blocker in your opponent\'s battle area, select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
          effects: [
            { condition: { kind: 'opponent-battle-area-has-no-blocker' } },
          ],
        },
      ],
    })
  })

  it('can be played and execute disable-block mode', () => {
    const state = createBattleState()
    const bs3Item = asGameCard('BS3-018')
    const itemCard: GameCard = {
      ...bs3Item,
      item: {
        ...bs3Item.item!,
        cost: { red: 2 },
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
        ...bs3Item.item!,
        cost: { red: 2 },
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

  it('skips damage mode when the opponent has a Blocker, even if that mode is selected', () => {
    const state = createBattleState()
    const bs3Item = asGameCard('BS3-018')
    const itemCard: GameCard = {
      ...bs3Item,
      item: {
        ...bs3Item.item!,
        cost: { red: 2 },
      },
    }
    const blockerCookie: CookieCard = {
      ...cookie('blocker'),
      skill: {
        trigger: 'block',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'Blocker',
        effects: [],
      },
    }

    const s1 = {
      ...state,
      activePlayerId: 'player-two' as const,
      phase: 'main' as const,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [
            ...state.players['player-one'].battleArea,
            {
              card: blockerCookie,
              hpCards: [],
              rested: false,
              battleEntryId: 'blocker:battle:1',
            },
          ],
        },
        'player-two': {
          ...state.players['player-two'],
          hand: [itemCard],
          supportArea: [
            { card: item('pay-1'), rested: false },
            { card: item('pay-2'), rested: false },
          ],
        },
      },
    }

    const pending = applyGameCommand(s1, {
      kind: 'begin-play-item',
      playerId: 'player-two',
      instanceId: itemCard.instanceId,
      paymentIds: ['pay-1', 'pay-2'],
      chooseOneModes: [1],
    })
    expect(pending.pendingAbilityEffect).toBeDefined()

    const next = applyGameCommand(pending, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: ['defender'],
    })

    expect(next.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
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
// BS3-044 Cheesepad Tablet - Item
// =====================================
describe('BS3-044 Cheesepad Tablet (item integration)', () => {
  it('can be played and sacrifices a LV.2+ hand cookie into the break area', () => {
    const state = createBattleState()
    const bs3Item = asGameCard('BS3-044')
    const sacrifice: CookieCard = { ...cookie('sacrifice-cookie', 1, 3), level: 2 }
    const itemCard: GameCard = {
      ...bs3Item,
      item: {
        ...bs3Item.item!,
        cost: { yellow: 2 },
      },
    }

    const s1 = { ...state, activePlayerId: 'player-two' as const, phase: 'main' as const }
    s1.players['player-two'].hand = [itemCard, sacrifice]
    s1.players['player-two'].supportArea = [
      { card: item('pay-1', 'yellow'), rested: false },
      { card: item('pay-2', 'yellow'), rested: false },
    ]

    const next = applyGameCommand(s1, {
      kind: 'play-item',
      playerId: 'player-two',
      instanceId: itemCard.instanceId,
      paymentIds: ['pay-1', 'pay-2'],
      effectTargets: [[sacrifice.instanceId], []],
    })

    expect(
      next.players['player-two'].hand.some((c) => c.instanceId === sacrifice.instanceId),
    ).toBe(false)
    expect(
      next.players['player-two'].breakArea.some((c) => c.instanceId === sacrifice.instanceId),
    ).toBe(true)
    expect(
      next.players['player-two'].discardPile.some((c) => c.instanceId === itemCard.instanceId),
    ).toBe(true)
  })

  it('rejects playing it without sacrificing exactly 1 LV.2+ hand cookie', () => {
    const state = createBattleState()
    const bs3Item = asGameCard('BS3-044')
    const itemCard: GameCard = {
      ...bs3Item,
      item: {
        ...bs3Item.item!,
        cost: { yellow: 2 },
      },
    }

    const s1 = { ...state, activePlayerId: 'player-two' as const, phase: 'main' as const }
    s1.players['player-two'].hand = [itemCard]
    s1.players['player-two'].supportArea = [
      { card: item('pay-1', 'yellow'), rested: false },
      { card: item('pay-2', 'yellow'), rested: false },
    ]

    expect(() =>
      applyGameCommand(s1, {
        kind: 'play-item',
        playerId: 'player-two',
        instanceId: itemCard.instanceId,
        paymentIds: ['pay-1', 'pay-2'],
        effectTargets: [[], []],
      }),
    ).toThrow()
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

// =====================================
// BS3-047 Kingdom of Eternal Abundance - Stage
// =====================================
describe('BS3-047 Kingdom of Eternal Abundance (stage integration)', () => {
  it('sends hand cookies summing to exactly LV.3 into the break area, then deploys a LV.3 break-area cookie', () => {
    const state = createBattleState()
    const stageCard = asGameCard('BS3-047')
    const lv1: CookieCard = { ...cookie('sac-lv1', 1, 2), level: 1, energyColor: 'yellow' }
    const lv2: CookieCard = { ...cookie('sac-lv2', 1, 2), level: 2, energyColor: 'yellow' }
    const lv3InBreak: CookieCard = { ...cookie('deploy-lv3', 2, 4), level: 3, energyColor: 'yellow' }

    const s1 = { ...state, activePlayerId: 'player-one' as const, phase: 'main' as const }
    s1.players['player-one'].stage = { card: stageCard, rested: false }
    s1.players['player-one'].hand = [lv1, lv2]
    s1.players['player-one'].breakArea = [lv3InBreak]
    s1.players['player-one'].supportArea = [
      { card: item('pay-1', 'yellow'), rested: false },
    ]

    const next = applyGameCommand(s1, {
      kind: 'activate-stage',
      playerId: 'player-one',
      paymentIds: ['pay-1'],
      effectTargets: [[lv1.instanceId, lv2.instanceId], [lv3InBreak.instanceId]],
    })

    expect(
      next.players['player-one'].hand.some((c) => c.instanceId === lv1.instanceId),
    ).toBe(false)
    expect(
      next.players['player-one'].hand.some((c) => c.instanceId === lv2.instanceId),
    ).toBe(false)
    expect(
      next.players['player-one'].breakArea.some((c) => c.instanceId === lv1.instanceId),
    ).toBe(true)
    expect(
      next.players['player-one'].breakArea.some((c) => c.instanceId === lv2.instanceId),
    ).toBe(true)
    expect(
      next.players['player-one'].battleArea.some(
        (b) => b.card.instanceId === lv3InBreak.instanceId,
      ),
    ).toBe(true)
  })

  it('rejects a hand selection whose levels do not sum to exactly LV.3', () => {
    const state = createBattleState()
    const stageCard = asGameCard('BS3-047')
    const lv1: CookieCard = { ...cookie('sac-lv1', 1, 2), level: 1, energyColor: 'yellow' }
    const lv3InBreak: CookieCard = { ...cookie('deploy-lv3', 2, 4), level: 3, energyColor: 'yellow' }

    const s1 = { ...state, activePlayerId: 'player-one' as const, phase: 'main' as const }
    s1.players['player-one'].stage = { card: stageCard, rested: false }
    s1.players['player-one'].hand = [lv1]
    s1.players['player-one'].breakArea = [lv3InBreak]
    s1.players['player-one'].supportArea = [
      { card: item('pay-1', 'yellow'), rested: false },
    ]

    expect(() =>
      applyGameCommand(s1, {
        kind: 'activate-stage',
        playerId: 'player-one',
        paymentIds: ['pay-1'],
        effectTargets: [[lv1.instanceId], [lv3InBreak.instanceId]],
      }),
    ).toThrow()
  })
})
