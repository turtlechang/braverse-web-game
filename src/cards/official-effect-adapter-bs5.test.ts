import { describe, expect, it } from 'vitest'
import officialBs5Candidates from '../../data/candidates/official-age-of-heroes-and-kingdoms-bs5.en.json'
import {
  convertOfficialAttackEffects,
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
  convertOfficialFlipAbility,
  convertOfficialItemAbility,
  convertOfficialStageAbility,
  convertOfficialTrapAbility,
  type OfficialCardRecord,
} from '.'

const bs5Cards = officialBs5Candidates.cards as OfficialCardRecord[]

const findBs5Card = (cardNumber: string): OfficialCardRecord => {
  const card = bs5Cards.find((c) => c.cardNumber === cardNumber)
  if (!card) throw new Error(`missing BS5 fixture: ${cardNumber}`)
  return card
}

describe('BS5 candidate RED effect adapter', () => {
  describe('主效果（exactStarterEffects）', () => {
    it('BS5-005 Mala Sauce Cookie 技能轉成對手下 1 傷害', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-005'))).toMatchObject({
        status: 'supported',
        effects: [
          { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } },
        ],
      })
    })

    it('BS5-010 Starch Noodle Cookie 登場效果限對手休息 LV.2 以下 2 傷害', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-010'))).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: {
              side: 'opponent',
              min: 0,
              max: 1,
              maxLevel: 2,
              restedOnly: true,
            },
          },
        ],
      })
    })

    it('BS5-013 Pitaya Dragon Cookie 登場效果對手下 1 傷害', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-013'))).toMatchObject({
        status: 'supported',
        effects: [
          { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } },
        ],
      })
    })

    it('BS5-014 Knight Cookie 技能目標是指定卡名 Pitaya Dragon Cookie', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-014'))).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: {
              side: 'opponent',
              min: 0,
              max: 1,
              cardName: 'Pitaya Dragon Cookie',
            },
          },
        ],
      })
    })

    it('BS5-015 Carol Cookie 登場效果對手下 1 傷害', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-015'))).toMatchObject({
        status: 'supported',
        effects: [
          { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } },
        ],
      })
    })

    it('BS5-016 Tiramisu Cookie 技能條件：代價棄掉的卡不是 Cookie 才傷害', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-016'))).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'last-hp-trash-card-non-cookie' },
          },
        ],
      })
    })

    it('BS5-018 Flat Tofu Cookie 登場效果對手下 1 傷害', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-018'))).toMatchObject({
        status: 'supported',
        effects: [
          { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } },
        ],
      })
    })

    it('BS5-019 Pudding Cookie 技能本回合自身攻擊 +1', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-019'))).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      })
    })

    it('BS5-020 Crimson Dragon Mask 道具：自身戰鬥區 1 HP 餅乾 2 張以上時對全部對手 2 傷害', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-020'))).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'damage-all',
            amount: 2,
            side: 'opponent',
            condition: {
              kind: 'battle-area-remaining-hp-count-at-least',
              side: 'self',
              remainingHp: 1,
              count: 2,
            },
          },
        ],
      })
    })

    it('BS5-021 Draconic Aura 陷阱主效果：攻擊 -1 與 HP 回手', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-021'))).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'modify-attack',
            amount: -1,
            duration: 'this-turn',
            target: { side: 'opponent', min: 0, max: 2 },
          },
          { kind: 'hp-to-hand', amount: 1, target: { side: 'self', min: 0, max: 1 } },
        ],
      })
    })

    it('BS5-022 Pitaya Dragon Cookie\'s Nest 場景主效果：costSelected 攻擊 +1 與指名條件抽 1', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-022'))).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, costSelected: true },
          },
          {
            kind: 'draw-up-to',
            max: 1,
            condition: {
              kind: 'battle-area-has-named-cookie',
              side: 'self',
              name: 'Pitaya Dragon Cookie',
            },
          },
        ],
      })
    })

    it('BS5-004 Lollipop Cookie 附著 +1 HP flip 主效果判定 supported', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-004'))).toMatchObject({
        status: 'supported',
      })
    })

    it('BS5-009 Butterbear Cookie flip 主效果轉成抽 1', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-009'))).toMatchObject({
        status: 'supported',
        effects: [{ kind: 'draw-up-to', max: 1 }],
      })
    })
  })

  describe('技能代價與觸發（exactCookieSkillCosts／triggers）', () => {
    it('BS5-005 Activate、Once Per Turn，代價 {R} + 自 {R} LV.2 以上餅乾 HP 棄 1', () => {
      expect(convertOfficialCookieSkill(findBs5Card('BS5-005'))).toMatchObject({
        trigger: 'activate',
        oncePerTurn: true,
        cost: {
          energy: { red: 1 },
          discardHand: 0,
          hpToTrash: { energyColor: 'red', minLevel: 2 },
        },
      })
    })

    it('BS5-013 On Play，代價棄 1 張手牌 {R} Cookie', () => {
      expect(convertOfficialCookieSkill(findBs5Card('BS5-013'))).toMatchObject({
        trigger: 'on-play',
        cost: {
          energy: {},
          discardHand: 1,
          discardHandColor: 'red',
          discardHandType: 'cookie',
        },
      })
    })

    it('BS5-014 Activate、Once Per Turn，無額外代價', () => {
      expect(convertOfficialCookieSkill(findBs5Card('BS5-014'))).toMatchObject({
        trigger: 'activate',
        oncePerTurn: true,
        cost: { energy: {}, discardHand: 0 },
      })
    })

    it('BS5-015 On Play，代價自其他餅乾 HP 棄 1', () => {
      expect(convertOfficialCookieSkill(findBs5Card('BS5-015'))).toMatchObject({
        trigger: 'on-play',
        cost: { energy: {}, discardHand: 0, hpToTrash: { excludeSource: true } },
      })
    })

    it('BS5-016 Activate、Once Per Turn，代價自自身 HP 棄 1', () => {
      expect(convertOfficialCookieSkill(findBs5Card('BS5-016'))).toMatchObject({
        trigger: 'activate',
        oncePerTurn: true,
        cost: { energy: {}, discardHand: 0, hpToTrash: { sourceOnly: true } },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'last-hp-trash-card-non-cookie' },
          },
        ],
      })
    })

    it('BS5-018 On Play，代價棄 1 張手牌 {R} 陷阱', () => {
      expect(convertOfficialCookieSkill(findBs5Card('BS5-018'))).toMatchObject({
        trigger: 'on-play',
        cost: {
          energy: {},
          discardHand: 1,
          discardHandColor: 'red',
          discardHandType: 'trap',
        },
      })
    })

    it('BS5-019 Activate、Once Per Turn，代價 {R} + 棄 1 張手牌 {R} Cookie', () => {
      expect(convertOfficialCookieSkill(findBs5Card('BS5-019'))).toMatchObject({
        trigger: 'activate',
        oncePerTurn: true,
        cost: {
          energy: { red: 1 },
          discardHand: 1,
          discardHandColor: 'red',
          discardHandType: 'cookie',
        },
      })
    })
  })

  describe('陷阱與場景能力', () => {
    it('BS5-021 Draconic Aura 陷阱：LV.3 Cookie 存在條件 + 兩個效果', () => {
      expect(convertOfficialTrapAbility(findBs5Card('BS5-021'))).toMatchObject({
        cost: { energy: { red: 1 } },
        condition: { kind: 'battle-area-has-cookie-with-level', level: 3 },
        effects: [
          {
            kind: 'modify-attack',
            amount: -1,
            duration: 'this-turn',
            target: { side: 'opponent', min: 0, max: 2 },
          },
          { kind: 'hp-to-hand', amount: 1, target: { side: 'self', min: 0, max: 1 } },
        ],
      })
    })

    it('BS5-022 Pitaya Dragon Cookie\'s Nest 場景：放置 {R}，啟動代價 {R} + 休息 + LV.2 以上 HP 棄 1', () => {
      const stage = convertOfficialStageAbility(findBs5Card('BS5-022'))
      expect(stage).toBeDefined()
      expect(stage?.cost).toMatchObject({
        energy: { red: 1 },
        discardHand: 0,
        hpToTrash: { minLevel: 2 },
      })
      expect(stage?.restSource).toBe(true)
      expect(stage?.effects).toMatchObject([
        {
          kind: 'modify-attack',
          amount: 1,
          duration: 'this-turn',
          target: { side: 'self', min: 1, max: 1, costSelected: true },
        },
        {
          kind: 'draw-up-to',
          max: 1,
          condition: {
            kind: 'battle-area-has-named-cookie',
            side: 'self',
            name: 'Pitaya Dragon Cookie',
          },
        },
      ])
    })
  })

  describe('flip 能力', () => {
    it('BS5-004 Lollipop Cookie flip：棄 1 卡代價 + attachedHpBonus 1', () => {
      expect(convertOfficialFlipAbility(findBs5Card('BS5-004'))).toMatchObject({
        cost: { energy: {}, discardHand: 1 },
        effects: [],
        attachedHpBonus: 1,
      })
    })

    it('BS5-009 Butterbear Cookie flip：抽 1', () => {
      expect(convertOfficialFlipAbility(findBs5Card('BS5-009'))).toMatchObject({
        cost: { energy: {}, discardHand: 0 },
        effects: [{ kind: 'draw-up-to', max: 1 }],
      })
    })
  })

  describe('攻擊 Then（exactAttackEffects）', () => {
    it('BS5-003 Strawberry Cream：棄 1 卡後打被攻擊的餅乾 1 傷害', () => {
      expect(convertOfficialAttackEffects(findBs5Card('BS5-003'))).toMatchObject([
        { kind: 'discard-hand', count: 1 },
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        },
      ])
    })

    it('BS5-006 Marshmallow：休息區 LV.6 以上才打 1 傷害', () => {
      expect(convertOfficialAttackEffects(findBs5Card('BS5-006'))).toMatchObject([
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
          condition: { kind: 'break-level-at-least', level: 6 },
        },
      ])
    })

    it('BS5-008 Chestnut：被攻擊餅乾剩餘 HP 3 以上才打 1', () => {
      expect(convertOfficialAttackEffects(findBs5Card('BS5-008'))).toMatchObject([
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
          condition: { kind: 'attack-target-remaining-hp-at-least', amount: 3 },
        },
      ])
    })

    it('BS5-010 Starch Noodle：自身 HP 棄 1 後抽 1', () => {
      expect(convertOfficialAttackEffects(findBs5Card('BS5-010'))).toMatchObject([
        {
          kind: 'hp-to-trash',
          amount: 1,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        },
        { kind: 'draw-up-to', max: 1 },
      ])
    })

    it('BS5-012 Eggnog：被攻擊餅乾是 LV.3 才打 1', () => {
      expect(convertOfficialAttackEffects(findBs5Card('BS5-012'))).toMatchObject([
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
          condition: { kind: 'attack-target-level-equals', level: 3 },
        },
      ])
    })

    it('BS5-013 Pitaya Dragon：自身剩餘 HP 4 以下時選至多 2 張各 1 傷害', () => {
      expect(convertOfficialAttackEffects(findBs5Card('BS5-013'))).toMatchObject([
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 2 },
          condition: { kind: 'source-hp-less-than', amount: 5 },
        },
      ])
    })
  })

  describe('異畫變體共用基礎規則', () => {
    it('BS5-013@1 的登場技能與基礎版本一致', () => {
      const variant = convertOfficialCookieSkill(findBs5Card('BS5-013@1'))
      expect(variant).toMatchObject({
        trigger: 'on-play',
        cost: {
          energy: {},
          discardHand: 1,
          discardHandColor: 'red',
          discardHandType: 'cookie',
        },
        effects: [
          { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } },
        ],
      })
    })

    it('BS5-014@1 的技能與基礎版本一致（指名 Pitaya Dragon Cookie 2 傷害）', () => {
      const variant = convertOfficialCookieSkill(findBs5Card('BS5-014@1'))
      expect(variant).toMatchObject({
        trigger: 'activate',
        oncePerTurn: true,
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1, cardName: 'Pitaya Dragon Cookie' },
          },
        ],
      })
    })
  })
})

