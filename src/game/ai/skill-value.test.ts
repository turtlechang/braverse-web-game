import { describe, expect, it } from 'vitest'
import {
  estimateAttackThreatValue,
  estimateSkillEffectValue,
  hasDerivedDefensiveSkill,
} from './skill-value'
import { evaluateHandQuality, MATCHUP_PROFILES } from './bs2MatchupProfiles'
import type { CardSkill, GameCard } from '../types'

const makeCard = (overrides: Partial<GameCard> = {}): GameCard => ({
  id: 'test-card',
  instanceId: 'test-card-1',
  name: 'Test Cookie',
  type: 'cookie',
  level: 2,
  hp: 3,
  attack: 2,
  attackCost: 1,
  ...overrides,
})

const passiveDamageSkill: CardSkill = {
  trigger: 'passive',
  oncePerTurn: false,
  yourTurn: false,
  restSource: false,
  cost: { energy: {}, discardHand: 0 },
  text: 'passive damage',
  effects: [
    { kind: 'damage', amount: 2, target: { side: 'opponent', min: 0, max: 1 } },
  ],
}

const costlyActivateDamageSkill: CardSkill = {
  ...passiveDamageSkill,
  trigger: 'activate',
  oncePerTurn: true,
  cost: { energy: { red: 3 }, discardHand: 1 },
}

const drawSkill: CardSkill = {
  trigger: 'on-play',
  oncePerTurn: false,
  yourTurn: false,
  restSource: false,
  cost: { energy: {}, discardHand: 0 },
  text: 'draw',
  effects: [{ kind: 'draw-up-to', max: 1 }],
}

const healSkill: CardSkill = {
  trigger: 'activate',
  oncePerTurn: false,
  yourTurn: false,
  restSource: false,
  cost: { energy: { blue: 1 }, discardHand: 0 },
  text: 'heal',
  effects: [{ kind: 'gain-hp', amount: 1 }],
}

const blockerSkill: CardSkill = {
  trigger: 'block',
  oncePerTurn: false,
  yourTurn: false,
  restSource: false,
  cost: { energy: { red: 1 }, discardHand: 0 },
  text: 'blocker',
  effects: [{ kind: 'redirect-attack', target: { side: 'self', min: 1, max: 1, sourceOnly: true } }],
}

describe('estimateSkillEffectValue', () => {
  it('無技能回傳 0，不假裝有中等效果', () => {
    expect(estimateSkillEffectValue(makeCard())).toBe(0)
  })

  it('免費被動傷害技能分數高於同強度但要付代價的 activate 技能', () => {
    const free = estimateSkillEffectValue(makeCard({ skill: passiveDamageSkill }))
    const costly = estimateSkillEffectValue(makeCard({ skill: costlyActivateDamageSkill }))
    expect(free).toBeGreaterThan(costly)
    expect(free).toBeGreaterThan(0)
    expect(costly).toBeGreaterThan(0)
  })

  it('抽牌／支援型技能給中等分數，不是 0', () => {
    const score = estimateSkillEffectValue(makeCard({ skill: drawSkill }))
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(8)
  })

  it('choose-one 取分數最高的那個模式估算', () => {
    const cleanSkill: CardSkill = {
      ...drawSkill,
      effects: [
        {
          kind: 'choose-one',
          modes: [
            {
              label: 'weak',
              effects: [{ kind: 'view-hp', target: { side: 'opponent', min: 0, max: 1 } }],
            },
            {
              label: 'strong',
              effects: [
                { kind: 'damage', amount: 3, target: { side: 'opponent', min: 0, max: 1 } },
              ],
            },
          ],
        },
      ],
    }
    const chooseOneScore = estimateSkillEffectValue(makeCard({ skill: cleanSkill }))
    const strongOnlyScore = estimateSkillEffectValue(
      makeCard({
        skill: {
          ...drawSkill,
          effects: [{ kind: 'damage', amount: 3, target: { side: 'opponent', min: 0, max: 1 } }],
        },
      }),
    )
    // choose-one 應該取到「strong」那個模式的分數，不是兩個模式的平均或最弱的
    expect(chooseOneScore).toBe(strongOnlyScore)
  })

  it('分數會封頂在 0–8 之間，不會爆表', () => {
    const hugeSkill: CardSkill = {
      ...passiveDamageSkill,
      effects: [
        { kind: 'damage', amount: 4, target: { side: 'opponent', min: 0, max: 1 } },
        { kind: 'damage-all', amount: 4, side: 'opponent' },
        { kind: 'gain-hp', amount: 4 },
        { kind: 'draw', amount: 4 },
      ],
    }
    const score = estimateSkillEffectValue(makeCard({ skill: hugeSkill }))
    expect(score).toBeLessThanOrEqual(8)
    expect(score).toBeGreaterThan(0)
  })
})

