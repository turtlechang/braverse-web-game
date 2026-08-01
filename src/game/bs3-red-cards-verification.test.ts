import { describe, expect, it } from 'vitest'
import officialBS3Inventory from '../../data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
  convertOfficialTrapAbility,
  convertOfficialItemAbility,
  convertOfficialStageAbility,
  convertOfficialAttackEffects,
  convertOfficialFlipAbility,
} from '../cards/official-effect-adapter'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import type { CardEffect, CookieCard } from './types'
import { beginAttack, getAttackDamageAgainst, getEffectiveAttack } from '.'
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

const effectsOf = (cardNumber: string): CardEffect[] => {
  const conversion = convertOfficialCardEffects(findBs3Card(cardNumber))
  if (conversion.status !== 'supported') {
    throw new Error(`${cardNumber} should convert to runtime effects.`)
  }
  return conversion.effects
}

// =====================================
// 紅色 BS3 餅乾卡 - 技能效果驗證
// =====================================
describe('紅色 BS3 餅乾卡技能效果', () => {
  it('BS3-001 Princess Cookie: +1 attack only when attacking a Cookie with remaining HP >= 4', () => {
    const conversion = convertOfficialCardEffects(findBs3Card('BS3-001'))
    expect(conversion.status).toBe('supported')
    if (conversion.status !== 'supported') return
    const effects = conversion.effects
    expect(effects).toHaveLength(1)
    expect(effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: 1,
      duration: 'persistent',
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      condition: { kind: 'attack-target-remaining-hp-at-least', amount: 4 },
    })
  })

  it('BS3-001 Princess Cookie: does not gain +1 attack against a low-HP target, does against a 4+ HP target', () => {
    const princess = asCookie('BS3-001')
    const state = createBattleState()
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: { ...princess, instanceId: 'attacker' },
    }

    // 對手只剩 3 張 HP 卡（< 4），不應該加成，維持基礎攻擊力 1。
    state.players['player-one'].battleArea[0] = {
      ...state.players['player-one'].battleArea[0],
      hpCards: [item('hp-1'), item('hp-2'), item('hp-3')],
    }
    state.pendingBattle = {
      attackerPlayerId: 'player-two',
      defenderPlayerId: 'player-one',
      attackerInstanceId: 'attacker',
      targetInstanceId: 'defender',
      declaredDamage: 0,
      remainingDamage: 0,
      stage: 'attack-effect',
      trapUsed: false,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: [],
      attackEffectIndex: 0,
    }
    expect(getAttackDamageAgainst(state, 'attacker', 'defender')).toBe(1)

    // 對手還有 4 張 HP 卡（>= 4），這次攻擊應該加成成 2。
    state.players['player-one'].battleArea[0] = {
      ...state.players['player-one'].battleArea[0],
      hpCards: [item('hp-1'), item('hp-2'), item('hp-3'), item('hp-4')],
    }
    expect(getAttackDamageAgainst(state, 'attacker', 'defender')).toBe(2)

    // 卡面顯示（getEffectiveAttack 不帶明確目標）在還沒宣告攻擊時，
    // 不能提前顯示加成後的攻擊力——`beginAttack` 算宣告傷害時
    // pendingBattle 尚未寫入 state，也要能靠明確傳入的目標算對（見上）。
    state.pendingBattle = null
    expect(getEffectiveAttack(state, 'attacker')).toBe(1)
  })

  it('BS3-001 Princess Cookie: beginAttack 算宣告傷害時 pendingBattle 還沒寫入，仍要正確加成', () => {
    // beginAttack 呼叫 getAttackDamageAgainst 算 declaredDamage 時，
    // state.pendingBattle 還是舊值（這裡故意留 null）——條件判斷不能只看
    // state.pendingBattle，一定要靠 beginAttack 明確傳入的目標 id 才能算對。
    const princess = asCookie('BS3-001')
    const state = createBattleState()
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: { ...princess, instanceId: 'attacker' },
    }
    state.players['player-one'].battleArea[0] = {
      ...state.players['player-one'].battleArea[0],
      hpCards: [item('hp-1'), item('hp-2'), item('hp-3'), item('hp-4')],
    }
    state.players['player-two'].supportArea = [
      { card: item('p2-support-1'), rested: false },
      { card: item('p2-support-2'), rested: false },
    ]
    expect(state.pendingBattle).toBeNull()

    const attacked = beginAttack(state, 'attacker', 'defender', [
      'p2-support-1',
      'p2-support-2',
    ])
    expect(attacked.pendingBattle!.declaredDamage).toBe(2)
  })

  it('BS3-002 Raspberry Cookie: on-play damage + optional-cost-attack', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-002'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.effects[0]).toMatchObject({
      kind: 'damage',
      amount: 2,
      target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
    })

    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-002'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'optional-cost-attack',
      cost: { energy: { red: 1 } },
    })
  })

  it('BS3-003 Royal Margarine Cookie: activate return-to-hand', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-003'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('activate')
    expect(skill!.effects[0]).toMatchObject({
      kind: 'return-to-hand',
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    })
  })

  it('BS3-005 Mala Sauce Cookie: no skill (confirmed)', () => {
    const conversion = convertOfficialCardEffects(findBs3Card('BS3-005'))
    expect(conversion.status).toBe('unsupported')
    if (conversion.status !== 'unsupported') return
    expect(conversion.reason).toBe('no-effect-text')
  })

  it('BS3-006 Snapdragon Cookie: passive modify-all-attack', () => {
    const effects = effectsOf('BS3-006')
    expect(effects[0]).toMatchObject({
      kind: 'modify-all-attack',
      amount: 1,
      duration: 'persistent',
      side: 'self',
      energyColor: 'red',
      minLevel: 2,
    })
  })

  it('BS3-007 Tea Knight Cookie: passive +2 attack (break>=7)', () => {
    const effects = effectsOf('BS3-007')
    expect(effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: 2,
      duration: 'persistent',
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      condition: { kind: 'break-level-at-least', level: 7 },
    })
  })

  it('BS3-008 Devil Cookie: activate faint LV.1 opponent', () => {
    const effects = effectsOf('BS3-008')
    expect(effects[0]).toMatchObject({
      kind: 'opponent-battle-to-trash',
      min: 0,
      maxLevel: 1,
      destination: 'break',
    })
  })

  it('BS3-009 Wildberry Cookie: on-play damage + optional-cost-attack', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-009'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.cost.discardHand).toBe(1)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'damage',
      amount: 1,
      target: { side: 'opponent', min: 0, max: 1 },
    })

    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-009'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'damage',
      amount: 1,
      target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
      condition: { kind: 'support-keyword-at-least', keyword: 'soul-jam', count: 1 },
    })
  })

  it('BS3-010 Pitaya Dragon Cookie: your-turn on-play faint LV.1', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-010'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.yourTurn).toBe(true)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'opponent-battle-to-trash',
      min: 0,
      maxLevel: 1,
      destination: 'break',
    })

    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-010'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'optional-cost-attack',
      cost: { energy: { red: 1 } },
    })
  })

  it('BS3-011 Knight Cookie: no skill, has optional-cost-attack', () => {
    const conversion = convertOfficialCardEffects(findBs3Card('BS3-011'))
    expect(conversion.status).toBe('unsupported')
    if (conversion.status !== 'unsupported') return
    expect(conversion.reason).toBe('no-effect-text')

    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-011'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'optional-cost-attack',
      cost: { energy: { red: 2 } },
    })
  })

  it('BS3-013 Tiger Lily Cookie: on-play modify-attack + optional-cost-attack', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-013'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: 1,
      duration: 'this-turn',
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    })

    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-013'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'modify-damage-received',
      amount: 0,
      duration: 'opponent-next-turn',
      minimumDamage: 2,
      setDamageTo: 1,
    })
  })

  it('BS3-014 Schwarzwälder: passive +1 attack (blocker exists)', () => {
    const effects = effectsOf('BS3-014')
    expect(effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: 1,
      duration: 'persistent',
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      condition: { kind: 'any-battle-area-has-blocker' },
    })
  })

  it('BS3-015 Capsaicin Cookie: no skill (confirmed)', () => {
    const conversion = convertOfficialCardEffects(findBs3Card('BS3-015'))
    expect(conversion.status).toBe('unsupported')
    if (conversion.status !== 'unsupported') return
    expect(conversion.reason).toBe('no-effect-text')
  })

  it('BS3-016 Tarte Tatin Cookie: activate set-active + optional-cost-attack', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-016'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('activate')
    expect(skill!.oncePerTurn).toBe(true)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'set-active',
      supportCount: 0,
      condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
    })

    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-016'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'set-active',
      supportCount: 0,
      condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
    })
  })

  it('BS3-017 Hollyberry Cookie: passive damage reduction + optional-cost-attack', () => {
    const effects = effectsOf('BS3-017')
    expect(effects[0]).toMatchObject({
      kind: 'modify-damage-received',
      amount: 0,
      duration: 'persistent',
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      minimumDamage: 3,
      setDamageTo: 2,
    })

    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-017'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'modify-attack',
      amount: 1,
      duration: 'this-turn',
      target: { side: 'self', min: 0, max: 1, excludeSource: true },
    })
  })
})