describe('BS5 candidate YELLOW effect adapter', () => {
  describe('主效果（exactStarterEffects）', () => {
    it('BS5-023 Dino-Sour Cookie 啟動技能：自身 HP 棄 3 後本回合攻擊 +2', () => {
      expect(convertOfficialCookieSkill(findBs5Card('BS5-023'))).toMatchObject({
        trigger: 'activate',
        oncePerTurn: true,
        cost: { hpToTrash: { amount: 3, sourceOnly: true } },
        effects: [
          {
            kind: 'modify-attack',
            amount: 2,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      })
    })

    it('BS5-026 DJ Cookie faint 技能：手牌黃色 LV.2 以下放休息區 + 自身回手', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-026'))).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'hand-to-break',
            amount: 1,
            energyColor: 'yellow',
            maxLevel: 2,
          },
          {
            kind: 'return-to-hand',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      })
      expect(convertOfficialCookieSkill(findBs5Card('BS5-026'))).toMatchObject({
        faint: true,
        effects: [
          { kind: 'hand-to-break', amount: 1, energyColor: 'yellow', maxLevel: 2 },
          { kind: 'return-to-hand', target: { side: 'self', min: 1, max: 1, sourceOnly: true } },
        ],
      })
    })

    it('BS5-028 Mango Cookie 登場效果：休息區 LV.3 以上才對對手休息中 LV.2 以下 2 傷害', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-028'))).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: {
              side: 'opponent',
              min: 0,
              max: 1,
              maxLevel: 2,
              restedOnly: true,
            },
            condition: { kind: 'break-level-at-least', level: 3 },
          },
        ],
      })
    })

    it('BS5-029 Mustard Cookie 登場效果：休息區有黃色 LV.3 餅乾才抽至多 1', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-029'))).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'draw-up-to',
            max: 1,
            condition: {
              kind: 'break-area-has-card',
              side: 'self',
              color: 'yellow',
              minLevel: 3,
              maxLevel: 3,
            },
          },
        ],
      })
    })

    it('BS5-031 Peach Cookie 登場效果：己方休息區 LV. 高於對手才抽至多 1', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-031'))).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'draw-up-to',
            max: 1,
            condition: { kind: 'break-level-higher-than-opponent' },
          },
        ],
      })
    })

    it('BS5-036 Milk Cookie 啟動技能：{Y} + 休息 + 棄 1 卡，使對手無技能 LV.1 餅乾昏厥', () => {
      expect(convertOfficialCookieSkill(findBs5Card('BS5-036'))).toMatchObject({
        trigger: 'activate',
        restSource: true,
        cost: { energy: { yellow: 1 }, discardHand: 1 },
        effects: [
          {
            kind: 'make-faint',
            target: {
              side: 'opponent',
              min: 0,
              max: 1,
              maxLevel: 1,
              noSkillOnly: true,
            },
          },
        ],
      })
    })

    it('BS5-039 Cheesecake Cookie 登場效果：對手 LV.2 以下、剩餘 HP 3 以上 1 傷害', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-039'))).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: {
              side: 'opponent',
              min: 0,
              max: 1,
              maxLevel: 2,
              minRemainingHp: 3,
            },
          },
        ],
      })
    })

    it('BS5-040 Ananas Dragon Cookie 啟動技能：自身 HP 棄 1 後選至多 1 張對手 1 傷害', () => {
      expect(convertOfficialCookieSkill(findBs5Card('BS5-040'))).toMatchObject({
        trigger: 'activate',
        oncePerTurn: true,
        cost: { hpToTrash: { amount: 1, sourceOnly: true } },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
    })
  })

  describe('道具與場景能力', () => {
    it('BS5-042 Sniffly Cocoa Palm 道具：{Y} + 己方餅乾 HP 棄 1，休息區 LV.5 以上抽至多 2', () => {
      expect(convertOfficialItemAbility(findBs5Card('BS5-042'))).toMatchObject({
        cost: { energy: { yellow: 1 }, discardHand: 0, hpToTrash: { amount: 1 } },
      })
      expect(convertOfficialCardEffects(findBs5Card('BS5-042'))).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'draw-up-to',
            max: 2,
            condition: { kind: 'break-level-at-least', level: 5 },
          },
        ],
      })
    })

    it('BS5-044 Ananas Dragon Cookie\'s Nest 場景：{Y} 放置，啟動 {Y} + 休息，本回合有餅乾獲得 HP 才 1 傷害，然後 Ananas Dragon Cookie +1 HP', () => {
      const stage = convertOfficialStageAbility(findBs5Card('BS5-044'))
      expect(stage).toBeDefined()
      expect(stage?.cost).toMatchObject({
        energy: { yellow: 1 },
        discardHand: 0,
      })
      expect(stage?.restSource).toBe(true)
      expect(stage?.effects).toMatchObject([
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
          condition: { kind: 'cookie-gained-hp-this-turn' },
        },
        {
          kind: 'gain-hp',
          amount: 1,
          target: {
            side: 'self',
            min: 0,
            max: 1,
            cardName: 'Ananas Dragon Cookie',
          },
        },
      ])
    })
  })

  describe('攻擊 Then（exactAttackEffects）', () => {
    it('BS5-023 Dino-Sour Cookie：自身剩餘 HP 3 以下時 +1 HP', () => {
      expect(convertOfficialAttackEffects(findBs5Card('BS5-023'))).toMatchObject([
        {
          kind: 'gain-hp',
          amount: 1,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          condition: { kind: 'source-hp-less-than', amount: 4 },
        },
      ])
    })

    it('BS5-024 Dr. Wasabi Cookie：被攻擊餅乾剩餘 HP 2 以下時 1 傷害', () => {
      expect(convertOfficialAttackEffects(findBs5Card('BS5-024'))).toMatchObject([
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
          condition: { kind: 'attack-target-remaining-hp-at-most', amount: 2 },
        },
      ])
    })

    it('BS5-025 Leek Cookie：自身剩餘 HP 1 時回手', () => {
      expect(convertOfficialAttackEffects(findBs5Card('BS5-025'))).toMatchObject([
        {
          kind: 'return-to-hand',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          condition: { kind: 'source-hp-less-than', amount: 2 },
        },
      ])
    })

    it('BS5-030 Buttercream Choco Cookie：自身進休息區後，休息區選 1 張黃色 LV.1 上場', () => {
      expect(convertOfficialAttackEffects(findBs5Card('BS5-030'))).toMatchObject([
        {
          kind: 'battle-to-break',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        },
        {
          kind: 'break-to-battle',
          amount: 1,
          exactLevel: 1,
          energyColor: 'yellow',
        },
      ])
    })

    it('BS5-032 Birthday Cake Cookie：己方休息區 LV. 高於對手才 1 傷害', () => {
      expect(convertOfficialAttackEffects(findBs5Card('BS5-032'))).toMatchObject([
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
          condition: { kind: 'break-level-higher-than-opponent' },
        },
      ])
    })

    it('BS5-035 Artichoke Cookie：自身剩餘 HP 1 時選至多 1 張對手 1 傷害', () => {
      expect(convertOfficialAttackEffects(findBs5Card('BS5-035'))).toMatchObject([
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
          condition: { kind: 'source-hp-less-than', amount: 2 },
        },
      ])
    })

    it('BS5-040 Ananas Dragon Cookie：自身剩餘 HP 4 以下時 +1 HP', () => {
      expect(convertOfficialAttackEffects(findBs5Card('BS5-040'))).toMatchObject([
        {
          kind: 'gain-hp',
          amount: 1,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          condition: { kind: 'source-hp-less-than', amount: 5 },
        },
      ])
    })
  })
})

