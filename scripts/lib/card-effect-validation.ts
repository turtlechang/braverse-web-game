import type { GameCard } from '../../src/game/types'
import type { OfficialCardRecord } from '../../src/cards/types'
import { P_FLAVOR_ONLY_SKILL_CARD_NUMBERS } from '../../src/cards/p-card-effects'

interface SemanticExpectation {
  path: string
  expected: unknown
}

interface CardSemanticContract {
  reason: string
  expectations: SemanticExpectation[]
}

/**
 * 容易因代價、條件、可選性或複合效果而「有 payload 但語意錯誤」的卡牌。
 * 這份契約刻意只鎖定高風險欄位；新增或修改契約時仍須人工比對官方文字。
 */
export const HIGH_RISK_CARD_SEMANTIC_CONTRACTS: Record<string, CardSemanticContract> = {
  'ST2-018': {
    reason: 'Then 複合效果必須依序保留抽牌與可選查看 HP',
    expectations: [
      { path: 'item.effects.length', expected: 2 },
      { path: 'item.effects.0.kind', expected: 'draw' },
      { path: 'item.effects.1.kind', expected: 'view-hp' },
      { path: 'item.effects.1.optional', expected: true },
    ],
  },
  'ST5-007': {
    reason: 'Activate、每回合一次、棄手牌代價與場上目標不可缺漏',
    expectations: [
      { path: 'skill.trigger', expected: 'activate' },
      { path: 'skill.oncePerTurn', expected: true },
      { path: 'skill.cost.energy.purple', expected: 1 },
      { path: 'skill.cost.discardHand', expected: 1 },
      { path: 'skill.effects.0.kind', expected: 'field-to-trash' },
      { path: 'skill.effects.0.target.side', expected: 'opponent' },
      { path: 'skill.effects.0.target.maxLevel', expected: 1 },
      { path: 'skill.effects.0.allowStage', expected: true },
    ],
  },
  'ST5-022': {
    reason: '對手戰鬥場離場觸發必須保留橫置與可選抽牌',
    expectations: [
      { path: 'stageAbility.placementCost.purple', expected: 2 },
      { path: 'stageAbility.triggered', expected: true },
      { path: 'stageAbility.restSource', expected: true },
      { path: 'stageAbility.effects.0.kind', expected: 'draw-up-to' },
      { path: 'stageAbility.effects.0.max', expected: 1 },
    ],
  },
  'BS2-056': {
    reason: 'FLIP 棄手牌代價與增加 HP 必須同時存在',
    expectations: [
      { path: 'flip.cost.discardHand', expected: 1 },
      { path: 'flip.effects.0.kind', expected: 'gain-hp' },
      { path: 'flip.effects.0.amount', expected: 1 },
    ],
  },
  'BS2-058': {
    reason: '攻擊追加傷害必須檢查來源玩家自己的棄牌區',
    expectations: [
      { path: 'attackEffects.0.kind', expected: 'damage' },
      { path: 'attackEffects.0.amount', expected: 1 },
      { path: 'attackEffects.0.condition.kind', expected: 'trash-count-at-least' },
      { path: 'attackEffects.0.condition.count', expected: 15 },
    ],
  },
  'BS2-077': {
    reason: '物品的紫色 LV.1 餅乾代價不可只轉出傷害',
    expectations: [
      { path: 'item.cost.trashBattleCookie.count', expected: 1 },
      { path: 'item.cost.trashBattleCookie.level', expected: 1 },
      { path: 'item.cost.trashBattleCookie.energyColor', expected: 'purple' },
      { path: 'item.effects.0.kind', expected: 'damage' },
      { path: 'item.effects.0.amount', expected: 2 },
    ],
  },
  'BS2-079': {
    reason: 'Then 後的非 FLIP 棄牌洗回牌庫不可遺失',
    expectations: [
      { path: 'trap.effects.length', expected: 2 },
      { path: 'trap.effects.0.kind', expected: 'modify-attack' },
      { path: 'trap.effects.0.amount', expected: -1 },
      { path: 'trap.effects.1.kind', expected: 'trash-to-deck' },
      { path: 'trap.effects.1.max', expected: 5 },
      { path: 'trap.effects.1.excludeFlip', expected: true },
    ],
  },
  'BS2-080': {
    reason: '陷阱條件必須檢查陷阱擁有者自己的棄牌數',
    expectations: [
      { path: 'trap.condition.kind', expected: 'opponent-trash-count-at-least' },
      { path: 'trap.condition.count', expected: 15 },
      { path: 'trap.effects.0.kind', expected: 'modify-attack' },
      { path: 'trap.effects.0.amount', expected: -3 },
    ],
  },
}

