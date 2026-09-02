import type {
  AbilityCost,
  EnergyCost,
  CardAbility,
  CardSkill,
  CardEffect,
  EndPhaseScope,
  EffectCondition,
  EffectTargetSelector,
  FlipAbility,
  TrapAbility,
  StageAbility,
  StageAttackCostModifier,
  ReturnToHandEffect,
  SkillTrigger,
} from '../game'
import { parseOfficialCardText } from './official-text-parser'
import type { OfficialCardRecord } from './types'
import {
  P_EXACT_ATTACK_EFFECTS,
  P_EXACT_EFFECTS,
  P_EXACT_FLIP_EFFECTS,
  P_EXACT_ITEM_ACTIVATION_COST_OVERRIDES,
  P_EXACT_SKILL_COSTS,
  P_EXACT_SPECIAL_PLAY_COSTS,
  P_EXACT_SKILL_TRIGGERS,
  P_FROM_SUPPORT,
  P_FROM_TRASH,
  P_SOURCE_ENERGY,
} from './p-card-effects'

export type OfficialEffectConversion =
  | {
      status: 'supported'
      cardNumber: string
      sourceText: string
      effects: CardEffect[]
    }
  | {
      status: 'unsupported'
      cardNumber: string
      sourceText: string | null
      reason: 'no-effect-text' | 'unsupported-effect-text'
    }

// 官方文字對「Rest this card.」的措辭不一致，BS2-051 用「Card Rests.」，需一併比對
const RESTS_THIS_CARD_PATTERN = /Rest this card|Card Rests/i
const STAGE_ACTIVATE_MARKER_PATTERN = /\{mob\}|【Activate】/i
// 昏厥觸發措辭不一致：多數卡是「When this Cookie faints」，P-011 用「If this Cookie has fainted」
const FAINT_TRIGGER_PATTERN = /When this Cookie faints|If this Cookie has fainted/i

const YOUR_TURN_END_PHASE_PATTERN =
  /(?:when (?:your|this) turn ends|at the end of (?:your|this) turn)/i
const OPPONENT_TURN_END_PHASE_PATTERN =
  /(?:when (?:your )?opponent[’']s turn ends|at the end of (?:your |the )?opponent[’']s turn)/i

const getEndPhaseScope = (text: string): EndPhaseScope | undefined => {
  if (OPPONENT_TURN_END_PHASE_PATTERN.test(text)) return 'opponent-turn'
  if (YOUR_TURN_END_PHASE_PATTERN.test(text)) return 'your-turn'
  return undefined
}

const getEffectText = (card: OfficialCardRecord): string | null => {
  if (card.type === 'cookie') {
    return card.skill.text
  }

  if (card.type === 'flip') {
    // 部分官方 FLIP 記錄將效果文案放在 skill.text；runtime 仍須視為 FLIP。
    return card.flipText ?? card.skill.text
  }

  return card.skill.text ?? card.attackText
}