// =====================================
// 紅色 BS3 餅乾卡 - 無技能確認
// =====================================
describe('紅色 BS3 餅乾卡 - 無技能確認', () => {
  it('BS3-004 Royal Berry Cookie: flip card, no cookie skill', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-004'))
    expect(skill).toBeUndefined()
  })

  it('BS3-012 Jungleberry Cookie: flip card, no cookie skill', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-012'))
    expect(skill).toBeUndefined()
  })
})

// =====================================
// 紅色 BS3 Flip 卡 - Flip 效果驗證
// =====================================
describe('紅色 BS3 Flip 卡效果', () => {
  it('BS3-004 Royal Berry Cookie: draw up to 1', () => {
    const flip = convertOfficialFlipAbility(findBs3Card('BS3-004'))
    expect(flip).toBeTruthy()
    expect(flip!.effects[0]).toMatchObject({
      kind: 'draw-up-to',
      max: 1,
    })
  })

  it('BS3-012 Jungleberry Cookie: gain-hp 1', () => {
    const flip = convertOfficialFlipAbility(findBs3Card('BS3-012'))
    expect(flip).toBeTruthy()
    expect(flip!.effects[0]).toMatchObject({
      kind: 'gain-hp',
      amount: 1,
    })
  })
})

// =====================================
// 紅色 BS3 物品卡效果
// =====================================
describe('紅色 BS3 物品卡效果', () => {
  it('BS3-018 Mushroom Spore Punch: choose-one', () => {
    const itemAbility = convertOfficialItemAbility(findBs3Card('BS3-018'))
    expect(itemAbility).toBeTruthy()
    expect(itemAbility!.effects[0]).toMatchObject({ kind: 'choose-one' })
  })

  it('BS3-019 Soul Jam: Light of Passion: damage + equip-source', () => {
    const effects = effectsOf('BS3-019')
    expect(effects).toHaveLength(2)
    expect(effects[0]).toMatchObject({
      kind: 'damage',
      amount: 2,
      target: { side: 'opponent', min: 0, max: 1 },
    })
    expect(effects[1]).toMatchObject({
      kind: 'equip-source',
      target: { side: 'self', min: 0, max: 1 },
      requiredCookieId: 'BS3-017',
      attackBonus: 1,
    })
  })

  it('BS3-020 Miniature Dragon Boat: hp-to-hand 3', () => {
    const effects = effectsOf('BS3-020')
    expect(effects[0]).toMatchObject({
      kind: 'hp-to-hand',
      amount: 3,
      target: { side: 'self', min: 0, max: 1, energyColor: 'red' },
    })
  })
})