const getValueAtPath = (value: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((current, segment) => {
    if (segment === 'length' && Array.isArray(current)) return current.length
    if (current === null || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[segment]
  }, value)

const collectEffects = (card: GameCard) => [
  ...(card.skill?.effects ?? []),
  ...(card.flip?.effects ?? []),
  ...(card.item?.effects ?? []),
  ...(card.trap?.effects ?? []),
  ...(card.stageAbility?.effects ?? []),
  ...(card.attackEffects ?? []),
]

export const validateCardEffectSemantics = (
  entry: OfficialCardRecord,
  card: GameCard,
): string[] => {
  const errors: string[] = []
  const label = `${entry.cardNumber} ${entry.name}`
  const hasFlavorOnlySkill = P_FLAVOR_ONLY_SKILL_CARD_NUMBERS.has(
    entry.baseCardNumber,
  )

  if (entry.type === 'cookie' && entry.skill.text) {
    if (!hasFlavorOnlySkill && (!card.skill || card.skill.effects.length === 0)) {
      errors.push(`${label}: 技能文字必須轉出含至少 1 個效果的 skill`)
    }

    if (/\{mob\}/i.test(entry.skill.text) && card.skill?.trigger !== 'activate') {
      errors.push(`${label}: {mob} 技能必須轉為 activate`)
    }
    if (/\{ap\}/i.test(entry.skill.text) && card.skill?.trigger !== 'on-play') {
      errors.push(`${label}: {ap} 技能必須轉為 on-play`)
    }
    if (/\{t1\}/i.test(entry.skill.text) && card.skill?.oncePerTurn !== true) {
      errors.push(`${label}: {t1} 技能必須標記 oncePerTurn`)
    }
    if (/\{mt\}/i.test(entry.skill.text) && card.skill?.yourTurn !== true) {
      errors.push(`${label}: {mt} 技能必須標記 yourTurn`)
    }
  }

  if (
    entry.type === 'flip' &&
    entry.flipText &&
    (!card.flip ||
      (card.flip.effects.length === 0 &&
        card.flip.attachedHpBonus === undefined))
  ) {
    errors.push(`${label}: FLIP 文字必須轉出含至少 1 個效果的 flip`)
  }
  if (entry.type === 'item' && entry.attackText && (!card.item || card.item.effects.length === 0)) {
    errors.push(`${label}: 物品文字必須轉出含至少 1 個效果的 item`)
  }
  if (entry.type === 'trap' && entry.attackText && (!card.trap || card.trap.effects.length === 0)) {
    errors.push(`${label}: 陷阱文字必須轉出含至少 1 個效果的 trap`)
  }
  if (
    entry.type === 'stage' &&
    entry.attackText &&
    (!card.stageAbility ||
      (card.stageAbility.effects.length === 0 && !card.stageAbility.specialVictory))
  ) {
    errors.push(`${label}: 場景文字必須轉出含至少 1 個效果的 stageAbility`)
  }

  const allSourceText = [entry.skill.text, entry.attackText, entry.flipText]
    .filter((text): text is string => Boolean(text))
    .join('\n')
  const effects = collectEffects(card)
  for (const match of allSourceText.matchAll(/You can draw\s+(\d+)\s+cards?/gi)) {
    const max = Number(match[1])
    if (!effects.some((effect) =>
      (effect.kind === 'draw-up-to' || effect.kind === 'draw-up-to-then-discard') &&
      effect.max === max,
    )) {
      errors.push(`${label}: "You can draw ${max}" 必須轉為 draw-up-to(${max})`)
    }
  }

  if (
    entry.type !== 'stage' &&
    /rest this card|card rests/i.test(entry.skill.text ?? '') &&
    card.skill?.restSource !== true
  ) {
    errors.push(`${label}: 技能文字要求橫置來源，但 skill.restSource 未設定`)
  }
  // 場景卡的橫置文字可能落在 skill.text 或 attackText 任一欄位（例如 BS3-095@2
  // 這個異畫版本，官方來源把安置與啟動文字都塞進 skill.text、attackText 是 null）。
  if (
    entry.type === 'stage' &&
    /rest this card|card rests/i.test(`${entry.skill.text ?? ''}\n${entry.attackText ?? ''}`) &&
    card.stageAbility?.restSource !== true
  ) {
    errors.push(`${label}: 場景文字要求橫置來源，但 stageAbility.restSource 未設定`)
  }

  const contract = HIGH_RISK_CARD_SEMANTIC_CONTRACTS[entry.baseCardNumber]
  if (contract) {
    for (const expectation of contract.expectations) {
      const actual = getValueAtPath(card, expectation.path)
      if (!Object.is(actual, expectation.expected)) {
        errors.push(
          `${label}: 高風險語意契約不符（${contract.reason}）` +
          `；${expectation.path} 預期 ${JSON.stringify(expectation.expected)}` +
          `，實際 ${JSON.stringify(actual)}`,
        )
      }
    }
  }

  return errors
}