const parseTarget = (text: string): EffectTargetSelector | null => {
  const match = text.match(
    /Select\s+(up to\s+)?(\d+)\s+of\s+(your opponent's|your)(\s+other)?(?:\s+\{[RYGBPKN]\})?\s+(?:LV\.(\d+)\s+)?Cookies/i,
  )

  if (match) {
    const target: EffectTargetSelector = {
      side: match[3].toLowerCase().includes("opponent's")
        ? 'opponent'
        : 'self',
      min: match[1] ? 0 : Number(match[2]),
      max: Number(match[2]),
    }

    if (match[4]) {
      target.excludeSource = true
    }

    if (match[5]) {
      target.maxLevel = Number(match[5])
    }

    const textAfterTarget = text.slice(match.index ?? 0)
    const remainingHpMatch = textAfterTarget.match(
      /remaining HP is (\d+)(\s+or more)?/i,
    )
    const minimumLevelMatch = textAfterTarget.match(/LV\.(\d+) or higher/i)

    if (remainingHpMatch) {
      if (remainingHpMatch[2]) {
        target.minRemainingHp = Number(remainingHpMatch[1])
      } else {
        target.remainingHp = Number(remainingHpMatch[1])
      }
    }

    if (minimumLevelMatch) {
      target.minLevel = Number(minimumLevelMatch[1])
    }

    return target
  }

  if (/\bthis Cookie\b/i.test(text)) {
    return {
      side: 'self',
      min: 1,
      max: 1,
      sourceOnly: true,
    }
  }

  return null
}

const parseCondition = (text: string): EffectCondition | undefined => {
  const breakLevelMatch = text.match(/break area is LV\.(\d+) or higher/i)
  if (breakLevelMatch) {
    return {
      kind: 'break-level-at-least',
      level: Number(breakLevelMatch[1]),
    }
  }

  // 官方文字用詞順序不一致：「contains N or more cards」與「contains N cards or more」都有。
  const supportCountMatch = text.match(
    /support area contains?\s+(\d+)\s+(?:cards?\s+or\s+more|or\s+more\s+cards?)/i,
  )
  if (supportCountMatch) {
    return {
      kind: 'support-count-at-least',
      count: Number(supportCountMatch[1]),
    }
  }

  const handCountAtMostMatch = text.match(/(\d+) cards? or less in your hand/i)
  if (handCountAtMostMatch) {
    return {
      kind: 'hand-count-at-most',
      count: Number(handCountAtMostMatch[1]),
    }
  }

  // BS4-083「if your hand contains 5 cards or more」。
  const handCountAtLeastMatch = text.match(
    /your hand contains?\s+(\d+)\s+cards?\s+or\s+more/i,
  )
  return handCountAtLeastMatch
    ? { kind: 'hand-count-at-least', count: Number(handCountAtLeastMatch[1]) }
    : undefined
}

const isUnsupportedBracketCost = (text: string): boolean => {
  const brackets = text.match(BRACKET_COST_RE) ?? []

  for (const bracket of brackets) {
    const inner = bracket.slice(1, -1).trim()

    if (/^(?:\{[A-Z]\})+$/.test(inner)) {
      continue
    }

    if (/^Discard\s+\d+\s+card(?:s)?\.?$/i.test(inner)) {
      continue
    }

    if (
      /^Place\s+\d+\s+card(?:s)?\s+from\s+your\s+support\s+area\s+into\s+the\s+trash\.?$/i.test(
        inner,
      )
    ) {
      continue
    }

    if (
      /Place\s+.+Cookie\s+from\s+your\s+battle\s+area\s+into\s+the\s+trash/i.test(
        inner,
      )
    ) {
      continue
    }

    if (
      /^Place\s+\d+\s+(?:\{[A-Z]\}\s+)?Cookie\s+from\s+your\s+hand\s+into\s+your\s+break\s+area\.?$/i.test(
        inner,
      )
    ) {
      continue
    }

    if (/(?:Place|Take|Discard)/i.test(inner)) {
      return true
    }
  }

  return false
}

const COST_OR_MARKER_RE = /\{[A-Za-z0-9_]+\}/g
const BRACKET_COST_RE = /(?:<|《)[^>》]*(?:>|》)/g
const DRAW_ONLY_RE = /^(?:You can\s+)?Draw\s+(up to\s+)?(\d+)\s+card(?:s)?\s+from\s+your\s+deck\.?$/i
const DECK_TO_SUPPORT_RE = /^Take\s+(\d+)\s+card(?:s)?\s+from\s+the\s+top(?:\s+of)?\s+your\s+deck\s+and\s+place\s+(?:it|them)\s+in\s+your\s+support\s+area\s+as\s+active\.?$/i
const BREAK_TO_TRASH_RE = /^(?:If\s+your\s+break\s+area\s+is\s+LV\.(\d+)\s+or\s+higher,\s+)?Select\s+up\s+to\s+(\d+)\s+LV\.(\d+)\s+(?:card|Cookie)\s+(?:in|from)\s+your\s+break\s+area(?:\s+and|\.)\s+place\s+(?:it|that Cookie)\s+in\s+the\s+trash\.?$/i

const stripEffectText = (text: string): string =>
  text.replace(COST_OR_MARKER_RE, '').replace(BRACKET_COST_RE, '').replace(/\s+/g, ' ').trim()

const parseAbilityCost = (text: string): AbilityCost => {
  const parsed = parseOfficialCardText(text)
  const discardMatch = text.match(
    /(?:<|《)\s*Discard\s+(\d+)\s+(?:\{([RYGBPK])\}\s+)?(?:(item|trap|cookie)\s+)?card(?:s)?\.\s*(?:>|》)/i,
  )
  const supportToTrashMatch = text.match(
    /(?:<|《)\s*Place\s+(\d+)\s+card(?:s)?\s+from\s+your\s+support\s+area\s+(?:in|into)\s+the\s+trash\.?\s*(?:>|》)/i,
  )
  const trashBattleMatch = text.match(
    /(?:<|《)\s*Place\s+(\d+)\s+(?:\{([RYGBPK])\}\s+)?LV\.(\d+)\s+Cookie\s+from\s+your\s+battle\s+area\s+into\s+the\s+trash\.?\s*(?:>|》)/i,
  )
  const makeFaintMatch = text.match(
    /(?:<|《)\s*Make\s+(\d+)\s+of\s+your\s+(?:\{([RYGBPK])\}\s+)?Cookies?\s+faint\.?\s*(?:>|》)/i,
  )
  const handToBreakMatch = text.match(
    /(?:<|《)\s*Place\s+(\d+)\s+(?:\{([RYGBPK])\}\s+)?Cookie\s+from\s+your\s+hand\s+into\s+your\s+break\s+area\.?\s*(?:>|》)/i,
  )
  // BS4-004／005／007 這類辣椒系卡的代價：從自己這張卡的 HP 頂端棄 N 張。
  // 官方文字用詞不一致：「this Cookie's HP」與「this Cookie's HP card」都有
  // （BS4-096），故「card」字尾為選用。
  const hpToTrashMatch = text.match(
    /(?:<|《)\s*Place\s+(\d+)\s+cards?\s+from\s+the\s+top\s+of\s+this\s+Cookie's\s+HP(?:\s+cards?)?\s+into\s+the\s+trash\.?\s*(?:>|》)/i,
  )
  const costColors = {
    R: 'red',
    Y: 'yellow',
    G: 'green',
    B: 'blue',
    P: 'purple',
    K: 'black',
  } as const

  return {
    energy: parsed?.cost ?? {},
    discardHand: discardMatch ? Number(discardMatch[1]) : 0,
    discardHandColor: discardMatch?.[2]
      ? costColors[discardMatch[2].toUpperCase() as keyof typeof costColors]
      : undefined,
    discardHandType: discardMatch?.[3]?.toLowerCase() as AbilityCost['discardHandType'],
    supportToTrash: supportToTrashMatch
      ? Number(supportToTrashMatch[1])
      : undefined,
    ...(hpToTrashMatch
      ? {
          hpToTrash: {
            amount: Number(hpToTrashMatch[1]),
            // 卡面明定 this Cookie，不能讓玩家改由另一張己方餅乾支付。
            sourceOnly: true,
          },
        }
      : {}),
    ...(handToBreakMatch ? {
      handToBreakArea: {
        count: Number(handToBreakMatch[1]),
        ...(handToBreakMatch[2]
          ? {
              energyColor:
                costColors[
                  handToBreakMatch[2].toUpperCase() as keyof typeof costColors
                ],
            }
          : {}),
      },
    } : {}),
    ...(trashBattleMatch ? {
      trashBattleCookie: {
        count: Number(trashBattleMatch[1]),
        level: Number(trashBattleMatch[3]),
        ...(trashBattleMatch[2]
          ? {
              energyColor:
                costColors[
                  trashBattleMatch[2].toUpperCase() as keyof typeof costColors
                ],
            }
          : {}),
      },
    } : makeFaintMatch ? {
      trashBattleCookie: {
        count: Number(makeFaintMatch[1]),
        ...(makeFaintMatch[2]
          ? {
              energyColor:
                costColors[
                  makeFaintMatch[2].toUpperCase() as keyof typeof costColors
                ],
            }
          : {}),
      },
    } : {}),
  }
}

const parseSimpleDraw = (stripped: string): number | null => {
  const match = stripped.match(DRAW_ONLY_RE)
  return match ? Number(match[2]) : null
}

const isOptionalDraw = (stripped: string): boolean =>
  /^\s*You can\s+draw\b/i.test(stripped) || /\bDraw\s+up to\b/i.test(stripped)

const CONDITIONAL_DRAW_RE =
  /^If\s+.+?,\s*you\s+can\s+draw\s+(?:up\s+to\s+)?(\d+)\s+card(?:s)?\s+from\s+your\s+deck\.?$/i

const parseConditionalDraw = (stripped: string): number | null => {
  const match = stripped.match(CONDITIONAL_DRAW_RE)
  return match ? Number(match[1]) : null
}

const parseDeckToSupport = (stripped: string): number | null => {
  const match = stripped.match(DECK_TO_SUPPORT_RE)
  return match ? Number(match[1]) : null
}

interface ParsedBreakToTrash {
  max: number
  exactLevel: number
  conditionLevel?: number
}

const parseBreakToTrash = (stripped: string): ParsedBreakToTrash | null => {
  const normalized = stripped.replace(/^When this Cookie faints,\s*/i, '')
  const match = normalized.match(BREAK_TO_TRASH_RE)
  return match
    ? {
        max: Number(match[2]),
        exactLevel: Number(match[3]),
        conditionLevel: match[1] ? Number(match[1]) : undefined,
      }
    : null
}

export const convertOfficialCardEffects = (
  card: OfficialCardRecord,
): OfficialEffectConversion => {
  const sourceText = getEffectText(card)
  const cardKey = card.cardNumber.includes('@')
    ? card.baseCardNumber || card.cardNumber.split('@')[0]
    : card.cardNumber

  if (!sourceText) {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      sourceText,
      reason: 'no-effect-text',
    }
  }

  const exactStarterEffects: Partial<Record<string, CardEffect[]>> = {
    // 複合效果（含 Then）仍需硬編碼，因通用解析器不處理 Then
    'ST1-002': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'break-level-at-least', level: 6 },
      },
    ],
    'ST1-017': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1, remainingHp: 1, minLevel: 2 },
      },
    ],
    'ST2-018': [
      { kind: 'draw', amount: 1 },
      {
        kind: 'view-hp',
        target: { side: 'self', min: 0, max: 1 },
        optional: true,
      },
    ],
    'ST3-004': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'ST3-017': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 2 },
      },
      { kind: 'support-to-trash', amount: 1 },
    ],
    'ST4-004': [
      { kind: 'set-active' as const, supportCount: 1 } satisfies CardEffect as CardEffect,
    ],
    'ST4-013': [
      { kind: 'inspect-deck', lookCount: 3, pickCount: 1, restDestination: 'bottom' },
    ],
    'ST4-016': [
      {
        kind: 'return-to-hand',
        target: {
          side: 'self',
          min: 1,
          max: 1,
          energyColor: 'blue',
          minRemainingHp: 3,
        },
      },
    ],
    'ST4-017': [
      {
        kind: 'return-to-hand',
        target: { side: 'self', min: 1, max: 1, maxLevel: 1 },
      },
    ],
    'ST4-018': [{ kind: 'draw-up-to', max: 2 }],
    'ST4-019': [{ kind: 'hand-to-deck-and-draw' }],
    'ST5-019': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'opponent-trash-count-at-least', count: 20 },
      },
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'opponent-trash-count-at-least', count: 20 },
      },
    ],
    'ST5-001': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
        allowStage: true,
      } satisfies CardEffect as CardEffect,
    ],
    'ST5-006': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 1, max: 1, maxLevel: 2 },
        allowStage: true,
      } satisfies CardEffect as CardEffect,
    ],
    'ST5-007': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
        allowStage: true,
      } satisfies CardEffect as CardEffect,
    ],
    'ST5-010': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 1, max: 1, remainingHp: 2 },
      } satisfies CardEffect as CardEffect,
    ],
    'ST5-013': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      } satisfies CardEffect as CardEffect,
    ],
    'ST5-015': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 1, max: 1 },
      } satisfies CardEffect as CardEffect,
    ],
    'ST5-016': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'opponent-trash-count-at-least', count: 30 },
      } satisfies CardEffect as CardEffect,
    ],
    'ST5-018': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 1, max: 1, remainingHp: 4 },
      } satisfies CardEffect as CardEffect,
    ],
    'ST5-021': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 1, max: 1, remainingHp: 2 },
      } satisfies CardEffect as CardEffect,
    ],
    'BS1-029': [
      {
        kind: 'draw',
        amount: 1,
        condition: { kind: 'break-level-at-least', level: 3 },
      },
      {
        kind: 'discard-hand',
        count: 1,
        condition: { kind: 'break-level-at-least', level: 3 },
      },
    ],
    'BS1-053': [
      {
        kind: 'support-to-hand',
        amount: 1,
        condition: { kind: 'hand-count-at-most', count: 6 },
      },
      {
        kind: 'deck-to-support',
        amount: 1,
        rested: true,
        condition: { kind: 'hand-count-at-most', count: 6 },
      },
    ],
    'BS1-022': [
      {
        kind: 'damage',
        amount: 3,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS1-023': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
      },
    ],
    'BS1-048': [
      {
        kind: 'modify-attack-by-break-count',
        perCount: 1,
        groupSize: 2,
        exactBreakLevel: 1,
        breakEnergyColor: 'yellow',
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
      },
    ],
    'BS1-049': [
      {
        kind: 'damage-by-break-count',
        perCount: 1,
        minBreakLevel: 2,
        breakEnergyColor: 'yellow',
        target: { side: 'opponent', min: 1, max: 1 },
      },
    ],
    'BS1-074': [{ kind: 'draw-up-to', max: 1 }],
    'BS1-075': [{ kind: 'place-source-to-support', rested: true }],
    'BS1-001': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS1-003': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS1-004': [
      {
        kind: 'return-to-hand',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS1-008': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
    ],
    'BS1-012': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'break-level-at-least', level: 9 },
      },
    ],
    'BS1-014': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS1-016': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'hand-count-at-most', count: 4 },
      },
    ],
    'BS1-017': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
    ],
    'BS2-002': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 0, max: 1 },
        stageOnly: true,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-003': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS2-006': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'hp-to-trash',
        amount: 2,
        target: { side: 'self', min: 1, max: 1 },
      },
    ],
    // === BS1/BS2 黃色餅乾卡技能 ===
    'BS1-028': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
    ],
    'BS1-034': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
    ],
    'BS1-035': [
      {
        kind: 'break-to-trash',
        max: 1,
        exactLevel: 1,
      },
    ],
    'BS1-044': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        // 官方繁中卡面文字為「HP 3 或以下」（含 3），英文資料庫的 "less than 3"
        // 對應到嚴格小於 4，故此處用 amount: 4 表示 HP <= 3。
        condition: { kind: 'source-hp-less-than', amount: 4 },
      },
    ],
    // === BS1/BS2 綠色餅乾卡技能 ===
    'BS1-054': [
      {
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
      },
    ],
    'BS1-063': [
      {
        kind: 'deck-to-support',
        amount: 1,
      },
    ],
    'BS1-066': [
      {
        kind: 'set-active',
        supportCount: 1,
      },
    ],
    'BS1-068': [
      { kind: 'draw', amount: 1 },
    ],
    'BS1-071': [
      {
        kind: 'trash-to-support',
        amount: 1,
      },
    ],
    'BS1-073': [
      {
        kind: 'set-active',
        supportCount: 1,
      },
    ],
    // === BS1/BS2 藍色餅乾卡技能 ===
    'BS2-022': [
      {
        kind: 'prevent-effect-damage',
        duration: 'until-source-next-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS2-025': [
      {
        kind: 'draw-up-to-then-discard',
        max: 1,
        discardCount: 1,
      },
    ],
    'BS2-027': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 2 },
      },
    ],
    'BS2-033': [
      {
        kind: 'set-active',
        supportCount: 0,
      },
    ],
    'BS2-029': [
      {
        kind: 'return-to-hand',
        target: { side: 'self', min: 0, max: 1, maxLevel: 2 },
      },
    ],
    'BS2-031': [
      {
        kind: 'split-damage',
        primaryAmount: 2,
        secondaryAmount: 1,
        target: { side: 'opponent', min: 0, max: 2 },
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-047': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 2 },
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-039': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 2 },
      },
    ],
    'BS2-040': [
      { kind: 'inspect-deck', lookCount: 3, pickCount: 1, restDestination: 'bottom', filterColor: 'blue' },
    ],
    'BS2-043': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 2 },
      },
    ],
    'BS2-046': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 0, max: 1 },
        stageOnly: true,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-036': [
      {
        kind: 'return-to-deck-bottom',
        target: { side: 'self', min: 1, max: 1, maxLevel: 1 },
      } satisfies CardEffect as CardEffect,
      { kind: 'draw-up-to', max: 1 },
    ],
    // === BS1/BS2 紫色餅乾卡技能 ===
    'BS2-057': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 0, max: 1 },
        stageOnly: true,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-058': [
      {
        kind: 'opponent-battle-to-trash',
        maxLevel: 3,
        minLevel: 3,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-064': [
      {
        kind: 'opponent-battle-to-trash',
        remainingHp: 2,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-065': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 0, max: 1 },
        stageOnly: true,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-069': [
      {
        kind: 'opponent-battle-to-trash',
        maxLevel: 1,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-048': [
      {
        kind: 'draw-up-to-opponent-fainted-this-turn',
        amountPerFainted: 1,
      },
    ],
    'BS2-074': [
      {
        kind: 'opponent-battle-to-trash',
        maxLevel: 1,
      } satisfies CardEffect as CardEffect,
    ],
    // === 補齊尚未實作的餅乾／物品卡效果 ===
    'ST4-010': [{ kind: 'draw-up-to', max: 1 }],
    'BS1-056': [
      {
        kind: 'battle-to-support',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          excludeSource: true,
          maxLevel: 2,
        },
      } satisfies CardEffect as CardEffect,
    ],
    'BS1-058': [
      { kind: 'support-to-trash', amount: 1 },
      { kind: 'damage-all', amount: 1, side: 'self' },
      { kind: 'damage-all', amount: 1, side: 'opponent' },
    ],
    'BS2-015': [
      { kind: 'damage', amount: 2, target: { side: 'opponent', min: 0, max: 1 } },
      { kind: 'deck-to-support', amount: 1, rested: true },
    ],
    'BS2-018': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 0, max: 1 },
        stageOnly: true,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-055': [
      { kind: 'field-to-trash-all', maxLevel: 2 } satisfies CardEffect as CardEffect,
    ],
    'BS2-060': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'opponent-trash-count-at-least', count: 20 },
      },
    ],
    'BS2-061': [
      { kind: 'trash-to-deck', max: 3, excludeFlip: true } satisfies CardEffect as CardEffect,
    ],
    'BS2-062': [
      {
        kind: 'field-to-trash',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          excludeSource: true,
          energyColor: 'purple',
          maxLevel: 2,
        },
      } satisfies CardEffect as CardEffect,
      {
        kind: 'opponent-battle-to-trash',
        maxLevel: 2,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-068': [
      { kind: 'trash-to-hand', max: 1, energyColor: 'purple' } satisfies CardEffect as CardEffect,
    ],
    'BS2-071': [
      { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } },
    ],
    'BS2-073': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'trash-count-at-least', count: 15 },
      },
    ],
    'BS1-036': [
      {
        kind: 'break-to-battle',
        amount: 1,
        exactLevel: 1,
        energyColor: 'yellow',
      } satisfies CardEffect as CardEffect,
    ],
    'BS1-037': [
      { kind: 'break-to-trash', max: 1, maxLevel: 2 },
    ],
    'BS1-038': [
      { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } },
    ],
    'BS2-011': [
      {
        kind: 'break-to-hand-by-level-sum',
        targetSum: 3,
        energyColor: 'yellow',
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-012': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 0, max: 1 },
        stageOnly: true,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-020': [
      {
        kind: 'hp-to-support',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, energyColor: 'green' },
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-077': [
      { kind: 'damage', amount: 2, target: { side: 'opponent', min: 0, max: 1 } },
    ],
    'BS2-078': [
      {
        kind: 'field-to-trash',
        target: { side: 'self', min: 1, max: 1, maxLevel: 2 },
      } satisfies CardEffect as CardEffect,
    ],
    'BS3-008': [
      {
        kind: 'opponent-battle-to-trash',
        min: 0,
        maxLevel: 1,
        destination: 'break',
      },
    ],
    'BS3-016': [
      {
        kind: 'set-active',
        supportCount: 0,
        condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
      },
    ],
    'BS3-017': [
      {
        kind: 'modify-damage-received',
        amount: 0,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        minimumDamage: 3,
        setDamageTo: 2,
      },
    ],
    'BS3-010': [
      {
        kind: 'opponent-battle-to-trash',
        min: 0,
        maxLevel: 1,
        destination: 'break',
      },
    ],
    'BS3-019': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'equip-source',
        target: { side: 'self', min: 0, max: 1 },
        requiredCookieId: 'BS3-017',
        attackBonus: 1,
      },
    ],
    'BS3-020': [
      {
        kind: 'hp-to-hand',
        amount: 3,
        target: { side: 'self', min: 0, max: 1, energyColor: 'red' },
      },
    ],
    'BS3-026': [
      {
        kind: 'view-hp',
        target: { side: 'self', min: 0, max: 1 },
        optional: true,
      },
    ],
    'BS3-030': [
      {
        kind: 'hand-to-hp',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        optional: true,
      },
    ],
    'BS3-036': [
      {
        kind: 'battle-to-break',
        target: {
          side: 'self',
          min: 1,
          max: 1,
          excludeSource: true,
          energyColor: 'yellow',
        },
      },
      { kind: 'draw-up-to', max: 2 },
    ],
    'BS3-042': [
      {
        kind: 'battle-to-break',
        target: { side: 'self', min: 1, max: 1, energyColor: 'yellow' },
      },
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS3-044': [
      { kind: 'hand-to-break', amount: 1, minLevel: 2 },
      {
        kind: 'break-to-hand',
        amount: 1,
        energyColor: 'yellow',
        maxLevel: 2,
        optional: true,
      },
    ],
    'BS3-043': [
      { kind: 'damage-all', amount: 1, side: 'opponent' },
      {
        kind: 'equip-source',
        target: { side: 'self', min: 0, max: 1 },
        requiredCookieId: 'BS3-025',
        gainHp: 2,
      },
    ],
    'BS3-038': [
      { kind: 'hand-to-break', amount: 1, minLevel: 2 },
      {
        kind: 'break-to-hand',
        amount: 1,
        energyColor: 'yellow',
        maxLevel: 2,
        optional: true,
      },
    ],
    'BS3-054': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'active-support-count-at-least', count: 2 },
      },
    ],
    'BS3-075': [
      {
        kind: 'battle-to-deck-top',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS3-081': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'battle-to-deck-top',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS3-082': [
      {
        kind: 'prevent-effect-damage',
        duration: 'until-source-next-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ],
    'BS3-055': [
      {
        kind: 'support-to-hp',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        energyColor: 'green',
        optional: true,
      },
    ],
    'BS3-060': [
      {
        kind: 'rest-support',
        side: 'opponent',
        amount: 1,
        activeOnly: true,
        optional: true,
      },
    ],
    'BS3-061': [
      // 「place 1 card from your support area into the trash」是這個昏厥觸發
      // 技能的代價，但 resolveFaintEffect 只讀 hand-to-battle 的 energyCost，
      // 完全不會去看 CardSkill.cost（同一類問題見 BS3-029 修正）；跟 BS3-064
      // 一樣，把代價改成陣列最前面一個非 optional 的效果，讓玩家選擇發動後
      // 確實支付犧牲，且讓後面「支援區至少 5 張」的條件用犧牲後張數判定。
      // 整組技能是否發動則由 convertOfficialCookieSkill 的 faintOptional 標記處理。
      { kind: 'support-to-trash', amount: 1 },
      {
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
        condition: { kind: 'support-count-at-least', count: 5 },
      },
    ],
    'BS3-062': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          excludeSource: true,
          energyColor: 'green',
        },
        condition: { kind: 'support-count-at-least', count: 5 },
      },
    ],
    'BS3-063': [
      { kind: 'support-to-hand', amount: 1 },
      { kind: 'hand-to-support', amount: 1, rested: true, optional: true },
    ],
    'BS3-064': [
      { kind: 'support-to-hand', amount: 1 },
      { kind: 'draw-up-to', max: 1 },
    ],
    'BS3-065': [
      { kind: 'hand-to-support', amount: 1, rested: true, optional: true },
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'support-count-at-least', count: 8 },
      },
    ],
    'BS3-066': [
      { kind: 'support-to-hand', amount: 1 },
      { kind: 'deck-to-support', amount: 1, rested: false },
      {
        kind: 'equip-source',
        target: { side: 'self', min: 0, max: 1 },
        requiredCookieId: 'BS3-055',
      },
    ],
    'BS3-067': [
      { kind: 'draw-up-to', max: 2 },
      {
        kind: 'set-active',
        supportCount: 1,
        selectable: true,
        condition: { kind: 'support-count-at-most', count: 6 },
      },
    ],
    'BS3-072': [
      {
        kind: 'rest-support',
        side: 'opponent',
        amount: 1,
        activeOnly: true,
        optional: true,
      },
    ],
    'BS3-077': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      { kind: 'set-active', supportCount: 0 },
    ],
    'BS3-097': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      { kind: 'deck-to-trash', amount: 1, side: 'opponent' },
    ],
    'BS3-100': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 2 },
      },
    ],
    'BS3-091': [
      { kind: 'inspect-deck', lookCount: 3, pickCount: 2, restDestination: 'top' },
      {
        kind: 'equip-source',
        target: { side: 'self', min: 0, max: 1 },
        requiredCookieId: 'BS3-088',
      },
    ],
    'BS3-104': [
      { kind: 'opponent-random-discard', count: 2 },
      { kind: 'draw', amount: 2, side: 'opponent' },
    ],
    'BS3-105': [
      { kind: 'deck-to-trash', amount: 2, side: 'self' },
      { kind: 'deck-to-trash', amount: 2, side: 'opponent' },
    ],
    'BS3-115': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 2, maxLevel: 2 },
      },
      {
        kind: 'equip-source',
        target: { side: 'self', min: 0, max: 1 },
        requiredCookieId: 'BS3-100',
      },
    ],
    'BS3-119': [{ kind: 'deck-to-trash', amount: 3, side: 'opponent' }],
    'BS3-028': [
      {
        kind: 'opponent-trash-to-break',
        max: 1,
        exactLevel: 1,
        condition: { kind: 'opponent-break-level-at-most', level: 6 },
      },
    ],
    'BS3-029': [
      {
        kind: 'hand-to-battle',
        amount: 1,
        energyColor: 'yellow',
        energyCost: { yellow: 1 },
        optional: true,
        gainHp: 1,
      },
    ],
    'BS3-073': [
      {
        kind: 'reveal-bottom-deck',
        cookieDestination: 'deck-top',
        otherwiseDestination: 'hand',
      },
    ],
    'BS3-087': [
      {
        kind: 'reveal-top-deck',
        match: { type: 'cookie', energyColor: 'blue', level: 2 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      },
    ],
    'BS3-088': [
      {
        kind: 'draw-up-to-then-discard',
        max: 3,
        discardCount: 1,
        handDestination: 'deck-top',
      },
    ],
    'BS3-083': [
      {
        kind: 'inspect-deck',
        lookCount: 3,
        pickCount: 0,
        restDestination: 'top',
      },
    ],
    'BS3-112': [
      { kind: 'trash-to-hand', max: 1, energyColor: 'purple', cookieOnly: true },
    ],
    'BS3-068': [
      {
        kind: 'choose-one',
        modes: [
          {
            label: '將這張卡以休息狀態放入支援區',
            effects: [{ kind: 'place-source-to-support', rested: true }],
          },
          {
            label: '對手全體受到 1 傷害，然後棄 2 張支援區卡',
            effects: [
              { kind: 'damage-all', amount: 1, side: 'opponent' },
              { kind: 'support-to-trash', amount: 2 },
            ],
          },
        ],
      },
    ],
    'BS3-114': [
      {
        kind: 'inspect-deck',
        lookCount: 5,
        pickCount: 1,
        restDestination: 'trash',
        pickDestination: 'battle',
        filterColor: 'purple',
        filterType: 'cookie',
        optionalPick: true,
      },
    ],
    'BS3-040': [
      {
        kind: 'battle-to-break',
        target: { side: 'either', min: 0, max: 1, maxLevel: 1 },
      },
    ],
    'BS3-076': [
      {
        kind: 'battle-to-deck-top',
        target: { side: 'either', min: 0, max: 1, maxLevel: 2 },
      },
    ],
    'BS3-031': [
      {
        kind: 'transfer-hp',
        amount: 1,
        direction: 'to-source',
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
    ],
    'BS3-053': [
      {
        kind: 'set-cookie-active',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          excludeSource: true,
          energyColor: 'green',
          restedOnly: true,
        },
      },
    ],
    'BS3-052': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: {
          side: 'self',
          min: 0,
          max: 1,
          remainingHp: 2,
          excludeSource: true,
        },
      },
    ],
    'BS3-089': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'transfer-hp',
        amount: 1,
        direction: 'from-source',
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
    ],
    'BS3-092': [
      {
        kind: 'draw-up-to-battle-cookie-count',
        level: 2,
        amountPerCookie: 1,
      },
    ],
    'BS3-113': [
      {
        kind: 'trash-to-deck-all',
        condition: {
          kind: 'trash-color-count-at-least',
          color: 'purple',
          count: 15,
        },
        // 洗回牌庫會清空棄牌區，傷害必須內嵌才不會被條件重判時跳過。
        // 全體傷害仍須讓玩家指定每個目標的結算順序，逐張處理 FLIP。
        thenEffects: [
          {
            kind: 'damage-all',
            amount: 2,
            side: 'opponent',
            sequential: true,
            target: { side: 'opponent', min: 1, max: 2 },
          },
        ],
      },
    ],
    'BS2-013': [
      {
        kind: 'battle-to-break',
        target: { side: 'self', min: 1, max: 1 },
      } satisfies CardEffect as CardEffect,
      {
        kind: 'break-to-battle',
        amount: 1,
        exactLevel: 1,
      } satisfies CardEffect as CardEffect,
    ],
    'BS3-006': [
      {
        kind: 'modify-all-attack',
        amount: 1,
        duration: 'persistent',
        side: 'self',
        energyColor: 'red',
        minLevel: 2,
      },
    ],
    'BS3-007': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'break-level-at-least', level: 7 },
      },
    ],
    'BS3-014': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'any-battle-area-has-blocker' },
      },
    ],
    'BS3-098': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS3-103': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'trash-count-at-least', count: 10 },
      },
    ],
    'BS3-051': [
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'support-count-at-least', count: 5 },
      },
    ],
    'BS3-001': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'attack-target-remaining-hp-at-least', amount: 4 },
      },
    ],
    'BS3-018': [
      {
        kind: 'choose-one',
        modes: [
          {
            label: 'During this turn, your opponent cannot activate Blocker.',
            effects: [{ kind: 'disable-block', duration: 'this-turn', side: 'opponent' }],
          },
          {
            label:
              'If there are no Cookies that have Blocker in your opponent\'s battle area, select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
            effects: [{
              kind: 'damage',
              amount: 1,
              target: { side: 'opponent', min: 0, max: 1 },
              condition: { kind: 'opponent-battle-area-has-no-blocker' },
            }],
          },
        ],
      },
    ],
    'BS3-090': [
      {
        kind: 'reveal-top-deck',
        match: { type: 'cookie', energyColor: 'blue', level: 2 },
        effects: [
          {
            kind: 'modify-attack',
            amount: 2,
            duration: 'this-turn',
            target: { side: 'self', min: 0, max: 1 },
          },
        ],
      },
    ],
    'BS3-116': [
      {
        kind: 'choose-one',
        modes: [
          {
            label: 'Place 1 card from the top of 1 opponent Cookie HP in the trash.',
            effects: [{ kind: 'hp-to-trash', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }],
          },
          {
            label: 'Place 1 random card from opponent hand into the trash.',
            effects: [{ kind: 'opponent-random-discard' as const, count: 1 }],
          },
        ],
      },
    ],
    'BS3-025': [
      {
        kind: 'break-source-to-battle',
        hpCount: 1,
      },
    ],
    // === P-0XX 促銷卡 ===
    'P-001': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
    ],
    'P-002': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
    ],
    'P-003': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
    ],
    'P-013': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
    ],
    'P-014': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
    ],
    'P-007': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'P-008': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1, minRemainingHp: 4 },
      },
    ],
    'P-010': [
      {
        kind: 'disable-attack',
        duration: 'opponent-next-turn',
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
      },
    ],
    'P-011': [
      { kind: 'support-to-hand', amount: 1 },
      { kind: 'hand-to-support', amount: 1, rested: true },
    ],
    'P-012': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      { kind: 'place-source-to-support', rested: true },
    ],
    'P-016': [
      {
        kind: 'trash-to-break',
        amount: 1,
        energyColor: 'yellow',
        exactLevel: 2,
      },
      {
        kind: 'break-to-trash',
        max: 2,
        energyColor: 'yellow',
        exactLevel: 1,
      },
    ],
    'P-018': [
      { kind: 'damage-all', amount: 1, side: 'opponent' },
      { kind: 'damage-all', amount: 1, side: 'self', excludeSource: true },
    ],
    'P-030': [
      { kind: 'damage-all', amount: 1, side: 'opponent' },
    ],
    'P-017': [
      {
        kind: 'deck-to-support',
        amount: 1,
        rested: true,
        condition: { kind: 'support-area-decreased-this-turn' },
      },
    ],
    'P-025': [
      {
        kind: 'multiply-attack-damage',
        multiplier: 2,
        condition: {
          kind: 'distinct-named-family-count',
          family: 'marzipan-cookie',
          battleAreaCount: 2,
          supportAreaCount: 4,
        },
      },
    ],
    'P-026': [
      {
        kind: 'multiply-attack-damage',
        multiplier: 2,
        condition: {
          kind: 'distinct-named-family-count',
          family: 'marzipan-cookie',
          battleAreaCount: 2,
          supportAreaCount: 4,
        },
      },
    ],
    'P-027': [
      {
        kind: 'multiply-attack-damage',
        multiplier: 2,
        condition: {
          kind: 'distinct-named-family-count',
          family: 'marzipan-cookie',
          battleAreaCount: 2,
          supportAreaCount: 4,
        },
      },
    ],
    // BS4-070「When this Cookie faints」的棄牌代價由 parseAbilityCost 自動解析，
    // 這裡只需要補上昏厥後的抽牌效果本身。
    'BS4-070': [{ kind: 'draw-up-to', max: 3 }],
    'BS4-082': [
      { kind: 'draw-up-to-then-discard', max: 3, discardCount: 2 },
    ],
    // 跟 BS3-083「View 3 cards from the top of your deck; place them on the
    // top of your deck in any order.」是同一種機制：pickCount 0、
    // restDestination 'top' 時，檢視到的卡全部照玩家決定的順序放回牌頂。
    'BS4-072': [
      { kind: 'inspect-deck', lookCount: 3, pickCount: 0, restDestination: 'top' },
    ],
    // === BS4 紅色餅乾卡技能 ===
    // 代價「Place 1 card from the top of this Cookie's HP into the trash」
    // 由 parseAbilityCost 的 hpToTrash 規則自動解析。
    'BS4-004': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS4-005': [
      {
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
        sequential: true,
        target: { side: 'opponent', min: 1, max: 2 },
      },
    ],
    'BS4-007': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          excludeSource: true,
          energyColor: 'red',
        },
      },
    ],
    // BS4-011：被動觸發，官方文字沒有 {ap}/{mob} 標記，兩個子效果都要各自帶上
    // 同一個「本次戰鬥擊倒對方餅乾」條件，因為 CardEffect 是逐一判定，不是整個
    // 陣列共用一個條件。
    'BS4-011': [
      {
        kind: 'draw',
        amount: 1,
        condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
      },
      {
        kind: 'discard-hand',
        count: 1,
        condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
      },
    ],
    'BS4-012': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'source-hp-less-than', amount: 2 },
      },
    ],
    'BS4-014': [
      {
        kind: 'redirect-attack',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
      {
        kind: 'modify-damage-received',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'attacker-level-at-most', level: 1 },
      },
    ],
    // Captain Ice 的三個正式版本都是 Blocker，且同時具有對 LV.1
    // 攻擊減傷。不能讓一般 Blocker parser 提前 return 而遺失第二段，
    // 也不能讓全形標記版本只留下減傷而失去 redirect-attack。
    'BS4-080': [
      {
        kind: 'redirect-attack',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
      {
        kind: 'modify-damage-received',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'attacker-level-at-most', level: 1 },
      },
    ],
    // === BS4 黃色餅乾卡技能 ===
    'BS4-038': [
      { kind: 'break-to-battle', amount: 1, maxLevel: 2, energyColor: 'yellow' },
    ],
    'BS4-026': [
      {
        kind: 'battle-to-break',
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 2 },
        condition: { kind: 'opponent-break-level-at-most', level: 5 },
      },
    ],
    'BS4-028': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'break-level-at-least', level: 5 },
      },
      {
        kind: 'discard-hand',
        count: 1,
        condition: { kind: 'break-level-at-least', level: 5 },
      },
    ],
    // === BS4 綠色餅乾卡技能 ===
    // 代價「Place 1 card from your support area into the trash」由
    // parseAbilityCost 的 supportToTrash 規則自動解析。
    'BS4-051': [
      {
        kind: 'set-cookie-active',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS4-059': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'support-count-at-most', count: 3 },
      },
    ],
    'BS4-048': [
      {
        kind: 'set-active',
        supportCount: 1,
        condition: {
          kind: 'support-color-count-at-least',
          color: 'green',
          count: 7,
        },
      },
    ],
    'BS4-053': [
      {
        kind: 'battle-to-support',
        target: { side: 'self', min: 0, max: 1, maxLevel: 2, energyColor: 'green' },
      },
    ],
    // BS4-077：代價「Place this Cookie on the bottom of your deck」透過
    // exactCookieSkillCosts 的 selfToDeckBottom 硬編碼（官方文字沒有固定句式
    // 可泛用解析，跟 selfToBreakArea 一樣走per-card覆寫）。
    'BS4-077': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: {
          kind: 'all-of',
          conditions: [
            { kind: 'hand-count-at-most', count: 5 },
            { kind: 'battle-area-has-color', side: 'self', color: 'blue' },
          ],
        },
      },
    ],
    // 中文卡面另一段用「或更多」明確標示「至少」，這段沒有那個字尾，
    // 確認「對手戰鬥區有2個餅乾」是剛好等於 2，不是至少 2。
    'BS4-089': [
      {
        kind: 'deck-to-trash',
        amount: 5,
        side: 'opponent',
      },
      {
        kind: 'opponent-battle-to-trash',
        min: 0,
        condition: { kind: 'opponent-battle-area-cookie-count', count: 2 },
      },
    ],
    // 中文卡面用「且」明確連接顏色與等級，是同一張卡要同時滿足紫色跟LV.3，
    // 不是分開各自判定存在（battle-area-has-color 已加上可選的 level 欄位）。
    'BS4-094': [
      {
        kind: 'deck-to-trash',
        amount: 3,
        side: 'self',
        condition: {
          kind: 'battle-area-has-color',
          side: 'self',
          color: 'purple',
          level: 3,
        },
      },
      {
        kind: 'deck-to-trash',
        amount: 3,
        side: 'opponent',
        condition: {
          kind: 'battle-area-has-color',
          side: 'self',
          color: 'purple',
          level: 3,
        },
      },
    ],
    // 中文卡面「從自己或對手的牌庫頂」確認是發動者自選要磨誰的牌庫，用既有的
    // choose-one 表達，不需要新的「可選邊」機制。
    'BS4-099': [
      {
        kind: 'choose-one',
        modes: [
          {
            label: '磨自己牌庫',
            effects: [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
          },
          {
            label: '磨對方牌庫',
            effects: [{ kind: 'deck-to-trash', amount: 3, side: 'opponent' }],
          },
        ],
      },
    ],
    // 中文卡面確認是兩段各自獨立的目標選擇：先選自己一隻紅色餅乾動它的 HP，
    // 再另外選對手一隻造成傷害，跟 BS3-115（hp-to-trash + equip-source 各自
    // 獨立目標）是同一種「陣列裡每個效果各自選目標」模式。
    'BS4-019': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, energyColor: 'red' },
      },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS4-058': [
      { kind: 'support-to-battle', amount: 1, energyColor: 'green' },
    ],
    'BS4-102': [
      {
        kind: 'choose-one',
        modes: [
          {
            label: '磨自己牌庫',
            effects: [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
          },
          {
            label: '磨對方牌庫',
            effects: [{ kind: 'deck-to-trash', amount: 3, side: 'opponent' }],
          },
        ],
      },
    ],
    'BS4-049': [
      {
        kind: 'battle-to-support',
        target: { side: 'opponent', min: 0, max: 1 },
        rested: true,
      },
    ],
    // === BS4 紫色卡技能／道具／場景 ===
    'BS4-095': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 0, max: 1 },
        stageOnly: true,
      },
    ],
    // 代價「Place 1 card from the top of this Cookie's HP card into the
    // trash」由 parseAbilityCost 的 hpToTrash 規則（已放寬「HP card」用詞）自動解析。
    'BS4-096': [{ kind: 'draw-up-to', max: 1 }],
    'BS4-106': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 2 },
        condition: { kind: 'opponent-trash-count-at-least', count: 10 },
      },
    ],
    'BS4-107': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'opponent-trash-count-at-least', count: 15 },
      },
      {
        kind: 'choose-one',
        modes: [
          {
            label: '將牌庫頂 3 張牌放入自己的棄牌區',
            effects: [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
          },
          {
            label: '將牌庫頂 2 張牌放入自己的棄牌區',
            effects: [{ kind: 'deck-to-trash', amount: 2, side: 'self' }],
          },
          {
            label: '將牌庫頂 1 張牌放入自己的棄牌區',
            effects: [{ kind: 'deck-to-trash', amount: 1, side: 'self' }],
          },
          {
            label: '不將牌庫頂的牌放入棄牌區',
            effects: [],
          },
        ],
        condition: { kind: 'opponent-trash-count-at-least', count: 15 },
      },
    ],
    'BS4-108': [
      { kind: 'trash-to-hand', max: 1, energyColor: 'purple' },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS4-081': [
      {
        kind: 'choose-one',
        modes: [
          {
            label: '選對方 1 隻 LV.1 餅乾放到對方牌庫底',
            effects: [
              {
                kind: 'return-to-deck-bottom',
                target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
              },
            ],
          },
          {
            label: '抽 2 張',
            effects: [{ kind: 'draw-up-to', max: 2 }],
          },
        ],
      },
    ],
    // BS4-085 是複合效果（含 Then），通用解析器不處理 Then，需硬編碼；
    // 棄 4 張的代價一樣交給 parseAbilityCost 自動解析。
    'BS4-085': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 2 },
      },
      { kind: 'draw-up-to', max: 4 },
    ],
    // === BS4 效果稽核：可由既有 CardEffect 精確表達的能力 ===
    // BS4-001 Cherry Cookie：【Activate】選至多 1 張其他 {R} Cookie。
    // 代價本身由 exactCookieSkillCosts 處理；這裡補齊目標的顏色與
    // excludeSource binding，避免 UI 列出來源卡或非紅色餅乾。
    'BS4-001': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          energyColor: 'red',
          excludeSource: true,
        },
      },
    ],
    'BS4-020': [
      {
        kind: 'modify-attack',
        amount: 3,
        duration: 'this-turn',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          minLevel: 3,
          maxLevel: 3,
          energyColor: 'red',
        },
        condition: { kind: 'break-level-at-least', level: 6 },
      },
    ],
    'BS4-024': [
      {
        kind: 'redirect-attack',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: {
          kind: 'battle-area-has-color',
          side: 'self',
          color: 'yellow',
          level: 3,
        },
      },
    ],
    'BS4-052': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'support-color-count-at-least',
          color: 'green',
          count: 5,
        },
      },
    ],
    'BS4-025': [
      { kind: 'hand-to-break', amount: 1, energyColor: 'yellow', minLevel: 2 },
      {
        kind: 'break-to-battle',
        amount: 1,
        exactLevel: 2,
        energyColor: 'yellow',
      },
    ],
    'BS4-030': [
      {
        kind: 'cycle-hp',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          excludeSource: true,
          energyColor: 'yellow',
        },
      },
    ],
    'BS4-055': [
      { kind: 'deck-to-support', amount: 1, rested: true },
    ],
    'BS4-035': [
      {
        kind: 'break-to-battle',
        amount: 1,
        exactLevel: 1,
        energyColor: 'yellow',
      },
    ],
    'BS4-040': [
      {
        kind: 'battle-to-break',
        target: {
          side: 'self',
          min: 1,
          max: 1,
          minLevel: 2,
          energyColor: 'yellow',
        },
      },
      {
        kind: 'break-to-battle',
        amount: 1,
        exactLevel: 3,
        energyColor: 'yellow',
      },
    ],
    'BS4-062': [
      {
        kind: 'rest-support-and-damage',
        supportSide: 'self',
        supportAmount: 4,
        supportEnergyColor: 'green',
        activeOnly: true,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS4-063': [
      { kind: 'deck-to-support', amount: 2, rested: true },
      { kind: 'support-to-trash', amount: 1 },
    ],
    'BS4-092': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
      },
    ],
    'BS4-093': [
      { kind: 'opponent-battle-to-trash', min: 0, maxLevel: 2 },
    ],
    'BS4-098': [
      {
        kind: 'disable-flip',
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS4-073': [
      {
        kind: 'return-to-deck-bottom',
        target: { side: 'self', min: 1, max: 1, maxLevel: 2 },
      },
      { kind: 'damage-all', amount: 1, side: 'opponent' },
    ],
    'BS4-073@2': [
      {
        kind: 'field-to-deck-bottom',
        target: { side: 'either', min: 1, max: 1, maxLevel: 1 },
        allowStage: true,
        battleSide: 'opponent',
      },
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS4-074': [
      { kind: 'discard-hand-all' },
      { kind: 'draw-up-to', max: 4 },
    ],
    'BS4-075': [
      {
        kind: 'field-to-deck-bottom',
        target: { side: 'either', min: 1, max: 1, maxLevel: 1 },
        allowStage: true,
        battleSide: 'opponent',
      },
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS4-084': [
      { kind: 'draw-until-hand-equals-opponent' },
    ],
    // === BS5 RED ===
    // BS5-005 Mala Sauce Cookie：【Activate】【Once Per Turn】<{R}>
    // <Place 1 card from the top of your {R} LV.2 or higher Cookie's HP
    // into the trash.> 對手下 1 傷害。代價的顏色／等級條件見 exactCookieSkillCosts。
    'BS5-005': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS5-007 Fire Spirit Cookie：只選對手餅乾，不能把「this Cookie faints」
    // 誤判成來源自己的傷害目標。
    'BS5-007': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS5-011 Starfruit Cookie：<can be used as {R}.> Select up to 1 LV.1
    // opponent Cookie. 1 damage. 這個句式不是「of ... Cookies」，因此要
    // 明確覆寫目標，避免 parseTarget 把來源 faint 句誤讀成 self。
    'BS5-011': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
      },
    ],
    // BS5-010 Starch Noodle Cookie：【On Play】對手休息中 LV.2 以下餅乾 2 傷害。
    'BS5-010': [
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
    // BS5-013 Pitaya Dragon Cookie：【On Play】<Discard 1 {R} Cookie from your
    // hand.> 對手下 1 傷害。代價見 exactCookieSkillCosts。
    'BS5-013': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS5-014 Knight Cookie：【Activate】【Once Per Turn】指名對手
    // [Pitaya Dragon Cookie] 2 傷害（異畫變體同名，selector 以卡名篩選）。
    'BS5-014': [
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
    // BS5-015 Carol Cookie：【On Play】<Place 1 card from the top of your other
    // Cookie's HP into the trash.> 對手下 1 傷害。代價見 exactCookieSkillCosts。
    'BS5-015': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS5-016 Tiramisu Cookie：【Activate】【Once Per Turn】<Place 1 card from
    // the top of this Cookie's HP into the trash.> If that card is a non-Cookie
    // card, 對手下 1 傷害。磨掉的卡類型由 payAbilityCost 寫入 costRecord。
    'BS5-016': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'last-hp-trash-card-non-cookie' },
      },
    ],
    // BS5-018 Flat Tofu Cookie：【On Play】<Discard 1 {R} trap card from your
    // hand.> 對手下 1 傷害。代價見 exactCookieSkillCosts。
    'BS5-018': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS5-019 Pudding Cookie：【Activate】【Once Per Turn】<{R}> <Discard 1 {R}
    // Cookie from your hand.> 本回合這張卡攻擊 +1。代價見 exactCookieSkillCosts。
    'BS5-019': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    // BS5-020 Crimson Dragon Mask（item）：<{R}{R}> If there are 2 Cookies
    // whose remaining HP is 1 in your battle area, 對所有對手餅乾 2 傷害。
    'BS5-020': [
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
    // BS5-021 Draconic Aura（trap）：<{R}> If there is a LV.3 Cookie in your
    // battle area, 選至多 2 張對手餅乾本回合攻擊 -1；Then 自 1 張己方餅乾的
    // HP 頂端回手至多 1 張卡。這裡只放效果（主效果狀態判定用）；發動門檻
    // （LV.3 Cookie 存在）與完整陷阱能力由 exactTrapEffects 的
    // TrapCondition 承載。
    'BS5-021': [
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 2 },
      },
      {
        kind: 'hp-to-hand',
        amount: 1,
        target: { side: 'self', min: 0, max: 1 },
      },
    ],
    // BS5-022 Pitaya Dragon Cookie's Nest（stage）：<{R}> Place in your stage
    // area. 【Activate】<{R}><Rest this card.><Place 1 card from the top of
    // your LV.2 or higher Cookie's HP into the trash.> During this turn, that
    // Cookie gains +1 attack damage. Then, if [Pitaya Dragon Cookie] is in
    // your battle area, draw up to 1 card。「that Cookie」用 costSelected
    // 指到剛付出 hpToTrash 代價的那張餅乾；代價見 exactStageCosts。
    'BS5-022': [
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
    // BS5-004 Lollipop Cookie／BS5-009 Butterbear Cookie（flip）：主效果欄位
    // === BS5 YELLOW ===
    // BS5-023 Dino-Sour Cookie：【Activate】【Once Per Turn】<Place 3 cards
    // from the top of this Cookie's HP into the trash.> 本回合這張卡攻擊 +2。
    // 代價由 parseAbilityCost 自動解析（this Cookie's HP，sourceOnly）。
    'BS5-023': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    // BS5-026 DJ Cookie：faint 技能「<place 1 {Y} LV.2 or lower Cookie from
    // your hand into your break area.> Return this Cookie to your hand.」。
    // faint 技能的代價由離場本身支付，方括號內的「放 1 張黃色 LV.2 以下餅乾
    // 進休息區」以第一個效果呈現（比照 BS3-061 寫法）；第二個效果把這張卡
    // 返回手牌。
    'BS5-026': [
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
    // BS5-047 Cotton Cookie：【When this Cookie faints】<Place 1 card from
    // support area into the trash.> Set 1 support card active. 代價動作必須
    // 先進入效果佇列，才能在 UI 中支付後再選擇要恢復的支援卡。
    'BS5-047': [
      { kind: 'support-to-trash', amount: 1 },
      {
        kind: 'set-active',
        supportCount: 1,
        selectable: true,
        optional: false,
      },
    ],
    // BS5-028 Mango Cookie：【On Play】<{Y}> If your break area is LV.3 or
    // higher, 選至多 1 張對手的休息中 LV.2 以下餅乾，2 傷害。
    'BS5-028': [
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
    // BS5-029 Mustard Cookie：【On Play】If there is a {Y} LV.3 Cookie in your
    // break area, 抽至多 1 張牌。
    'BS5-029': [
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
    // BS5-031 Peach Cookie：【On Play】If your break area LV. is higher than
    // your opponent's break area LV., 抽至多 1 張牌。
    'BS5-031': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'break-level-higher-than-opponent' },
      },
    ],
    // BS5-036 Milk Cookie：【Activate】<{Y}><Rest this card.><Discard 1 card.>
    // 選至多 1 張對手戰鬥區中沒有技能、LV.1 的餅乾，使其昏厥。昏厥走與傷害
    // 相同的流程：餅乾進休息區、HP 進棄牌區、觸發目標的 faint 技能。
    'BS5-036': [
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
    // BS5-037 Plum Cookie：【On Play】條件成立後選至多 1 張自己的其他
    // {Y} Cookie。通用 parser 能辨識 side／optional，但顏色與排除來源是
    // 目標 binding 的必要部分，明確保留在 runtime selector。
    'BS5-037': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          energyColor: 'yellow',
          excludeSource: true,
        },
        condition: { kind: 'break-level-higher-than-opponent' },
      },
    ],
    // BS5-039 Cheesecake Cookie：【On Play】選至多 1 張對手的 LV.2 以下、
    // 剩餘 HP 3 以上的餅乾，1 傷害。
    'BS5-039': [
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
    // BS5-040 Ananas Dragon Cookie：【Activate】【Once Per Turn】<Place 1 card
    // from the top of this Cookie's HP into the trash.> 選至多 1 張對手餅乾，
    // 1 傷害。代價自動解析。
    'BS5-040': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS5-042 Sniffly Cocoa Palm（item）：<{Y}> <Place 1 of your Cookies' HP
    // cards in the trash.> If your break area is LV.5 or higher, draw up to 2
    // cards from your deck. 文字沒有「Select」目標句式，主效果要手動給；
    // HP 代價見 convertOfficialItemAbility 的 exactCosts。
    'BS5-042': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'break-level-at-least', level: 5 },
      },
    ],
    // BS5-044 Ananas Dragon Cookie's Nest（stage）：<{Y}> Place in your stage
    // area. 【Activate】<{Y}><Rest this card.> During this turn, if any of
    // your Cookies gained HP, select up to 1 of your opponent's Cookies. That
    // Cookie receives 1 damage. Then, <can be used as {Y}.> 1 of your
    // [Ananas Dragon Cookie] gains +1 HP。效果與 exactStageEffects 相同，
    // 提供 convertOfficialCardEffects 的主效果盤點（比照 BS5-022）。
    'BS5-044': [
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
    ],
    // BS5-045 Potato Cookie：【On Play】<Return 1 card from your support area
    // to your hand.> Draw up to 1 card from your deck.
    'BS5-045': [
      {
        kind: 'support-to-hand',
        amount: 1,
      },
      { kind: 'draw-up-to', max: 1 },
    ],
    // BS5-048 Bellflower Cookie：【Activate】<{G}><Rest this card.>
    // <Discard 1 card.> 選至多 1 張對手戰鬥區中沒有技能、LV.1 的餅乾，使其
    // 昏厥。效果與代價寫法同 BS5-036（YELLOW）。
    'BS5-048': [
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
    // BS5-051 Beet Cookie：When your turn ends, if there are 2 active cards or
    // more in your support area, <can be used as {G}.> Place this Cookie on the
    // bottom of your deck.「can be used as {G}」是能量補充說明，不建效果；
    // 回合結束觸發由技能 endPhase 承載。
    'BS5-051': [
      {
        kind: 'return-to-deck-bottom',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'active-support-count-at-least', count: 2 },
      },
    ],
    // BS5-053 Shine Muscat Cookie：【On Play】<{G}{G}> Place up to 1 card from
    // the top of your deck into your support area as rested. 代價自動解析。
    'BS5-053': [{ kind: 'deck-to-support', amount: 1, rested: true }],
    // BS5-056 Longan Dragon Cookie：When your turn ends, if there are 3 active
    // cards or more in your support area, <can be used as {G}.> Select up to 1
    // of your opponent's Cookies. That Cookie receives 2 damage. 被動回合結束
    // 觸發（技能 endPhase）；攻擊的 Then 回合結束延遲見 exactAttackEffects。
    'BS5-056': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'active-support-count-at-least', count: 3 },
      },
    ],
    // BS5-058 Ginseng Cookie：When your turn ends, if there are 3 cards or less
    // in your support area, <can be used as {G}.> Draw up to 1 card from your
    // deck。
    'BS5-058': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'support-count-at-most', count: 3 },
      },
    ],
    // BS5-059 Purple Yam Cookie：【On Play】選至多 1 張對手的休息中 LV.2 以下
    // 餅乾，2 傷害。與 BS5-028 相同但沒有 break 條件。
    'BS5-059': [
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
    // BS5-063 Hero Cookie：When your turn ends, if there are 2 active cards or
    // more in your support area, draw up to 2 cards from your deck.
    'BS5-063': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'active-support-count-at-least', count: 2 },
      },
    ],
    // BS5-064 Dragon Orb（item）：<{G}{G}{G}> Place up to 1 card from the top
    // of your deck into your support area as rested. Then, if there are 7 cards
    // or more in your support area, draw up to 1 card from your deck. 效果與
    // item 能力相同，提供主效果盤點（比照 BS5-042）。
    'BS5-064': [
      { kind: 'deck-to-support', amount: 1, rested: true },
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'support-count-at-least', count: 7 },
      },
    ],
    // BS5-065 Petrification（trap）：<{G}{G}{G}> 對手餅乾本回合攻擊 -2。
    // Then, if there are 7 cards or more in your support area, your opponent
    // selects 1 active card from their support area. Rest that card. 完整陷阱
    // 能力見 exactTrapEffects；這裡只做主效果盤點。
    'BS5-065': [
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
    ],
    // BS5-087 Dino Greetings：陷阱主效果與 Then 條件分開建模；LV.6 條件
    // 只影響後續抽牌，不是陷阱的發動門檻。
    'BS5-087': [
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'break-level-at-least', level: 6 },
      },
    ],
    // BS5-109 Charmed Miners：第二個攻擊下降效果只鎖定對手 LV.1，且
    // 15 張棄牌條件是 Then 子句，不是陷阱的發動門檻。
    'BS5-109': [
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
        condition: { kind: 'trash-count-at-least', count: 15 },
      },
    ],
    // BS5-066 Longan Palace（stage）：<{G}> Place in your stage area. When
    // your turn ends, <discard 1 card.> Set up to 1 card from your support area
    // as active. Then, if [Longan Dragon Cookie] is in your battle area, draw
    // up to 1 card from your deck. 效果與 stageAbility 相同（棄牌為鏈中第一
    // 個效果），提供主效果盤點（比照 BS5-044）。
    'BS5-066': [
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
    ],
    // 是 flipText。BS5-004 的附著 +1 HP 由 FlipAbility.attachedHpBonus
    // 承載（見 exactFlipEffects），這裡空效果陣列只為讓主效果狀態判定為
    // supported；BS5-009 就是一般的抽 1。代價<Discard 1 card.>由 flip 轉接
    // 層的 parseAbilityCost 解析。
    // === BS5 BLUE ability conversions ===
    'BS5-068': [{ kind: 'draw-up-to', max: 1 }],
    'BS5-070': [
      {
        kind: 'return-to-hand',
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS5-071': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'break-level-at-least', level: 2 },
      },
    ],
    'BS5-072': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'break-level-at-least', level: 6 },
      },
    ],
    'BS5-074': [{ kind: 'draw-up-to', max: 2 }],
    'BS5-075': [
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
        condition: { kind: 'hand-count-at-least', count: 5 },
      },
    ],
    'BS5-076': [
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
    'BS5-078': [{ kind: 'draw-up-to', max: 1 }],
    'BS5-081': [
      {
        kind: 'prevent-knockout',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS5-083': [
      {
        kind: 'gain-hp',
        amount: 2,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
      { kind: 'draw-up-to', max: 1 },
    ],
    'BS5-084': [
      {
        kind: 'set-cookie-active',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          excludeSource: true,
          energyColor: 'blue',
        },
      },
    ],
    'BS5-086': [
      {
        kind: 'inspect-deck',
        lookCount: 3,
        pickCount: 1,
        restDestination: 'bottom',
        pickDestination: 'battle',
        filterColor: 'blue',
        filterType: 'cookie',
        optionalPick: true,
        extraHp: 1,
        condition: { kind: 'battle-area-count-at-most', count: 1 },
      },
    ],
    'BS5-088': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
      {
        kind: 'draw-up-to',
        max: 2,
        condition: {
          kind: 'battle-area-has-named-cookie',
          side: 'self',
          name: 'Lotus Dragon Cookie',
        },
      },
    ],
    // === BS5 PURPLE ability conversions ===
    'BS5-091': [
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
        condition: { kind: 'trash-count-at-least', count: 15 },
      },
    ],
    'BS5-098': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, sourceOnly: true },
      },
    ],
    'BS5-100': [
      {
        kind: 'inspect-deck',
        lookCount: 3,
        pickCount: 1,
        restDestination: 'trash',
        filterColor: 'purple',
        optionalPick: true,
      },
    ],
    'BS5-101': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'trash-count-at-least', count: 10 },
      },
    ],
    'BS5-102': [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
    'BS5-104': [
      { kind: 'deck-to-trash', amount: 2, side: 'self' },
      { kind: 'deck-to-trash', amount: 2, side: 'opponent' },
    ],
    'BS5-107': [
      { kind: 'deck-to-trash', amount: 2, side: 'self' },
      { kind: 'deck-to-trash', amount: 2, side: 'opponent' },
    ],
    'BS5-108': [
      {
        kind: 'inspect-deck',
        lookCount: 3,
        pickCount: 1,
        restDestination: 'trash',
        filterColor: 'purple',
        filterType: 'cookie',
        optionalPick: true,
      },
    ],
    'BS5-110': [
      { kind: 'deck-to-trash', amount: 2, side: 'self' },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'battle-area-has-named-cookie',
          side: 'self',
          name: 'Lychee Dragon Cookie',
        },
      },
    ],
    // BS5-111 can equip any Dragon Cookie; the HP clause only gates its bonuses.
    'BS5-111': [
      {
        kind: 'equip-source',
        target: { side: 'self', min: 1, max: 1, keyword: 'dragon' },
        requiredKeyword: 'dragon',
        bonusMaxRemainingHp: 3,
        attackBonus: 1,
        damageReceivedReduction: 1,
      },
    ],
    'BS5-004': [],
    'BS5-009': [{ kind: 'draw-up-to', max: 1 }],
    'BS5-038': [{ kind: 'draw-up-to', max: 1 }],
    'BS5-046': [],
    // 其他四色的同款 flip：附著 +1 HP（041/082/095）與一般抽 1（049/090）。
    // 主效果只做狀態判定，能力實作各自在 exactFlipEffects。
    'BS5-041': [],
    'BS5-082': [],
    'BS5-095': [],
    'BS5-049': [{ kind: 'draw-up-to', max: 1 }],
    'BS5-090': [{ kind: 'draw-up-to', max: 1 }],
    // BS6 basic FLIP cards: attached +1 HP or draw up to 1 card.
    // The attachment bonus is represented by convertOfficialFlipAbility below.
    'BS6-006': [],
    'BS6-009': [{ kind: 'draw-up-to', max: 1 }],
    'BS6-027': [{ kind: 'draw-up-to', max: 1 }],
    'BS6-037': [],
    'BS6-046': [],
    'BS6-056': [{ kind: 'draw-up-to', max: 1 }],
    'BS6-067': [{ kind: 'draw-up-to', max: 1 }],
    'BS6-069': [],
    // BS7-002／BS7-025 的主效果為條件式 FLIP；實際 runtime 效果在 exactFlipEffects。
    'BS7-002': [],
    'BS7-025': [],
    // BS7-030 Rainbow Sherbet Cookie：黃色 Arena 與手牌上限雙條件 FLIP，
    // 具體效果由 exactFlipEffects 綁定。
    'BS7-030': [],
    // BS7-027 Lemon Cookie：若本回合己方有【Arena】餅乾進入休息區，
    // 可選至多 1 張己方 Cookie，本回合攻擊傷害 +2。事件旗標由 break
    // 解析流程累積，條件保留在 runtime effect 以供 UI／AI 共用。
    'BS7-027': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
        condition: { kind: 'arena-cookie-placed-in-break-this-turn' },
      },
    ],
    // BS7-028 Lemon Zest Cookie：本回合有 Arena 餅乾進入休息區時，抽最多 1 張。
    'BS7-028': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'arena-cookie-placed-in-break-this-turn' },
      },
    ],
    // BS7-029 Madeleine Cookie：同一事件條件成立時，選對手餅乾造成 2 傷害。
    'BS7-029': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'arena-cookie-placed-in-break-this-turn' },
      },
    ],
    // BS7-031 Vanilla Sugar Cookie：登場支付黃色能量與棄 1 張手牌，
    // 再選己方戰鬥區 Arena Cookie 增加 1 HP。
    'BS7-031': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, keyword: 'arena' },
      },
    ],
    // BS7-032 Onyx Cream Cookie：本回合事件條件成立時將來源設為 active。
    'BS7-032': [
      {
        kind: 'set-cookie-active',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'arena-cookie-placed-in-break-this-turn' },
      },
    ],
    // BS7-033 Candy Drop Cookie：登場時先將另一張己方 Arena Cookie
    // 放入休息區，再選對手餅乾造成 2 傷害；前段是必須選擇的移動效果，
    // 不能只把後段傷害交給通用 parser，否則會漏掉成本的目標邊界。
    'BS7-033': [
      {
        kind: 'battle-to-break',
        target: {
          side: 'self',
          min: 1,
          max: 1,
          keyword: 'arena',
          excludeSource: true,
        },
      },
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS7-044 Licorice Cookie：從支援區登場時，只在自己的回合橫置對手
    // 支援區最多 2 張卡。來源區與 Your Turn 時機由 skill 欄位保留。
    'BS7-044': [
      { kind: 'rest-support', side: 'opponent', amount: 2, optional: true },
    ],
    // BS7-045 Kumiho Cookie：從支援區登場時，再讓 1 張 Arena Cookie 登場。
    'BS7-045': [
      { kind: 'support-to-battle', amount: 1, keyword: 'arena' },
    ],
    // BS7-046 Green Tea Mousse Cookie：支援區登場先把牌庫頂 1 張放入
    // 支援區（active），攻擊 Then 再從支援區登場 1 張 Arena Cookie；攻擊
    // 的第二段另由 exactAttackEffects 綁定，避免把兩個時機混在一起。
    'BS7-046': [
      { kind: 'deck-to-support', amount: 1, rested: false },
    ],
    // BS7-034 Serious Paladin Trainee 沒有技能；不放入 exact map，讓
    // vanilla card-check 仍以正式攻擊支付路徑驗證。
    // BS7-035 的 On Play 子句由 exactCookieSkillOnPlayEffects 承載，
    // Activate 傷害則沿用 generic conversion 的效果。
    'BS7-036': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: {
          side: 'self',
          min: 0,
          max: 1,
          keyword: 'arena',
          noSkillOnly: true,
        },
      },
    ],
    'BS7-037': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'battle-area-has-color',
          side: 'self',
          color: 'yellow',
          keyword: 'arena',
          excludeSource: true,
        },
      },
    ],
    // BS7-040 Whipped Cream Cookie：昏厥時可支付自身提供的黃色能量，
    // 選擇至多 1 張己方 Arena Cookie 增加 1 HP。sourceEnergy 由技能表承載，
    // faint queue 會在實際結算時要求同一筆支付。
    'BS7-040': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, keyword: 'arena' },
      },
    ],
    // BS7-041 The Key to Unbreakable Faith：休息區事件只限制攻擊加成；
    // Then 抽牌不再重複掛同一條件，保持官方句子中的先後語意。
    'BS7-041': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
        condition: { kind: 'arena-cookie-placed-in-break-this-turn' },
      },
      { kind: 'draw-up-to', max: 1 },
    ],
    // BS7-048 Poison Mushroom Cookie：昏厥時支付自身提供的綠色能量，
    // 將手牌中的 1 張 Arena 卡放入支援區並保持 active。
    'BS7-048': [
      {
        kind: 'hand-to-support',
        amount: 1,
        rested: false,
        keyword: 'arena',
        optional: true,
      },
    ],
    // BS7-053 Red Velvet Cookie：支援區至少 5 張 Arena 卡時解除自身休息狀態。
    'BS7-053': [
      {
        kind: 'set-cookie-active',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: {
          kind: 'support-count-at-least',
          count: 5,
          keyword: 'arena',
        },
      },
    ],
    // BS7-054 Black Lemonade Cookie：On Play 的回手是技能代價，然後把
    // 手牌至多 1 張以疲勞狀態放入支援區。
    'BS7-054': [
      { kind: 'hand-to-support', amount: 1, rested: true, optional: true },
    ],
    // BS7-055 Shining Glitter Cookie：從支援區登場至多 1 張 Cookie。
    'BS7-055': [{ kind: 'support-to-battle', amount: 1 }],
    // BS7-060 Custard Cookie III：從支援區登場時抽最多 1 張。
    'BS7-060': [{ kind: 'draw-up-to', max: 1 }],
    // BS7-061 Pancake Cookie：On Play 先支付 1 張 Arena 支援卡，再抽最多 2 張。
    'BS7-061': [{ kind: 'draw-up-to', max: 2 }],
    // BS7-063 Grand Cookie Games Trophy：檢視牌庫頂 3 張，至多挑 1 張
    // Arena 放入休息支援，其餘牌直接進棄牌區。
    'BS7-063': [
      {
        kind: 'inspect-deck',
        lookCount: 3,
        pickCount: 1,
        restDestination: 'trash',
        pickDestination: 'support',
        filterKeyword: 'arena',
        optionalPick: true,
      },
    ],
    // BS7-067 Dark Choco Cookie：手牌至多 5 張時解除自身休息狀態。
    'BS7-067': [
      {
        kind: 'set-cookie-active',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ],
    // BS7-069 Leek Cookie：棄 2 張手牌後，讓另一張己方 Arena Cookie
    // 本回合造成的攻擊傷害 +1。
    'BS7-069': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          keyword: 'arena',
          excludeSource: true,
        },
      },
    ],
    // BS7-074 Laurel Cookie：手牌至多 3 張時，登場抽最多 2 張。
    'BS7-074': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
    ],
    // BS7-075 Rose Cookie：昏厥效果支付 Arena 手牌後抽最多 2 張。
    'BS7-075': [{ kind: 'draw-up-to', max: 2 }],
    // BS7-076 Cherry Cola Cookie：將來源放到牌庫底後，若仍有另一張
    // 藍色 Arena Cookie，抽最多 1 張。
    'BS7-076': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: {
          kind: 'battle-area-has-color',
          side: 'self',
          color: 'blue',
          keyword: 'arena',
          excludeSource: true,
        },
      },
    ],
    // BS7-077 Chili Pepper Cookie：只要來源仍在戰鬥區，己方紅色 LV.2+
    // Arena Cookie 造成的效果傷害 +1。
    'BS7-077': [
      {
        kind: 'modify-all-effect-damage',
        amount: 1,
        duration: 'persistent',
        side: 'self',
        energyColor: 'red',
        keyword: 'arena',
        minLevel: 2,
      },
    ],
    // BS7-068 General Jujube Cookie：回合結束時抽牌直到手牌有 4 張。
    'BS7-068': [{ kind: 'draw-up-to', max: 4, untilHandSize: 4 }],
    // BS7-083 White Choco Cookie：回合結束時，手牌至多 5 張且有另一張
    // Arena Cookie 時抽最多 1 張。
    'BS7-083': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: {
          kind: 'all-of',
          conditions: [
            { kind: 'hand-count-at-most', count: 5 },
            {
              kind: 'battle-area-has-keyword',
              side: 'self',
              keyword: 'arena',
              excludeSource: true,
            },
          ],
        },
      },
    ],
    // BS7-090 Black Sapphire Cookie：昏厥時棄 2 張，再檢視牌庫頂 5 張，
    // 至多把 Arena 卡加入手牌，其餘進棄牌區。
    'BS7-090': [
      {
        kind: 'inspect-deck',
        lookCount: 5,
        pickCount: 2,
        pickDestination: 'hand',
        restDestination: 'trash',
        filterKeyword: 'arena',
        optionalPick: true,
      },
    ],
    // BS7-093 Cream Puff Cookie：支付紫能量並將自身置入棄牌，再抽最多 2
    // 張後棄 2 張；支付自我移動由 exactCookieSkillCosts 綁定。
    'BS7-093': [{ kind: 'draw-up-to-then-discard', max: 2, discardCount: 2 }],
    // BS7-105 Golem Core：從棄牌區登場至多 1 張 Arena Cookie，成功登場
    // 後只讓剛登場的那張 Cookie 增加 1 HP。
    'BS7-105': [
      {
        kind: 'trash-to-battle',
        amount: 1,
        optional: true,
        keyword: 'arena',
        thenEffects: [
          {
            kind: 'gain-hp',
            amount: 1,
            target: {
              side: 'self',
              min: 1,
              max: 1,
              previousEffectTargetOnly: true,
            },
          },
        ],
      },
    ],
    // BS7-057 Pudding à la Mode Cookie：先把來源卡疲勞放入支援區，
    // 再從支援區登場 1 張 LV.2 以上 Arena Cookie。
    'BS7-057': [
      { kind: 'place-source-to-support', rested: true },
      {
        kind: 'support-to-battle',
        amount: 1,
        optional: false,
        minLevel: 2,
        keyword: 'arena',
      },
    ],
    // BS7-058 Schwarzwälder：5 張 Arena 支援卡以上時，持續獲得 +2 攻擊。
    // 這是 passive skill 的條件式光環，不能套用「this turn」的一次性修正。
    'BS7-058': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: {
          kind: 'support-count-at-least',
          count: 5,
          keyword: 'arena',
        },
      },
    ],
    // BS7-049 Strawberry Crepe Cookie：啟動時先將 Arena 支援卡送入棄牌，
    // 手牌不超過 6 張才抽 1 張並把牌庫頂放入休息支援區。
    'BS7-049': [
      {
        kind: 'draw',
        amount: 1,
        condition: { kind: 'hand-count-at-most', count: 6 },
      },
      {
        kind: 'deck-to-support',
        amount: 1,
        rested: true,
        condition: { kind: 'hand-count-at-most', count: 6 },
      },
    ],
    // BS7-050 Rockstar Cookie：昏厥時先支付「將 1 張支援卡返回手牌」的
    // 觸發代價，再讓對手 1 張已橫置餅乾受到 1 傷害。
    'BS7-050': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1, restedOnly: true },
      },
    ],
    // BS7-051 Mint Choco Cookie：支付 1 張 Arena 支援卡後檢視牌庫頂 3
    // 張，至多挑 1 張 Arena 放入休息支援區，其餘進棄牌區。
    'BS7-051': [
      {
        kind: 'inspect-deck',
        lookCount: 3,
        pickCount: 1,
        restDestination: 'trash',
        pickDestination: 'support',
        filterKeyword: 'arena',
        optionalPick: true,
      },
    ],
    // BS7-003 Raspberry Cookie：登場時若己方有另一張【Arena】Cookie，
    // 本回合對手不能發動 Blocker。關鍵字條件不應被誤縮成顏色條件，
    // 因此使用獨立的 battle-area-has-keyword selector 並排除來源卡。
    'BS7-003': [
      {
        kind: 'disable-block',
        duration: 'this-turn',
        side: 'opponent',
        condition: {
          kind: 'battle-area-has-keyword',
          side: 'self',
          keyword: 'arena',
          excludeSource: true,
        },
      },
    ],
    // BS7-004 Mala Sauce Cookie：只有本回合己方 Arena Cookie 已造成效果傷害
    // 時，才可支付紅色能量對對手餅乾造成 1 傷害。
    'BS7-004': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'arena-cookie-dealt-effect-damage-this-turn' },
      },
    ],
    // BS7-006 Basil Pesto Cookie：登場時支付自身 1 張 HP，接著抽至多 1 張。
    'BS7-006': [{ kind: 'draw-up-to', max: 1 }],
    // BS7-007 Street Urchin Cookie：登場時可從任一方戰鬥區選擇【Arena】Cookie，
    // 讓該 Cookie 受到 1 點傷害；`either` 必須保留，不能誤縮成對手側。
    'BS7-007': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'either', min: 0, max: 1, keyword: 'arena' },
      },
    ],
    // BS7-008 Earl Grey Cookie：先由己方【Arena】Cookie 支付 1 張 HP，
    // 再讓己方至多 1 張 Cookie 增加 1 HP；代價限制放在 exactCookieSkillCosts。
    'BS7-008': [
      { kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 1 } },
    ],
    // BS7-010 Olive Cookie：昏厥時只有己方戰鬥區仍有【Arena】Cookie，
    // 才能選擇對手餅乾造成 1 點傷害；條件必須保留在 faint pending queue。
    'BS7-010': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'battle-area-has-keyword',
          side: 'self',
          keyword: 'arena',
        },
      },
    ],
    // BS7-012 Sachertorte Cookie：先從己方任一【Arena】Cookie 支付 1 張 HP，
    // 再讓同一張已支付 HP 的 Cookie 本回合攻擊傷害 +1；`costSelected`
    // 透過 costRecord 把「that Cookie」鎖回 HP 代價目標。
    'BS7-012': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, costSelected: true },
      },
    ],
    // BS7-013 Chili Pepper Cookie：只要本卡仍在戰鬥區，己方紅色、
    // LV.2 以上【Arena】餅乾造成的效果傷害 +1。
    'BS7-013': [
      {
        kind: 'modify-all-effect-damage',
        amount: 1,
        duration: 'persistent',
        side: 'self',
        energyColor: 'red',
        keyword: 'arena',
        minLevel: 2,
      },
    ],
    // BS7-016 Cream Unicorn Cookie：本回合己方 Arena Cookie 已造成效果傷害
    // 時，登場後最多抽 1 張；條件沿用回合旗標，不把效果傷害誤當普通攻擊。
    'BS7-016': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'arena-cookie-dealt-effect-damage-this-turn' },
      },
    ],
    // BS7-017 Tarte Tatin Cookie：己方戰鬥區有剩餘 HP 2 以下的 Arena
    // Cookie 時，抽至多 2 張再棄 1 張；HP 門檻是同一張關鍵字餅乾的條件。
    'BS7-017': [
      {
        kind: 'draw-up-to-then-discard',
        max: 2,
        discardCount: 1,
        condition: {
          kind: 'battle-area-has-keyword',
          side: 'self',
          keyword: 'arena',
          maxRemainingHp: 2,
        },
      },
    ],
    // BS7-020 Scovilsky Manuscript：只有己方休息區等級總和至少高出對手 2
    // 級時，才可選對手 LV.1 餅乾造成 3 傷害。
    'BS7-020': [
      {
        kind: 'damage',
        amount: 3,
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
        condition: {
          kind: 'break-level-higher-than-opponent',
          minDifference: 2,
        },
      },
    ],
    'BS6-103': [],
    'BS6-104': [{ kind: 'draw-up-to', max: 1 }],
    // BS6 RED: the first runtime batch uses existing target, HP, end-phase and
    // FLIP prevention primitives; these cards remain unavailable in the pool
    // until the full BS6 candidate is promotion-ready.
    'BS6-002': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'source-hp-less-than', amount: 3 },
      },
    ],
    'BS6-001': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
      },
    ],
    'BS6-004': [{ kind: 'draw-up-to', max: 2 }],
    'BS6-008': [
      {
        kind: 'disable-traps',
        duration: 'current-battle',
        condition: { kind: 'source-hp-at-most', amount: 4 },
      },
    ],
    'BS6-010': [{ kind: 'prevent-opponent-battle-movement' }],
    'BS6-011': [
      {
        kind: 'hp-to-hand',
        amount: 1,
        target: { side: 'self', min: 0, max: 1 },
      },
    ],
    'BS6-012': [
      {
        kind: 'hp-to-hand',
        amount: 1,
        target: { side: 'self', min: 0, max: 1 },
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ],
    'BS6-014': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS6-021': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          minLevel: 2,
          maxRemainingHp: 3,
        },
        thenDrawUpToIfTargetRemainingHp: { remainingHp: 1, max: 1 },
      },
    ],
    'BS6-017': [
      {
        kind: 'disable-flip',
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS6-019：先將自己餅乾最上方的 HP 回手，再橫置對手最多 2 張支援卡。
    // 兩段都各自選擇目標，沿用既有 effect queue 逐段處理。
    'BS6-019': [
      {
        kind: 'hp-to-hand',
        amount: 1,
        target: { side: 'self', min: 1, max: 1 },
      },
      {
        kind: 'rest-support',
        side: 'opponent',
        amount: 2,
        activeOnly: true,
        optional: true,
      },
    ],
    'BS6-020': [
      {
        kind: 'modify-attack',
        amount: -2,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'hp-to-hand',
        amount: 1,
        target: { side: 'self', min: 0, max: 1 },
      },
    ],
    // BS6 YELLOW：本批只接入既有 effect primitive 可完整表示的效果。
    // 「從手牌放入休息區」保留為第一段 effect，確保先選牌並更新休息區後才進入後段。
    // 全體傷害仍須逐一選擇對手餅乾，完成每張餅乾的傷害、FLIP 與昏厥處理後，
    // 才能繼續下一個目標；因此不能使用無目標的普通 damage-all。
    'BS6-023': [
      { kind: 'hand-to-break', amount: 1 },
      {
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
        sequential: true,
        target: { side: 'opponent', min: 1, max: 2 },
      },
    ],
    'BS6-025': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: {
          kind: 'all-of',
          conditions: [
            { kind: 'break-level-at-most', level: 2 },
            { kind: 'hand-count-at-most', count: 6 },
          ],
        },
      },
    ],
    // 官方資料將 BS6-028~030 標為 NPC；匯入器已依其 Cookie 的等級、HP 與
    // 攻擊欄位正規化。這裡保留各自的登場技能結算。
    'BS6-028': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: {
          kind: 'break-area-card-count-at-least',
          side: 'self',
          count: 3,
        },
      },
    ],
    'BS6-030': [
      {
        kind: 'draw-up-to-break-cookie-count',
        minLevel: 2,
        amountPerCookie: 1,
      },
    ],
    'BS6-032': [
      { kind: 'hand-to-break', amount: 1 },
      { kind: 'draw-up-to', max: 2 },
    ],
    'BS6-033': [
      {
        kind: 'draw-up-to-then-discard',
        max: 2,
        discardCount: 2,
        condition: { kind: 'break-level-at-least', level: 4 },
      },
    ],
    'BS6-034': [
      { kind: 'reorder-hp', target: { side: 'self', min: 0, max: 1 } },
    ],
    'BS6-039': [
      {
        kind: 'opponent-break-to-trash-then-battle-to-break',
        condition: { kind: 'opponent-break-level-at-most', level: 6 },
      },
    ],
    'BS6-035': [
      {
        kind: 'set-active',
        supportCount: 1,
        selectable: true,
        optional: true,
        condition: {
          kind: 'break-area-card-count-at-least',
          side: 'self',
          count: 2,
        },
      },
    ],
    'BS6-041': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'break-area-card-count-at-least',
          side: 'self',
          count: 3,
        },
      },
      {
        kind: 'draw-up-to',
        max: 1,
        condition: {
          kind: 'break-area-card-count-at-least',
          side: 'self',
          count: 3,
        },
      },
    ],
    'BS6-043': [
      { kind: 'hand-to-break', amount: 1, energyColor: 'yellow' },
      { kind: 'set-active', supportCount: 2, selectable: true, optional: true },
      { kind: 'draw-up-to', max: 1 },
    ],
    // BS6 GREEN：僅採用既有支援區張數條件與可表達的卡牌移動效果。
    'BS6-045': [
      {
        kind: 'draw',
        amount: 1,
        condition: { kind: 'support-count-less-than-opponent', difference: 4 },
      },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'support-count-less-than-opponent', difference: 4 },
      },
    ],
    'BS6-048': [
      {
        kind: 'draw',
        amount: 1,
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      },
      {
        kind: 'opponent-discard-hand',
        count: 1,
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      },
    ],
    // BS6-050 Butter Pretzel Cookie："any number" 不是固定張數；僅列出
    // 綠色支援卡並保留 0 張選擇，確認後才一併返回手牌。
    'BS6-050': [
      {
        kind: 'support-to-hand',
        amount: 0,
        anyNumber: true,
        optional: true,
        energyColor: 'green',
      },
    ],
    'BS6-051': [
      {
        kind: 'support-to-hand',
        amount: 0,
        keepCount: 5,
        condition: { kind: 'support-count-at-least', count: 6 },
      },
    ],
    'BS6-052': [
      {
        kind: 'make-faint',
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
      },
    ],
    'BS6-055': [
      {
        kind: 'modify-damage-received',
        amount: 0,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        minimumDamage: 0,
        setDamageTo: 0,
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      },
    ],
    'BS6-058': [
      {
        kind: 'damage-all',
        amount: 2,
        side: 'opponent',
        // All opponent Cookies are damaged one at a time so the player can
        // choose the resolution order and complete each Cookie's FLIP/faint
        // handling before moving to the next target.
        sequential: true,
        target: { side: 'opponent', min: 1, max: 2 },
        condition: { kind: 'support-count-less-than-opponent', difference: 2 },
      },
    ],
    'BS6-064': [
      {
        kind: 'hand-to-support',
        amount: 1,
        rested: false,
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      },
    ],
    // BS6-062 Time Rend Scissors：第二個尖括號「Return 1 Cookie from your
    // support area to your hand.」是物品啟動代價，另由 exactCosts 限定為
    // 支援區餅乾回手；效果本身是最多 1 張對手餅乾受到 1 點傷害。
    'BS6-062': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS6-063 的「最多 1 張」必須讓玩家可以明確略過，不能在條件成立時
    // 一律把牌庫頂放進支援區；以既有 choose-one 呈現放置／不放置兩條路徑。
    'BS6-063': [
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'choose-one',
        condition: {
          kind: 'all-of',
          conditions: [
            { kind: 'support-count-at-least', count: 5 },
            { kind: 'support-count-at-most', count: 5 },
          ],
        },
        modes: [
          {
            label: '將牌庫頂 1 張卡以休息狀態放入支援區',
            effects: [{ kind: 'deck-to-support', amount: 1, rested: true }],
          },
          { label: '不放置卡牌', effects: [] },
        ],
      },
    ],
    // BS6-057 Coffee Candy Cookie：自身進棄牌區與支援區餅乾回手皆為
    // 括號代價；兩項代價都在 skill cost 支付，效果只剩最後抽最多 1 張。
    'BS6-057': [{ kind: 'draw-up-to', max: 1 }],
    'BS6-071': [{ kind: 'draw-up-to', max: 2 }],
    'BS6-072': [{ kind: 'draw-up-to', max: 3 }],
    // BS6-073 Schneeball Cookie：這是 On Play 技能效果，不是攻擊後效果。
    // 回手藍色 LV.1 餅乾本身由 exactCookieSkillCosts 支付。
    'BS6-073': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS6-066 Maple Taffy Cookie：登場代價先將己方藍色 LV.1 餅乾回手，
    // 再抽最多 1 張。
    'BS6-066': [
      {
        kind: 'return-to-hand',
        target: {
          side: 'self',
          min: 1,
          max: 1,
          maxLevel: 1,
          energyColor: 'blue',
        },
      },
      { kind: 'draw-up-to', max: 1 },
    ],
    // BS6-079 Croissant Cookie：登場代價先將己方藍色 LV.2 以下餅乾
    // 放到牌庫底，再抽最多 2 張。
    'BS6-079': [
      {
        kind: 'field-to-deck-bottom',
        target: {
          side: 'self',
          min: 1,
          max: 1,
          maxLevel: 2,
          energyColor: 'blue',
        },
      },
      { kind: 'draw-up-to', max: 2 },
    ],
    'BS6-080': [
      {
        kind: 'return-to-hand',
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ],
    // BS6-081 Truffle Cookie：對手 LV.1 餅乾或任一方場景回到其擁有者
    // 牌庫底；後段的棄 1 張牌只在手牌至少 5 張時才執行。
    'BS6-081': [
      {
        kind: 'field-to-deck-bottom',
        target: { side: 'either', min: 0, max: 1, maxLevel: 1 },
        allowStage: true,
        battleSide: 'opponent',
      },
      {
        kind: 'discard-hand',
        count: 1,
        condition: { kind: 'hand-count-at-least', count: 5 },
      },
    ],
    'BS6-082': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ],
    'BS6-083': [{ kind: 'draw-up-to-then-discard', max: 2, discardCount: 1 }],
    'BS6-084': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ],
    'BS6-085': [
      {
        kind: 'modify-attack',
        amount: -2,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'hand-count-at-most', count: 4 },
      },
    ],
    'BS6-086': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1, energyColor: 'blue' },
      },
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
    ],
    'BS6-089': [{ kind: 'trash-to-hand', max: 1 }],
    'BS6-090': [{ kind: 'deck-to-trash', amount: 2, side: 'self' }],
    // BS6-091 官方資料只有異圖，且 adapter 會先把合併在 attackText 的技能
    // 拆回 skill.text。從棄牌區登場時可選己方另一張紫色 LV.1 休息區餅乾
    // 放入棄牌區。
    'BS6-091': [
      {
        kind: 'break-to-trash',
        max: 1,
        energyColor: 'purple',
        exactLevel: 1,
        excludeCardId: 'BS6-091',
      },
    ],
    'BS6-093': [
      {
        kind: 'field-to-trash',
        target: { side: 'self', min: 0, max: 1, maxLevel: 1 },
      },
    ],
    'BS6-094': [
      {
        kind: 'field-to-trash',
        target: { side: 'self', min: 0, max: 1, maxLevel: 1 },
      },
    ],
    // BS6-101 的「最多 1 張」必須保留 0 張選擇；「can be used as {P}」
    // 是這個昏厥效果本身的可選能量代價，必須先從支援區支付，才能
    // 繼續選擇棄牌區的紫色餅乾登場。
    'BS6-101': [
      {
        kind: 'trash-to-battle',
        amount: 1,
        optional: true,
        energyColor: 'purple',
        energyCost: { purple: 1 },
      },
    ],
    'BS6-105': [{ kind: 'draw-up-to-then-discard', max: 2, discardCount: 1 }],
    'BS6-106': [
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'trash-to-battle',
        amount: 1,
        optional: true,
        energyColor: 'purple',
        maxHp: 2,
      },
    ],
    // BS6-087／098／099 只在「從棄牌區登場」時才觸發；觸發來源限制由
    // fromTrashArea 統一處理，以下只保留卡面指定的實際結算順序。
    'BS6-087': [{ kind: 'trash-to-hand', max: 1, energyColor: 'purple' }],
    'BS6-098': [{ kind: 'deck-to-trash', amount: 5, side: 'opponent' }],
    'BS6-099': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1, minRemainingHp: 2 },
      },
    ],
    // BS6-107 TBD Machine Room：只有本回合已從棄牌區登場過餅乾時，才對
    // 對手全體造成效果傷害；旗標由 trash-to-battle 在實際登場後記錄。
    'BS6-107': [
      {
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
        condition: { kind: 'cookie-played-from-trash-this-turn' },
      },
    ],
    // BS8-002 Cilantro Cobra Swordsman：Activate／每回合一次。來源剩餘
    // HP 恰為 1 時，先讓來源補 1 HP；Then 是玩家可選的技能後續，必須
    // 先支付 1 點紅色能量，再抽 1 並對至多一張對手餅乾造成 1 傷害。
    // 沿用 optional-cost-attack 的付款管道，但標記為 `ability`，避免被
    // 攻擊後效果的 battle resolver 誤處理。
    'BS8-002': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'source-hp-less-than', amount: 2 },
      },
      {
        kind: 'optional-cost-attack',
        resolution: 'ability',
        cost: { energy: { red: 1 }, discardHand: 0 },
        effectText:
          'Then, <can be used as {R}.> Draw 1 card from your deck and select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
        effects: [
          { kind: 'draw-up-to', max: 1 },
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      },
    ],
    // BS8-003 Cilantro Cobra Fighter：不是「選 1 張」；來源剩餘 HP 恰為
    // 1 時，所有目前剩餘 HP 為 4 以下的己方戰鬥區餅乾都各自獲得 1 HP。
    // 戰鬥區上限為兩張，`allMatching` 會在規則層強制結算每一張合法目標。
    'BS8-003': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: {
          side: 'self',
          min: 1,
          max: 2,
          maxRemainingHp: 4,
          allMatching: true,
        },
        condition: { kind: 'source-hp-less-than', amount: 2 },
      },
    ],
    // BS8-018 Cake Wolf：昏厥後先把剛進休息區的來源送進棄牌區，再對至多
    // 一張對手餅乾造成傷害；來源可作為 1 點紅色能量見 sourceEnergy map。
    'BS8-018': [
      { kind: 'break-source-to-trash' },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS8-028／029 的官方異畫資料將技能與攻擊合併；正規化後保留的技能
    // 皆只在本回合確實有餅乾從休息區登場時才能結算。
    'BS8-028': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'cookie-played-from-break-this-turn' },
      },
    ],
    'BS8-029': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'cookie-played-from-break-this-turn' },
      },
    ],
    // BS8-043 Fettuccine Cookie：啟動來源本身必須留在兩格戰鬥區，故唯一
    // 可受益的「that Cookie」就是另一格本回合從 break 登場的 LV.3。此處
    // 不加入玩家任選或全體語意；selector 只接受這一張實際場上實體。
    'BS8-043': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: {
          side: 'self',
          min: 1,
          max: 1,
          minLevel: 3,
          maxLevel: 3,
          enteredFrom: 'break',
          enteredThisTurn: true,
        },
      },
    ],
    // BS8-086 Cream Puff Cookie：On Play 的「Draw up to 1」不帶付款、目標
    // 或後續條件；保留 optional draw，讓牌庫不足時沿用通用的安全抽牌流程。
    'BS8-086': [{ kind: 'draw-up-to', max: 1 }],
    // BS8-053 Gim Cookie：只可選最多一張綠色、已休息的支援卡恢復活動。
    'BS8-053': [
      {
        kind: 'set-active',
        supportCount: 1,
        energyColor: 'green',
        selectable: true,
        optional: true,
      },
    ],
    // BS8-064 Snake Fruit Cookie：和 BS8-053 相同流程但不限顏色、最多兩張。
    'BS8-064': [
      {
        kind: 'set-active',
        supportCount: 2,
        selectable: true,
        optional: true,
      },
    ],
    // BS8-057 Vagabond Cookie：支援區落後時，每回合一次抽至多一張。
    'BS8-057': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      },
    ],
    // BS8-061 Chives Dumpling King：這是持續被動，不可只靠文字解析的
    // modify-attack 預設值；少兩張以上支援卡的門檻必須留在規則層，否則
    // 在雙方支援區同數時仍會錯誤加攻。
    'BS8-061': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'support-count-less-than-opponent', difference: 2 },
      },
    ],
    // BS8-071 Peach Baos：支援區張數落後時，只可補至多一張剩餘 HP 不超過 3
    // 的己方餅乾，不能把條件或 HP 上限交給 UI 自行判斷。
    'BS8-071': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, maxRemainingHp: 3 },
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      },
    ],
    'BS8-096': [
      {
        kind: 'draw-up-to',
        max: 4,
        condition: { kind: 'hand-count-at-most', count: 2 },
      },
    ],
    'BS8-097': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, maxLevel: 2 },
        condition: { kind: 'hand-count-at-most', count: 2 },
      },
    ],
    // BS8-062 Shrimp Dumpling King：同一張數落後條件下，將至多一張手牌
    // 以休息狀態放入支援區。
    'BS8-062': [
      {
        kind: 'hand-to-support',
        amount: 1,
        rested: true,
        optional: true,
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      },
    ],
    // BS8-088 Milk Cookie：支付一點藍色能量後，手牌五張以下才可恢復自身。
    'BS8-088': [
      {
        kind: 'set-cookie-active',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ],
    // BS8-113 Knight Cookie：棄牌區達十五張時恢復來源本身。
    'BS8-113': [
      {
        kind: 'set-cookie-active',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'trash-count-at-least', count: 15 },
      },
    ],
    // BS8-117 Healer Cookie 1：登場時若棄牌區達十五張，可抽至多一張。
    'BS8-117': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'trash-count-at-least', count: 15 },
      },
    ],
    // BS8-009 Burning Spice Cookie：兩個 damage-all 分別覆蓋對手與己方，
    // 但己方段排除來源，合起來正是「all other Cookies」。後段的加傷以
    // 休息區總 LV.（不是卡片張數）每完成一組 3 點計算一次（Math.floor）；Then 的尖括號是
    // 玩家可選的支援區紅色能量支付，不是來源餅乾自動供能。
    'BS8-009': [
      {
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
        condition: { kind: 'battle-area-has-another-cookie', side: 'self' },
      },
      {
        kind: 'damage-all',
        amount: 1,
        side: 'self',
        excludeSource: true,
        condition: { kind: 'battle-area-has-another-cookie', side: 'self' },
      },
      {
        kind: 'optional-cost-attack',
        resolution: 'ability',
        cost: { energy: { red: 1 }, discardHand: 0 },
        effectText:
          'Then, <can be used as {R}.> For each 3 levels your break area has reached, during this turn, this Cookie gains +1 attack damage.',
        effects: [
          {
            kind: 'modify-attack-by-break-count',
            perCount: 1,
            groupSize: 3,
            countMode: 'break-level',
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      },
    ],
    // BS8-084 Sherbet Cookie：這是休息時的攻擊宣告門檻，不是攻擊 Then。
    // `battle.ts` 會先要求攻擊方棄 1 張手牌，成功後才建立 pendingBattle。
    'BS8-084': [
      {
        kind: 'require-opponent-attack-discard-hand',
        count: 1,
        whileSourceRested: true,
      },
    ],
    // BS8 各色 Blocker：付款解析保留卡面指定顏色，效果則一律把本卡設為
    // 當次攻擊目標；不可退化為一般的可選戰鬥區目標。
    'BS8-008': [
      {
        kind: 'redirect-attack',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS8-044': [
      {
        kind: 'redirect-attack',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS8-056': [
      {
        kind: 'redirect-attack',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS8-081': [
      {
        kind: 'redirect-attack',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS8-116': [
      {
        kind: 'redirect-attack',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    // BS8-051 Meat Dumpling King：昏厥後可從己方支援區登場至多一張餅乾。
    'BS8-051': [{ kind: 'support-to-battle', amount: 1, optional: true }],
    // BS8-077 Kumiho Cookie：登場時將對手至多一張 LV.1 餅乾置於其牌庫底。
    'BS8-077': [
      {
        kind: 'return-to-deck-bottom',
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
      },
    ],
    // BS8-085 Pinecone Cookie：棄兩張手牌後，使對手至多一張剩 1 HP 的餅乾昏厥。
    'BS8-085': [
      {
        kind: 'make-faint',
        target: { side: 'opponent', min: 0, max: 1, remainingHp: 1 },
      },
    ],
    // BS8-107 Wizard Cookie：棄一張紫色物品後，移除對手至多一張餅乾的一張 HP。
    'BS8-107': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS8-111 Onion Cookie：登場時棄一張手牌，將牌庫頂至多四張放入棄牌區。
    'BS8-111': [{ kind: 'deck-to-trash', amount: 4, side: 'self' }],
    // BS8-020 Pepper Pangolin Cookie：僅在自身剩 1 HP 時，將來源自戰場放入棄牌區。
    'BS8-020': [
      {
        kind: 'field-to-trash',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'source-hp-less-than', amount: 2 },
      },
    ],
    // BS8-022 Cake Hound's Crown：先使自己一張 Cookie 昏厥作為成本，再從
    // 棄牌區回收至多兩張紅色 LV.1 Cookie。成本不能降成效果，否則無合法
    // 昏厥目標時仍會違反卡面文字地回收卡牌。
    'BS8-022': [
      {
        kind: 'trash-to-hand',
        max: 2,
        energyColor: 'red',
        cookieOnly: true,
        maxLevel: 1,
      },
    ],
    // BS8-072 Soul Jam: Light of Apathy：展示的兩張都離開牌庫；至多一張
    // 直立進支援區，其餘橫置進支援區，之後才可裝備到 Mystic Flour。
    'BS8-072': [
      {
        kind: 'inspect-deck',
        lookCount: 2,
        pickCount: 1,
        restDestination: 'support-rested',
        pickDestination: 'support',
        pickSupportRested: false,
        optionalPick: true,
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      },
      {
        kind: 'equip-source',
        target: { side: 'self', min: 0, max: 1 },
        requiredCookieId: 'BS8-059',
        gainHp: 1,
      },
    ],
    // BS8-122 Milk Cart：紫色非 Cookie 手牌是啟動代價（見 item exactCosts），
    // 成本付清後才抽至多兩張；不能把棄牌誤建模成抽牌效果的選擇目標。
    'BS8-122': [{ kind: 'draw-up-to', max: 2 }],
    // BS8-092 Angel Cookie：手牌一張以下時，將來源自身置於牌庫底。
    'BS8-092': [
      {
        kind: 'return-to-deck-bottom',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'hand-count-at-most', count: 1 },
      },
    ],
    // BS8-017 Cake Monster Army：從棄牌區登場的餅乾必須是紅色且印刷 HP 為 1；
    // 後續 1 點傷害只在實際登場成功後才進入效果佇列。
    'BS8-017': [
      {
        kind: 'trash-to-battle',
        amount: 1,
        optional: true,
        energyColor: 'red',
        maxHp: 1,
        thenEffects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'either', min: 0, max: 1 },
          },
        ],
      },
    ],
    // BS8-013 Pomegranate Cake Shaman：你的回合昏厥時，先移除剛進休息區的
    // 來源，再讓至多一張紅色 LV.1、非同名 Cookie 從棄牌區登場。
    'BS8-013': [
      { kind: 'break-source-to-trash' },
      {
        kind: 'trash-to-battle',
        amount: 1,
        optional: true,
        energyColor: 'red',
        exactLevel: 1,
        excludeCardName: 'Pomegranate Cake Shaman',
      },
    ],
    // BS8-019@1 Cake Hound：昏厥觸發的棄牌成本後，來源自休息區進棄牌區，
    // 再選至多一張非同名紅色 LV.1 Cookie 回手。
    'BS8-019': [
      { kind: 'break-source-to-trash' },
      {
        kind: 'trash-to-hand',
        max: 1,
        energyColor: 'red',
        cookieOnly: true,
        maxLevel: 1,
        excludeCardName: 'Cake Hound',
      },
    ],
    // BS8-052 Cloud Haetae Cookie：支援區比對手少至少兩張時，將來源送入
    // 棄牌區後，至多兩張綠色手牌以休息狀態進支援區。
    'BS8-052': [
      {
        kind: 'hand-to-support',
        amount: 2,
        rested: true,
        energyColor: 'green',
        optional: true,
        condition: { kind: 'support-count-less-than-opponent', difference: 2 },
      },
    ],
    // BS8-059 Mystic Flour Cookie：支付一點綠色能量、把兩張綠色支援卡回手
    // 後，對每張對手 Cookie 各自移除至多兩張 HP 卡。
    'BS8-059': [{ kind: 'hp-to-trash-all', amount: 2, side: 'opponent' }],
    // BS8-060 Peach Blossom Cookie：回手一張綠色支援卡後二選一；兩個模式
    // 的目標陣營不同，必須保留成 choose-one，不能把傷害誤套到己方目標。
    'BS8-060': [
      {
        kind: 'choose-one',
        modes: [
          {
            label: 'Select up to 1 of your Cookies. That Cookie gains +1 HP.',
            effects: [
              {
                kind: 'gain-hp',
                amount: 1,
                target: { side: 'self', min: 0, max: 1 },
              },
            ],
          },
          {
            label: "Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage.",
            effects: [
              {
                kind: 'damage',
                amount: 1,
                target: { side: 'opponent', min: 0, max: 1 },
              },
            ],
          },
        ],
      },
    ],
    // BS8-038 Olive Cookie：登場時必須先把一張 LV.3 Cookie 自手牌放進
    // 休息區，之後才可把至多兩張 LV.1 Cookie 從休息區送入棄牌區。
    'BS8-038': [
      { kind: 'hand-to-break', amount: 1, minLevel: 3, maxLevel: 3 },
      { kind: 'break-to-trash', max: 2, exactLevel: 1 },
    ],
    // BS8-039 Shelly：每回合一次的 LV.2 手牌休息成本完成後，才可讓至多
    // 一張 LV.2 以下的休息區 Cookie 登場。
    'BS8-039': [
      { kind: 'hand-to-break', amount: 1, minLevel: 2, maxLevel: 2 },
      { kind: 'break-to-battle', amount: 1, maxLevel: 2 },
    ],
    // BS8-047 Puny Strength：展示並不是「任選一張」的提示，而是後段 Then
    // 必須移動的同一張手牌實體；`revealedCardOnly` 由規則層鎖定該 ID。
    'BS8-047': [
      {
        kind: 'reveal-hand',
        amount: 1,
        selectCard: true,
        cookieOnly: true,
        minLevel: 3,
        maxLevel: 3,
      },
      {
        kind: 'break-to-battle',
        amount: 1,
        optional: true,
        exactLevel: 3,
        energyColor: 'yellow',
      },
      {
        kind: 'hand-to-break',
        amount: 1,
        minLevel: 3,
        maxLevel: 3,
        revealedCardOnly: true,
      },
    ],
    // BS8-021 Soul Jam: Light of Destruction：傷害要排除所有同名的
    // Burning Spice Cookie；裝備與攻擊時的陷阱封鎖則在 Item ability
    // 的 equippedAttackEffects 保存，避免每次攻擊重複執行這次性的全體傷害。
    'BS8-021': [
      {
        kind: 'damage-all',
        amount: 1,
        side: 'self',
        excludeCardName: 'Burning Spice Cookie',
      },
      {
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
        excludeCardName: 'Burning Spice Cookie',
      },
      {
        kind: 'equip-source',
        target: { side: 'self', min: 0, max: 1 },
        requiredCookieId: 'BS8-009',
      },
    ],
    // BS8-032／034 Cheese Cookie：兩者均先把來源與一張手牌送入休息區；
    // 僅能讓指名的 Golden Cheese Cookie 從休息區登場。BS8-034 另覆寫為 6 HP。
    'BS8-032': [
      {
        kind: 'battle-to-break',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'break-area-has-card', side: 'self' },
      },
      { kind: 'hand-to-break', amount: 1, minLevel: 2 },
      { kind: 'draw-up-to', max: 2 },
      { kind: 'break-to-battle', amount: 1, cardName: 'Golden Cheese Cookie' },
    ],
    'BS8-034': [
      {
        kind: 'battle-to-break',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'break-area-has-card', side: 'self' },
      },
      { kind: 'hand-to-break', amount: 1 },
      {
        kind: 'break-to-battle',
        amount: 1,
        cardName: 'Golden Cheese Cookie',
        hpCount: 6,
      },
    ],
    // BS8-035 Cinnamon Cookie：先把一張棄牌區 Cookie 放進休息區，接著只能
    // 將與該張卡同等級的休息區 Cookie 送進棄牌區。
    'BS8-035': [
      { kind: 'trash-to-break', amount: 1 },
      {
        kind: 'break-to-trash',
        max: 1,
        sameLevelAsPreviousEffectTarget: true,
      },
    ],
    // BS8-042 Adventurer Cookie：僅從休息區登場時，才可令對手至多一張支援卡
    // 在下一個 Active Phase 維持原狀，不被設為活躍。
    'BS8-042': [
      {
        kind: 'prevent-support-active-next-phase',
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS8-031 Mozzarella Cookie：卡面尖括號的 LV.3 棄牌區→休息區移動必須
    // 在後續選兩張、等級總和不超過 3 的回手前完成；不能降成只看總和的泛用效果。
    'BS8-031': [
      { kind: 'trash-to-break', amount: 1, exactLevel: 3 },
      {
        kind: 'break-to-hand-by-level-sum',
        targetSum: 3,
        targetSumMode: 'at-most',
        cardCount: 2,
      },
    ],
    // BS8-011 Saffron Buffalo Shaman：兩位玩家各自必須選一張 Cookie；兩段
    // 不能合併為 either 目標，否則會遺失「每位玩家各一張」的強制基數。
    'BS8-011': [
      { kind: 'damage', amount: 1, target: { side: 'self', min: 1, max: 1 } },
      { kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } },
    ],
    // BS8-079 Snowflake Cookie：對手下一個 Active Phase 不得把指定 LV.1
    // Cookie 轉為活躍；標記由回合引擎在該玩家的下一個 Active Phase 消耗。
    'BS8-079': [
      {
        kind: 'prevent-cookie-active-next-phase',
        target: { side: 'opponent', min: 0, max: 1, minLevel: 1, maxLevel: 1 },
      },
    ],
    // BS8-083 Frost Queen Cookie：登場時可讓任一對手 Cookie 略過下一個
    // Active Phase 的活躍處理；攻擊的抽至三張手牌由一般 attack 解析處理。
    'BS8-083': [
      {
        kind: 'prevent-cookie-active-next-phase',
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS8-078 Snow Sugar Cookie：手牌三張以下時，先讓來源到牌庫底，再讓
    // 至多一張藍色 LV.2+ 餅乾登場並獲得 1 HP。gainHp 必須屬於實際登場卡。
    'BS8-078': [
      {
        kind: 'hand-to-battle',
        amount: 1,
        energyColor: 'blue',
        minLevel: 2,
        optional: true,
        gainHp: 1,
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
    ],
    // BS8-082 Cotton Cookie：兩張手牌與來源牌庫底成本完成後，至多一張
    // 己方藍色 LV.2 以下 Cookie 獲得 1 HP。
    'BS8-082': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: {
          side: 'self',
          min: 0,
          max: 1,
          energyColor: 'blue',
          maxLevel: 2,
        },
      },
    ],
    // BS8-087 Starfruit Cookie：登場成本要求退回另一張藍色 LV.1 Cookie；
    // 之後才把對手至多一張 LV.1 Cookie 放到牌庫底。
    'BS8-087': [
      {
        kind: 'return-to-deck-bottom',
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
      },
    ],
    // BS8-119 Crunchy Chip Cookie：只可從己方棄牌區登場指定的
    // Dark Cacao Cookie；名稱限制放在 selector，而不是 UI 特判。
    'BS8-119': [
      {
        kind: 'trash-to-battle',
        amount: 1,
        optional: true,
        cardName: 'Dark Cacao Cookie',
      },
    ],
    // BS8-120 Caramel Arrow Cookie：棄牌區達十五張後才可讓至多一張
    // LV.2 以上 Cookie 從棄牌區登場。
    'BS8-120': [
      {
        kind: 'trash-to-battle',
        amount: 1,
        optional: true,
        minLevel: 2,
        condition: { kind: 'trash-count-at-least', count: 15 },
      },
    ],
    // BS8-068 Yugwa Cookie：昏厥後僅在己方支援區少於對手時，讓對手從自己
    // 的活躍支援區選一張休息。選擇權屬對手，不能誤用一般 rest-support。
    'BS8-068': [
      {
        kind: 'opponent-rests-support',
        amount: 1,
        activeOnly: true,
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      },
    ],
    // BS8-012 Pomegranate Cake Hound：你的回合中本卡昏厥時，先把剛進休息區的
    // 來源送進棄牌區，再抽至多一張。這個來源移動是尖括號代價，不能漏掉或
    // 與抽牌交換順序。
    'BS8-012': [
      { kind: 'break-source-to-trash' },
      { kind: 'draw-up-to', max: 1 },
    ],
    // BS8-016 Choco Cake Hound：同一種昏厥來源代價後，僅能讓剩餘 HP 至多 5
    // 的己方餅乾獲得 1 HP；目標可選 0，因此保留 min: 0。
    'BS8-016': [
      { kind: 'break-source-to-trash' },
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, maxRemainingHp: 5 },
      },
    ],
    // BS8-114 Old Milk Villager Cookie：棄牌區至少 30 張時才把整個棄牌區
    // 洗回牌庫；+1 HP 是 Then，因此必須內嵌，避免門檻不成立仍讓來源回血。
    'BS8-114': [
      {
        kind: 'trash-to-deck-all',
        condition: { kind: 'trash-count-at-least', count: 30 },
        thenEffects: [
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      },
    ],
    // BS8-103 Dark Cacao Cookie：僅從棄牌區登場時，對每張對手餅乾各移除
    // 至多一張 HP；「can be used as {P}」是來源供應能量。
    'BS8-103': [{ kind: 'hp-to-trash-all', amount: 1, side: 'opponent' }],
    // BS7-001 Nutmeg Tiger Cookie：Activate／每回合一次，將自身 1 張 HP
    // 放進棄牌區後，可選至多 1 張己方 LV.3 Cookie，本回合攻擊傷害 +1。
    // HP 代價由 parseAbilityCost 的 sourceOnly 規則保留，目標須限於 LV.3。
    'BS7-001': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1, minLevel: 3, maxLevel: 3 },
      },
    ],
  }
  const exactEffects =
    exactStarterEffects[card.cardNumber] ??
    exactStarterEffects[cardKey] ??
    P_EXACT_EFFECTS[card.cardNumber] ??
    P_EXACT_EFFECTS[cardKey]
  if (exactEffects) {
    return {
      status: 'supported',
      cardNumber: card.cardNumber,
      sourceText,
      effects: exactEffects,
    }
  }

  if (/\{bl\}/i.test(sourceText) && /redirect\s+the\s+attack\s+to\s+this\s+Cookie/i.test(sourceText)) {
    return {
      status: 'supported',
      cardNumber: card.cardNumber,
      sourceText,
      effects: [
        {
          kind: 'redirect-attack',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        },
      ],
    }
  }

  if (/opponent\s+cannot\s+activate\s+\{bl\}/i.test(sourceText)) {
    return {
      status: 'supported',
      cardNumber: card.cardNumber,
      sourceText,
      effects: [
        {
          kind: 'disable-block',
          duration: 'this-turn',
          side: 'opponent',
        },
      ],
    }
  }

  const isFaintSkill = FAINT_TRIGGER_PATTERN.test(sourceText)
  if (isFaintSkill && card.type !== 'cookie') {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      sourceText,
      reason: 'unsupported-effect-text',
    }
  }

  if (isFaintSkill) {
    const target = parseTarget(sourceText)
    const condition = parseCondition(sourceText)
    const damageMatch = sourceText.match(/receives?\s+(\d+)\s+damage/i)
    if (damageMatch) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'damage',
            amount: Number(damageMatch[1]),
            target: target ?? { side: 'opponent', min: 1, max: 1 },
            condition,
          },
        ],
      }
    }
    const strippedFaintText = stripEffectText(sourceText)
    const drawMatch = parseSimpleDraw(strippedFaintText)
    if (drawMatch !== null) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          isOptionalDraw(strippedFaintText)
            ? { kind: 'draw-up-to', max: drawMatch }
            : { kind: 'draw', amount: drawMatch },
        ],
      }
    }
    const breakToTrashParsed = parseBreakToTrash(stripEffectText(sourceText))
    if (breakToTrashParsed) {
      const effect: CardEffect = {
        kind: 'break-to-trash',
        max: breakToTrashParsed.max,
        exactLevel: breakToTrashParsed.exactLevel,
      }

      if (breakToTrashParsed.conditionLevel) {
        effect.condition = {
          kind: 'break-level-at-least',
          level: breakToTrashParsed.conditionLevel,
        }
      }

      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [effect],
      }
    }
  }

  if (/\bThen\b/i.test(sourceText)) {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      sourceText,
      reason: 'unsupported-effect-text',
    }
  }

  if (/If\s+(?:\d+\s+of\s+)?your opponent's Cookies?\s+attacks?\s+more than\s+\d+/i.test(sourceText)) {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      sourceText,
      reason: 'unsupported-effect-text',
    }
  }

  if (isUnsupportedBracketCost(sourceText)) {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      sourceText,
      reason: 'unsupported-effect-text',
    }
  }

  if (card.type === 'stage' && /Place in your stage area/i.test(sourceText)) {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      sourceText,
      reason: 'unsupported-effect-text',
    }
  }

  if (card.type !== 'flip') {
    const strippedDrawText = stripEffectText(sourceText)
    const drawAmount = parseSimpleDraw(strippedDrawText)

    if (drawAmount !== null) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          isOptionalDraw(strippedDrawText)
            ? { kind: 'draw-up-to', max: drawAmount }
            : { kind: 'draw', amount: drawAmount },
        ],
      }
    }

    const conditionalDrawAmount = parseConditionalDraw(
      stripEffectText(sourceText),
    )

    // CONDITIONAL_DRAW_RE only matches "...you can draw...", so this is always optional
    if (conditionalDrawAmount !== null) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'draw-up-to',
            max: conditionalDrawAmount,
            condition: parseCondition(sourceText),
          },
        ],
      }
    }

    const deckToSupportAmount = parseDeckToSupport(stripEffectText(sourceText))

    if (deckToSupportAmount !== null) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'deck-to-support',
            amount: deckToSupportAmount,
          },
        ],
      }
    }

    const breakToTrashParsed = parseBreakToTrash(stripEffectText(sourceText))

    if (breakToTrashParsed) {
      const effect: CardEffect = {
        kind: 'break-to-trash',
        max: breakToTrashParsed.max,
        exactLevel: breakToTrashParsed.exactLevel,
      }

      if (breakToTrashParsed.conditionLevel) {
        effect.condition = {
          kind: 'break-level-at-least',
          level: breakToTrashParsed.conditionLevel,
        }
      }

      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [effect],
      }
    }

    // 通用物品/場景效果解析
    if (/flip\s+effect\s+cannot\s+be\s+activated/i.test(sourceText)) {
      const dfTarget = parseTarget(sourceText) ?? {
        side: 'opponent',
        min: 0,
        max: 1,
      }
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'disable-flip',
            duration: 'this-turn',
            target: dfTarget,
          },
        ],
      }
    }

    if (/view\s+(?:the\s+)?HP\s+cards/i.test(sourceText)) {
      const vhTarget = parseTarget(sourceText) ?? {
        side: 'opponent',
        min: 0,
        max: 1,
      }
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'view-hp',
            target: vhTarget,
            optional: true,
          },
        ],
      }
    }

    const allAttackMatch = sourceText.match(
      /all\s+(?:your\s+)?Cookies(?:\s+currently\s+in\s+your\s+battle\s+area)?\s+gain\s+\+(\d+)\s+attack\s+damage/i,
    )
    if (allAttackMatch) {
      const condition = parseCondition(sourceText)
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'modify-all-attack',
            amount: Number(allAttackMatch[1]),
            duration: /this\s+turn/i.test(sourceText)
              ? 'this-turn'
              : 'persistent',
            side: 'self',
            condition,
          },
        ],
      }
    }

    const battleToSupportMatch = sourceText.match(
      /Select\s+(?:up to\s+)?(\d+)\s+(?:of\s+)?(?:your\s+)?(?:.*\s+)?Cookie.*?\s+(?:LV\.(\d+)\s+or\s+lower\s+)?(?:and\s+)?place\s+it\s+in\s+your\s+support\s+area/i,
    )
    if (battleToSupportMatch) {
      const btsTarget: EffectTargetSelector = {
        side: 'self',
        min: Number(battleToSupportMatch[1]),
        max: Number(battleToSupportMatch[1]),
      }
      if (battleToSupportMatch[2]) {
        btsTarget.maxLevel = Number(battleToSupportMatch[2])
      }
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'battle-to-support',
            target: btsTarget,
          },
        ],
      }
    }

    const trashToBattleMatch = sourceText.match(
      /(?:Select|Play)\s+(\d+)\s+(?:LV\.(\d+)\s+)?Cookie\s+from\s+your\s+trash/i,
    )
    if (trashToBattleMatch) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'trash-to-battle',
            amount: Number(trashToBattleMatch[1]),
          },
        ],
      }
    }

    const returnToHandMatch = sourceText.match(
      /Return\s+(\d+)\s+(?:LV\.(\d+)\s+)?(?:([RYGBPKN])\s+)?Cookie\s+(?:from\s+your\s+battle\s+area\s+)?to\s+your\s+hand/i,
    )
    if (returnToHandMatch) {
      const effect: ReturnToHandEffect = {
        kind: 'return-to-hand',
        target: {
          side: /from\s+your\s+battle\s+area/i.test(sourceText) ? 'self' : 'opponent',
          min: Number(returnToHandMatch[1]),
          max: Number(returnToHandMatch[1]),
        },
      }
      if (returnToHandMatch[2]) effect.target.minLevel = Number(returnToHandMatch[2])
      const hpMatch = sourceText.match(/remaining HP is (\d+) or more/i)
      if (hpMatch) effect.target.minRemainingHp = Number(hpMatch[1])
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [effect],
      }
    }

    if (/Return\s+this\s+Cookie\s+to\s+your\s+hand/i.test(sourceText)) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'return-to-hand',
            target: {
              side: 'self',
              min: 1,
              max: 1,
              sourceOnly: true,
            },
          },
        ],
      }
    }

    const randomDiscardMatch = sourceText.match(
      /Place\s+(\d+)\s+random\s+card(?:s)?\s+from\s+your\s+opponent['']s\s+hand\s+into\s+the\s+trash/i,
    )
    if (randomDiscardMatch) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'opponent-random-discard' as const,
            count: Number(randomDiscardMatch[1]),
          },
        ],
      }
    }

    const opponentDiscardHandMatch = sourceText.match(
      /Your opponent must place (\d+) card(?:s)? from their hand into the trash/i,
    )
    if (opponentDiscardHandMatch) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'opponent-discard-hand',
            count: Number(opponentDiscardHandMatch[1]),
          },
        ],
      }
    }

    const battleToTrashMatch = sourceText.match(
      /Place\s+(\d+)\s+of\s+your\s+opponent['']s\s+(?:LV\.(\d+)(?:\s+or\s+lower)?\s+)?Cookies?\s+(?:from\s+their\s+battle\s+area\s+)?into\s+the\s+trash/i,
    )
    if (battleToTrashMatch) {
      const hpMatch = sourceText.match(/remaining HP is (\d+) or less/i)
      const lvLowerMatch = sourceText.match(/LV\.(\d+) or lower/i)
      const lvExactMatch = sourceText.match(
        /LV\.(\d+)\s+(?!or lower)/i,
      )
      const stageMatch = /or\s+\d+\s+stage\s+card/i.test(sourceText)
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'opponent-battle-to-trash' as const,
            ...(hpMatch ? { remainingHp: Number(hpMatch[1]) } : {}),
            ...(lvLowerMatch ? { maxLevel: Number(lvLowerMatch[1]) } : {}),
            ...(lvExactMatch ? { minLevel: Number(lvExactMatch[1]), maxLevel: Number(lvExactMatch[1]) } : {}),
            ...(stageMatch ? { allowStage: true } : {}),
          } satisfies CardEffect as CardEffect,
        ],
      }
    }

    const supportToHandMatch = sourceText.match(
      /Select\s+(\d+)\s+card\s+from\s+your\s+support\s+area\s+and\s+place\s+it\s+in\s+your\s+hand/i,
    )
    if (supportToHandMatch) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'support-to-hand',
            amount: Number(supportToHandMatch[1]),
          },
        ],
      }
    }

    const setSupportActiveMatch = sourceText.match(
      /set\s+(?:up to\s+)?(\d+)\s+(?:of\s+)?card\s+from\s+your\s+support\s+area\s+as\s+active/i,
    )
    if (setSupportActiveMatch) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'set-active',
            supportCount: Number(setSupportActiveMatch[1]),
          },
        ],
      }
    }
  }

  const target = parseTarget(sourceText)

  if (!target) {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      sourceText,
      reason: 'unsupported-effect-text',
    }
  }

  const condition = parseCondition(sourceText)
  const damageMatch = sourceText.match(/receives?\s+(\d+)\s+damage/i)

  if (damageMatch) {
    return {
      status: 'supported',
      cardNumber: card.cardNumber,
      sourceText,
      effects: [
        {
          kind: 'damage',
          amount: Number(damageMatch[1]),
          target,
          condition,
        },
      ],
    }
  }

  const increaseMatch = sourceText.match(
    /gains?\s+\+(\d+)\s+attack damage/i,
  )
  const attackDecreaseMatch = sourceText.match(
    /deals?\s+-(\d+)\s+attack damage/i,
  )
  const receivedDamageMatch = sourceText.match(
    /receives?\s+-(\d+)\s+attack damage/i,
  )

  if (increaseMatch || attackDecreaseMatch || receivedDamageMatch) {
    const amount = increaseMatch
      ? Number(increaseMatch[1])
      : -Number((attackDecreaseMatch ?? receivedDamageMatch)![1])

    return {
      status: 'supported',
      cardNumber: card.cardNumber,
      sourceText,
      effects: [
        {
          kind: receivedDamageMatch
            ? 'modify-damage-received'
            : 'modify-attack',
          amount,
          duration: /opponent's next turn/i.test(sourceText)
            ? 'opponent-next-turn'
            : 'this-turn',
          target,
          condition,
        },
      ],
    }
  }

  const gainHpMatch = sourceText.match(/gains?\s+\+(\d+)\s+HP/i)
  if (gainHpMatch && target && card.type !== 'flip') {
    return {
      status: 'supported',
      cardNumber: card.cardNumber,
      sourceText,
      effects: [
        {
          kind: 'gain-hp',
          amount: Number(gainHpMatch[1]),
          target,
        },
      ],
    }
  }

  return {
    status: 'unsupported',
    cardNumber: card.cardNumber,
    sourceText,
    reason: 'unsupported-effect-text',
  }
}