// =====================================
// 紅色 BS3 陷阱卡效果
// =====================================
describe('紅色 BS3 陷阱卡效果', () => {
  it('BS3-021 Oath on the Shield: -3 attack + self damage', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-021'))
    expect(trap).toBeTruthy()
    expect(trap!.effects).toHaveLength(2)
    expect(trap!.effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: -3,
      duration: 'this-turn',
    })
    expect(trap!.effects[1]).toMatchObject({
      kind: 'damage',
      amount: 1,
      target: { side: 'self', min: 1, max: 1 },
    })
  })

  it('BS3-022 Banquet of Victory: -1 attack + damage (break>=6)', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-022'))
    expect(trap).toBeTruthy()
    expect(trap!.condition).toEqual({ kind: 'break-level-at-least', level: 6 })
    expect(trap!.effects[0]).toMatchObject({ kind: 'modify-attack', amount: -1 })
    expect(trap!.effects[1]).toMatchObject({ kind: 'damage', amount: 1 })
  })
})

// =====================================
// 紅色 BS3 場景卡效果
// =====================================
describe('紅色 BS3 場景卡效果', () => {
  it('BS3-023 Passionate Hollyberry Kingdom: choose-one (modify-attack +1 or hp-to-hand)', () => {
    const stage = convertOfficialStageAbility(findBs3Card('BS3-023'))
    expect(stage).toBeTruthy()
    expect(stage!.effects[0]).toMatchObject({
      kind: 'choose-one',
      modes: [
        {
          label: 'During this turn, that Cookie gains +1 attack damage.',
          effects: [
            {
              kind: 'modify-attack',
              amount: 1,
              duration: 'this-turn',
              target: { side: 'self', min: 0, max: 1 },
            },
          ],
        },
        {
          label: "Return 1 card from the top of this Cookie's HP to your hand.",
          effects: [
            {
              kind: 'hp-to-hand',
              amount: 1,
              target: { side: 'self', min: 0, max: 1 },
            },
          ],
        },
      ],
    })
  })

  it('BS3-024 Dragon\'s Valley: modify-attack +2', () => {
    const stage = convertOfficialStageAbility(findBs3Card('BS3-024'))
    expect(stage).toBeTruthy()
    expect(stage!.effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: 2,
      duration: 'this-turn',
      target: { side: 'self', min: 0, max: 1 },
    })
  })
})