describe('hasDerivedDefensiveSkill', () => {
  it('無技能不算防守型', () => {
    expect(hasDerivedDefensiveSkill(makeCard())).toBe(false)
  })

  it('有回血效果算防守型', () => {
    expect(hasDerivedDefensiveSkill(makeCard({ skill: healSkill }))).toBe(true)
  })

  it('Blocker（block 觸發）算防守型，即使效果本身是 redirect-attack', () => {
    expect(hasDerivedDefensiveSkill(makeCard({ skill: blockerSkill }))).toBe(true)
  })

  it('純傷害技能不算防守型', () => {
    expect(hasDerivedDefensiveSkill(makeCard({ skill: passiveDamageSkill }))).toBe(false)
  })
})

describe('estimateAttackThreatValue', () => {
  it('攻擊力與等級越高，威脅值越高', () => {
    const weak = estimateAttackThreatValue(makeCard({ attack: 1, level: 1 }))
    const strong = estimateAttackThreatValue(makeCard({ attack: 4, level: 3 }))
    expect(strong).toBeGreaterThan(weak)
  })

  it('有主動傷害技能的餅乾威脅值更高', () => {
    const vanilla = estimateAttackThreatValue(makeCard({ attack: 2, level: 2 }))
    const withSkill = estimateAttackThreatValue(
      makeCard({ attack: 2, level: 2, skill: passiveDamageSkill }),
    )
    expect(withSkill).toBeGreaterThan(vanilla)
  })

  it('結果落在既有手刻表格使用的 10–95 區間內', () => {
    const value = estimateAttackThreatValue(makeCard({ attack: 4, level: 3, skill: passiveDamageSkill }))
    expect(value).toBeGreaterThanOrEqual(10)
    expect(value).toBeLessThanOrEqual(95)
  })

  it('非餅乾卡片不會爆炸，回傳合理預設值', () => {
    expect(() =>
      estimateAttackThreatValue({ id: 'x', instanceId: 'x', name: 'x', type: 'item' }),
    ).not.toThrow()
  })
})

/**
 * 回歸測試：evaluateHandQuality 的結果會拿去跟 turn-handler.ts 的絕對門檻
 * （>= 30）比較，不是相對排序，所以它的 fallback 不能換成 R6a 公式
 * （level*3+hp*2）。一般 Lv.1～2 起始卡套進這個公式落在 5～12 分，一旦
 * fallback 改用它，整手牌查無資料時 handQuality 會全部掉到 30 以下，AI
 * 從此拒絕鋪牌——這正是把 estimateSkillEffectValue／calculateReplacement-
 * BaseScore 直接套用到這個消費者身上會踩到的坑，此測試釘住正確行為。
 */
describe('evaluateHandQuality：查無資料的卡不能拖垮絕對門檻判斷', () => {
  it('整手都是查無資料的低等級卡，平均分數仍然要能通過 turn-handler 的 >=30 門檻', () => {
    const profile = MATCHUP_PROFILES.red
    const untabledStarterHand: GameCard[] = [
      makeCard({ id: 'untabled-1', level: 1, hp: 1 }),
      makeCard({ id: 'untabled-2', level: 1, hp: 2 }),
      makeCard({ id: 'untabled-3', level: 2, hp: 2 }),
    ]
    expect(evaluateHandQuality(untabledStarterHand, profile)).toBeGreaterThanOrEqual(30)
  })
})
