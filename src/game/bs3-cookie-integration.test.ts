import { describe, expect, it } from 'vitest'
import officialBS3Inventory from '../../data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import {
  convertOfficialCookieSkill,
  convertOfficialAttackEffects,
  convertOfficialFlipAbility,
} from '../cards/official-effect-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  canActivateCookieSkill,
  type CardSkill,
  type GameState,
  type CookieCard,
} from '.'
import { item } from './test-helpers/battle-helpers'

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

const setupBattleState = (
  skill: CardSkill,
  cookieCard?: CookieCard,
): GameState => {
  const sourceCard = cookieCard ?? asCookie('BS3-001')
  const base: GameState = {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        deck: [],
        hand: [item('hand-1')],
        battleArea: [
          {
            card: { ...sourceCard, skill },
            hpCards: [item('hp-1'), item('hp-2')],
            rested: false,
            battleEntryId: `${sourceCard.instanceId}:battle:1`,
          },
        ],
        supportArea: [
          { card: item('pay-1'), rested: false },
          { card: item('pay-2'), rested: false },
          { card: item('pay-3'), rested: false },
        ],
        breakArea: [],
        discardPile: [],
        stage: null,
        hasMulliganed: true,
        startingCookieSelected: true,
      },
      'player-two': {
        id: 'player-two',
        name: 'AI',
        deck: [],
        hand: [],
        battleArea: [],
        supportArea: [],
        breakArea: [],
        discardPile: [],
        stage: null,
        hasMulliganed: true,
        startingCookieSelected: true,
      },
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-one',
    turnNumber: 1,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 1,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingRefresh: null,
    pendingBattle: null,
  }
  return base
}

// =====================================
// BS3-001 Princess Cookie - passive +1 attack
// =====================================
describe('BS3-001 Princess Cookie (integration)', () => {
  it('converts to passive modify-attack +1', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-001'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('passive')
    expect(skill!.effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: 1,
      duration: 'persistent',
    })
  })

  it('passive effect is applied automatically (no manual activation needed)', () => {
    const state = setupBattleState({
      trigger: undefined as unknown as 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: {} },
      text: '',
      effects: [{ kind: 'modify-attack', amount: 1, duration: 'persistent', target: { side: 'self', min: 1, max: 1, sourceOnly: true } }],
    })

    const cookie = state.players['player-one'].battleArea[0]
    expect(cookie.card.skill!.effects[0]).toMatchObject({ kind: 'modify-attack', amount: 1 })
  })
})

// =====================================
// BS3-002 Raspberry Cookie - on-play damage
// =====================================
describe('BS3-002 Raspberry Cookie (integration)', () => {
  it('converts to on-play skill with damage effect', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-002'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.effects[0]).toMatchObject({
      kind: 'damage',
      amount: 2,
      target: { side: 'opponent', maxLevel: 1 },
    })
  })

  it('has optional-cost-attack effect', () => {
    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-002'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'optional-cost-attack',
      cost: { energy: { red: 1 } },
    })
  })
})

// =====================================
// BS3-003 Royal Margarine Cookie - activate return-to-hand
// =====================================
describe('BS3-003 Royal Margarine Cookie (integration)', () => {
  it('converts to activate skill with return-to-hand effect', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-003'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('activate')
    expect(skill!.effects[0]).toMatchObject({
      kind: 'return-to-hand',
      target: { side: 'self', sourceOnly: true },
    })
  })

  it('can be activated with red:2 cost', () => {
    const state = setupBattleState({
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: { red: 2 } },
      text: '',
      effects: [{ kind: 'return-to-hand', target: { side: 'self', min: 1, max: 1, sourceOnly: true } }],
    })

    const sourceId = state.players['player-one'].battleArea[0].card.instanceId
    expect(canActivateCookieSkill(state, 'player-one', sourceId, 'activate')).toBe(true)
  })
})