export const convertOfficialItemAbility = (
  card: OfficialCardRecord,
): CardAbility | undefined => {
  const abilityText = card.skill.text ?? card.attackText
  if (card.type !== 'item' || !abilityText) return undefined
  const conversion = convertOfficialCardEffects(card)
  if (conversion.status !== 'supported') {
    return undefined
  }
  const parsed = parseOfficialCardText(abilityText)
  if (!parsed) return undefined
  const cardKey = card.cardNumber.includes('@')
    ? card.baseCardNumber || card.cardNumber.split('@')[0]
    : card.cardNumber
  const exactCosts: Partial<Record<string, AbilityCost>> = {
    'BS1-022': { energy: { red: 3 }, discardHand: 1 },
    'BS1-023': {
      energy: { red: 1 },
      discardHand: 0,
      hpToTrash: { untilRemainingHp: 1 },
    },
    'BS1-048': { energy: { yellow: 3 }, discardHand: 0 },
    'BS1-049': { energy: { yellow: 2 }, discardHand: 0 },
    'BS1-074': {
      energy: { green: 1 },
      discardHand: 0,
      supportToHand: 1,
    },
    'BS1-075': { energy: { green: 2 }, discardHand: 0 },
    'BS2-006': { energy: { red: 2 }, discardHand: 0 },
    'BS2-048': { energy: { blue: 1 }, discardHand: 0 },
    'BS2-077': {
      energy: { purple: 2 },
      discardHand: 0,
      trashBattleCookie: { count: 1, level: 1, energyColor: 'purple' },
    },
    'BS4-040': {
      energy: { yellow: 2 },
      discardHand: 0,
    },
    // BS5-042 Sniffly Cocoa Palm（item）：<{Y}> <Place 1 of your Cookies' HP
    // cards in the trash.> 可選任何己方餅乾的 HP 支付（非 this Cookie 措辭，
    // parseAbilityCost 抓不到，且不能 sourceOnly）。
    'BS5-042': {
      energy: { yellow: 1 },
      discardHand: 0,
      hpToTrash: { amount: 1 },
    },
    'BS5-086': {
      energy: { blue: 2 },
      discardHand: 0,
    },
    'BS5-108': {
      energy: { purple: 1 },
      discardHand: 0,
    },
    'BS5-111': {
      energy: { neutral: 1 },
      discardHand: 0,
    },
    // BS6-062 Time Rend Scissors：<{G}> 後的尖括號是額外啟動代價，
    // 回手目標限定為支援區的 Cookie；generic parseAbilityCost 目前不解析
    // 「Return ... Cookie ...」句型，必須在此保留完整代價。
    'BS6-062': {
      energy: { green: 1 },
      discardHand: 0,
      supportToHand: 1,
      supportToHandType: 'cookie',
    },
    'BS6-084': {
      energy: { blue: 1 },
      discardHand: 1,
      discardHandAtLeast: true,
    },
    'BS6-105': {
      energy: { purple: 1 },
      discardHand: 0,
      trashBattleCookie: { count: 1, level: 1, energyColor: 'purple' },
    },
    'BS8-022': {
      energy: { red: 1 },
      discardHand: 0,
      trashBattleCookie: { count: 1 },
    },
    'BS8-021': { energy: { red: 2 }, discardHand: 0 },
    'BS8-047': { energy: { yellow: 1 }, discardHand: 0 },
    'BS8-072': { energy: { green: 2 }, discardHand: 0 },
    'BS8-122': {
      energy: { purple: 1 },
      discardHand: 1,
      discardHandColor: 'purple',
      discardHandNonCookie: true,
    },
  }
  const exactSourceEnergy: Partial<Record<string, EnergyCost>> = {
    // 這是裝備後的來源能量，非物品啟動費用。
    'BS8-021': { red: 1 },
  }
  const exactEquippedAttackEffects: Partial<Record<string, CardEffect[]>> = {
    'BS8-021': [
      {
        kind: 'disable-traps',
        duration: 'current-battle',
        condition: { kind: 'break-level-at-least', level: 8 },
      },
    ],
  }
  const parsedCost = parseAbilityCost(abilityText)
  const hasSpecialCost =
    (parsedCost.discardHand ?? 0) > 0 ||
    Boolean(parsedCost.supportToTrash) ||
    Boolean(parsedCost.supportToHand) ||
    Boolean(parsedCost.hpToTrash) ||
    Boolean(parsedCost.trashBattleCookie)
  return {
    cost: P_EXACT_SKILL_COSTS[cardKey] ?? exactCosts[cardKey] ?? (hasSpecialCost ? parsedCost : parsed.cost),
    text: abilityText,
    effects: conversion.effects,
    ...(exactSourceEnergy[cardKey]
      ? { sourceEnergy: exactSourceEnergy[cardKey] }
      : {}),
    ...(exactEquippedAttackEffects[cardKey]
      ? { equippedAttackEffects: exactEquippedAttackEffects[cardKey] }
      : {}),
    ...(P_EXACT_ITEM_ACTIVATION_COST_OVERRIDES[cardKey]
      ? { activationCostOverride: P_EXACT_ITEM_ACTIVATION_COST_OVERRIDES[cardKey] }
      : {}),
  }
}