// =====================================
// 紅色 BS3 卡牌 - 完整轉換驗證
// =====================================
describe('紅色 BS3 卡牌完整轉換', () => {
  const redBs3Cards = [
    'BS3-001', 'BS3-002', 'BS3-003', 'BS3-004', 'BS3-005',
    'BS3-006', 'BS3-007', 'BS3-008', 'BS3-009', 'BS3-010',
    'BS3-011', 'BS3-012', 'BS3-013', 'BS3-014', 'BS3-015',
    'BS3-016', 'BS3-017', 'BS3-018', 'BS3-019', 'BS3-020',
    'BS3-021', 'BS3-022', 'BS3-023', 'BS3-024',
  ]

  redBs3Cards.forEach((cardNumber) => {
    it(`${cardNumber} has valid conversion`, () => {
      const card = findBs3Card(cardNumber)
      expect(card.color).toBe('RED')

      const conversion = convertOfficialCardEffects(card)
      // All cards should either be supported or unsupported with valid reason
      expect(['supported', 'unsupported']).toContain(conversion.status)
      if (conversion.status === 'unsupported') {
        expect(['no-effect-text', 'unsupported-effect-text']).toContain(conversion.reason)
      }
    })
  })
})

// =====================================
// 紅色 BS3 卡牌 - 特殊機制驗證
// =====================================
describe('紅色 BS3 卡牌特殊機制', () => {
  it('BS3-009 Wildberry Cookie: attack effect requires Soul Jam support', () => {
    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-009'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'damage',
      amount: 1,
      condition: { kind: 'support-keyword-at-least', keyword: 'soul-jam', count: 1 },
    })
  })

  it('BS3-010 Pitaya Dragon Cookie: your-turn skill', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-010'))
    expect(skill).toBeTruthy()
    expect(skill!.yourTurn).toBe(true)
  })

  it('BS3-013 Tiger Lily Cookie: attack reduces incoming damage', () => {
    const attackEffects = convertOfficialAttackEffects(findBs3Card('BS3-013'))
    expect(attackEffects).toBeTruthy()
    expect(attackEffects![0]).toMatchObject({
      kind: 'modify-damage-received',
      amount: 0,
      duration: 'opponent-next-turn',
      minimumDamage: 2,
      setDamageTo: 1,
    })
  })

  it('BS3-016 Tarte Tatin Cookie: once-per-turn activate', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-016'))
    expect(skill).toBeTruthy()
    expect(skill!.oncePerTurn).toBe(true)
    expect(skill!.trigger).toBe('activate')
  })

  it('BS3-017 Hollyberry Cookie: persistent damage reduction', () => {
    const effects = effectsOf('BS3-017')
    expect(effects[0]).toMatchObject({
      kind: 'modify-damage-received',
      duration: 'persistent',
      minimumDamage: 3,
      setDamageTo: 2,
    })
  })

  it('BS3-019 Soul Jam: Light of Passion: equip to Hollyberry Cookie', () => {
    const effects = effectsOf('BS3-019')
    expect(effects[1]).toMatchObject({
      kind: 'equip-source',
      requiredCookieId: 'BS3-017',
      attackBonus: 1,
    })
  })

  it('BS3-021 Oath on the Shield: trap with two effects', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-021'))
    expect(trap).toBeTruthy()
    expect(trap!.effects).toHaveLength(2)
  })

  it('BS3-022 Banquet of Victory: trap requires break LV.6+', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-022'))
    expect(trap).toBeTruthy()
    expect(trap!.condition).toEqual({ kind: 'break-level-at-least', level: 6 })
  })
})