describe('BS5 candidate GREEN effect adapter', () => {
  describe('主效果（exactStarterEffects）', () => {
    it('BS5-045 Potato Cookie 登場效果：支援區回手 1（可選）後抽至多 1', () => {
      expect(convertOfficialCookieSkill(findBs5Card('BS5-045'))).toMatchObject({
        trigger: 'on-play',
        cost: { energy: {}, discardHand: 0 },
        effects: [
          { kind: 'support-to-hand', amount: 1, optional: true },
          { kind: 'draw-up-to', max: 1 },
        ],
      })
    })

    it('BS5-048 Bellflower Cookie 啟動技能：{G} + 休息 + 棄 1 卡，使對手無技能 LV.1 餅乾昏厥', () => {
      expect(convertOfficialCookieSkill(findBs5Card('BS5-048'))).toMatchObject({
        trigger: 'activate',
        restSource: true,
        cost: { energy: { green: 1 }, discardHand: 1 },
        effects: [
          {
            kind: 'make-faint',
            target: {
              side: 'opponent',
              min: 0,
              max: 1,
              maxLevel: 1,
              noSkillOnly: true,
            },
          },
        ],
      })
    })

    it('BS5-051 Beet Cookie 被動回合結束效果：支援區 2 張以上啟動卡時自己回牌庫底', () => {
      const skill = convertOfficialCookieSkill(findBs5Card('BS5-051'))
      expect(skill).toBeDefined()
      expect(skill).toMatchObject({
        trigger: 'passive',
        endPhase: true,
        cost: { energy: {}, discardHand: 0 },
        effects: [
          {
            kind: 'return-to-deck-bottom',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
            condition: { kind: 'active-support-count-at-least', count: 2 },
          },
        ],
      })
    })

    it('BS5-053 Shine Muscat Cookie 登場效果：{G}{G} 代價，牌庫頂至多 1 張進支援區橫置', () => {
      expect(convertOfficialCookieSkill(findBs5Card('BS5-053'))).toMatchObject({
        trigger: 'on-play',
        cost: { energy: { green: 2 }, discardHand: 0 },
        effects: [{ kind: 'deck-to-support', amount: 1, rested: true }],
      })
    })

    it('BS5-056 Longan Dragon Cookie 被動回合結束效果：支援區 3 張以上啟動卡時對手下 2 傷害', () => {
      expect(convertOfficialCookieSkill(findBs5Card('BS5-056'))).toMatchObject({
        trigger: 'passive',
        endPhase: true,
        cost: { energy: {}, discardHand: 0 },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'active-support-count-at-least', count: 3 },
          },
        ],
      })
    })

    it('BS5-058 Ginseng Cookie 被動回合結束效果：支援區 3 張以下時抽至多 1', () => {
      expect(convertOfficialCookieSkill(findBs5Card('BS5-058'))).toMatchObject({
        trigger: 'passive',
        endPhase: true,
        effects: [
          {
            kind: 'draw-up-to',
            max: 1,
            condition: { kind: 'support-count-at-most', count: 3 },
          },
        ],
      })
    })

    it('BS5-059 Purple Yam Cookie 登場效果：對手休息中 LV.2 以下 2 傷害', () => {
      expect(convertOfficialCookieSkill(findBs5Card('BS5-059'))).toMatchObject({
        trigger: 'on-play',
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: {
              side: 'opponent',
              min: 0,
              max: 1,
              maxLevel: 2,
              restedOnly: true,
            },
          },
        ],
      })
    })

    it('BS5-063 Hero Cookie 被動回合結束效果：支援區 2 張以上啟動卡時抽至多 2', () => {
      expect(convertOfficialCookieSkill(findBs5Card('BS5-063'))).toMatchObject({
        trigger: 'passive',
        endPhase: true,
        effects: [
          {
            kind: 'draw-up-to',
            max: 2,
            condition: { kind: 'active-support-count-at-least', count: 2 },
          },
        ],
      })
    })
  })

  describe('道具／陷阱／場景能力', () => {
    it('BS5-064 Dragon Orb 道具：{G}{G}{G}，牌庫頂至多 1 張進支援區橫置，支援區 7 張以上再抽至多 1', () => {
      expect(convertOfficialItemAbility(findBs5Card('BS5-064'))).toMatchObject({
        cost: { green: 3 },
        effects: [
          { kind: 'deck-to-support', amount: 1, rested: true },
          {
            kind: 'draw-up-to',
            max: 1,
            condition: { kind: 'support-count-at-least', count: 7 },
          },
        ],
      })
    })

    it('BS5-065 Petrification 陷阱：無發動門檻，本回合攻擊 -2，Then 對手橫置 1 張啟動中支援卡', () => {
      const trap = convertOfficialTrapAbility(findBs5Card('BS5-065'))
      expect(trap).toBeDefined()
      expect(trap?.condition).toBeUndefined()
      expect(trap?.effects).toMatchObject([
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'opponent-rests-support',
          amount: 1,
          activeOnly: true,
          condition: { kind: 'support-count-at-least', count: 7 },
        },
      ])
    })

    it('BS5-066 Longan Palace 場景：{G} 放置，被動回合結束觸發（非手動啟動）', () => {
      const stage = convertOfficialStageAbility(findBs5Card('BS5-066'))
      expect(stage).toBeDefined()
      expect(stage?.placementCost).toMatchObject({ green: 1 })
      expect(stage?.cost).toMatchObject({ energy: {}, discardHand: 0 })
      expect(stage?.endPhase).toBe(true)
      expect(stage?.effects).toMatchObject([
        { kind: 'discard-hand', count: 1 },
        { kind: 'set-active', supportCount: 1 },
        {
          kind: 'draw-up-to',
          max: 1,
          condition: {
            kind: 'battle-area-has-named-cookie',
            side: 'self',
            name: 'Longan Dragon Cookie',
          },
        },
      ])
    })
  })

  describe('攻擊 Then（exactAttackEffects）', () => {
    it('BS5-056 Longan Dragon Cookie：Then, when your turn ends, 支援區至多 1 張啟動', () => {
      expect(convertOfficialAttackEffects(findBs5Card('BS5-056'))).toMatchObject([
        {
          kind: 'deferred-end-of-turn',
          effects: [{ kind: 'set-active', supportCount: 1 }],
        },
      ])
    })

    it('BS5-059 Purple Yam Cookie：Then 支援區回手 1（可選）後抽至多 1', () => {
      expect(convertOfficialAttackEffects(findBs5Card('BS5-059'))).toMatchObject([
        { kind: 'support-to-hand', amount: 1, optional: true },
        { kind: 'draw-up-to', max: 1 },
      ])
    })

    it('BS5-060 Croissant Cookie：Then, when your turn ends, 支援區至多 3 張啟動', () => {
      expect(convertOfficialAttackEffects(findBs5Card('BS5-060'))).toMatchObject([
        {
          kind: 'deferred-end-of-turn',
          effects: [{ kind: 'set-active', supportCount: 3 }],
        },
      ])
    })
  })

  describe('異畫變體共用規則', () => {
    it('BS5-056@1 與本體共用相同技能效果', () => {
      expect(convertOfficialCardEffects(findBs5Card('BS5-056@1'))).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'active-support-count-at-least', count: 3 },
          },
        ],
      })
    })
  })
})