export const convertOfficialStageAbility = (
  card: OfficialCardRecord,
): StageAbility | undefined => {
  if (card.type !== 'stage') return undefined
  const sourceText = [card.skill.text, card.attackText]
    .filter((text): text is string => Boolean(text?.trim()))
    .map((text) => text.replaceAll('\\"', '"').replace(/^"|"$/g, '').trim())
    .join('\n')
  if (!sourceText) return undefined
  const [placementText, activationText] = sourceText.split(
    STAGE_ACTIVATE_MARKER_PATTERN,
  )
  const endPhaseScope = getEndPhaseScope(sourceText)
  const placement = parseOfficialCardText(placementText)
  const activation = parseOfficialCardText(activationText ?? '')
  if (!placement) return undefined

  if (card.baseCardNumber === 'BS3-121') {
    if (!activation) return undefined

    return {
      placementCost: placement.cost,
      cost: activation.cost,
      text: sourceText,
      effects: [],
      restSource: RESTS_THIS_CARD_PATTERN.test(activationText ?? ''),
      specialVictory: {
        kind: 'distinct-named-keywords',
        requirements: [
          { keyword: 'ancient', cardType: 'cookie', count: 5 },
          { keyword: 'soul-jam', count: 5 },
        ],
      },
    }
  }

  // 複合效果（含 Then）仍需硬編碼；被動觸發階段（無 {mob}）也在此定義
  const exactStageEffects: Partial<Record<string, CardEffect[]>> = {
    'ST3-022': [
      { kind: 'support-to-hand', amount: 1 },
      { kind: 'draw-up-to', max: 1 },
    ],
    'ST5-022': [{ kind: 'draw-up-to', max: 1 }],
    'BS1-026': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
      },
    ],
    'BS1-052': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1 },
      },
    ],
    'BS1-078': [
      {
        kind: 'set-active',
        supportCount: 1,
        condition: { kind: 'support-area-decreased-this-turn' },
      },
    ],
    // BS8-024 Land of Fire & Ruin：兩位玩家的每一張 Cookie 都各受 1 點
    // 傷害；不能把雙方併成不帶 side 的泛用全場效果。
    'BS8-024': [
      { kind: 'damage-all', amount: 1, side: 'self' },
      { kind: 'damage-all', amount: 1, side: 'opponent' },
    ],
    // BS8-024@1 與 BS8-025：兩張都把「讓一張己方 Cookie 昏厥」放在
    // 發動成本，後續才可選至多一張對手 Cookie 造成 1 點傷害。異圖的
    // cardNumber 有獨立文字，不能沿用 BS8-024 基礎版的全體傷害效果。
    'BS8-024@1': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS8-025': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS8-049 Simmering Lassi Springs：只可選「剛好」剩 1 HP 的己方 Cookie。
    'BS8-049': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, remainingHp: 1 },
      },
    ],
    // BS8-050 City of Eternal Gold：第一段先鎖定「本回合從 break 登場的
    // LV.3」；Then 的 HP 檢查與額外補 HP 都只能作用到同一個已選目標。
    'BS8-050': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: {
          side: 'self',
          min: 0,
          max: 1,
          minLevel: 3,
          maxLevel: 3,
          enteredFrom: 'break',
          enteredThisTurn: true,
        },
        thenEffects: [
          {
            kind: 'gain-hp',
            amount: 1,
            target: {
              side: 'self',
              min: 0,
              max: 1,
              previousEffectTargetOnly: true,
            },
            condition: {
              kind: 'previous-effect-target-remaining-hp',
              remainingHp: 2,
            },
          },
        ],
      },
    ],
    // BS8-099 Frozen Mountain Depths：休息 Cookie 計數橫跨雙方戰鬥區。
    'BS8-099': [
      {
        kind: 'draw-up-to',
        max: 3,
        condition: { kind: 'battle-area-rested-cookie-count-at-least', count: 3 },
      },
    ],
    // BS8-100 Snowfall Lantern Tree：棄置張數決定 Then 的強制抽牌張數；
    // 場景自身進垃圾桶是啟動代價，見 exactStageCosts。
    'BS8-100': [{ kind: 'discard-hand-then-draw-same', energyColor: 'blue' }],
    // === BS2 場景卡 ===
    'BS2-051': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
      },
    ],
    'BS2-081': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      // 官方文字是《Place this card in the trash.》，不是「橫置」，RESTS_THIS_CARD_PATTERN
      // 抓不到，之前完全沒實作這個代價，變成可以每回合無限重複發動。
      { kind: 'stage-source-to-trash' },
    ],
    'BS3-023': [
      {
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
            label: 'Return 1 card from the top of this Cookie\'s HP to your hand.',
            effects: [
              {
                kind: 'hp-to-hand',
                amount: 1,
                target: { side: 'self', min: 0, max: 1 },
              },
            ],
          },
        ],
      },
    ],
    // BS5-022 Pitaya Dragon Cookie's Nest：<Place 1 card from the top of your
    // LV.2 or higher Cookie's HP into the trash.> 是本技能代價（見
    // exactStageCosts），「that Cookie」以 costSelected 指到代價選中的那張
    // 餅乾；抽牌段的 [Pitaya Dragon Cookie] 條件是戰鬥區指名卡名條件。
    'BS5-022': [
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
    'BS3-047': [
      {
        kind: 'hand-to-break-by-level-sum',
        targetSum: 3,
        energyColor: 'yellow',
      },
      {
        kind: 'break-to-battle',
        amount: 1,
        exactLevel: 3,
        energyColor: 'yellow',
      },
    ],
    'BS3-048': [
      {
        kind: 'modify-attack-by-break-count',
        target: { side: 'self', min: 0, max: 1, minLevel: 2 },
        duration: 'this-turn',
        perCount: 1,
        exactBreakLevel: 3,
        breakEnergyColor: 'yellow',
      },
    ],
    'BS3-071': [
      {
        kind: 'disable-flip',
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 2 },
        // 官方文字「If a selected Cookie is LV.3, place this card in the
        // trash.」是依附在這次選擇結果上的場景卡自我送棄，不是看場面狀態
        // 的一般條件，見 DisableFlipEffect.trashSourceIfTargetLevel 註解。
        trashSourceIfTargetLevel: 3,
      },
    ],
    'BS3-072': [
      {
        kind: 'rest-support',
        side: 'opponent',
        amount: 1,
        activeOnly: true,
        optional: true,
        condition: { kind: 'opponent-support-count-at-least', count: 5 },
      },
    ],
    'BS3-095': [
      {
        kind: 'choose-one',
        modes: [
          {
            label: 'View 3 cards from the top of your deck; place them back to the top of your deck in any order.',
            effects: [{ kind: 'inspect-deck', lookCount: 3, pickCount: 0, restDestination: 'top' }],
          },
          {
            label: 'Draw 1 card from your deck and place this card at the bottom of your deck.',
            effects: [
              { kind: 'draw', amount: 1 },
              { kind: 'stage-source-to-deck', destination: 'bottom' },
            ],
          },
        ],
      },
    ],
    'BS3-096': [
      {
        kind: 'draw',
        amount: 2,
        condition: { kind: 'hand-count-at-most', count: 2 },
      },
    ],
    'BS3-119': [{ kind: 'deck-to-trash', amount: 3, side: 'opponent' }],
    'BS3-120': [
      {
        kind: 'choose-one',
        modes: [
          {
            label: 'Place up to 2 cards from the top of your deck into the trash.',
            effects: [{ kind: 'deck-to-trash', amount: 2, side: 'self' }],
          },
          {
            label: 'View 3 cards from the top of your deck. Out of the 3 cards, reveal up to 1 {P} card and add that card to your hand. Then, place the remaining cards and this card in the trash.',
            effects: [
              {
                kind: 'inspect-deck',
                lookCount: 3,
                pickCount: 1,
                filterColor: 'purple',
                optionalPick: true,
                restDestination: 'trash',
              },
              { kind: 'stage-source-to-trash' },
            ],
          },
        ],
      },
    ],
    'BS3-024': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
      },
    ],
    'P-028': [
      {
        kind: 'hand-to-break',
        amount: 1,
        energyColor: 'yellow',
        minLevel: 2,
      },
      {
        kind: 'break-to-hand',
        amount: 1,
        energyColor: 'yellow',
        maxLevel: 1,
        optional: true,
      },
    ],
    'P-032': [
      {
        kind: 'modify-attack-cost',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          keyword: 'ancient',
        },
        energyCost: { neutral: 1 },
        duration: 'this-turn',
      },
    ],
    'BS4-110': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'trash-count-at-most', count: 15 },
      },
    ],
    'BS4-022': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: {
          side: 'self',
          min: 0,
          max: 1,
          minLevel: 2,
          energyColor: 'red',
        },
      },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS4-088': [
      {
        kind: 'return-to-hand',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          maxLevel: 2,
          minRemainingHp: 4,
          energyColor: 'blue',
        },
      },
    ],
    'BS4-044': [
      {
        kind: 'hand-to-hp',
        target: { side: 'self', min: 0, max: 1 },
        selectTarget: true,
        optional: true,
      },
    ],
    'BS4-066': [
      {
        kind: 'support-to-hp',
        target: { side: 'self', min: 0, max: 1 },
        energyColor: 'green',
        selectTarget: true,
        optional: true,
      },
    ],
    'BS4-111': [
      { kind: 'field-to-deck-bottom-all', maxLevel: 2 },
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, minLevel: 3, maxLevel: 3 },
      },
    ],
    // BS5-044 Ananas Dragon Cookie's Nest：【Activate】<{Y}><Rest this card.>
    // During this turn, if any of your Cookies gained HP, 選至多 1 張對手餅乾
    // 1 傷害。Then, 1 of your [Ananas Dragon Cookie] 獲得 +1 HP。gained HP
    // 條件由 cookiesGainedHpThisTurn 記錄（gain-hp 效果結算時寫入）。
    'BS5-044': [
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
    ],
    // BS5-066 Longan Palace：<{G}> Place in your stage area. When your turn
    // ends, <discard 1 card.> Set up to 1 card from your support area as
    // active. Then, if [Longan Dragon Cookie] is in your battle area, draw up
    // to 1 card from your deck. 被動回合結束觸發（endPhase），沒有 {mob}
    // 標記所以 cannot be manually activated；棄牌是效果鏈第一個效果（由
    // pendingAbilityEffect 通道讓玩家選要棄的手牌），代價列留空。
    'BS5-066': [
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
    ],
    'BS5-088': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
      {
        kind: 'draw-up-to',
        max: 2,
        condition: {
          kind: 'battle-area-has-named-cookie',
          side: 'self',
          name: 'Lotus Dragon Cookie',
        },
      },
    ],
    'BS5-110': [
      { kind: 'deck-to-trash', amount: 2, side: 'self' },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'battle-area-has-named-cookie',
          side: 'self',
          name: 'Lychee Dragon Cookie',
        },
      },
    ],
    // BS6-043 Timecraft Garage：回合結束時先將手牌黃餅乾放進休息區，
    // 然後玩家可選最多 2 張疲勞支援卡轉為活躍，最後抽最多 1 張。
    'BS6-043': [
      { kind: 'hand-to-break', amount: 1, energyColor: 'yellow' },
      { kind: 'set-active', supportCount: 2, selectable: true, optional: true },
      { kind: 'draw-up-to', max: 1 },
    ],
    'BS6-064': [
      {
        kind: 'hand-to-support',
        amount: 1,
        rested: false,
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      },
    ],
    'BS6-086': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1, energyColor: 'blue' },
      },
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
    ],
    // BS7-022 Scovillia Quarters：本回合己方【Arena】Cookie 造成過效果傷害
    // 後，選擇至多 1 張對手餅乾造成 1 傷害。
    'BS7-022': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'arena-cookie-dealt-effect-damage-this-turn' },
      },
    ],
    // BS7-043 Crème Knights' Quarters：啟動費用 1 黃色能量；本回合有
    // Arena Cookie 進入休息區後，選擇至多 1 張己方 Cookie +1 HP。
    'BS7-043': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1 },
        condition: { kind: 'arena-cookie-placed-in-break-this-turn' },
      },
    ],
    // BS7-065 Cookie Games Stadium：橫置場景後從支援區登場至多 1 張
    // Arena Cookie；只有真的登場才進入後續抽牌。
    'BS7-065': [
      {
        kind: 'support-to-battle',
        amount: 1,
        keyword: 'arena',
        thenEffects: [{ kind: 'draw-up-to', max: 1 }],
      },
    ],
    // BS7-086 Temple of the Sun Central Arena：啟動後抽最多 1 張；藍色
    // Arena 手牌是啟動代價，見 exactStageCosts。
    'BS7-086': [{ kind: 'draw-up-to', max: 1 }],
    // BS7-107 Parfaedia Quarters：把棄牌區最多 2 張沒有 FLIP 的 Arena
    // Cookie 依選擇順序放到牌庫底。
    'BS7-107': [
      {
        kind: 'trash-to-deck',
        max: 2,
        excludeFlip: true,
        cookieOnly: true,
        keyword: 'arena',
        destination: 'bottom',
      },
    ],
  }
  // 無 Activate 標記的 Stage 持續效果不能塞進 `effects`：它們沒有被玩家啟動
  // 的單一結算點，必須在每次攻擊費用查詢時由目前場面重新計算。
  const exactStaticAttackCostModifiers: Partial<
    Record<string, StageAttackCostModifier[]>
  > = {
    // BS8-075 The Ivory Pagoda：不論場景持有者是誰，任何支援區滿六張的
    // 玩家都各自增加一點中性攻擊費用。
    'BS8-075': [{
      operation: 'increase',
      energyCost: { neutral: 1 },
      appliesTo: 'all-players',
      condition: {
        kind: 'support-count-at-least',
        count: 6,
        player: 'affected-player',
      },
    }],
    // BS8-125：僅此場景持有者的 Dark Cacao Cookie，且持有者垃圾桶達
    // 十五張時，才減少一點紫色攻擊費用。
    'BS8-125': [{
      operation: 'reduce',
      energyCost: { purple: 1 },
      appliesTo: 'stage-owner',
      targetCardName: 'Dark Cacao Cookie',
      condition: {
        kind: 'trash-count-at-least',
        count: 15,
        player: 'stage-owner',
      },
    }],
  }
  const exactStageCosts: Partial<Record<string, AbilityCost>> = {
    'BS1-026': {
      energy: {},
      discardHand: 0,
      hpToTrash: { amount: 1 },
    },
    'BS1-052': { energy: { yellow: 2 }, discardHand: 0 },
    'BS1-078': { energy: {}, discardHand: 0 },
    'BS8-024': { energy: { red: 2 }, discardHand: 0 },
    'BS8-024@1': {
      energy: { red: 1 },
      discardHand: 0,
      trashBattleCookie: { count: 1 },
    },
    'BS8-025': {
      energy: { red: 1 },
      discardHand: 0,
      trashBattleCookie: { count: 1 },
    },
    'BS8-049': { energy: { yellow: 1 }, discardHand: 0 },
    'BS8-050': { energy: {}, discardHand: 0 },
    'BS8-099': { energy: { blue: 2 }, discardHand: 0 },
    'BS8-100': {
      energy: { blue: 1 },
      discardHand: 0,
      stageSourceToTrash: true,
    },
    'BS2-051': { energy: {}, discardHand: 1 },
    'BS2-081': { energy: { purple: 1 }, discardHand: 0 },
    'BS3-024': {
      energy: { red: 2 },
      trashBattleCookie: { count: 1, energyColor: 'red' },
    },
    'P-028': { energy: { yellow: 1 } },
    'P-032': { energy: { neutral: 2 } },
    'BS4-110': { energy: { purple: 1 }, discardHand: 2 },
    'BS4-022': { energy: { red: 2 }, discardHand: 0 },
    'BS4-088': { energy: { blue: 1 }, discardHand: 1 },
    'BS4-044': { energy: { yellow: 2 }, discardHand: 1 },
    'BS4-066': { energy: { green: 3 }, discardHand: 0 },
    // BS5-022 Pitaya Dragon Cookie's Nest：【Activate】<{R}><Rest this
    // card.><Place 1 card from the top of your LV.2 or higher Cookie's HP
    // into the trash.> <Rest this card.> 由 RESTS_THIS_CARD_PATTERN 抓，
    // 這裡只要補能量與 hpToTrash 的等級條件。效果見 exactStageEffects。
    'BS5-022': {
      energy: { red: 1 },
      discardHand: 0,
      hpToTrash: { minLevel: 2 },
    },
    // BS5-044 Ananas Dragon Cookie's Nest：<{Y}> Place in your stage area.
    // 【Activate】<{Y}><Rest this card.> 代價（能量 + rest）由通關解析取得，
    // 效果見 exactStageEffects。
    'BS5-044': {
      energy: { yellow: 1 },
      discardHand: 0,
    },
    // BS5-066 Longan Palace：<{G}> Place in your stage area. 被動回合結束
    // 觸發，代價為 0（棄牌在效果鏈中處理，見 exactStageEffects）。
    'BS5-066': {
      energy: {},
      discardHand: 0,
    },
    'BS5-088': {
      energy: { blue: 1 },
      discardHand: 0,
    },
    'BS5-110': {
      energy: { purple: 1 },
      discardHand: 0,
    },
    // BS6-043 的黃卡手牌進休息區，是回合結束自動效果的第一段，
    // 不是場景啟動代價；避免走尚未通用化的 AbilityCost.handToBreakArea。
    'BS6-043': { energy: {}, discardHand: 0 },
    'BS6-086': { energy: {}, discardHand: 2 },
    'BS7-022': { energy: { red: 1 }, discardHand: 0 },
    'BS7-043': { energy: { yellow: 1 }, discardHand: 0 },
    'BS7-065': { energy: {}, discardHand: 0 },
    'BS7-086': {
      energy: {},
      discardHand: 1,
      discardHandColor: 'blue',
      discardHandKeyword: 'arena',
    },
    'BS7-107': { energy: {}, discardHand: 0 },
  }
  const stageEffects =
    exactStageEffects[card.cardNumber] ??
    exactStageEffects[card.baseCardNumber] ??
    P_EXACT_EFFECTS[card.cardNumber] ??
    P_EXACT_EFFECTS[card.baseCardNumber]
  const staticAttackCostModifiers =
    exactStaticAttackCostModifiers[card.cardNumber] ??
    exactStaticAttackCostModifiers[card.baseCardNumber]
  if (stageEffects || staticAttackCostModifiers) {
    return {
      placementCost: placement.cost,
      cost:
        exactStageCosts[card.cardNumber] ??
        exactStageCosts[card.baseCardNumber] ??
        P_EXACT_SKILL_COSTS[card.cardNumber] ??
        P_EXACT_SKILL_COSTS[card.baseCardNumber] ??
        (activation?.cost ?? {}),
      text: sourceText,
      effects: stageEffects ?? [],
      ...(staticAttackCostModifiers
        ? { staticAttackCostModifiers }
        : {}),
      // BS3-095@1 這個異畫版本的官方文字缺了「<Rest this card.>」（base／@2 都有），
      // 判斷是來源網站對該版本的資料缺漏，不是規則差異，固定以 baseCardNumber 覆寫。
      restSource:
        card.cardNumber === 'ST5-022' ||
        card.baseCardNumber === 'BS3-095' ||
        RESTS_THIS_CARD_PATTERN.test(activationText ?? ''),
      ...(card.cardNumber === 'ST5-022' ? { triggered: true } : {}),
      ...(endPhaseScope ? { endPhase: true, endPhaseScope } : {}),
    }
  }

  if (!activation) return undefined

  // 通用化解析：使用 activation 部分作為效果文字
  const conversion = convertOfficialCardEffects({
    ...card,
    type: 'stage',
    attackText: activationText ?? card.attackText,
  })
  if (conversion.status !== 'supported') return undefined

  return {
    placementCost: placement.cost,
    cost: activation.cost,
    text: sourceText,
    effects: conversion.effects,
    restSource: RESTS_THIS_CARD_PATTERN.test(activationText ?? ''),
    ...(endPhaseScope ? { endPhase: true, endPhaseScope } : {}),
  }
}