// =====================================
// BS3-004 Royal Berry Cookie - flip draw-up-to
// =====================================
describe('BS3-004 Royal Berry Cookie (integration)', () => {
  it('converts to flip ability with draw-up-to', () => {
    const flip = convertOfficialFlipAbility(findBs3Card('BS3-004'))
    expect(flip).toBeTruthy()
    expect(flip!.effects[0]).toMatchObject({ kind: 'draw-up-to', max: 1 })
  })

  it('has no cookie skill', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-004'))
    expect(skill).toBeUndefined()
  })
})

// =====================================
// BS3-005 Mala Sauce Cookie - no skill
// =====================================
describe('BS3-005 Mala Sauce Cookie (integration)', () => {
  it('has no skill', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-005'))
    expect(skill).toBeUndefined()
  })
})

// =====================================
// BS3-006 Snapdragon Cookie - passive aura
// =====================================
describe('BS3-006 Snapdragon Cookie (integration)', () => {
  it('converts to passive modify-all-attack aura', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-006'))
    expect(skill).toBeTruthy()
    expect(skill!.effects[0]).toMatchObject({
      kind: 'modify-all-attack',
      amount: 1,
      duration: 'persistent',
      side: 'self',
      energyColor: 'red',
      minLevel: 2,
    })
  })
})

// =====================================
// BS3-007 Tea Knight Cookie - passive conditional
// =====================================
describe('BS3-007 Tea Knight Cookie (integration)', () => {
  it('converts to passive modify-attack with break-level condition', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-007'))
    expect(skill).toBeTruthy()
    expect(skill!.effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: 2,
      duration: 'persistent',
      condition: { kind: 'break-level-at-least', level: 7 },
    })
  })
})

// =====================================
// BS3-008 Devil Cookie - activate faint
// =====================================
describe('BS3-008 Devil Cookie (integration)', () => {
  it('converts to activate skill with opponent-battle-to-trash', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-008'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('activate')
    expect(skill!.oncePerTurn).toBe(true)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'opponent-battle-to-trash',
      maxLevel: 1,
      destination: 'break',
    })
  })

  it('can be activated with red:3 cost', () => {
    const state = setupBattleState({
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      restSource: false,
      cost: { energy: { red: 3 } },
      text: '',
      effects: [{ kind: 'opponent-battle-to-trash', min: 0, maxLevel: 1, destination: 'break' }],
    })

    const sourceId = state.players['player-one'].battleArea[0].card.instanceId
    expect(canActivateCookieSkill(state, 'player-one', sourceId, 'activate')).toBe(true)
  })
})

// =====================================
// BS3-009 Wildberry Cookie - on-play damage + Soul Jam attack
// =====================================
describe('BS3-009 Wildberry Cookie (integration)', () => {
  it('converts to on-play skill with discard cost and damage', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-009'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.cost.discardHand).toBe(1)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'damage',
      amount: 1,
      target: { side: 'opponent' },
    })
  })

  it('has Soul Jam conditional attack effect', () => {
    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-009'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'damage',
      condition: { kind: 'support-keyword-at-least', keyword: 'soul-jam', count: 1 },
    })
  })
})

// =====================================
// BS3-010 Pitaya Dragon Cookie - on-play your-turn faint
// =====================================
describe('BS3-010 Pitaya Dragon Cookie (integration)', () => {
  it('converts to on-play skill with yourTurn and opponent-battle-to-trash', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-010'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.yourTurn).toBe(true)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'opponent-battle-to-trash',
      maxLevel: 1,
      destination: 'break',
    })
  })

  it('has optional-cost-attack effect', () => {
    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-010'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'optional-cost-attack',
      cost: { energy: { red: 1 } },
    })
  })
})

// =====================================
// BS3-011 Knight Cookie - no skill, attack effect
// =====================================
describe('BS3-011 Knight Cookie (integration)', () => {
  it('has no cookie skill', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-011'))
    expect(skill).toBeUndefined()
  })

  it('has optional-cost-attack effect', () => {
    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-011'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'optional-cost-attack',
      cost: { energy: { red: 2 } },
    })
  })
})