export const convertOfficialCardEffectSet = (
  cards: OfficialCardRecord[],
): OfficialEffectConversion[] => cards.map(convertOfficialCardEffects)

export const convertOfficialAttackEffects = (
  card: OfficialCardRecord,
): CardEffect[] | undefined => {
  if (
    (card.type !== 'cookie' && card.type !== 'flip' && card.type !== 'extra') ||
    !card.attackText
  ) {
    return undefined
  }

  const cardKey = card.cardNumber.includes('@')
    ? card.baseCardNumber || card.cardNumber.split('@')[0]
    : card.cardNumber
  const exactAttackEffects: Partial<Record<string, CardEffect[]>> = {
    // BS8 EXTRA cards remain outside the main-deck GameCard pool, but after
    // materialization their attacks use the same attack-effect pipeline.  Keep
    // these mappings here so the effect is derived from the official card
    // number rather than reimplemented by the EXTRA command or UI.
    'BS8-005': [
      { kind: 'damage-all', amount: 1, side: 'opponent' },
      { kind: 'damage-all', amount: 1, side: 'self', excludeSource: true },
    ],
    'BS8-027': [{ kind: 'damage-all', amount: 1, side: 'opponent' }],
    'BS8-090': [{ kind: 'draw-up-to', max: 2 }],
    'BS8-104': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS8-006 Nutmeg Tiger Cookie：每一位玩家各選恰好一張 Cookie；兩段
    // 必須保留為獨立強制目標，不能壓成跨區任選或全體傷害。
    'BS8-006': [
      { kind: 'damage', amount: 1, target: { side: 'self', min: 1, max: 1 } },
      { kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } },
    ],
    // BS8-106 Lilac：棄牌是 Then 的第一步，來源移入棄牌區必須在其後。
    'BS8-106': [
      { kind: 'discard-hand', count: 1 },
      {
        kind: 'field-to-trash',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    // BS8-112 Espresso：棄牌完成後才可從棄牌區登場一張 LV.2 以上 Cookie。
    'BS8-112': [
      { kind: 'discard-hand', count: 1 },
      { kind: 'trash-to-battle', amount: 1, optional: true, minLevel: 2 },
    ],
    // BS8 attack Then：以下卡片只使用既有的攻擊後效果模型；條件與目標均保留
    // 在 CardEffect，避免 UI／AI 以卡號或攻擊文字重複判定。
    'BS8-010': [
      { kind: 'make-faint', target: { side: 'self', min: 0, max: 1 } },
    ],
    'BS8-026': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'source-hp-at-most', amount: 4 },
      },
    ],
    'BS8-040': [
      {
        kind: 'draw-up-to-then-discard',
        max: 1,
        discardCount: 1,
        condition: { kind: 'break-level-at-least', level: 3 },
      },
    ],
    'BS8-045': [
      {
        kind: 'battle-to-break',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'break-level-at-most', level: 6 },
      },
    ],
    'BS8-054': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      },
    ],
    'BS8-067': [
      {
        kind: 'deck-to-support',
        amount: 1,
        rested: false,
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      },
    ],
    // BS8-076 Icicle Yeti Cookie：Then 的尖括號是強制的攻擊後代價，
    // 來源先進牌庫底才抽牌；所選對手 Cookie 到對手下一個 Active Phase
    // 才可決定是否恰好棄 2 張換取 active，不能改成一般必定保持 rested。
    'BS8-076': [
      {
        kind: 'optional-cost-attack',
        mandatory: true,
        cost: { energy: {}, discardHand: 0, selfToDeckBottom: true },
        effects: [
          { kind: 'draw', amount: 1 },
          {
            kind: 'prevent-cookie-active-next-phase',
            target: { side: 'opponent', min: 0, max: 1 },
            discardHandToSetActive: 2,
          },
        ],
        effectText:
          'Place this Cookie on the bottom of your deck. Draw 1 card from your deck and select up to 1 of your opponent\'s Cookies. During your opponent\'s next Active Phase, that Cookie is not set as active unless your opponent discards 2 cards from their hand.',
      },
    ],
    // BS8-083 Frost Queen Cookie：攻擊後只補足到三張手牌，不是固定抽三張。
    // DrawUpToEffect 的 untilHandSize 讓引擎以實際手牌數決定抽牌上限。
    'BS8-083': [{ kind: 'draw-up-to', max: 3, untilHandSize: 3 }],
    'BS8-084': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
    ],
    'BS8-108': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 2 },
      },
    ],
    'BS8-109': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1, minLevel: 3, maxLevel: 3 },
      },
    ],
    // 已確認的 BS3 攻擊後續效果皆由既有 attack-effect pipeline 依序處理。
    // Soul Jam 僅可作為支援區 keyword 條件；附著仍待完整規則與 runtime 區域模型。
    'BS3-009': [
      {
        kind: 'damage',
        amount: 1,
        target: {
          side: 'opponent',
          min: 1,
          max: 1,
          attackTargetOnly: true,
        },
        condition: {
          kind: 'support-keyword-at-least',
          keyword: 'soul-jam',
          count: 1,
        },
      },
    ],
    'BS3-016': [
      {
        kind: 'set-active',
        supportCount: 0,
        condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
      },
    ],
    'BS3-002': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { red: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: {
              side: 'opponent',
              min: 1,
              max: 1,
              attackTargetOnly: true,
            },
          },
        ],
        effectText:
          'Use this Cookie as {R} to deal 1 damage to the attacked Cookie.',
      },
    ],
    'BS3-010': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { red: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 1, max: 1 },
          },
        ],
        effectText:
          'Use this Cookie as {R} to deal 1 damage to 1 opponent Cookie.',
      },
    ],
    'BS3-011': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { red: 2 } },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
        effectText:
          'Use this Cookie as {R}{R} to deal 1 damage to 1 opponent Cookie.',
      },
    ],
    'BS3-013': [
      {
        kind: 'modify-damage-received',
        amount: 0,
        duration: 'opponent-next-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        minimumDamage: 2,
        setDamageTo: 1,
      },
    ],
    'BS3-017': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
    ],
    'BS3-028': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'source-hp-less-than', amount: 6 },
      },
    ],
    'BS3-032': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'break-to-battle',
            amount: 1,
            exactLevel: 1,
            energyColor: 'yellow',
          },
        ],
        effectText:
          'Use this Cookie as {Y} to play up to 1 {Y} LV.1 Cookie from your break area.',
      },
    ],
    'BS3-037': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
            condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
          },
        ],
        effectText:
          "When your opponent's Cookie faints from this Cookie's attack, use this Cookie as {Y} to gain +1 HP.",
      },
    ],
    'BS3-033': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'opponent-battle-to-trash',
            min: 0,
            remainingHp: 1,
            minRemainingHp: 1,
            destination: 'break',
          },
        ],
        effectText:
          'Use this Cookie as {Y} to place up to 1 opponent Cookie with 1 remaining HP in its break area.',
      },
    ],
    'BS3-041': [
      {
        kind: 'battle-to-break',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS3-055': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { green: 1 } },
        effects: [
          {
            kind: 'support-to-trash',
            amount: 1,
            side: 'opponent',
            activeOnly: true,
            optional: true,
            condition: { kind: 'source-hp-at-least', amount: 5 },
          },
        ],
        effectText:
          "Use this Cookie as {G}; if it has 5 or more HP, place up to 1 active opponent support card in the trash.",
      },
    ],
    'BS3-060': [
      {
        kind: 'hp-to-trash',
        amount: 2,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
      {
        kind: 'set-active',
        supportCount: 2,
        selectable: true,
        condition: { kind: 'source-in-break-area' },
      },
    ],
    'BS3-076': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 } },
        effects: [
          {
            kind: 'reveal-top-deck',
            match: { type: 'cookie', energyColor: 'blue', level: 2 },
            effects: [
              {
                kind: 'damage',
                amount: 2,
                target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
              },
            ],
          },
        ],
        effectText:
          'Use this Cookie as {B}; reveal the top card of your deck. If it is a {B} LV.2 Cookie, deal 2 damage to the attacked Cookie.',
      },
    ],
    'BS3-080': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 } },
        effects: [
          {
            kind: 'reveal-top-deck',
            match: { type: 'cookie', energyColor: 'blue', level: 2 },
            effects: [{ kind: 'draw-up-to', max: 2 }],
          },
        ],
        effectText:
          'Use this Cookie as {B}; reveal the top card of your deck. If it is a {B} LV.2 Cookie, draw up to 2 cards.',
      },
    ],
    'BS3-086': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 1 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: {
              side: 'opponent',
              min: 1,
              max: 1,
              attackTargetOnly: true,
            },
            condition: {
              kind: 'battle-area-has-cookie-with-level',
              side: 'self',
              level: 3,
            },
          },
        ],
        effectText:
          'If you have a LV.3 Cookie in your battle area, discard 1 card to deal 1 damage to the attacked Cookie.',
      },
    ],
    'BS3-087': [
      {
        kind: 'damage',
        amount: 1,
        target: {
          side: 'opponent',
          min: 1,
          max: 1,
          maxLevel: 1,
          attackTargetOnly: true,
        },
        condition: {
          kind: 'support-keyword-at-least',
          keyword: 'soul-jam',
          count: 1,
        },
      },
    ],
    'BS3-088': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 1 },
        effects: [
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 0, max: 1 },
          },
        ],
        effectText:
          'Discard 1 card to give up to 1 Cookie in your battle area +1 HP.',
      },
    ],
    'BS3-099': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'trash-count-at-least', count: 15 },
      },
    ],
    'BS3-100': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS3-101': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { purple: 1 } },
        effects: [
          {
            kind: 'opponent-battle-to-trash',
            min: 0,
            remainingHp: 2,
          },
        ],
        effectText:
          'Use this Cookie as {P} to place up to 1 opponent Cookie with 2 or less remaining HP in the trash.',
      },
    ],
    'BS3-102': [
      { kind: 'deck-to-trash', amount: 2, side: 'self' },
      { kind: 'deck-to-trash', amount: 2, side: 'opponent' },
    ],
    'BS3-105': [{ kind: 'deck-to-trash', amount: 1, side: 'opponent' }],
    'BS3-109': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS3-111': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'support-keyword-at-least',
          keyword: 'soul-jam',
          count: 1,
        },
      },
    ],
    'BS3-113': [{ kind: 'deck-to-trash', amount: 1, side: 'self' }],
    'ST2-003': [{ kind: 'break-to-trash', max: 1, exactLevel: 1 }],
    'ST2-015': [
      {
        kind: 'damage',
        amount: 3,
        target: { side: 'opponent', min: 1, max: 1 },
      },
      {
        kind: 'disable-attack',
        duration: 'opponent-next-turn',
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
      } satisfies CardEffect as CardEffect,
    ],
    'ST4-013': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
        effectText:
          'Discard 2 cards from your hand to deal 1 damage to 1 opponent cookie.',
      },
    ],
    'ST4-015': [{ kind: 'draw-up-to', max: 1 }],
    'BS1-005': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS1-013': [{ kind: 'discard-hand', count: 1 }],
    'BS1-028': [
      {
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
        condition: { kind: 'break-level-at-least', level: 5 },
      },
    ],
    'BS1-033': [
      {
        kind: 'damage-by-break-count',
        perCount: 1,
        minBreakLevel: 2,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS1-039': [
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'opponent-next-turn',
        target: { side: 'opponent', min: 0, max: 2 },
      },
    ],
    'BS1-044': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 2 }, discardHand: 0 },
        effects: [
          {
            kind: 'damage',
            amount: 3,
            target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
          },
        ],
        effectText:
          'You can pay {Y}{Y} more to deal an additional 3 damage to the same Cookie.',
      },
    ],
    'BS1-064': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, excludeSource: true },
        condition: { kind: 'support-count-at-least', count: 7 },
      },
    ],
    'BS1-070': [
      { kind: 'support-to-hand', amount: 1, maxLevel: 1 },
    ],
    'BS2-004': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { red: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 3,
            target: { side: 'opponent', min: 1, max: 1, maxLevel: 1, attackTargetOnly: true },
            condition: { kind: 'opponent-has-cookie-with-level', level: 1 },
          },
        ],
        effectText: 'You can use this Cookie as {R} to deal 3 damage to 1 of your opponent\'s LV.1 Cookies.',
      } satisfies CardEffect as CardEffect,
    ],
    // === BS1/BS2 黃綠藍紫攻擊 Then 效果 ===
    'BS1-037': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'opponent-battle-to-trash',
            maxLevel: 1,
            destination: 'break',
          },
        ],
        effectText: 'You can use this Cookie as {Y} to select up to 1 of your opponent\'s LV.1 Cookies and place that Cookie in the break area.',
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-010': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 3,
            target: { side: 'opponent', min: 1, max: 1, maxLevel: 1, attackTargetOnly: true },
            condition: { kind: 'opponent-has-cookie-with-level', level: 1 },
          },
        ],
        effectText: 'You can use this Cookie as {Y} to deal 3 damage to 1 of your opponent\'s LV.1 Cookies.',
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-017': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { green: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 3,
            target: { side: 'opponent', min: 1, max: 1, maxLevel: 1, attackTargetOnly: true },
            condition: { kind: 'opponent-has-cookie-with-level', level: 1 },
          },
        ],
        effectText: 'You can use this Cookie as {G} to deal 3 damage to 1 of your opponent\'s LV.1 Cookies.',
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-044': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 3,
            target: { side: 'opponent', min: 1, max: 1, maxLevel: 1, attackTargetOnly: true },
            condition: { kind: 'opponent-has-cookie-with-level', level: 1 },
          },
        ],
        effectText: 'You can use this Cookie as {B} to deal 3 damage to 1 of your opponent\'s LV.1 Cookies.',
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-045': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'hand-count-at-most', count: 6 },
      },
    ],
    'BS2-058': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'trash-count-at-least', count: 15 },
      },
    ],
    'BS2-075': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { purple: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 3,
            target: { side: 'opponent', min: 1, max: 1, maxLevel: 1, attackTargetOnly: true },
            condition: { kind: 'opponent-has-cookie-with-level', level: 1 },
          },
        ],
        effectText: 'You can use this Cookie as {P} to deal 3 damage to 1 of your opponent\'s LV.1 Cookies.',
      } satisfies CardEffect as CardEffect,
    ],
    // === P-0XX 促銷卡 ===
    'P-009': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'break-level-higher-than-opponent' },
      },
    ],
    'P-015': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { red: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          {
            kind: 'hp-to-trash',
            amount: 2,
            target: { side: 'self', min: 0, max: 1 },
          },
        ],
        effectText:
          'Use this Cookie as {R} to deal 1 damage to 1 of your opponent\'s Cookies, then place 2 cards from the top of 1 of your Cookie\'s HP into the trash.',
      },
    ],
    'P-019': [
      { kind: 'trash-to-deck', max: 3, excludeFlip: true },
    ],
    'P-030': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 1 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
        effectText:
          'You can discard 1 card to deal 1 damage to 1 of your opponent\'s Cookies.',
      },
    ],
    // === BS4 藍色餅乾卡攻擊 Then ===
    // BS4-080@1／@2 異圖的攻擊文字帶有基礎版沒有的 Then 段：
    // 「Then, if there are 5 cards or less in your hand, draw up to 2 cards.」
    'BS4-080@1': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ],
    'BS4-080@2': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ],
    'BS4-076': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ],
    'BS4-083': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        condition: { kind: 'hand-count-at-least', count: 5 },
      },
    ],
    // === BS4 紅色餅乾卡攻擊 Then ===
    'BS4-004': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 2 },
        // BS4-004@1 的官方異圖文字是「remaining HP is 1」；攻擊結算時
        // 以「來源 HP 小於 2」表達同一個可觀察條件。
        condition: { kind: 'source-hp-less-than', amount: 2 },
      },
    ],
    'BS4-003': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'battle-area-has-color',
          side: 'self',
          color: 'red',
          excludeSource: true,
        },
      },
    ],
    'BS4-009': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        condition: { kind: 'attack-target-level-at-most', level: 2 },
      },
    ],
    'BS4-013': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { red: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
          },
        ],
        effectText:
          'Use this Cookie as {R} to deal 1 damage to the attacked Cookie.',
      },
    ],
    'BS4-016': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1, remainingHp: 1 },
      },
    ],
    // === BS4 黃色餅乾卡攻擊 Then ===
    'BS4-038': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'battle-area-has-color',
          side: 'self',
          color: 'yellow',
          excludeSource: true,
        },
      },
    ],
    'BS4-026': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'break-level-at-least', level: 3 },
          },
        ],
        effectText:
          "If your break area is LV.3 or higher, use this Cookie as {Y} to deal 2 damage to 1 of your opponent's Cookies.",
      },
    ],
    'BS4-039': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
        condition: { kind: 'source-hp-at-least', amount: 2 },
      },
    ],
    // === BS4 綠色餅乾卡攻擊 Then ===
    'BS4-053': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { green: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'support-count-at-least', count: 7 },
          },
        ],
        effectText:
          "If your support area contains 7 cards or more, use this Cookie as {G} to deal 1 damage to 1 of your opponent's Cookies.",
      },
    ],
    'BS4-049': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { green: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'opponent-support-count-at-least', count: 7 },
          },
        ],
        effectText:
          "If your opponent's support area contains 7 cards or more, use this Cookie as {G} to deal 2 damage to 1 of your opponent's Cookies.",
      },
    ],
    'BS4-054': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        condition: { kind: 'support-count-at-least', count: 5 },
      },
    ],
    'BS4-061': [
      {
        kind: 'set-active',
        supportCount: 1,
        condition: { kind: 'support-count-at-least', count: 7 },
      },
    ],
    // === BS4 紫色卡攻擊 Then ===
    'BS4-103': [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
    'BS4-023': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'break-area-has-card',
          side: 'self',
          color: 'yellow',
          minLevel: 3,
          maxLevel: 3,
        },
      },
    ],
    'BS4-029': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'battle-to-break',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
          {
            kind: 'break-to-battle',
            amount: 1,
            exactLevel: 3,
            energyColor: 'yellow',
          },
        ],
        effectText:
          'Use this Cookie as {Y} to place this Cookie in your break area and play up to 1 {Y} LV.3 Cookie from your break area.',
      },
    ],
    'BS4-069': [
      {
        kind: 'opponent-discard-hand',
        count: 1,
        destination: 'deck-bottom',
      },
    ],
    'BS4-090': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        condition: { kind: 'trash-flip-count-at-least', count: 3 },
      },
    ],
    'BS4-091': [
      {
        kind: 'trash-to-deck',
        max: 3,
        excludeFlip: true,
        destination: 'bottom',
      },
    ],
    'BS4-098': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { purple: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            // "Deals 2 damage" names no new target, so it follows the normal attack target.
            target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
            condition: {
              kind: 'trash-color-count-at-least',
              color: 'purple',
              count: 15,
            },
          },
        ],
        effectText:
          "If your trash contains 15 {P} cards or more, use this Cookie as {P} to deal 2 damage to 1 of your opponent's Cookies.",
      },
    ],
    'BS4-089': [
      {
        kind: 'draw-up-to-then-discard',
        max: 2,
        discardCount: 1,
        condition: { kind: 'opponent-trash-count-at-least', count: 15 },
      },
    ],
    'BS4-073': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
            condition: { kind: 'hand-count-at-least', count: 5 },
          },
        ],
        effectText:
          'If your hand contains 5 cards or more, use this Cookie as {B} to deal 2 additional damage to the attacked Cookie.',
      },
    ],
    'BS4-073@2': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
        effectText: 'Discard 2 cards from your hand to deal 2 damage to up to 1 opponent Cookie.',
      },
    ],
    // BS4-075：攻擊後 Then 的尖括號是可選代價；玩家可略過棄 2 張手牌，
    // 或先在攻擊後代價 UI 選牌並支付，再選擇最多 1 張對手餅乾造成 2 傷害。
    'BS4-075': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
        effectText: 'Discard 2 cards from your hand to deal 2 damage to up to 1 opponent Cookie.',
      },
    ],
    // === BS5 RED 攻擊 Then ===
    // BS5-003 Strawberry Cream Cookie：Then, <discard 1 card.> Deals 1 damage.
    // 尖括號是攻擊後的可選代價；玩家可以略過棄牌與後續傷害。
    'BS5-003': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 1 },
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        }],
        effectText: 'Discard 1 card to deal 1 damage to the attacked Cookie.',
      },
    ],
    // BS5-006 Marshmallow Cookie：Then, if your break area is LV.6 or higher,
    // select up to 1 of your opponent's Cookies. 1 damage。
    'BS5-006': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'break-level-at-least', level: 6 },
      },
    ],
    // BS5-008 Chestnut Cookie：Then, if the attacked Cookie's remaining HP is
    // 3 or more, that Cookie receives 1 damage.
    'BS5-008': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        condition: { kind: 'attack-target-remaining-hp-at-least', amount: 3 },
      },
    ],
    // BS5-010 Starch Noodle Cookie：Then, <place 1 card from the top of this
    // Cookie's HP into the trash.> Draw up to 1 card from your deck.
    'BS5-010': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, hpToTrash: { amount: 1, sourceOnly: true } },
        effects: [{ kind: 'draw-up-to', max: 1 }],
        effectText: "Trash 1 HP card from this Cookie to draw up to 1 card.",
      },
    ],
    // BS5-012 Eggnog Cookie：Then, if the attacked Cookie is LV.3, that Cookie
    // receives 1 damage.
    'BS5-012': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        condition: { kind: 'attack-target-level-equals', level: 3 },
      },
    ],
    // BS5-013 Pitaya Dragon Cookie：Then, <can be used as {R}.> 是攻擊後
    // 可選的來源能量代價；未支付時不結算後續傷害。
    'BS5-013': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { red: 1 } },
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 2 },
          condition: { kind: 'source-hp-less-than', amount: 5 },
        }],
        effectText:
          'Use this Cookie as {R}. If its remaining HP is 4 or less, deal 1 damage to up to 2 opponent Cookies.',
      },
    ],
    // === BS5 YELLOW 攻擊 Then ===
    // BS5-023 Dino-Sour Cookie：Then, if this Cookie's remaining HP is 3 or
    // less, this Cookie gains +1 HP。「3 or less」比照 BS3-028 慣例用
    // source-hp-less-than 4。
    'BS5-023': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'source-hp-less-than', amount: 4 },
      },
    ],
    // BS5-024 Dr. Wasabi Cookie：Then, if the attacked Cookie's remaining HP
    // is 2 or less, that Cookie receives 1 damage。
    'BS5-024': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        condition: { kind: 'attack-target-remaining-hp-at-most', amount: 2 },
      },
    ],
    // BS5-025 Leek Cookie：Then, if this Cookie's remaining HP is 1, you can
    // return this Cookie to your hand。「you can」為可選，但攻擊後條件效果在
    // 本引擎一律自動結算（條件成立即執行），與 BS5-035 等卡一致。
    'BS5-025': [
      {
        kind: 'return-to-hand',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'source-hp-less-than', amount: 2 },
      },
    ],
    // BS5-030 Buttercream Choco Cookie：Then, <place this Cookie in your break
    // area.> Select up to 1 {Y} LV.1 Cookie from your break area. Play that
    // Cookie。
    'BS5-030': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, selfToBreakArea: true },
        effects: [{
          kind: 'break-to-battle',
          amount: 1,
          exactLevel: 1,
          energyColor: 'yellow',
        }],
        effectText:
          'Place this Cookie in your break area to play up to 1 {Y} LV.1 Cookie from your break area.',
      },
    ],
    // BS5-032 Birthday Cake Cookie：Then, if your break area LV. is higher
    // than your opponent's break area LV., 選至多 1 張對手餅乾 1 傷害。
    'BS5-032': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'break-level-higher-than-opponent' },
      },
    ],
    // BS5-035 Artichoke Cookie：Then, if this Cookie's remaining HP is 1,
    // 選至多 1 張對手餅乾 1 傷害。
    'BS5-035': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'source-hp-less-than', amount: 2 },
      },
    ],
    // BS5-040 Ananas Dragon Cookie：Then, <can be used as {Y}.> 是可選代價。
    'BS5-040': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [{
          kind: 'gain-hp',
          amount: 1,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          condition: { kind: 'source-hp-less-than', amount: 5 },
        }],
        effectText:
          'Use this Cookie as {Y}. If its remaining HP is 4 or less, it gains +1 HP.',
      },
    ],
    // === BS5 GREEN 攻擊 Then ===
    // BS5-056 Longan Dragon Cookie：Then, when your turn ends, set up to 1
    // card from your support area as active. 回合結束延遲效果：攻擊結算時只
    // 排隊（deferred-end-of-turn），由 end 階段的 processEndPhaseEffects
    // 依序結算。
    'BS5-056': [
      {
        kind: 'deferred-end-of-turn',
        effects: [{ kind: 'set-active', supportCount: 1 }],
      },
    ],
    // BS5-059 Purple Yam Cookie：Then, <return 1 card from your support area
    // to your hand.> 是可選支援區回手代價。
    'BS5-059': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, supportToHand: 1 },
        effects: [{ kind: 'draw-up-to', max: 1 }],
        effectText:
          'Return 1 card from your support area to your hand to draw up to 1 card.',
      },
    ],
    // BS5-060 Croissant Cookie：Then, when your turn ends, set up to 3 cards
    // from your support area as active.
    'BS5-060': [
      {
        kind: 'deferred-end-of-turn',
        effects: [{ kind: 'set-active', supportCount: 3 }],
      },
    ],
    // === BS5 BLUE／PURPLE 攻擊 Then ===
    'BS5-067': [
      {
        kind: 'inspect-deck',
        lookCount: 3,
        pickCount: 0,
        restDestination: 'top',
      },
    ],
    'BS5-071': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
    ],
    'BS5-080': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        }],
        effectText: 'Discard 2 cards to deal 1 damage to up to 1 opponent Cookie.',
      },
    ],
    'BS5-085': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
      },
      { kind: 'draw-up-to', max: 1 },
    ],
    'BS5-089': [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
    'BS5-094': [
      {
        kind: 'optional-cost-attack',
        cost: {
          energy: {},
          trashToDeck: {
            count: 5,
            excludeFlip: true,
            energyColor: 'purple',
            cookieOnly: true,
          },
        },
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        }],
        effectText:
          'Return 5 {P} Cookies without FLIP from your trash to your deck to deal 1 damage to up to 1 opponent Cookie.',
      },
    ],
    'BS5-097': [
      {
        kind: 'draw-up-to-then-discard',
        max: 2,
        discardCount: 2,
        condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
      },
    ],
    'BS5-098': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, hpToTrash: { amount: 1, sourceOnly: true } },
        effects: [{
          kind: 'field-to-trash',
          target: {
            side: 'opponent',
            min: 1,
            max: 1,
            maxLevel: 1,
            attackTargetOnly: true,
          },
        }],
        effectText:
          "Trash 1 HP card from this Cookie to place the attacked LV.1 Cookie in the trash.",
      },
    ],
    'BS5-099': [
      { kind: 'deck-to-trash', amount: 2, side: 'self' },
      { kind: 'deck-to-trash', amount: 2, side: 'opponent' },
    ],
    'BS5-106': [
      { kind: 'draw', amount: 1 },
      { kind: 'deck-to-trash', amount: 3, side: 'self' },
    ],
    // === BS6 RED attack Then ===
    // BS6-003 Strawberry Stick Cookie：HP 是攻擊後可選代價。
    'BS6-003': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, hpToTrash: { amount: 1, energyColor: 'red' } },
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        }],
        effectText:
          'Place 1 card from the top of your red Cookie HP into the trash to deal 1 damage to up to 1 opponent Cookie.',
      },
    ],
    'BS6-007': [
      {
        kind: 'rest-support',
        side: 'opponent',
        amount: 2,
        activeOnly: true,
        optional: true,
        condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
      },
    ],
    'BS6-038': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'break-area-has-card',
          side: 'self',
          color: 'yellow',
          minLevel: 2,
        },
      },
    ],
    'BS6-060': [{ kind: 'support-to-hand', amount: 1 }],
    'BS6-013': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'battle-area-has-named-cookie',
          side: 'self',
          name: 'Chess Choco Cookie',
          excludeSource: true,
        },
      },
    ],
    'BS6-016': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'source-hp-less-than', amount: 2 },
      },
    ],
    'BS6-018': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
        condition: { kind: 'source-hp-less-than', amount: 2 },
      },
    ],
    // === BS6 YELLOW attack Then ===
    'BS6-022': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'return-to-hand',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
            condition: { kind: 'break-level-at-least', level: 3 },
          },
        ],
        effectText:
          'Use this Cookie as {Y}. If your break area is LV.3 or higher, return this Cookie to your hand.',
      },
    ],
    'BS6-024': [
      {
        kind: 'damage-by-break-count',
        perCount: 1,
        exactBreakLevel: 3,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS6-031': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'break-level-at-least', level: 4 },
          },
        ],
        effectText:
          'Use this Cookie as {Y}. If your break area is LV.4 or higher, deal 2 damage to up to 1 opponent Cookie.',
      },
    ],
    // === BS6 GREEN attack Then ===
    'BS6-053': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: {
          kind: 'all-of',
          conditions: [
            { kind: 'support-count-at-least', count: 5 },
            { kind: 'support-count-at-most', count: 5 },
          ],
        },
      },
    ],
    'BS6-059': [
      {
        kind: 'return-to-hand',
        target: { side: 'self', min: 0, max: 1, sourceOnly: true },
        condition: {
          kind: 'all-of',
          conditions: [
            { kind: 'support-count-at-least', count: 5 },
            { kind: 'support-count-at-most', count: 5 },
          ],
        },
      },
    ],
    'BS6-044': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, supportToHand: 1, supportToHandType: 'cookie' },
        effects: [{
          kind: 'damage',
          amount: 2,
          target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        }],
        effectText:
          'Return 1 Cookie from your support area to your hand to deal 2 damage to the attacked Cookie.',
      },
    ],
    'BS6-061': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, supportToHand: 1, supportToHandType: 'cookie' },
        effects: [
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 0, max: 1, maxRemainingHp: 5 },
          },
        ],
        effectText:
          'Return 1 Cookie from your support area to your hand to gain 1 HP.',
      },
    ],
    'BS6-036': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'gain-hp',
            amount: 1,
            perBreakCard: { exactLevel: 3 },
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
        effectText:
          'Use this Cookie as {Y}. This Cookie gains +1 HP for each LV.3 Cookie in your break area.',
      },
    ],
    'BS6-051': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { green: 1 } },
        effects: [
          {
            kind: 'hand-to-support',
            amount: 2,
            rested: false,
            optional: true,
            energyColor: 'green',
            condition: {
              kind: 'opponent-support-count-at-least',
              count: 3,
            },
          },
        ],
        effectText:
          'Use this Cookie as {G}. If your opponent has 3 or more support cards, place up to 2 {G} cards from your hand into your support area as active.',
      },
    ],
    'BS6-096': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { purple: 1 }, selfToTrash: true },
        effects: [
          {
            kind: 'trash-to-battle',
            amount: 1,
            exactLevel: 1,
            energyColor: 'purple',
            condition: {
              kind: 'battle-area-has-cookie-with-level',
              side: 'self',
              level: 3,
            },
          },
        ],
        effectText:
          'Use this Cookie as {P}. Place this Cookie in the trash, then play 1 {P} LV.1 Cookie from your trash.',
      },
    ],
    'BS6-065': [
      {
        kind: 'discard-hand',
        count: 1,
        condition: { kind: 'hand-count-at-least', count: 6 },
      },
    ],
    'BS6-072': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [{ kind: 'draw-up-to', max: 2 }],
        effectText: 'Discard 2 cards to draw up to 2 cards.',
      },
    ],
    'BS6-074': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ],
    'BS6-076': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 1 },
        effects: [{ kind: 'draw-up-to', max: 1 }],
        effectText: 'Discard 1 card to draw up to 1 card.',
      },
    ],
    // BS6-068／077 的「can be used as {B}」是攻擊後可選來源能量代價。
    'BS6-068': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 } },
        effects: [{
          kind: 'field-to-deck-bottom',
          target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
          condition: { kind: 'hand-count-at-most', count: 5 },
        }],
        effectText:
          'Use this Cookie as {B}. If your hand has 5 or fewer cards, place up to 1 opponent LV.1 Cookie on the bottom of its deck.',
      },
    ],
    'BS6-077': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 } },
        effects: [{
          kind: 'gain-hp',
          amount: 1,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          condition: { kind: 'hand-count-at-most', count: 5 },
        }],
        effectText:
          'Use this Cookie as {B}. If your hand has 5 or fewer cards, it gains +1 HP.',
      },
    ],
    'BS6-079': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 1 },
        effects: [
          {
            kind: 'rest-support',
            side: 'opponent',
            amount: 3,
            activeOnly: true,
            optional: true,
          },
        ],
        effectText:
          "Discard 1 card. Select up to 3 cards in your opponent's support area. Rest those cards.",
      },
    ],
    'BS6-093': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { purple: 1 } },
        effects: [
          {
            kind: 'trash-to-battle',
            amount: 1,
            optional: true,
            energyColor: 'purple',
            maxHp: 2,
          },
        ],
        effectText:
          'Use this Cookie as {P}. Play up to 1 {P} Cookie with 2 or less HP from your trash.',
      },
    ],
    'BS6-095': [
      {
        kind: 'trash-to-battle',
        amount: 1,
        optional: true,
        energyColor: 'purple',
        maxHp: 2,
      },
    ],
    'BS6-102': [
      { kind: 'deck-to-trash', amount: 3, side: 'self' },
      { kind: 'deck-to-trash', amount: 3, side: 'opponent' },
    ],
    // BS7-015 Crushed Pepper Cookie：Then, if there is another 【Arena】
    // Cookie in your battle area, the attacked Cookie receives 2 damage.
    // 「another」必須排除攻擊來源；傷害沒有另行指定目標，因此鎖定本次
    // 攻擊的對象，沿用 attackTargetOnly 的攻擊後效果語意。
    'BS7-015': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        condition: {
          kind: 'battle-area-has-keyword',
          side: 'self',
          keyword: 'arena',
          excludeSource: true,
        },
      },
    ],
    // BS7-018 Jalapeño Cookie：Then, if there is another 【Arena】 Cookie in
    // your battle area, select up to 1 opponent Cookie and deal 1 damage.
    'BS7-018': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'battle-area-has-keyword',
          side: 'self',
          keyword: 'arena',
          excludeSource: true,
        },
      },
    ],
    // BS7-019 Rye Cookie：Then, optionally use this Cookie as 1 red energy;
    // if another Arena Cookie exists, deal 1 damage to the attacked Cookie.
    'BS7-019': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { red: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
            condition: {
              kind: 'battle-area-has-keyword',
              side: 'self',
              keyword: 'arena',
              excludeSource: true,
            },
          },
        ],
        effectText:
          'Use this Cookie as {R}. If there is another Arena Cookie in your battle area, deal 1 damage to the attacked Cookie.',
      },
    ],
    // BS7-024 Ice Juggler Cookie：Then, <return 1 card from the top of your
    // Arena Cookie's HP to your hand.> deals 1 damage to the attacked Cookie.
    // The HP movement is an optional attack cost, not a generic HP effect;
    // keep the Arena selector on AbilityCost so the UI, AI and strict ledger
    // all enforce the same candidate boundary.
    'BS7-024': [
      {
        kind: 'optional-cost-attack',
        cost: { hpToHand: { amount: 1, keyword: 'arena' } },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
          },
        ],
        effectText:
          "Return 1 card from the top of your Arena Cookie's HP to your hand to deal 1 damage to the attacked Cookie.",
      },
    ],
    // BS7-026 Twisted Donut Cookie：Then, <place this Cookie in your break
    // area.> select up to 1 other Arena Cookie and give it +1 HP.
    'BS7-026': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, selfToBreakArea: true },
        effects: [
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 0, max: 1, keyword: 'arena', excludeSource: true },
            condition: {
              kind: 'battle-area-has-keyword',
              side: 'self',
              keyword: 'arena',
              excludeSource: true,
            },
          },
        ],
        effectText:
          'Place this Cookie in your break area to give up to 1 other Arena Cookie +1 HP.',
      },
    ],
    // BS7-038 Clotted Cream Cookie：Then, 先將手牌 1 張 Cookie 放入休息區，
    // 再選擇至多 1 張 LV.1 黃色 Arena Cookie 返回手牌；第二段不得選回剛放入
    // 休息區的同一張卡。兩段拆成可互動的 attackEffects，讓 Browser 與 AI
    // 都能在第一段後重新取得正確的休息區候選。
    'BS7-038': [
      {
        kind: 'hand-to-break',
        amount: 1,
        thenEffects: [
          {
            kind: 'break-to-hand',
            amount: 1,
            energyColor: 'yellow',
            keyword: 'arena',
            minLevel: 1,
            maxLevel: 1,
            optional: true,
            excludePreviousHandToBreak: true,
          },
        ],
      },
    ],
    // BS7-039 Financier Cookie：攻擊後只在本回合有 Arena Cookie 進入休息區
    // 時，對手全體餅乾各受 1 點傷害。
    'BS7-039': [
      {
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
        // 全體傷害仍需逐張選取；每張 Cookie 的 HP／FLIP／昏厥流程
        // 完成後，才進入下一個對手目標。
        sequential: true,
        target: { side: 'opponent', min: 1, max: 2 },
        condition: { kind: 'arena-cookie-placed-in-break-this-turn' },
      },
    ],
    // BS7-046 Green Tea Mousse Cookie：Then，從支援區登場至多 1 張 Arena
    // Cookie；支援區登場本身會開啟該卡的 On Play pending（若有）。
    'BS7-046': [
      { kind: 'support-to-battle', amount: 1, keyword: 'arena' },
    ],
    // BS7-059 Choco Drizzle Cookie：Then 的尖括號是可選攻擊代價；支付
    // 1 張支援卡後，將己方至多 1 張綠色 LV.2 以下餅乾以 active 放入支援區。
    'BS7-059': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, supportToTrash: 1 },
        effects: [
          {
            kind: 'battle-to-support',
            target: {
              side: 'self',
              min: 0,
              max: 1,
              energyColor: 'green',
              maxLevel: 2,
            },
            rested: false,
          },
        ],
        effectText:
          'Place 1 card from your support area into the trash to place up to 1 {G} LV.2 or lower Cookie from your battle area into your support area as active.',
      },
    ],
    // BS7-066 Princess Cookie：攻擊後可棄 2 張 Arena 手牌，對攻擊目標
    // 造成 1 點效果傷害。
    'BS7-066': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2, discardHandKeyword: 'arena' },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
          },
        ],
        effectText: 'Discard 2 Arena cards to deal 1 damage to the attacked Cookie.',
      },
    ],
    // BS7-067 Dark Choco Cookie：攻擊後可棄 1 張 Arena 手牌，選對手
    // LV.2 以上餅乾造成 2 點效果傷害。
    'BS7-067': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 1, discardHandKeyword: 'arena' },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1, minLevel: 2 },
          },
        ],
        effectText: 'Discard 1 Arena card to deal 2 damage to up to 1 opponent LV.2 or higher Cookie.',
      },
    ],
    // BS7-073 Knight Cookie：只有手牌至多 3 張且攻擊目標為 LV.1 時，
    // 才對該攻擊目標造成 3 點效果傷害。
    'BS7-073': [
      {
        kind: 'damage',
        amount: 3,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        condition: {
          kind: 'all-of',
          conditions: [
            { kind: 'hand-count-at-most', count: 3 },
            { kind: 'attack-target-level-equals', level: 1 },
          ],
        },
      },
    ],
    // BS7-070 Raspberry Mousse Cookie：將己方另一張藍色 LV.2 以下
    // Arena Cookie 放到牌庫底，再抽最多 1 張。
    'BS7-070': [
      {
        kind: 'field-to-deck-bottom',
        target: {
          side: 'self',
          min: 1,
          max: 1,
          maxLevel: 2,
          energyColor: 'blue',
          keyword: 'arena',
          excludeSource: true,
        },
      },
      { kind: 'draw-up-to', max: 1 },
    ],
    // BS7-082 Red Pepper Cookie：至少棄 1 張手牌；若棄完後手牌只剩
    // 1 張以下，對手戰鬥區所有餅乾各受 1 傷害。
    'BS7-082': [
      { kind: 'discard-hand', count: 1, atLeast: true },
      {
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
        // 官方「all of your opponent's Cookies」仍按目標逐張結算，
        // 不可把兩張餅乾合併成一次批次傷害。
        sequential: true,
        target: { side: 'opponent', min: 1, max: 2 },
        condition: { kind: 'hand-count-at-most', count: 1 },
      },
    ],
    // BS7-088 Camellia Cookie：可支付 1 紫色能量後，若棄牌區有至少
    // 7 張 Arena 卡，對手至多 1 張餅乾受 2 傷害。
    'BS7-088': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { purple: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'trash-keyword-count-at-least', keyword: 'arena', count: 7 },
          },
        ],
        effectText:
          'Use this Cookie as {P}. If there are 7 Arena cards or more in your trash, deal 2 damage to up to 1 opponent Cookie.',
      },
    ],
    // BS7-089 Latte Cookie：對手手牌至少 6 張時，隨機棄置對手 2 張手牌。
    'BS7-089': [
      {
        kind: 'opponent-random-discard',
        count: 2,
        condition: { kind: 'opponent-hand-count-at-least', count: 6 },
      },
    ],
    // BS7-091 Gelato Trio Cookie：將牌庫頂最多 3 張直接置入棄牌區。
    'BS7-091': [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
    // BS7-095 Almond Cookie：自己的棄牌區有至少 7 張 Arena 卡時抽最多 1 張。
    'BS7-095': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'trash-keyword-count-at-least', keyword: 'arena', count: 7 },
      },
    ],
    // BS7-097 Eclair Cookie：自己的棄牌區有至少 7 張 Arena 卡時，
    // 本餅乾直到對手回合結束「受到的」攻擊傷害 -1。英文官方勘誤已將
    // 舊版 deals -1 修正為 receives -1，不能誤接成降低自身攻擊力。
    'BS7-097': [
      {
        kind: 'modify-damage-received',
        amount: -1,
        duration: 'opponent-next-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'trash-keyword-count-at-least', keyword: 'arena', count: 7 },
      },
    ],
    // BS7-098 Milk Cookie：自己的棄牌區有至少 7 張 Arena 卡時自身 +1 HP。
    'BS7-098': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'trash-keyword-count-at-least', keyword: 'arena', count: 7 },
      },
    ],
    // BS7-101 Purple Yam Cookie：自己的棄牌區有至少 7 張 Arena 卡時，
    // 將對手至多 1 張場景卡置入棄牌區。
    'BS7-101': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 0, max: 1 },
        stageOnly: true,
        allowStage: true,
        condition: { kind: 'trash-keyword-count-at-least', keyword: 'arena', count: 7 },
      } satisfies CardEffect as CardEffect,
    ],
    // BS7-102 Kohlrabi Cookie：支付 1 紫色能量並將 5 張未 FLIP 的
    // Arena 棄牌洗回牌庫後，對手至多 1 張餅乾受 1 傷害。
    'BS7-102': [
      {
        kind: 'optional-cost-attack',
        cost: {
          energy: { purple: 1 },
          trashToDeck: { count: 5, keyword: 'arena', excludeFlip: true },
        },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
        effectText:
          'Use this Cookie as {P}. Return 5 Arena cards without FLIP from your trash to your deck to deal 1 damage to up to 1 opponent Cookie.',
      },
    ],
    // BS7-103 Parfaedia Principal：將自己的棄牌區最多 1 張 LV.1
    // Arena Cookie 返回手牌。
    'BS7-103': [
      {
        kind: 'trash-to-hand',
        max: 1,
        maxLevel: 1,
        keyword: 'arena',
      },
    ],
  }

  if (exactAttackEffects[card.cardNumber]) {
    return exactAttackEffects[card.cardNumber]
  }

  if (exactAttackEffects[cardKey]) {
    return exactAttackEffects[cardKey]
  }

  if (P_EXACT_ATTACK_EFFECTS[card.cardNumber]) {
    return P_EXACT_ATTACK_EFFECTS[card.cardNumber]
  }

  if (P_EXACT_ATTACK_EFFECTS[cardKey]) {
    return P_EXACT_ATTACK_EFFECTS[cardKey]
  }

  if (!/\bThen\b/i.test(card.attackText)) {
    return undefined
  }

  return exactAttackEffects[cardKey]
}

export const convertOfficialFlipAbility = (
  card: OfficialCardRecord,
): FlipAbility | undefined => {
  const flipText = card.flipText ?? card.skill.text
  // 官方資料也會把帶有 FLIP 能力的餅乾記成 COOKIE（例如 BS5-073/074）。
  // 是否能翻面應以 FLIP 文案判斷，不能只看 card.type。
  const hasFlipRecord =
    card.type === 'flip' ||
    (card.type === 'cookie' && Boolean(card.flipText?.trim()))
  if (!hasFlipRecord || !flipText) {
    return undefined
  }

  const cardKey = card.cardNumber.includes('@')
    ? card.baseCardNumber || card.cardNumber.split('@')[0]
    : card.cardNumber

  // 官方 BS4-032@1 異圖的 card_flip 欄位只重複攻擊名稱；依官方卡圖補回
  // 與同卡基礎版本一致的抽牌效果。
  if (
    card.cardNumber === 'BS4-032@1' &&
    /^<\{Y\}\{Y\}>\s*Creamcraft Magic!\s*$/i.test(flipText.trim())
  ) {
    return {
      text: 'Draw up to 1 card from your deck.',
      cost: parseAbilityCost(flipText),
      effects: [{ kind: 'draw-up-to', max: 1 }],
    }
  }

  const exactFlipEffects: Partial<Record<string, { effects: CardEffect[]; cost?: AbilityCost; attachedHpBonus?: number }>> = {
    'P-024': {
      cost: { energy: {}, discardHand: 1 },
      effects: [
        {
          kind: 'gain-hp',
          amount: 1,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        },
      ],
    },
    // BS5-004 Lollipop Cookie／BS5-041 Firecracker Cookie／BS5-082 Ion Cookie
    // Robot／BS5-095 Mint Wafer Cookie：「The Cookie with this card attached
    // for HP gains +1 HP.」是附著期間的連續效果，不是一次性 gain-hp——
    // 只要這張卡還附在目標餅乾的 HP 上，剩餘 HP 就 +1，卡離開加成就消失。
    // 因此 effects 為空，附著加成由 FlipAbility.attachedHpBonus 承載，
    // 剩餘 HP 計算走 helpers.getCookieEffectiveHp。代價 <Discard 1 card.>
    // 由 parseAbilityCost 解析。
    'BS5-004': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS5-046': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS5-009': {
      effects: [{ kind: 'draw-up-to', max: 1 }],
    },
    'BS5-041': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS5-082': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS5-095': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS6-006': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS6-009': {
      effects: [{ kind: 'draw-up-to', max: 1 }],
    },
    'BS6-027': {
      effects: [{ kind: 'draw-up-to', max: 1 }],
    },
    'BS6-037': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS6-046': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS6-056': {
      effects: [{ kind: 'draw-up-to', max: 1 }],
    },
    'BS6-067': {
      effects: [{ kind: 'draw-up-to', max: 1 }],
    },
    'BS6-069': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS6-103': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS6-104': {
      effects: [{ kind: 'draw-up-to', max: 1 }],
    },
    // BS7-002 Red Osmanthus Cookie：只有己方戰鬥區存在紅色【Arena】Cookie
    // 時，且這張 FLIP 所附著的受傷餅乾為 LV.2 以上，才從牌庫補 1 張 HP。
    // 這是翻開時的一次性條件式 gain-hp，不是 attachedHpBonus 的持續加成。
    'BS7-002': {
      effects: [
        {
          kind: 'gain-hp',
          amount: 1,
          target: {
            side: 'self',
            min: 1,
            max: 1,
            sourceOnly: true,
            minLevel: 2,
          },
          condition: {
            kind: 'battle-area-has-color',
            side: 'self',
            color: 'red',
            keyword: 'arena',
          },
        },
      ],
    },
    // BS7-025 Golden Osmanthus Cookie：與 BS7-002 同樣是附著卡翻開時的
    // 一次性 +1 HP，但條件改為己方戰鬥區存在黃色【Arena】Cookie。
    'BS7-025': {
      effects: [
        {
          kind: 'gain-hp',
          amount: 1,
          target: {
            side: 'self',
            min: 1,
            max: 1,
            sourceOnly: true,
            minLevel: 2,
          },
          condition: {
            kind: 'battle-area-has-color',
            side: 'self',
            color: 'yellow',
            keyword: 'arena',
          },
        },
      ],
    },
    // BS7-030 Rainbow Sherbet Cookie：手牌至多 5 張且己方有黃色【Arena】
    // Cookie 時，FLIP 翻開後從牌庫抽最多 2 張。
    'BS7-030': {
      effects: [
        {
          kind: 'draw-up-to',
          max: 2,
          condition: {
            kind: 'all-of',
            conditions: [
              { kind: 'hand-count-at-most', count: 5 },
              {
                kind: 'battle-area-has-color',
                side: 'self',
                color: 'yellow',
                keyword: 'arena',
              },
            ],
          },
        },
      ],
    },
    // BS7-056 Sting Durian Cookie：有綠色 Arena Cookie 時，附著目標若為
    // LV.2 以上，翻開效果使其增加 1 HP。
    'BS7-056': {
      effects: [
        {
          kind: 'gain-hp',
          amount: 1,
          target: {
            side: 'self',
            min: 1,
            max: 1,
            sourceOnly: true,
            minLevel: 2,
          },
          condition: {
            kind: 'battle-area-has-color',
            side: 'self',
            color: 'green',
            keyword: 'arena',
          },
        },
      ],
    },
    // BS7-062 Plantain Cookie：手牌至多 5 張且有綠色 Arena Cookie 時抽最多 2 張。
    'BS7-062': {
      effects: [
        {
          kind: 'draw-up-to',
          max: 2,
          condition: {
            kind: 'all-of',
            conditions: [
              { kind: 'hand-count-at-most', count: 5 },
              {
                kind: 'battle-area-has-color',
                side: 'self',
                color: 'green',
                keyword: 'arena',
              },
            ],
          },
        },
      ],
    },
    // BS7-072 Ice Mint Cookie：手牌至多 5 張且有藍色 Arena Cookie 時抽最多 2 張。
    'BS7-072': {
      effects: [
        {
          kind: 'draw-up-to',
          max: 2,
          condition: {
            kind: 'all-of',
            conditions: [
              { kind: 'hand-count-at-most', count: 5 },
              {
                kind: 'battle-area-has-color',
                side: 'self',
                color: 'blue',
                keyword: 'arena',
              },
            ],
          },
        },
      ],
    },
    // BS7-078 Frostrock Cookie：有藍色 Arena Cookie 時，LV.2 以上的
    // 附著目標增加 1 HP。
    'BS7-078': {
      effects: [
        {
          kind: 'gain-hp',
          amount: 1,
          target: {
            side: 'self',
            min: 1,
            max: 1,
            sourceOnly: true,
            minLevel: 2,
          },
          condition: {
            kind: 'battle-area-has-color',
            side: 'self',
            color: 'blue',
            keyword: 'arena',
          },
        },
      ],
    },
    // BS7-096 Espresso Cookie：有紫色 Arena Cookie 時，LV.2 以上附著
    // 餅乾增加 1 HP。
    'BS7-096': {
      effects: [
        {
          kind: 'gain-hp',
          amount: 1,
          target: {
            side: 'self',
            min: 1,
            max: 1,
            sourceOnly: true,
            minLevel: 2,
          },
          condition: {
            kind: 'battle-area-has-color',
            side: 'self',
            color: 'purple',
            keyword: 'arena',
          },
        },
      ],
    },
    // BS7-100 Witchberry Cookie：手牌至多 5 張且有紫色 Arena Cookie
    // 時，翻開後抽最多 2 張。
    'BS7-100': {
      effects: [
        {
          kind: 'draw-up-to',
          max: 2,
          condition: {
            kind: 'all-of',
            conditions: [
              { kind: 'hand-count-at-most', count: 5 },
              {
                kind: 'battle-area-has-color',
                side: 'self',
                color: 'purple',
                keyword: 'arena',
              },
            ],
          },
        },
      ],
    },
    // BS7-011 Yoga Cookie：翻開時同時檢查手牌至多 5 張，以及己方戰鬥區
    // 存在紅色【Arena】Cookie，成立後最多抽 2 張；兩個條件不可被 generic
    // parser 拆掉或遺漏，必須由同一個 all-of condition 綁在 draw-up-to 上。
    'BS7-011': {
      effects: [
        {
          kind: 'draw-up-to',
          max: 2,
          condition: {
            kind: 'all-of',
            conditions: [
              { kind: 'hand-count-at-most', count: 5 },
              {
                kind: 'battle-area-has-color',
                side: 'self',
                color: 'red',
                keyword: 'arena',
              },
            ],
          },
        },
      ],
    },
    'BS1-040': {
      effects: [
        {
          kind: 'gain-hp',
          amount: 2,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          condition: { kind: 'break-level-at-least', level: 6 },
        },
      ],
    },
    'BS2-034': {
      effects: [
        {
          kind: 'draw-up-to',
          max: 2,
          condition: { kind: 'break-level-at-least', level: 4 },
        },
      ],
    },
    'BS2-063': {
      effects: [
        {
          kind: 'field-to-trash',
          target: { side: 'opponent', min: 0, max: 1, maxLevel: 2 },
          allowStage: true,
          autoSelect: true,
          condition: { kind: 'break-level-at-least', level: 3 },
        } satisfies CardEffect as CardEffect,
      ],
    },
    'BS1-067': {
      effects: [
        {
          kind: 'flip-to-support',
          rested: true,
          condition: { kind: 'support-count-at-least', count: 4 },
        } satisfies CardEffect as CardEffect,
      ],
    },
    // 跟 BS3-083 的技能是同一種機制，見 exactStarterEffects 裡的註解。
    'BS4-072': {
      effects: [
        { kind: 'inspect-deck', lookCount: 3, pickCount: 0, restDestination: 'top' },
      ],
    },
    'BS4-057': {
      effects: [
        {
          kind: 'flip-to-support',
          rested: true,
          condition: { kind: 'break-level-at-least', level: 6 },
        },
      ],
    },
    'BS4-031': {
      effects: [
        {
          kind: 'break-to-hand',
          amount: 1,
          minLevel: 1,
          maxLevel: 1,
          optional: true,
        },
        {
          kind: 'flip-to-break',
          condition: { kind: 'break-level-at-least', level: 5 },
        },
      ],
    },
    // 中文卡面「從自己或對手的牌庫頂」跟 BS4-099 是同一種「自選磨誰的牌庫」，
    // 一樣用 choose-one 表達。
    'BS4-102': {
      effects: [
        {
          kind: 'choose-one',
          modes: [
            {
              label: '磨自己牌庫',
              effects: [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
            },
            {
              label: '磨對方牌庫',
              effects: [{ kind: 'deck-to-trash', amount: 3, side: 'opponent' }],
            },
          ],
        },
      ],
    },
  }
  const exactFlip = exactFlipEffects[cardKey]
  const pExactFlip = P_EXACT_FLIP_EFFECTS[cardKey]
  if (exactFlip) {
    return {
      text: flipText,
      cost: exactFlip.cost ?? parseAbilityCost(flipText),
      effects: exactFlip.effects,
      ...(exactFlip.attachedHpBonus !== undefined
        ? { attachedHpBonus: exactFlip.attachedHpBonus }
        : {}),
    }
  }
  if (pExactFlip) {
    return {
      text: flipText,
      cost: pExactFlip.cost ?? parseAbilityCost(flipText),
      effects: pExactFlip.effects,
      ...(pExactFlip.attachedHpBonus !== undefined
        ? { attachedHpBonus: pExactFlip.attachedHpBonus }
        : {}),
    }
  }

  const stripped = stripEffectText(flipText)
  const drawAmount = parseSimpleDraw(stripped)

  if (drawAmount !== null) {
    return {
      text: flipText,
      cost: parseAbilityCost(flipText),
      effects: isOptionalDraw(stripped)
        ? [{ kind: 'draw-up-to', max: drawAmount }]
        : [{ kind: 'draw', amount: drawAmount }],
    }
  }

  const conditionalDrawAmount = parseConditionalDraw(stripped)
  if (conditionalDrawAmount !== null) {
    return {
      text: flipText,
      cost: parseAbilityCost(flipText),
      effects: [
        {
          kind: 'draw-up-to',
          max: conditionalDrawAmount,
          condition: parseCondition(stripped),
        },
      ],
    }
  }

  const target = parseTarget(flipText)
  const damageMatch = flipText.match(/receives?\s+(\d+)\s+damage/i)
  if (target && damageMatch) {
    return {
      text: flipText,
      cost: parseAbilityCost(flipText),
      effects: [
        {
          kind: 'damage',
          amount: Number(damageMatch[1]),
          target,
        },
      ],
    }
  }

  const gainHpMatch = stripped.match(
    /^The Cookie with this card attached for HP gains \+(\d+) HP\.?$/i,
  )

  if (gainHpMatch) {
    // 「The Cookie with this card attached for HP gains +N HP.」是附著期間的連續
    // 加成：只要這張卡還附在目標餅乾的 HP 上，剩餘 HP 就 +N（getCookieEffectiveHp
    // 依 hpCard.flip.attachedHpBonus 計算），與 exact map 的 BS5-004／BS6-069 等
    // 同一語意。翻開並發動時由 resolveFlip 把附著加成轉成牌庫頂補 N 張 HP 卡；
    // 卡離開 HP（被傷害／代價磨掉……）加成就消失。修正前舊系列統一走一次性
    // gain-hp，缺少「附著期間」的隱藏加成，與新版卡不一致。
    return {
      text: flipText,
      cost: parseAbilityCost(flipText),
      effects: [],
      attachedHpBonus: Number(gainHpMatch[1]),
    }
  }

  return undefined
}

const parseTrapCondition = (
  text: string,
): TrapAbility['condition'] | undefined => {
  const breakLevel = text.match(/break area is LV\.(\d+) or higher/i)
  if (breakLevel) {
    return {
      kind: 'break-level-at-least',
      level: Number(breakLevel[1]),
    }
  }

  const attackThreshold = text.match(
    /opponent's Cookies? attacks? more than (\d+) damage/i,
  )
  if (attackThreshold) {
    return {
      kind: 'attacker-attack-more-than',
      amount: Number(attackThreshold[1]),
    }
  }

  const selfHpEquals = text.match(/If\s+1\s+of\s+your\s+Cookies\s+has\s+(\d+)\s+HP/i)
  if (selfHpEquals) {
    return {
      kind: 'self-cookie-hp-equals',
      amount: Number(selfHpEquals[1]),
    }
  }

  const trashCountMatch = text.match(/(\d+)\s+cards?\s+or\s+more\s+in\s+your\s+trash/i)
  if (trashCountMatch) {
    return {
      kind: 'opponent-trash-count-at-least',
      count: Number(trashCountMatch[1]),
    }
  }

  const faintedColor = text.match(
    /(?:any|if\s+\d+)\s+of\s+your\s+\{([RYGBPK])\}\s+Cookies?\s+(?:fainted|faints)/i,
  )
  const colors = {
    R: 'red',
    Y: 'yellow',
    G: 'green',
    B: 'blue',
    P: 'purple',
    K: 'black',
  } as const
  const color = faintedColor
    ? colors[faintedColor[1] as keyof typeof colors]
    : undefined

  return color
    ? {
        kind: 'friendly-color-fainted-this-battle',
        color,
      }
    : undefined
}

export const convertOfficialTrapAbility = (
  card: OfficialCardRecord,
): TrapAbility | undefined => {
  if (card.type !== 'trap' || !(card.skill.text ?? card.attackText)) {
    return undefined
  }

  const text = card.skill.text ?? card.attackText!
  const condition = parseTrapCondition(text)
  const target = parseTarget(text)
  const effects: CardEffect[] = []
  const attackDecrease = text.match(
    /deals?\s+-(\d+)\s+attack damage/i,
  )
  const damage = text.match(/receives?\s+(\d+)\s+damage/i)
  const preventKnockout = /HP cannot reach 0 during this battle/i.test(text)
  const supportToTrash = text.match(
    /place\s+(\d+)\s+card(?:s)?\s+from your support area (?:in|into) the trash/i,
  )
  const deckToRestedSupport = text.match(
    /take the top card from your deck and place it in your support area as rested/i,
  )
  const supportToHand = text.match(
    /return (\d+) card(?:s)? from your support area to your hand/i,
  )
  const handToSupport = text.match(
    /place (\d+) card(?:s)? from your hand into your support area as rested/i,
  )
  const afterThen = text.split(/then/i).pop() ?? ''
  const strippedAfterThen = stripEffectText(afterThen).replace(
    /^[^A-Za-z]+/,
    '',
  )
  const trapDrawAmount = parseSimpleDraw(strippedAfterThen)
  const redirectAttack =
    /Redirect your opponent's attack to a different Cookie of your own/i.test(text)
  const setActive = text.match(
    /set\s+(?:up to\s+)?(\d+)\s+of\s+card\s+from\s+your\s+support\s+area\s+as\s+active/i,
  )

  if (supportToHand) {
    effects.push({
      kind: 'support-to-hand',
      amount: Number(supportToHand[1]),
      optional: true,
    })
  }

  if (handToSupport) {
    effects.push({
      kind: 'hand-to-support',
      amount: Number(handToSupport[1]),
      rested: true,
    })
  }

  if (attackDecrease && target) {
    effects.push({
      kind: 'modify-attack',
      amount: -Number(attackDecrease[1]),
      duration: 'this-turn',
      target,
    })
  }

  if (damage && target) {
    effects.push({
      kind: 'damage',
      amount: Number(damage[1]),
      target,
    })
  }

  if (preventKnockout && target) {
    effects.push({
      kind: 'prevent-knockout',
      target,
    })
  }

  if (redirectAttack) {
    effects.push({
      kind: 'redirect-attack',
      target: { side: 'self', min: 1, max: 1, excludeAttackTarget: true },
    })
  }

  if (supportToTrash) {
    effects.push({
      kind: 'support-to-trash',
      amount: Number(supportToTrash[1]),
    })
  }

  if (trapDrawAmount !== null) {
    effects.push(
      isOptionalDraw(strippedAfterThen)
        ? { kind: 'draw-up-to', max: trapDrawAmount }
        : { kind: 'draw', amount: trapDrawAmount },
    )
  }

  const trapDrawUpToAndDiscard = text.match(
    /draw\s+up\s+to\s+(\d+)\s+card(?:s)?\s+from\s+your\s+deck\s+and\s+discard\s+(\d+)\s+card(?:s)?\s+from\s+your\s+hand/i,
  )
  if (trapDrawUpToAndDiscard && effects.length === 0) {
    effects.push(
      { kind: 'draw-up-to', max: Number(trapDrawUpToAndDiscard[1]) },
      { kind: 'discard-hand', count: Number(trapDrawUpToAndDiscard[2]) },
    )
  }

  const battleToTrash = text.match(
    /Place\s+(\d+)\s+of\s+your\s+opponent['']s\s+(?:LV\.(\d+)(?:\s+or\s+lower)?\s+)?Cookies?\s+(?:whose\s+remaining\s+HP\s+is\s+\d+\s+or\s+less\s+)?(?:from\s+their\s+battle\s+area\s+)?into\s+the\s+trash/i,
  )
  if (battleToTrash) {
    const trapHpMatch = text.match(/remaining HP is (\d+) or less/i)
    effects.push({
      kind: 'field-to-trash',
      target: {
        side: 'opponent',
        min: Number(battleToTrash[1]),
        max: Number(battleToTrash[1]),
        ...(battleToTrash[2]
          ? { maxLevel: Number(battleToTrash[2]) }
          : {}),
        ...(trapHpMatch ? { remainingHp: Number(trapHpMatch[1]) } : {}),
      },
    } satisfies CardEffect as CardEffect)
  }

  if (deckToRestedSupport) {
    effects.push({
      kind: 'deck-to-support',
      amount: 1,
      rested: true,
    })
  }

  const gainHp = text.match(/gains?\s+\+(\d+)\s+HP/i)
  if (gainHp && target) {
    effects.push({
      kind: 'gain-hp',
      amount: Number(gainHp[1]),
      target,
    })
  }

  if (setActive) {
    effects.push({
      kind: 'set-active',
      supportCount: Number(setActive[1]),
    })
  }

  const exactTrapEffects: Partial<
    Record<
      string,
      {
        effects: CardEffect[]
        cost?: AbilityCost
        sourceEnergy?: EnergyCost
        alternativeCosts?: AbilityCost[]
        condition?: TrapAbility['condition']
        ignoreParsedCondition?: boolean
      }
    >
  > = {
    'P-036': {
      cost: { energy: { red: 3 } },
      effects: [
        { kind: 'damage-all', amount: 1, side: 'self' },
        { kind: 'damage-all', amount: 1, side: 'opponent' },
      ],
    },
    'BS8-023': {
      effects: [
        { kind: 'damage-all', amount: 1, side: 'self', minRemainingHp: 2 },
        { kind: 'damage-all', amount: 1, side: 'opponent', minRemainingHp: 2 },
      ],
    },
    'BS8-048': {
      cost: { energy: { yellow: 1 } },
      condition: { kind: 'break-level-at-least', level: 3 },
      effects: [
        {
          kind: 'trash-to-hand',
          max: 1,
          cardNames: [
            'Soul Jam: Light of Destruction',
            'Soul Jam: Light of Abundance',
          ],
        },
      ],
    },
    'BS8-123': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'trash-to-hand',
          max: 1,
          cardName: 'Soul Jam: Light of Resolution',
        },
      ],
    },
    'BS8-124': {
      condition: { kind: 'trash-count-at-least', count: 15 },
      effects: [
        {
          kind: 'trash-to-hand',
          max: 1,
          energyColor: 'purple',
          cookieOnly: true,
        },
      ],
    },
    'BS3-046': {
      // 條件在戰鬥中延後判定：本次戰鬥有己方 {Y} LV.2 以上餅乾昏厥才發動。
      condition: {
        kind: 'friendly-color-fainted-this-battle',
        color: 'yellow',
        minLevel: 2,
      },
      effects: [
        {
          kind: 'break-to-battle',
          amount: 1,
          exactLevel: 1,
          energyColor: 'yellow',
        },
      ],
    },
    'BS2-050': {
      effects: [
        {
          kind: 'return-to-deck-bottom',
          target: { side: 'opponent', min: 0, max: 1, remainingHp: 3 },
        },
      ],
      cost: { energy: { blue: 3 }, discardHand: 1 },
    },
    'BS4-042': {
      cost: { energy: { yellow: 2 } },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'gain-hp',
          amount: 1,
          target: { side: 'self', min: 0, max: 1 },
        },
      ],
    },
    'BS4-064': {
      cost: { energy: { green: 2 } },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'trash-to-support',
          amount: 1,
          optional: true,
          energyColor: 'green',
          condition: { kind: 'support-color-count-at-least', color: 'green', count: 8 },
          rested: true,
        },
      ],
    },
    'BS2-079': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        { kind: 'trash-to-deck', max: 5, excludeFlip: true },
      ],
    },
    // BS2-014：先選擇是否將 LV.1 餅乾從自己的休息區返回手牌；只有
    // 實際選到卡牌（「If you did」）時，才再選一張手牌放入休息區。
    // 以 thenEffects 綁定兩段，避免略過第一段後錯誤執行第二段。
    'BS2-014': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'break-to-hand',
          amount: 1,
          minLevel: 1,
          maxLevel: 1,
          optional: true,
          thenEffects: [{ kind: 'hand-to-break', amount: 1 }],
        },
      ],
    },
    'BS3-021': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -3,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'self', min: 1, max: 1 },
        },
      ],
    },
    'BS3-022': {
      condition: {
        kind: 'break-level-at-least',
        level: 6,
      },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
    },
    'BS3-045': {
      effects: [
        {
          kind: 'damage-by-break-count',
          perCount: 1,
          exactBreakLevel: 3,
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
    },
    'BS4-043': {
      effects: [
        {
          kind: 'damage-by-break-level-difference',
          target: { side: 'opponent', min: 0, max: 1 },
          condition: { kind: 'break-level-higher-than-opponent' },
        },
      ],
    },
    'BS4-065': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        { kind: 'deck-to-support', amount: 1, rested: true },
      ],
    },
    'BS4-109': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'inspect-deck',
          lookCount: 3,
          pickCount: 1,
          filterColor: 'purple',
          optionalPick: true,
          restDestination: 'trash',
        },
      ],
    },
    'BS3-069': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'support-to-trash',
          amount: 2,
        },
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
    },
    'BS3-070': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 2 },
        },
        // 官方文字「if your support area contains 5 or more, draw up to 2
        // cards ... and discard 1 card」是單一個「若 X 則抽 N 張再棄 M 張」
        // 的複合子句，不是兩個各自獨立判斷條件的動作。過去拆成 draw-up-to
        // 與 discard-hand 兩個各掛同一條件的獨立效果，會被 playTrap 的
        // 陷阱效果迴圈連續呼叫 executeCardEffect（迴圈只在 pendingRevealTopDeck
        // 時才 break，pendingDrawUpTo 不會），導致 pendingDrawUpTo 與
        // pendingOpponentHandDiscard 在同一次結算裡就同時被設置，UI 只是
        // 剛好疊圖只顯示前者，玩家會覺得抽完牌後突然又跳出一個「無關」的
        // 棄牌視窗。改用 draw-up-to-then-discard（跟 BS3-088 同一種複合效果）
        // 才會走 resolveDrawUpTo 的 afterEffects 銜接流程，UI 才能正確顯示
        // 「步驟 1/2 → 2/2」的接續提示。
        {
          kind: 'draw-up-to-then-discard',
          max: 2,
          discardCount: 1,
          condition: { kind: 'support-count-at-least', count: 5 },
        },
      ],
    },
    'BS3-093': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'reveal-top-deck',
          match: { type: 'cookie', energyColor: 'blue', level: 2 },
          effects: [
            {
              kind: 'modify-attack',
              amount: -1,
              duration: 'this-turn',
              target: { side: 'opponent', min: 0, max: 1 },
            },
          ],
        },
      ],
    },
    'BS3-094': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'inspect-deck',
          lookCount: 3,
          pickCount: 0,
          restDestination: 'top',
        },
      ],
    },
    'BS3-117': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -3,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'field-to-trash',
          target: { side: 'opponent', min: 0, max: 1, remainingHp: 2 },
          condition: { kind: 'trash-count-at-least', count: 15 },
        } satisfies CardEffect as CardEffect,
      ],
    },
    'BS3-118': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        { kind: 'deck-to-trash', amount: 2, side: 'self' },
      ],
    },
    'P-031': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1, minLevel: 3, maxLevel: 3 },
        },
        {
          kind: 'hp-to-trash',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1, minLevel: 3, maxLevel: 3 },
        },
      ],
    },
    'P-082': {
      cost: { energy: { yellow: 1, neutral: 1 } },
      alternativeCosts: [
        {
          energy: {},
          trashCookieToBreakArea: {
            count: 1,
            hp: 1,
            excludeFlip: true,
          },
        },
      ],
      effects: [
        {
          kind: 'gain-hp',
          amount: 2,
          target: { side: 'self', min: 1, max: 1 },
        },
        {
          kind: 'gain-hp',
          amount: 2,
          target: { side: 'opponent', min: 1, max: 1 },
        },
      ],
    },
    'P-029': {
      condition: { kind: 'friendly-cookie-fainted-this-battle' },
      effects: [
        {
          kind: 'trash-to-battle',
          amount: 1,
          energyColor: 'green',
        },
      ],
    },
    // BS5-021 Draconic Aura：<{R}> If there is a LV.3 Cookie in your battle
    // area, 選至多 2 張對手餅乾本回合攻擊 -1；Then 自 1 張己方餅乾的 HP 頂端
    // 回手至多 1 張卡。LV.3 條件是「發動門檻」（TrapCondition），不是個別
    // 效果的條件，條件不成立時整張陷阱不能發動。
    'BS5-021': {
      condition: { kind: 'battle-area-has-cookie-with-level', level: 3 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 2 },
        },
        {
          kind: 'hp-to-hand',
          amount: 1,
          target: { side: 'self', min: 0, max: 1 },
        },
      ],
    },
    // BS5-065 Petrification：<{G}{G}{G}> Select up to 1 of your opponent's
    // Cookies. This attack deals -2 attack damage this turn. Then, if there
    // are 7 cards or more in your support area, your opponent selects 1
    // active card from their support area. Rest that card. 無發動門檻（7 張
    // 支援區條件屬於 Then 子句，不是陷阱的 play 條件）；對手選擇橫置由
    // opponent-rests-support 效果通道處理。
    'BS5-065': {
      effects: [
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
      ],
    },
    'BS5-087': {
      ignoreParsedCondition: true,
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'draw-up-to',
          max: 2,
          condition: { kind: 'break-level-at-least', level: 6 },
        },
      ],
    },
    'BS5-109': {
      ignoreParsedCondition: true,
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
          condition: { kind: 'trash-count-at-least', count: 15 },
        },
      ],
    },
    'BS6-020': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'hp-to-hand',
          amount: 1,
          target: { side: 'self', min: 0, max: 1 },
        },
      ],
    },
    // BS6-042 的「休息區有 3 張以上餅乾」是陷阱發動門檻，不是只略過
    // 效果的 Then 條件；用 TrapCondition 保證條件不成立時不會出現在可發動清單。
    'BS6-063': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'choose-one',
          condition: {
            kind: 'all-of',
            conditions: [
              { kind: 'support-count-at-least', count: 5 },
              { kind: 'support-count-at-most', count: 5 },
            ],
          },
          modes: [
            {
              label: '將牌庫頂 1 張卡以休息狀態放入支援區',
              effects: [{ kind: 'deck-to-support', amount: 1, rested: true }],
            },
            { label: '不放置卡牌', effects: [] },
          ],
        },
      ],
    },
    'BS6-042': {
      condition: { kind: 'break-area-card-count-at-least', count: 3 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1, minLevel: 2 },
        },
        { kind: 'draw-up-to', max: 1 },
      ],
    },
    'BS6-085': {
      cost: { energy: { blue: 1 }, discardHand: 2 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'draw-up-to',
          max: 2,
          condition: { kind: 'hand-count-at-most', count: 4 },
        },
      ],
    },
    'BS6-106': {
      cost: { energy: { purple: 2 }, discardHand: 0 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'trash-to-battle',
          amount: 1,
          optional: true,
          energyColor: 'purple',
          maxHp: 2,
        },
      ],
    },
    // BS7-021 Labyrinth Golem Attack：己方戰鬥區有【Arena】Cookie 時，
    // 對手選定的攻擊餅乾本回合攻擊傷害 -2，Then 同一目標再受 1 傷害。
    'BS7-021': {
      cost: { energy: { red: 1, neutral: 1 }, discardHand: 0 },
      sourceEnergy: { red: 2 },
      condition: { kind: 'battle-area-has-keyword', keyword: 'arena' },
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
          thenEffects: [
            {
              kind: 'damage',
              amount: 1,
              target: { side: 'opponent', min: 0, max: 1 },
            },
          ],
        },
      ],
    },
    // BS7-042 Valiant Victor's Salvation：第一段攻擊下降總是可選；
    // 第二段是 Then 條件，只有自己的休息區至少有 3 張 Arena Cookie
    // 才建立同樣的攻擊下降效果，不把條件誤當成陷阱發動門檻。
    'BS7-042': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
          condition: {
            kind: 'break-area-card-count-at-least',
            side: 'self',
            count: 3,
            keyword: 'arena',
          },
        },
      ],
    },
    // BS7-064 Cookie Windmill：第一段攻擊下降後，支付 1 張支援卡，
    // 再從棄牌區選至多 1 張 Cookie 以橫置狀態放入支援區。
    'BS7-064': {
      cost: { energy: { green: 1 }, supportToTrash: 1 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        { kind: 'support-to-trash', amount: 1 },
        { kind: 'trash-to-support', amount: 1, rested: true, optional: true },
      ],
    },
    // BS7-085 A Victory For You：攻擊下降後，只有手牌至多 2 張且
    // 己方戰鬥區有 Arena Cookie 時才抽最多 2 張。
    'BS7-085': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'draw-up-to',
          max: 2,
          condition: {
            kind: 'all-of',
            conditions: [
              { kind: 'hand-count-at-most', count: 2 },
              { kind: 'battle-area-has-keyword', side: 'self', keyword: 'arena' },
            ],
          },
        },
      ],
    },
    // BS7-106 Securing the First Victory：支付 1 張手牌後，
    // 從棄牌區回收至多 1 張 Arena Cookie。
    'BS7-106': {
      cost: { energy: { purple: 1 }, discardHand: 1 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        { kind: 'trash-to-hand', max: 1, keyword: 'arena' },
      ],
    },
    // BS7-108 Arena of Glory：第一段攻擊下降後，若己方休息區 LV
    // 比對手高至少 3，才可再選對手 LV.3 餅乾使其攻擊傷害 -2。
    'BS7-108': {
      cost: { energy: { neutral: 1 } },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1, minLevel: 3, maxLevel: 3 },
          condition: {
            kind: 'break-level-higher-than-opponent',
            minDifference: 3,
          },
        },
      ],
    },
  }

  const exactTrap =
    exactTrapEffects[card.cardNumber] ?? exactTrapEffects[card.baseCardNumber]
  if (exactTrap) {
    return {
      text,
      cost: exactTrap.cost ?? parseAbilityCost(text),
      ...(exactTrap.sourceEnergy
        ? { sourceEnergy: exactTrap.sourceEnergy }
        : {}),
      ...(exactTrap.alternativeCosts
        ? { alternativeCosts: exactTrap.alternativeCosts }
        : {}),
      condition: exactTrap.ignoreParsedCondition
        ? exactTrap.condition
        : exactTrap.condition ?? condition,
      effects: exactTrap.effects,
    }
  }

  if (effects.length === 0) {
    return undefined
  }

  return {
    text,
    cost: parseAbilityCost(text),
    condition,
    effects,
  }
}