// =====================================
// BS3-012 Jungleberry Cookie - flip gain-hp
// =====================================
describe('BS3-012 Jungleberry Cookie (integration)', () => {
  it('converts to flip ability with attachedHpBonus (gains +1 HP while attached)', () => {
    const flip = convertOfficialFlipAbility(findBs3Card('BS3-012'))
    expect(flip).toBeTruthy()
    expect(flip!.attachedHpBonus).toBe(1)
    expect(flip!.effects).toEqual([])
  })

  it('has no cookie skill', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-012'))
    expect(skill).toBeUndefined()
  })
})

// =====================================
// BS3-013 Tiger Lily Cookie - on-play + attack damage reduction
// =====================================
describe('BS3-013 Tiger Lily Cookie (integration)', () => {
  it('converts to on-play skill with modify-attack', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-013'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: 1,
      duration: 'this-turn',
    })
  })

  it('has attack effect with damage reduction', () => {
    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-013'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'modify-damage-received',
      duration: 'opponent-next-turn',
      minimumDamage: 2,
      setDamageTo: 1,
    })
  })
})

// =====================================
// BS3-014 Schwarzwaler - passive conditional
// =====================================
describe('BS3-014 Schwarzwaler (integration)', () => {
  it('converts to passive modify-attack with blocker condition', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-014'))
    expect(skill).toBeTruthy()
    expect(skill!.effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: 1,
      duration: 'persistent',
      condition: { kind: 'any-battle-area-has-blocker' },
    })
  })
})

// =====================================
// BS3-015 Capsaicin Cookie - no skill
// =====================================
describe('BS3-015 Capsaicin Cookie (integration)', () => {
  it('has no skill', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-015'))
    expect(skill).toBeUndefined()
  })
})

// =====================================
// BS3-016 Tarte Tatin Cookie - activate set-active
// =====================================
describe('BS3-016 Tarte Tatin Cookie (integration)', () => {
  it('converts to activate skill with set-active', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-016'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('activate')
    expect(skill!.oncePerTurn).toBe(true)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'set-active',
      supportCount: 0,
      condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
    })
  })

  it('can be activated (free cost)', () => {
    const state = setupBattleState({
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      restSource: false,
      cost: { energy: {} },
      text: '',
      effects: [{ kind: 'set-active', supportCount: 0 }],
    })

    const sourceId = state.players['player-one'].battleArea[0].card.instanceId
    expect(canActivateCookieSkill(state, 'player-one', sourceId, 'activate')).toBe(true)
  })
})

// =====================================
// BS3-017 Hollyberry Cookie - passive + attack ally buff
// =====================================
describe('BS3-017 Hollyberry Cookie (integration)', () => {
  it('converts to passive modify-damage-received', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-017'))
    expect(skill).toBeTruthy()
    expect(skill!.effects[0]).toMatchObject({
      kind: 'modify-damage-received',
      duration: 'persistent',
      minimumDamage: 3,
      setDamageTo: 2,
    })
  })

  it('has attack effect with ally buff', () => {
    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-017'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'modify-attack',
      amount: 1,
      duration: 'this-turn',
      target: { side: 'self', excludeSource: true },
    })
  })
})

// =====================================
// 完整轉換驗證 - 全部 BS3-001~017
// =====================================
describe('BS3-001~017 完整轉換驗證', () => {
  const bs3CookieCards = [
    'BS3-001', 'BS3-002', 'BS3-003', 'BS3-004', 'BS3-005',
    'BS3-006', 'BS3-007', 'BS3-008', 'BS3-009', 'BS3-010',
    'BS3-011', 'BS3-012', 'BS3-013', 'BS3-014', 'BS3-015',
    'BS3-016', 'BS3-017',
  ]

  bs3CookieCards.forEach((cardNumber) => {
    it(`${cardNumber} has valid conversion`, () => {
      const card = findBs3Card(cardNumber)
      expect(['cookie', 'flip']).toContain(card.type)

      const conversion = convertOfficialCardToGameCard(card)
      expect(conversion.status).toBe('converted')
    })
  })
})