const exactCookieSkillCosts: Partial<Record<string, AbilityCost>> = {
  // BS8 候選流程中有些尖括號是來源離場或手牌／戰鬥區移動成本；明確保留
  // 可防止通用英文 parser 漏掉 self reference 而讓技能無成本發動。
  'BS8-052': { energy: {}, discardHand: 0, selfToTrash: true },
  'BS8-059': { energy: { green: 1 }, discardHand: 0, supportToHand: 2 },
  'BS8-060': {
    energy: {},
    discardHand: 0,
    supportToHand: 1,
    supportToHandColor: 'green',
  },
  'BS8-019': { energy: {}, discardHand: 1 },
  'BS8-078': { energy: {}, discardHand: 0, selfToDeckBottom: true },
  'BS8-079': {
    energy: {},
    discardHand: 2,
    discardHandColor: 'blue',
    selfToDeckBottom: true,
  },
  'BS8-082': { energy: {}, discardHand: 2, selfToDeckBottom: true },
  'BS8-087': {
    energy: { blue: 1 },
    discardHand: 0,
    battleCookieToHand: {
      count: 1,
      energyColor: 'blue',
      maxLevel: 1,
      excludeSource: true,
    },
  },
  'BS8-119': { energy: { purple: 1 }, discardHand: 0, selfToTrash: true },
  'BS8-120': { energy: {}, discardHand: 1 },
  // BS8-107 的官方英文使用大寫「Item」；generic cost parser 僅接受其既有
  // 小寫句型，故在此保留實際的紫色物品棄牌成本，不能降成零成本。
  'BS8-107': {
    energy: {},
    discardHand: 1,
    discardHandColor: 'purple',
    discardHandType: 'item',
  },
  // 這兩張的手牌餅乾進休息區，需由 effect queue 帶出選卡 UI 並先結算，
  // 不能當成僅有陷阱路徑支援的 AbilityCost.handToBreakArea。
  'BS6-023': { energy: {}, discardHand: 0 },
  'BS6-032': { energy: {}, discardHand: 0 },
  'BS6-045': {
    energy: { green: 1 },
    discardHand: 0,
    trashBattleCookie: { count: 1, sourceOnly: true },
  },
  'BS6-052': {
    energy: { green: 2 },
    discardHand: 0,
    supportToHand: 2,
  },
  'BS6-057': {
    energy: { green: 1 },
    discardHand: 0,
    trashBattleCookie: { count: 1, sourceOnly: true },
    supportToHand: 1,
    supportToHandType: 'cookie',
  },
  'BS6-073': {
    energy: { blue: 1 },
    discardHand: 0,
    battleCookieToHand: {
      count: 1,
      maxLevel: 1,
      energyColor: 'blue',
    },
  },
  'BS6-082': {
    energy: {},
    discardHand: 1,
    discardHandAtLeast: true,
  },
  'BS6-001': {
    energy: {},
    discardHand: 0,
    hpToTrash: { amount: 2, energyColor: 'red' },
  },
  'BS6-004': {
    energy: {},
    discardHand: 0,
    hpToTrash: { amount: 1, energyColor: 'red' },
  },
  // BS7-006 的 On Play 尖括號代價是自身 HP，官方文字沒有 generic
  // parser 所需的標準「this Cookie」句型，明確保留 sourceOnly。
  'BS7-006': {
    energy: {},
    discardHand: 0,
    hpToTrash: { amount: 1, sourceOnly: true },
  },
  'BS7-008': {
    energy: {},
    discardHand: 0,
    hpToTrash: { amount: 1, keyword: 'arena' },
  },
  'BS7-012': {
    energy: {},
    discardHand: 0,
    hpToTrash: { amount: 1, keyword: 'arena' },
  },
  // BS7-027 的 Activate 費用只有 1 黃色能量；明確覆寫可避免官方
  // 尖括號標記在不同語系／格式化版本下被誤分類成一般效果成本。
  'BS7-027': {
    energy: { yellow: 1 },
    discardHand: 0,
  },
  'BS7-028': { energy: {}, discardHand: 0 },
  'BS7-029': { energy: { yellow: 1 }, discardHand: 0 },
  'BS7-031': { energy: { yellow: 1 }, discardHand: 1 },
  'BS7-032': { energy: {}, discardHand: 0 },
  // BS7-033 的尖括號是登場時的戰鬥區移動成本；先以零能量技能成本
  // 開啟 pending effect，再由第一個 battle-to-break 效果完成選卡。
  'BS7-033': { energy: {}, discardHand: 0 },
  'BS7-036': { energy: {}, discardHand: 0 },
  // BS7-037 的 Activate 代價是將自身放入休息區，不是一般能量支付。
  'BS7-037': { energy: {}, discardHand: 0, selfToBreakArea: true },
  'BS7-044': { energy: {}, discardHand: 0 },
  'BS7-045': { energy: {}, discardHand: 0 },
  // BS7-046 的登場成本是棄 1 張牌；支援區登場效果本身另由 exact effects
  // 展開，避免把「Then」攻擊效果誤算進 On Play。
  'BS7-046': { energy: {}, discardHand: 1 },
  'BS7-048': { energy: {}, discardHand: 0 },
  'BS7-049': {
    energy: { green: 1 },
    discardHand: 0,
    supportToTrash: 1,
    supportToTrashKeyword: 'arena',
  },
  'BS7-050': { energy: {}, discardHand: 0, supportToHand: 1 },
  'BS7-051': {
    energy: {},
    discardHand: 0,
    supportToTrash: 1,
    supportToTrashKeyword: 'arena',
  },
  'BS7-053': { energy: {}, discardHand: 0 },
  'BS7-054': { energy: {}, discardHand: 0, supportToHand: 1 },
  'BS7-055': { energy: {}, discardHand: 0 },
  'BS7-057': { energy: { green: 2 }, discardHand: 0 },
  'BS7-060': { energy: {}, discardHand: 0 },
    'BS7-061': {
      energy: {},
      discardHand: 0,
      supportToTrash: 1,
      supportToTrashKeyword: 'arena',
    },
  'BS7-067': { energy: { blue: 1 }, discardHand: 0 },
  'BS7-069': { energy: {}, discardHand: 2 },
  'BS7-074': { energy: {}, discardHand: 0 },
  'BS7-075': {
    energy: {},
    discardHand: 1,
    discardHandKeyword: 'arena',
  },
  'BS7-076': { energy: {}, discardHand: 0, selfToDeckBottom: true },
  'BS7-090': { energy: {}, discardHand: 2 },
  'BS7-093': { energy: { purple: 1 }, discardHand: 0, selfToTrash: true },
  'BS7-105': { energy: { purple: 2 }, discardHand: 0 },
  'BS6-014': {
    energy: {},
    discardHand: 0,
    hpToTrash: { amount: 2 },
  },
  'BS2-015': {
    energy: { green: 4 },
    discardHand: 0,
    trashBattleCookie: { count: 1, sourceOnly: true },
  },
  'BS1-038': {
    energy: { yellow: 2 },
    discardHand: 0,
    selfToBreakArea: true,
  },
  'BS2-011': {
    energy: { yellow: 2 },
    discardHand: 0,
    selfToBreakArea: true,
  },
  'BS4-077': {
    energy: { blue: 1 },
    discardHand: 0,
    selfToDeckBottom: true,
  },
  'BS4-001': {
    energy: { red: 2 },
    discardHand: 0,
    selfToBreakArea: true,
  },
  'BS4-092': {
    energy: { purple: 1 },
    discardHand: 0,
    trashBattleCookie: {
      count: 1,
      maxLevel: 2,
      energyColor: 'purple',
      excludeSource: true,
    },
  },
  'BS2-071': {
    energy: { purple: 1 },
    discardHand: 0,
    trashBattleCookie: { count: 1, sourceOnly: true },
  },
  'BS3-075': { energy: {}, discardHand: 1 },
  'BS3-081': { energy: { blue: 2 }, discardHand: 1 },
  'BS3-112': {
    energy: { purple: 1 },
    discardHand: 0,
    trashToDeckBottom: { count: 2, nonCookieOnly: true },
  },
  'BS3-051': { energy: { green: 1 }, discardHand: 0 },
  'BS3-098': {
    energy: { purple: 1 },
    discardHand: 0,
    trashToDeck: { count: 5, energyColor: 'purple', excludeFlip: true },
  },
  // 「<Place this Cookie in the trash.>」是這個技能的代價（比照 BS2-015／
  // BS2-071 的 trashBattleCookie 寫法），generic parseAbilityCost 只認得
  // 「Place N (energy) LV.X Cookie from your battle area into the trash」
  // 這種措辭，「this Cookie」是自我指涉、抓不到，沒有這個覆寫的話發動這個
  // 技能就完全不用犧牲自己。
  'BS3-105': {
    energy: { purple: 1 },
    discardHand: 0,
    trashBattleCookie: { count: 1, sourceOnly: true },
  },
  'BS3-025': { energy: { yellow: 1 }, discardHand: 0 },
  'P-016': { energy: { yellow: 1 }, discardHand: 0 },
  'P-018': { energy: {}, discardHand: 1 },
  'P-030': { energy: {}, discardHand: 2 },
  // BS5 RED 系列代價覆寫（詳細文字在 data/candidates/ 的原始 JSON）。
  // BS5-005 Mala Sauce Cookie：【Activate】<{R}><Place 1 card from the top of
  // your {R} LV.2 or higher Cookie's HP into the trash.> 技能效果是選對手餅乾
  // 1 傷害，見 exactStarterEffects。
  'BS5-005': {
    energy: { red: 1 },
    discardHand: 0,
    hpToTrash: { energyColor: 'red', minLevel: 2 },
  },
  // BS5-007 Fire Spirit Cookie：【When this Cookie faints】<Discard 1 {R}
  // item card from your hand.> 這個棄牌是昏厥技能的代價，不能只依賴一般
  // faint 效果轉接，否則會出現技能提示但沒有支付入口的狀態。
  'BS5-007': {
    energy: {},
    discardHand: 1,
    discardHandColor: 'red',
    discardHandType: 'item',
  },
  // BS5-013 Pitaya Dragon Cookie：【On Play】<Discard 1 {R} Cookie from your
  // hand.> 紅龍 Cookie 是 DRAGON 關鍵字，本身是餅乾。
  'BS5-013': {
    energy: {},
    discardHand: 1,
    discardHandColor: 'red',
    discardHandType: 'cookie',
  },
  // BS5-015 Carol Cookie：【On Play】<Place 1 card from the top of your other
  // Cookie's HP into the trash.>（不能犧牲自己）
  'BS5-015': {
    energy: {},
    discardHand: 0,
    hpToTrash: { excludeSource: true },
  },
  // BS5-018 Flat Tofu Cookie：【On Play】<Discard 1 {R} trap card from your
  // hand.>
  'BS5-018': {
    energy: {},
    discardHand: 1,
    discardHandColor: 'red',
    discardHandType: 'trap',
  },
  // BS5-019 Pudding Cookie：【Activate】【Once Per Turn】<{R}><Discard 1 {R}
  // Cookie from your hand.> 效果是本回合自身攻擊 +1（見 exactStarterEffects）。
  'BS5-019': {
    energy: { red: 1 },
    discardHand: 1,
    discardHandColor: 'red',
    discardHandType: 'cookie',
  },
  'BS5-071': {
    energy: {},
    discardHand: 3,
    discardHandAtLeast: true,
    discardHandColor: 'blue',
  },
  'BS5-074': {
    energy: { blue: 1 },
    discardHand: 0,
  },
  'BS5-076': {
    energy: { blue: 1 },
    discardHand: 1,
  },
  'BS5-078': {
    energy: { blue: 1 },
    discardHand: 0,
  },
  'BS5-081': {
    energy: {},
    discardHand: 4,
  },
  'BS5-083': {
    energy: {},
    discardHand: 0,
    discardAllHand: true,
  },
  'BS5-084': {
    energy: {},
    discardHand: 1,
  },
  // BS5-092 Rambutan Cookie：被動回應的「<return 3 non-Cookie cards from
  // your trash to your deck and shuffle it.>」是技能代價；generic parser
  // 不認得「return … from your trash to your deck」句型。
  'BS5-092': {
    energy: {},
    discardHand: 0,
    trashToDeck: { count: 3, nonCookieOnly: true },
  },
  // BS5-093 Lychee Dragon Cookie：【Activate】<{P}><Return 3 {P} Cookies
  // that do not have FLIP from your trash to your deck and shuffle it.>
  'BS5-093': {
    energy: { purple: 1 },
    discardHand: 0,
    trashToDeck: { count: 3, energyColor: 'purple', excludeFlip: true, cookieOnly: true },
  },
}

/** 卡面同時含靜態被動句與 Activate 技能時，分開保留靜態效果。 */
const exactCookieSkillPassiveEffects: Partial<Record<string, CardEffect[]>> = {
  // BS7-014 Capsaicin Cookie：指定卡名任一張在己方戰鬥區時自身 +1 攻擊。
  'BS7-014': [
    {
      kind: 'modify-attack',
      amount: 1,
      duration: 'persistent',
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      condition: {
        kind: 'any-of',
        conditions: [
          {
            kind: 'battle-area-has-named-cookie',
            side: 'self',
            name: 'Kouign-Amann Cookie',
          },
          {
            kind: 'battle-area-has-named-cookie',
            side: 'self',
            name: 'Prune Juice Cookie',
          },
        ],
      },
    },
  ],
}

/** 卡面同時有獨立 On Play 與 Activate 子句時，保留登場效果的單次時機。 */
const exactCookieSkillOnPlayEffects: Partial<Record<string, CardEffect[]>> = {
  // BS7-035 Kouign-Amann Cookie：登場時若己方戰鬥區有 Capsaicin 或
  // Prune Juice，這張卡本身增加 1 HP；不能放入 Activate effects，否則
  // 每次啟動傷害技能都會重複補 HP。
  'BS7-035': [
    {
      kind: 'gain-hp',
      amount: 1,
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      condition: {
        kind: 'any-of',
        conditions: [
          {
            kind: 'battle-area-has-named-cookie',
            side: 'self',
            name: 'Capsaicin Cookie',
          },
          {
            kind: 'battle-area-has-named-cookie',
            side: 'self',
            name: 'Prune Juice Cookie',
          },
        ],
      },
    },
  ],
}

const exactCookieSkillSourceEnergy: Partial<
  Record<string, CardSkill['sourceEnergy']>
> = {
  'P-017': { green: 1 },
  'BS8-018': { red: 1 },
  'BS8-103': { purple: 1 },
  // BS7-040 Whipped Cream Cookie：昏厥效果可由自身作為 1 黃色能量支付。
  'BS7-040': { yellow: 1 },
  // BS7-048 Poison Mushroom Cookie：昏厥效果可由自身作為 1 綠色能量支付。
  'BS7-048': { green: 1 },
}

/**
 * 通用觸發判斷靠 `{mob}`／`{ap}` 標記，但 BS3-025 的文字沒有這兩種標記
 * （只有 `{mt}`），只以「once per game」與「休息區」文意表達可主動發動，
 * 一般解析會誤判成 passive，需要明確覆寫。
 */
const exactCookieSkillTriggers: Partial<Record<string, SkillTrigger>> = {
  'BS3-025': 'activate',
  'BS4-004': 'on-play',
  'BS5-081': 'opponent-attack',
  // BS5-092 與 BS5-081 同樣是「When your opponent's Cookie attacks」的
  // 防守方一次性回應技能，在陷阱視窗內宣告並支付代價。
  'BS5-092': 'opponent-attack',
  // BS7-079 uses the same defensive timing in plain prose without an
  // explicit `{mob}` marker: it triggers when the opponent declares an
  // attack, so it must enter the real attack-response window rather than be
  // treated as a passive aura.
  'BS7-079': 'opponent-attack',
  // BS7-044～046 的技能都寫成「從支援區登場時」，但官方資料未提供
  // `{ap}` 標記；固定為 On Play，並由 fromSupportArea 限定來源。
  'BS7-044': 'on-play',
  'BS7-045': 'on-play',
  'BS7-046': 'on-play',
}

/**
 * P-002／P-003／P-013／P-014（GingerBright 黃/綠/藍/紫版本）的官方文字把
 * `{mt}` 誤植成 `{mt)`（少了右大括號），一般的 token 解析抓不到合法標記，
 * 導致 yourTurn 被判成 false。P-001（紅版本）文字正確，不需要覆寫。
 */
const exactCookieSkillYourTurn: Partial<Record<string, boolean>> = {
  'P-002': true,
  'P-003': true,
  'P-013': true,
  'P-014': true,
}

/**
 * 部分「When this Cookie faints」技能是整組效果的可選觸發；
 * BS3-061 的支援區卡牌是啟動代價，不能只把第一段代價當成可選效果，
 * 否則略過代價後仍可能繼續結算後面的全場傷害。
 */
const exactCookieSkillFaintOptional: Partial<Record<string, boolean>> = {
  'BS3-061': true,
}

export const convertOfficialCookieSkill = (
  card: OfficialCardRecord,
): CardSkill | undefined => {
  if ((card.type !== 'cookie' && card.type !== 'flip') || !card.skill.text) {
    return undefined
  }

  const cardKey = card.cardNumber.includes('@')
    ? card.baseCardNumber || card.cardNumber.split('@')[0]
    : card.cardNumber
  const conversion = convertOfficialCardEffects(
    card.type === 'flip' ? { ...card, type: 'cookie' } : card,
  )
  const cost = P_EXACT_SKILL_COSTS[cardKey] ?? exactCookieSkillCosts[cardKey] ?? parseAbilityCost(card.skill.text)
  const parsed = parseOfficialCardText(card.skill.text)
  const endPhaseScope = getEndPhaseScope(card.skill.text)

  if (
    conversion.status !== 'supported' ||
    !parsed
  ) {
    return undefined
  }

  return {
    trigger:
      P_EXACT_SKILL_TRIGGERS[cardKey] ??
      exactCookieSkillTriggers[cardKey] ??
      (/(?:when|if) this Cookie is played from the (?:trash|support|break)(?: area)?/i.test(card.skill.text)
        ? 'on-play'
        : undefined) ??
      (parsed.markers.includes('bl') &&
      /redirect\s+the\s+attack\s+to\s+this\s+Cookie/i.test(card.skill.text)
        ? 'block'
        : parsed.markers.includes('mob')
          ? 'activate'
          : parsed.markers.includes('ap')
            ? 'on-play'
            : 'passive'),
    oncePerTurn: parsed.markers.includes('t1'),
    yourTurn: exactCookieSkillYourTurn[cardKey] ?? parsed.markers.includes('mt'),
    restSource: RESTS_THIS_CARD_PATTERN.test(card.skill.text),
    cost,
    ...(P_EXACT_SPECIAL_PLAY_COSTS[cardKey]
      ? { specialPlayCost: P_EXACT_SPECIAL_PLAY_COSTS[cardKey] }
      : {}),
    ...(P_SOURCE_ENERGY[cardKey] ?? exactCookieSkillSourceEnergy[cardKey]
      ? { sourceEnergy: P_SOURCE_ENERGY[cardKey] ?? exactCookieSkillSourceEnergy[cardKey] }
      : {}),
    ...(exactCookieSkillFaintOptional[cardKey]
      ? { faintOptional: true }
      : {}),
    text: conversion.sourceText,
    effects: conversion.effects,
    ...(exactCookieSkillPassiveEffects[cardKey]
      ? { passiveEffects: exactCookieSkillPassiveEffects[cardKey] }
      : {}),
    ...(exactCookieSkillOnPlayEffects[cardKey]
      ? { onPlayEffects: exactCookieSkillOnPlayEffects[cardKey] }
      : {}),
    ...(exactCookieSkillOnPlayEffects[cardKey]
      ? { onPlayCost: { energy: {}, discardHand: 0 } }
      : {}),
    faint: FAINT_TRIGGER_PATTERN.test(card.skill.text),
    endPhase: endPhaseScope !== undefined,
    ...(endPhaseScope ? { endPhaseScope } : {}),
    afterDamage: /(?:after|when)\s+(?:receiving|taking)\s+damage/i.test(
      card.skill.text,
    ),
    oncePerGame: /once per game/i.test(card.skill.text),
    // 只認「來源自己目前在休息區」這個前提句式（BS3-025），不能用寬鬆的
    // 「文字裡有提到 break area」去比對——P-016／BS3-036／BS1-035／BS1-038
    // 的文字都提到 break area，但那是效果的目標／去向（送某張卡進休息區），
    // 不是這個技能本身只能從休息區發動的前提，誤判會讓 findSkillSource 在
    // 這些卡意外流落休息區時把它們當成可發動的技能來源。
    fromBreakArea: /this Cookie is in your break area/i.test(card.skill.text),
    onPlayFromBreakArea: /when this Cookie is played from the break area/i.test(card.skill.text),
    fromTrashArea:
      P_FROM_TRASH.has(cardKey) ||
      /when this Cookie is played from the trash/i.test(card.skill.text),
    fromSupportArea:
      P_FROM_SUPPORT.has(cardKey) ||
      /when this Cookie is played from the support area/i.test(card.skill.text),
  }
}
