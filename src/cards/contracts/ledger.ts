import { createHash } from 'node:crypto'
import type {
  AbilityCost,
  CardEffect,
  EnergyCost,
  EffectTargetSelector,
  GameCard,
  ExtraDeckCard,
} from '../../game'
import {
  convertOfficialCardToExtraDeckCard,
  convertOfficialCardToGameCard,
  normalizeOfficialCardRecord,
} from '../official-card-adapter'
import { materializeExtraDeckCookie } from '../../game/extra-deck'
import { parseOfficialCardText } from '../official-text-parser'
import type { OfficialCardRecord } from '../types'
import type {
  CardBehaviorAudit,
  CardBehaviorContract,
  CardClauseFragment,
  CardTextSource,
  ContractCost,
  ContractPayment,
  ContractResolutionStep,
  ContractTiming,
  ContractTarget,
  RuntimeCardEvidence,
} from './types'

const ENERGY_TOKEN_TO_COLOR: Record<string, keyof EnergyCost> = {
  R: 'red',
  Y: 'yellow',
  G: 'green',
  B: 'blue',
  P: 'purple',
  K: 'black',
  N: 'neutral',
}

const ACTION_PATTERNS: readonly [RegExp, CardClauseFragment['role']][] = [
  [/\bboth\s+players\s+can\s+use\s+(?:the\s+)?effect\s+below\b/i, 'condition'],
  [/\b(?:draw\w*|reveal\w*|inspect\w*|look at|view\w*|rearrange\w*)\b/i, 'effect'],
  [/\b(?:add\w*|become\w*|deal\w*|receiv\w*|gain\w*|damage\w*|attack\w*|faint\w*|equip\w*|redirect\w*|mou\w*|discard\w*|awaken\w*)\b|\bcannot\s+add\s+HP\b|\bcannot\s+be\s+moved\b|\bunaffected\s+by\s+your\s+opponent['’]s\s+trap\s+effects\b|\{da\}/i, 'effect'],
  [
    /\b(?:play|place|return|move|put|take|trash|discard|rest|set|make)\b/i,
    'effect',
  ],
  [
    /\b(?:if|when|while|as long as|whenever|cannot\s+(?:activate|be activated|reach|be selected|be trashed)|only be used|sum reaches|sum of\s+\d+\s+or\s+(?:lower|higher)|higher than|lower than|less than|more than)\b/i,
    'condition',
  ],
  [/\bselect\b/i, 'target'],
]

const stripMarkupTags = (text: string): string =>
  text
    // Official exports occasionally contain presentation-only HTML around a
    // FLIP label.  Do not strip the rule brackets: those are parsed below.
    .replace(/<\/?(?:em|strong|b|i|span|br|p)(?:\s[^>]*)?>/gi, '')
    .replace(/&nbsp;/gi, ' ')

const normalizeWhitespace = (text: string): string =>
  stripMarkupTags(text).replace(/\s+/g, ' ').trim()

const hashSource = (record: OfficialCardRecord): string =>
  createHash('sha256')
    .update(
      JSON.stringify({
        cardNumber: record.cardNumber,
        baseCardNumber: record.baseCardNumber,
        type: record.type,
        skill: record.skill,
        attackText: record.attackText,
        flipText: record.flipText,
      }),
    )
    .digest('hex')

const sourceSegments = (
  record: OfficialCardRecord,
): Partial<Record<CardTextSource, string>> => {
  const segments: Partial<Record<CardTextSource, string>> = {}
  if (record.skill.text?.trim()) segments.skill = record.skill.text.trim()
  if (record.attackText?.trim()) segments.attack = record.attackText.trim()
  if (record.flipText?.trim()) segments.flip = record.flipText.trim()
  if (!segments.skill && !segments.attack && !segments.flip) {
    if (record.skill.name?.trim()) segments.ability = record.skill.name.trim()
  }
  return segments
}

// `{bl}` is the printed Blocker keyword, not a skill timing marker.  Treating
// it as timing made every item containing "cannot activate Blocker" fail the
// contract even though the runtime effect was present.
const TIMING_MARKERS = new Set(['mob', 'ap', 't1', 'mt'])

const tokenize = (text: string): string[] =>
  [...text.matchAll(/\{([A-Za-z0-9_]+)\}|(?:<|《)([^>》]+)(?:>|》)/g)].map(
    (match) => match[1] ?? match[2]?.trim() ?? '',
  )

const addClause = (
  clauses: CardClauseFragment[],
  source: CardTextSource,
  text: string,
  role: CardClauseFragment['role'],
  start: number,
  end: number,
  confidence: CardClauseFragment['confidence'],
): void => {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return
  clauses.push({
    id: `${source}-${clauses.length + 1}`,
    source,
    text: normalized,
    role,
    start,
    end,
    confidence,
    tokens: tokenize(normalized),
  })
}

const parseEnergy = (text: string): EnergyCost => {
  const energy: EnergyCost = {}
  for (const match of text.matchAll(/\{([RYGBPKN])\}/gi)) {
    const color = ENERGY_TOKEN_TO_COLOR[match[1].toUpperCase()]
      if (color) energy[color] = (energy[color] ?? 0) + 1
  }
  // A small number of official exports omit the braces around a single
  // energy icon (for example `<R>`).  Only accept a string made entirely of
  // standalone energy letters so skill/attack names are never misread as a
  // payment.
  if (Object.keys(energy).length === 0 && /^[RYGBPKN](?:\s*[RYGBPKN])*$/i.test(text.trim())) {
    for (const token of text.trim().split(/\s+/)) {
      const color = ENERGY_TOKEN_TO_COLOR[token.toUpperCase()]
      if (color) energy[color] = (energy[color] ?? 0) + 1
    }
  }
  return energy
}

const hasEnergy = (energy: EnergyCost): boolean =>
  Object.values(energy).some((amount) => (amount ?? 0) > 0)

const energyMatches = (expected: EnergyCost, actual: EnergyCost): boolean =>
  Object.entries(expected).every(
    ([color, amount]) => (actual[color as keyof EnergyCost] ?? 0) >= (amount ?? 0),
  )

const selectorMatches = (
  expected: Partial<EffectTargetSelector>,
  actual: Partial<EffectTargetSelector>,
): boolean => {
  if (expected.side !== actual.side) return false
  if (expected.min !== undefined && actual.min !== expected.min) return false
  if (expected.max !== undefined && actual.max !== expected.max) return false
  for (const key of [
    'energyColor',
    'minLevel',
    'maxLevel',
    'remainingHp',
    'minRemainingHp',
    'maxRemainingHp',
    'excludeSource',
    'sourceOnly',
    'allMatching',
    'attackTargetOnly',
    'excludeAttackTarget',
    'restedOnly',
    'activeOnly',
    'excludeFlip',
    'cardType',
    'nonCookieOnly',
    'keyword',
    'cardName',
    'costSelected',
    'noSkillOnly',
    'sameLevelAsPreviousEffectTarget',
    'countPerPlayer',
  ] as const) {
    if (expected[key] !== undefined && actual[key] !== expected[key]) {
      // LV.1 is the lower bound of the Cookie level domain.  A number of
      // legacy effects express an exact LV.1 target with only `maxLevel: 1`;
      // adding `minLevel: 1` to the shadow selector would claim a runtime
      // distinction that does not exist (there is no LV.0 Cookie).  Keep all
      // other level bounds exact so LV.2+ and HP qualifiers cannot be hidden.
      if (
        key === 'minLevel' &&
        expected.minLevel === 1 &&
        actual.minLevel === undefined &&
        actual.maxLevel === 1
      ) {
        continue
      }
      // Older runtime selectors used `remainingHp` for an upper-bound
      // qualifier (“N or less”).  Treat that representation as equivalent to
      // the explicit `maxRemainingHp` field in the shadow contract.
      if (
        key === 'maxRemainingHp' &&
        expected.maxRemainingHp !== undefined &&
        actual.maxRemainingHp === undefined &&
        actual.remainingHp === expected.maxRemainingHp
      ) {
        continue
      }
      // An exact HP target may be represented by the runtime as the paired
      // lower/upper bounds.  This preserves evidence without widening a
      // one-point target into an upper-bound-only selector.
      if (
        key === 'remainingHp' &&
        expected.remainingHp !== undefined &&
        actual.remainingHp === undefined &&
        actual.minRemainingHp === expected.remainingHp &&
        actual.maxRemainingHp === expected.remainingHp
      ) {
        continue
      }
      return false
    }
  }
  return true
}

/**
 * Some CardEffect variants intentionally keep a movement/selection domain in
 * their discriminated fields instead of an EffectTargetSelector.  The
 * runtime still exposes that domain to the player, so the shadow ledger must
 * project it without changing the formal rule object.
 */
const additionalRuntimeSelectorsForEffect = (
  record: Record<string, unknown>,
): Partial<EffectTargetSelector>[] => {
  if (typeof record.kind !== 'string') return []
  const amount =
    typeof record.amount === 'number'
      ? record.amount
      : typeof record.count === 'number'
        ? record.count
        : undefined
  const selector =
    record.target && typeof record.target === 'object'
      ? (record.target as Partial<EffectTargetSelector>)
      : undefined
  const side =
    record.side === 'opponent' || record.side === 'either'
      ? (record.side as EffectTargetSelector['side'])
      : 'self'
  const movementFields: Partial<EffectTargetSelector> = {
    side,
    ...(typeof record.energyColor === 'string'
      ? { energyColor: record.energyColor as EffectTargetSelector['energyColor'] }
      : {}),
    ...(typeof record.exactLevel === 'number'
      ? { minLevel: record.exactLevel, maxLevel: record.exactLevel }
      : {}),
    ...(typeof record.minLevel === 'number' ? { minLevel: record.minLevel } : {}),
    ...(typeof record.maxLevel === 'number' ? { maxLevel: record.maxLevel } : {}),
    ...(record.cookieOnly === true ? { cardType: 'cookie' as const } : {}),
    ...(record.nonCookieOnly === true ? { nonCookieOnly: true } : {}),
    ...(typeof record.cardName === 'string' ? { cardName: record.cardName } : {}),
    ...(Array.isArray(record.cardNames) && record.cardNames.every((name) => typeof name === 'string')
      ? { cardNames: record.cardNames as string[] }
      : {}),
    ...(record.sameLevelAsPreviousEffectTarget === true
      ? { sameLevelAsPreviousEffectTarget: true }
      : {}),
  }
  const fixed = (count: number): Partial<EffectTargetSelector> => ({
    ...movementFields,
    min: count,
    max: count,
  })
  const upTo = (count: number): Partial<EffectTargetSelector> => ({
    ...movementFields,
    min: 0,
    max: count,
  })

  switch (record.kind) {
    case 'set-active':
      return record.selectable === true && typeof record.supportCount === 'number'
        ? [{ side: 'self', min: record.optional === false ? record.supportCount : 0, max: record.supportCount,
            ...(record.energyColor ? { energyColor: record.energyColor as EffectTargetSelector['energyColor'] } : {}) }]
        : []
    case 'deck-to-support':
      return amount === undefined ? [] : [upTo(amount), fixed(amount)]
    case 'trash-to-support':
      return amount === undefined ? [] : [upTo(amount), fixed(amount)]
    case 'opponent-random-discard':
    case 'opponent-discard-hand':
      return amount === undefined ? [] : [
        { side: 'opponent', min: 0, max: amount },
        { side: 'opponent', min: amount, max: amount },
      ]
    case 'discard-hand':
      return record.destination === 'deck-top' || record.destination === 'deck-bottom'
        ? amount === undefined
          ? []
          : [fixed(amount)]
        : []
    case 'draw-up-to-then-discard':
      return record.handDestination === 'deck-top' ||
        record.handDestination === 'deck-bottom' ||
        record.handDestination === 'deck-top-or-bottom'
        ? [{
            side: 'self',
            min: typeof record.discardCount === 'number' ? record.discardCount : 1,
            max: typeof record.discardCount === 'number' ? record.discardCount : 1,
          }]
        : []
    case 'break-to-hand-by-level-sum':
      return typeof record.cardCount === 'number'
        ? [{ side: 'self', min: record.cardCount, max: record.cardCount }]
        : []
    case 'opponent-break-to-trash-then-battle-to-break':
      // The first step chooses a Cookie from the opponent's break area; the
      // second step optionally chooses an opponent battle Cookie.  The
      // compound effect keeps both decisions in its own fields rather than a
      // single `target`, so project both public selection domains here.
      return [
        { side: 'opponent', min: 1, max: 1 },
        { side: 'opponent', min: 0, max: 1 },
      ]
    case 'hand-to-hp':
      // The hand choice is independent of the destination Cookie selector.
      // A required second-stage placement cannot be covered by an optional hand choice.
      return [{ side: 'self', min: record.handPlacementRequired === true ? 1 : 0, max: 1 }]
    case 'hp-to-support':
      // The target field identifies the destination Cookie.  The attached HP
      // card is a separate support-area selection exposed by the UI.
      return [{ side: 'self', min: record.optional === true ? 0 : 1, max: 1 }]
    case 'field-to-deck-bottom':
    case 'field-to-trash':
      if (!selector || record.allowStage !== true) return []
      return [
        {
          ...selector,
          side:
            record.battleSide === 'opponent' ? 'opponent' : selector.side,
          cardType: 'cookie',
        },
        {
          side: selector.side ?? 'either',
          min: selector.min,
          max: selector.max,
          cardType: 'stage',
        },
      ]
    default:
      return []
  }
}

const runtimeSelectorForEffect = (
  record: Record<string, unknown>,
): Partial<EffectTargetSelector> | null => {
  if (typeof record.kind !== 'string') return null
  const amount =
    typeof record.amount === 'number'
      ? record.amount
      : typeof record.max === 'number'
        ? record.max
        : undefined
  const optional = record.optional === true
  const side =
    record.side === 'opponent' || record.side === 'either'
      ? (record.side as EffectTargetSelector['side'])
      : record.supportSide === 'opponent'
        ? 'opponent'
        : 'self'
  const common: Partial<EffectTargetSelector> = {
    side,
    ...(typeof record.energyColor === 'string'
      ? { energyColor: record.energyColor as EffectTargetSelector['energyColor'] }
      : {}),
    ...(typeof record.maxLevel === 'number' ? { maxLevel: record.maxLevel } : {}),
    ...(typeof record.exactLevel === 'number'
      ? { minLevel: record.exactLevel, maxLevel: record.exactLevel }
      : {}),
    ...(typeof record.minLevel === 'number' ? { minLevel: record.minLevel } : {}),
    ...(typeof record.remainingHp === 'number' ? { remainingHp: record.remainingHp } : {}),
    ...(typeof record.maxRemainingHp === 'number'
      ? { maxRemainingHp: record.maxRemainingHp }
      : {}),
    ...(typeof record.minRemainingHp === 'number'
      ? { minRemainingHp: record.minRemainingHp }
      : {}),
    ...(typeof record.excludeSource === 'boolean'
      ? { excludeSource: record.excludeSource }
      : {}),
    ...(typeof record.sourceOnly === 'boolean' ? { sourceOnly: record.sourceOnly } : {}),
    ...(typeof record.activeOnly === 'boolean' ? { activeOnly: record.activeOnly } : {}),
    ...(typeof record.noSkillOnly === 'boolean'
      ? { noSkillOnly: record.noSkillOnly }
      : {}),
    ...(typeof record.keyword === 'string'
      ? { keyword: record.keyword as EffectTargetSelector['keyword'] }
      : {}),
    ...(typeof record.cardName === 'string' ? { cardName: record.cardName } : {}),
    ...(Array.isArray(record.cardNames) && record.cardNames.every((name) => typeof name === 'string')
      ? { cardNames: record.cardNames as string[] }
      : {}),
    ...(record.sameLevelAsPreviousEffectTarget === true
      ? { sameLevelAsPreviousEffectTarget: true }
      : {}),
  }
  if (
    record.kind === 'prevent-cookie-active-next-phase' &&
    record.target &&
    typeof record.target === 'object'
  ) {
    const target = record.target as Record<string, unknown>
    return {
      ...(target as Partial<EffectTargetSelector>),
      ...(typeof target.exactLevel === 'number'
        ? { minLevel: target.exactLevel, maxLevel: target.exactLevel }
      : {}),
    }
  }
  // Equipped cards remain public on their host Cookie, but they are a
  // distinct selection domain from the host itself. Project the card-level
  // selector so an "Equipped [Soul Jam]" clause cannot be satisfied by a
  // generic opposing Cookie target.
  if (record.kind === 'equipped-to-hp') {
    return {
      ...common,
      ...(amount !== undefined ? { min: 0, max: amount } : {}),
    }
  }
  const movementKinds = new Set([
    'trash-to-battle',
    'break-to-battle',
    'break-to-hand',
    'support-to-battle',
    'hand-to-battle',
    'hand-to-break',
    'trash-to-break',
    'break-to-trash',
    'support-to-hand',
    'support-to-support',
    'hand-to-support',
    'trash-to-support',
    'trash-to-hand',
    'trash-to-deck',
    'flip-to-support',
  ])
  if (movementKinds.has(record.kind)) {
    // break-to-battle is defined as an "up to" selection in the rules layer.
    // support-to-battle keeps that legacy default when no explicit optional
    // flag is present, but an official "Select 1" clause (for example
    // BS7-057) is required and the adapter records `optional: false`.
    const upToByRule =
      record.kind === 'break-to-battle' ||
      (record.kind === 'support-to-battle' && record.optional !== false)
    const max =
      record.kind === 'support-to-hand' && typeof record.keepCount === 'number'
        ? record.keepCount
        : record.kind === 'support-to-hand' && record.anyNumber === true
          ? Number.MAX_SAFE_INTEGER
          : amount
    const min =
      record.kind === 'trash-to-deck'
        ? typeof record.min === 'number'
          ? record.min
          : 0
        : record.kind === 'break-to-trash' || record.kind === 'trash-to-hand'
          ? 0
          : record.kind === 'support-to-hand' && typeof record.keepCount === 'number'
            ? record.keepCount
            : upToByRule || optional
              ? 0
              : max
    return {
      ...common,
      ...(max !== undefined ? { min, max } : {}),
      ...(record.kind === 'trash-to-deck'
        ? {
            ...(record.excludeFlip === true ? { excludeFlip: true } : {}),
            ...(record.cookieOnly === true ? { cardType: 'cookie' as const } : {}),
            ...(record.nonCookieOnly === true ? { nonCookieOnly: true } : {}),
          }
        : {}),
    }
  }
  if (
    record.kind === 'support-to-trash' ||
    record.kind === 'rest-support' ||
    record.kind === 'opponent-rests-support'
  ) {
    const max = amount
    return {
      ...common,
      ...(max !== undefined ? { min: optional ? 0 : max, max } : {}),
    }
  }
  if (record.kind === 'rest-support-and-damage') {
    const max =
      typeof record.supportAmount === 'number' ? record.supportAmount : undefined
    return {
      ...common,
      ...(max !== undefined ? { min: 0, max } : {}),
      ...(record.activeOnly === true ? { activeOnly: true } : {}),
    }
  }
  if (record.kind === 'inspect-deck') {
    const max = typeof record.pickCount === 'number' ? record.pickCount : undefined
    return {
      side: 'self',
      ...(max !== undefined
        ? { min: record.optionalPick === true ? 0 : max, max }
        : {}),
      ...(typeof record.filterColor === 'string'
        ? { energyColor: record.filterColor as EffectTargetSelector['energyColor'] }
        : {}),
      ...(typeof record.filterType === 'string'
        ? { cardType: record.filterType as EffectTargetSelector['cardType'] }
        : {}),
      ...(typeof record.filterKeyword === 'string'
        ? { keyword: record.filterKeyword as EffectTargetSelector['keyword'] }
        : {}),
    }
  }
  if (record.kind === 'opponent-trash-to-break') {
    const max = typeof record.max === 'number' ? record.max : undefined
    return {
      side: 'opponent',
      ...(max !== undefined ? { min: 0, max } : {}),
      ...(typeof record.exactLevel === 'number'
        ? { minLevel: record.exactLevel, maxLevel: record.exactLevel }
        : {}),
      ...(typeof record.maxLevel === 'number' ? { maxLevel: record.maxLevel } : {}),
    }
  }
  if (record.kind === 'opponent-battle-to-trash') {
    return {
      side: 'opponent',
      min: typeof record.min === 'number' ? record.min : 0,
      max: typeof record.max === 'number' ? record.max : 1,
      ...(typeof record.remainingHp === 'number'
        // This effect field is the upper-bound form of the target wording
        // (“N or less HP”), while the shared selector names that dimension
        // `maxRemainingHp`.
        ? { maxRemainingHp: record.remainingHp }
        : {}),
      ...(typeof record.minRemainingHp === 'number'
        ? { minRemainingHp: record.minRemainingHp }
        : {}),
      ...(typeof record.maxLevel === 'number' ? { maxLevel: record.maxLevel } : {}),
      ...(typeof record.minLevel === 'number' ? { minLevel: record.minLevel } : {}),
    }
  }
  return null
}

/** Convert a structured AbilityCost movement into selector evidence. */
const runtimeSelectorsForCost = (
  value: Record<string, unknown>,
): Partial<EffectTargetSelector>[] => {
  const selectors: Partial<EffectTargetSelector>[] = []
  const add = (
    amount: number,
    fields: Partial<EffectTargetSelector> = {},
  ): void => {
    selectors.push({ side: 'self', min: amount, max: amount, ...fields })
  }
  if (typeof value.supportToTrash === 'number' && value.supportToTrash > 0) {
    add(value.supportToTrash)
  }
  if (typeof value.supportToHand === 'number' && value.supportToHand > 0) {
    add(value.supportToHand, {
      ...(typeof value.supportToHandType === 'string'
        ? { cardType: value.supportToHandType as EffectTargetSelector['cardType'] }
        : {}),
      ...(typeof value.supportToHandColor === 'string'
        ? { energyColor: value.supportToHandColor as EffectTargetSelector['energyColor'] }
        : {}),
      ...(typeof value.supportToHandKeyword === 'string'
        ? { keyword: value.supportToHandKeyword as EffectTargetSelector['keyword'] }
        : {}),
    })
  }
  const hpToTrash = value.hpToTrash
  if (hpToTrash && typeof hpToTrash === 'object') {
    const hp = hpToTrash as Record<string, unknown>
    add(typeof hp.amount === 'number' ? hp.amount : 1, {
      ...(hp.sourceOnly === true ? { sourceOnly: true } : {}),
      ...(hp.excludeSource === true ? { excludeSource: true } : {}),
      ...(typeof hp.energyColor === 'string'
        ? { energyColor: hp.energyColor as EffectTargetSelector['energyColor'] }
        : {}),
      ...(typeof hp.minLevel === 'number' ? { minLevel: hp.minLevel } : {}),
      ...(typeof hp.maxLevel === 'number' ? { maxLevel: hp.maxLevel } : {}),
      ...(typeof hp.keyword === 'string'
        ? { keyword: hp.keyword as EffectTargetSelector['keyword'] }
        : {}),
    })
  }
  const hpToHand = value.hpToHand
  if (hpToHand && typeof hpToHand === 'object') {
    const hp = hpToHand as Record<string, unknown>
    add(typeof hp.amount === 'number' ? hp.amount : 1, {
      ...(hp.sourceOnly === true ? { sourceOnly: true } : {}),
      ...(hp.excludeSource === true ? { excludeSource: true } : {}),
      ...(typeof hp.energyColor === 'string'
        ? { energyColor: hp.energyColor as EffectTargetSelector['energyColor'] }
        : {}),
      ...(typeof hp.minLevel === 'number' ? { minLevel: hp.minLevel } : {}),
      ...(typeof hp.maxLevel === 'number' ? { maxLevel: hp.maxLevel } : {}),
      ...(typeof hp.keyword === 'string'
        ? { keyword: hp.keyword as EffectTargetSelector['keyword'] }
        : {}),
    })
  }
  const battleCookie = value.trashBattleCookie ?? value.battleCookieToHand
  if (battleCookie && typeof battleCookie === 'object') {
    const battle = battleCookie as Record<string, unknown>
    add(typeof battle.count === 'number' ? battle.count : 1, {
      ...(battle.sourceOnly === true ? { sourceOnly: true } : {}),
      ...(battle.excludeSource === true ? { excludeSource: true } : {}),
      ...(typeof battle.energyColor === 'string'
        ? { energyColor: battle.energyColor as EffectTargetSelector['energyColor'] }
        : {}),
      ...(typeof battle.level === 'number'
        ? { minLevel: battle.level, maxLevel: battle.level }
        : {}),
      ...(typeof battle.minLevel === 'number' ? { minLevel: battle.minLevel } : {}),
      ...(typeof battle.maxLevel === 'number' ? { maxLevel: battle.maxLevel } : {}),
    })
  }
  const trashCookie = value.trashCookieToBreakArea
  if (trashCookie && typeof trashCookie === 'object') {
    const trash = trashCookie as Record<string, unknown>
    add(typeof trash.count === 'number' ? trash.count : 1, {
      cardType: 'cookie',
      ...(typeof trash.minLevel === 'number' ? { minLevel: trash.minLevel } : {}),
      ...(typeof trash.maxLevel === 'number' ? { maxLevel: trash.maxLevel } : {}),
      ...(typeof trash.energyColor === 'string'
        ? { energyColor: trash.energyColor as EffectTargetSelector['energyColor'] }
        : {}),
      ...(trash.excludeFlip === true ? { excludeFlip: true } : {}),
    })
  }
  const trashToDeck = value.trashToDeck ?? value.trashToDeckBottom
  if (trashToDeck && typeof trashToDeck === 'object') {
    const trash = trashToDeck as Record<string, unknown>
    add(typeof trash.count === 'number' ? trash.count : 1, {
      ...(typeof trash.energyColor === 'string'
        ? { energyColor: trash.energyColor as EffectTargetSelector['energyColor'] }
        : {}),
      ...(trash.excludeFlip === true ? { excludeFlip: true } : {}),
      ...(trash.cookieOnly === true ? { cardType: 'cookie' } : {}),
      ...(trash.nonCookieOnly === true ? { nonCookieOnly: true } : {}),
    })
  }
  const handToBreak = value.handToBreakArea
  if (handToBreak && typeof handToBreak === 'object') {
    const hand = handToBreak as Record<string, unknown>
    add(typeof hand.count === 'number' ? hand.count : 1, {
      cardType: 'cookie',
      ...(typeof hand.minLevel === 'number' ? { minLevel: hand.minLevel } : {}),
      ...(typeof hand.maxLevel === 'number' ? { maxLevel: hand.maxLevel } : {}),
      ...(typeof hand.energyColor === 'string'
        ? { energyColor: hand.energyColor as EffectTargetSelector['energyColor'] }
        : {}),
    })
  }
  return selectors
}

const bracketClauses = (
  source: CardTextSource,
  text: string,
  clauses: CardClauseFragment[],
): { payments: ContractPayment[]; costs: ContractCost[] } => {
  const payments: ContractPayment[] = []
  const costs: ContractCost[] = []
  for (const match of text.matchAll(/(?:<|《)([^>》]+)(?:>|》)/g)) {
    const inner = normalizeWhitespace(match[1])
    const start = match.index ?? 0
    const end = start + match[0].length
    const energy = parseEnergy(inner)
    const clauseId = `${source}-${clauses.length + 1}`
    if (/^(?:\{[RYGBPKN]\}|[RYGBPKN])(?:\s*(?:\{[RYGBPKN]\}|[RYGBPKN]))*$/i.test(inner)) {
      addClause(clauses, source, match[0], 'payment', start, end, 'exact')
      payments.push({ kind: 'energy', energy, clauseIds: [clauseId] })
      continue
    }
    if (/can be used as\s+\{[RYGBPKN]\}/i.test(inner)) {
      addClause(clauses, source, match[0], 'payment', start, end, 'pattern')
      payments.push({ kind: 'source-energy', energy, clauseIds: [clauseId] })
      continue
    }
    if (/^reveal\s+1\s+card\s+from\s+the\s+bottom\s+of\s+your\s+deck\.?$/i.test(inner)) {
      addClause(clauses, source, match[0], 'cost', start, end, 'pattern')
      costs.push({ kind: 'reveal-deck-bottom', amount: 1, clauseIds: [clauseId] })
      continue
    }
    // A bracketed `Select ... from ... support area` is a target selector,
    // not a payment/cost.  Leave its contract target classification to
    // `targetClauses`; otherwise the generic bracket fallback would add an
    // unknown cost and permanently mask valid support-to-battle evidence.
    const bracketTargetSelection = /^select\s+(?:up\s+to\s+)?(?:\d+|any\s+number)\s+(?:(?:\{[RYGBPK]\}|LV\.\s*\d+(?:\s+or\s+(?:lower|higher))?|(?:【Arena】|\[Arena\]|Arena))\s+)*(?:other\s+)?(?:cards?|cookies?)\s+(?:from|in)\s+(?:your opponent's|opponent's|your|the|either player's)\s+(?:trash|break\s+area|support\s+area|hand|deck)\.?$/i
    if (bracketTargetSelection.test(inner)) {
      continue
    }
    // A bracketed "Select 1 Cookie from each player" is a selection cost
    // (v1.8 §8-2). Target cardinality is recorded by `eachPlayerSelection`;
    // this ledger does not prove cost timing or Then optionality. The runtime
    // paired selector and command/browser regressions must verify those.
    if (/^select\s+1\s+cookies?\s+from\s+each\s+player\.?$/i.test(inner)) {
      continue
    }
    // EXTRA BS8-027 selects a specifically named Cookie from trash. It is a
    // public target selection, never an unknown bracketed payment.
    if (/^select\s+(?:up\s+to\s+)?\d+\s+\[[^\]]+\]\s+in\s+your\s+trash\.?$/i.test(inner)) {
      continue
    }
    // BS10-068 places a specifically named Cookie from either hand or trash
    // into the Support Area.  This is a move effect (the runtime adapter
    // exposes the two source zones as a choose-one), never an unknown cost.
    // Keep it as a classified effect clause so the source text is covered
    // without pretending that the source itself is an energy/discard cost.
    if (
      /^place\s+(?:up\s+to\s+)?\d+\s+\[[^\]]+\]\s+from\s+your\s+hand\s+or\s+your\s+trash\s+in\s+your\s+support\s+area\s+as\s+rested\.?$/i.test(
        inner,
      )
    ) {
      addClause(clauses, source, match[0], 'effect', start, end, 'pattern')
      continue
    }
    const discard = inner.match(
      /discard\s+(?:(\d+)|an?)(?:\s+or\s+more)?\s+(?:(?:\{[RYGBPK]\}|【[^】]+】)\s+)*(?:non-)?(?:cards?|cookies?|traps?|items?)/i,
    )
    const discardAll = /discard\s+(?:your|the)\s+entire\s+hand/i.test(inner)
    const supportTrash = inner.match(
      /place\s+(\d+)\s+(?:(?:\{[RYGBPK]\}|【[^】]+】)\s+)?cards?\s+from\s+your\s+support/i,
    )
    const hpTrash =
      inner.match(
        /place\s+(?:a\s+total\s+of\s+)?(\d+)(?:\s+cards?)?\s+from\s+the\s+top\s+of\s+[\s\S]*?cookies?(?:['’]s?)?\s+hp(?:\s+cards?)?(?:\s+in\s+your\s+battle\s+area)?\s+(?:into|in)\s+(?:the|your)\s+trash/i,
      ) ??
      inner.match(/place\s+(?:a\s+total\s+of\s+)?(\d+)\s+of\s+your\s+cookies?(?:['’]s?)?\s+hp\s+cards?\s+in\s+the\s+trash/i)
    const battleTrash = inner.match(/place\s+(\d+)\s+.*cookie.*battle\s+area.*trash/i)
    const selfTrash = /place\s+this\s+(?:cookie|card)\s+in\s+(?:the|your)\s+trash/i.test(inner)
    // BS9-059 combines the source Cookie and support-card payment in a
    // single bracketed clause; retain both cost witnesses under this clause.
    const selfAndSupportTrash = inner.match(
      /place\s+this\s+(?:cookie|card)\s+and\s+(\d+)\s+cards?\s+from\s+your\s+support\s+area\s+into\s+(?:the|your)\s+trash/i,
    )
    const selfBreak = /(?:make\s+this\s+cookie\s+faint|place\s+this\s+cookie\s+in\s+(?:the|your)\s+break\s+area)/i.test(inner)
    const selfAndHandBreak = /place\s+this\s+cookie\s+and\s+(?:a|\d+)\s+cookie(?:\s+that\s+is\s+LV\.\s*\d+\s+or\s+above)?\s+from\s+your\s+hand\s+into\s+your\s+break\s+area/i.test(inner)
    const battleFaint = inner.match(/make\s+(\d+)\s+.*cookies?\s+faint/i)
    const battleBreak = inner.match(/place\s+(\d+)\s+.*cookie.*battle\s+area.*break\s+area/i)
    const handBreak = inner.match(/place\s+(\d+)\s+.*cookie.*hand.*break\s+area/i)
    const positionCookie = inner.match(/set\s+(\d+)\s+(?:【Arena】\s+)?cookies?\s+in\s+your\s+battle\s+area\s+as\s+(active|rested)/i)
    const restCookie = /rest\s+\d+\s+cookie\s+in\s+your\s+battle\s+area/i.test(inner)
    const restSource = /(?:rest\s+this\s+(?:card|cookie)|card\s+rests?)/i.test(inner)
    const fieldToDeckBottom = /\b(?:place|select)\b[\s\S]*\b(?:battle\s+area|stage\s+area)\b[\s\S]*\b(?:on|at|to)\s+the\s+bottom\s+of\s+(?:the|your|the\s+owner's)\s+deck/i.test(inner)
    // 官方 BS8-078／082 省略了 "your"，但來源仍只能是自己這張 Cookie；
    // 兩種措辭都必須綁到 AbilityCost.selfToDeckBottom 的成本證據。
    const selfDeckBottom = /place\s+this\s+cookie\s+(?:on|at|to)\s+the\s+bottom\s+of\s+(?:(?:your|the)\s+)?deck/i.test(inner)
    const breakToTrash = /place\s+this\s+cookie\s+from\s+(?:the\s+)?break\s+area\s+into\s+the\s+trash/i.test(inner)
    const handToDeckBottom = /place\s+(?:\d+\s+)?cards?\s+from\s+your\s+hand\s+(?:on|at)\s+the\s+bottom\s+of\s+your\s+deck/i.test(inner)
    const supportHand = inner.match(/return\s+(?:up\s+to\s+)?(\d+)\s+(?:(?:\{[RYGBPK]\}|【[^】]+】)\s+)?(?:cards?|cookies?)\s+from\s+your\s+support\s+area\s+to\s+your\s+hand/i)
    const battleToHand = /return\s+(?:up\s+to\s+)?\d+[\s\S]*?from\s+your\s+battle\s+area\s+to\s+your\s+hand/i.test(inner)
    const hpToHand = /return\s+(\d+)\s+card\s+from\s+the\s+top\s+of\s+(?:your|this)\s+(?:(?:\{[RYGBPK]\}|【[^】]+】)\s+)?cookie'?s\s+hp(?:\s+cards?)?\s+to\s+your\s+hand/i.exec(inner)
    const trashDeck = inner.match(/(?:select|return)\s+(\d+)[\s\S]*?from\s+your\s+trash[\s\S]*?(?:return\s+them\s+to|to)\s+your\s+deck/i)
    const trashDeckBottom = inner.match(/(?:select|return|place)\s+(\d+)[\s\S]*?from\s+your\s+trash[\s\S]*?bottom\s+of\s+your\s+deck/i)
    const trashToBreak = /place\s+\d+\s+(?:LV\.\s*\d+\s+)?cookie.*from\s+your\s+trash\s+into\s+(?:your|the)\s+break\s+area/i.test(inner)
    const revealHand =
      /(?:reveal\s+\d+\s+(?:(?:\{[RYGBPK]\}|【[^】]+】|\[[^\]]+\]|LV\.\s*\d+(?:\s+or\s+(?:lower|higher))?)\s+)*(?:cards?|cookies?|【[^】]+】|\[[^\]]+\])(?:\s+from\s+your\s+hand|\s+in\s+your\s+hand)|reveal\s+(?:cards?|cookies?)\s+from\s+your\s+hand\s+with\s+a\s+total\s+LV\.\s+sum\s+of\s+\d+)/i.test(inner)
    const deckTrash = inner.match(
      /place\s+(\d+)\s+cards?\s+from\s+the\s+top\s+of\s+your\s+deck\s+into\s+(?:the|your)\s+trash/i,
    )
    if (
      discard ||
      discardAll ||
      supportTrash ||
      hpTrash ||
      battleTrash ||
      selfTrash ||
      selfAndSupportTrash ||
      selfBreak ||
      selfAndHandBreak ||
      battleFaint ||
      battleBreak ||
      handBreak ||
      positionCookie ||
      restCookie ||
      restSource ||
      fieldToDeckBottom ||
      selfDeckBottom ||
      breakToTrash ||
      handToDeckBottom ||
      battleToHand ||
        hpToHand ||
      supportHand ||
      trashDeck ||
      trashDeckBottom ||
      trashToBreak ||
      revealHand ||
      deckTrash
    ) {
      const kind = discard
        ? 'discard-hand'
        : discardAll
          ? 'discard-hand'
        : supportTrash
          ? 'support-to-trash'
          : hpTrash
            ? 'hp-to-trash'
            : battleTrash
              ? 'battle-to-trash'
                : selfTrash
                  ? 'self-to-trash'
                  : selfAndSupportTrash
                    ? 'self-to-trash'
                  : selfAndHandBreak
                    ? 'self-to-break'
                    : selfBreak
                  ? 'self-to-break'
                  : battleFaint
                    ? 'battle-to-break'
                    : battleBreak
                    ? 'battle-to-break'
                    : handBreak
                      ? 'hand-to-break'
                      : positionCookie
                        ? positionCookie[2].toLowerCase() === 'active' ? 'ready-cookie' : 'rest-cookie'
                      : restCookie
                        ? 'rest-cookie'
                        : restSource
                          ? 'rest-source'
                          : fieldToDeckBottom
                            ? 'field-to-deck-bottom'
                            : selfDeckBottom
                              ? 'self-to-deck-bottom'
                            : breakToTrash
                              ? 'break-to-trash'
                              : handToDeckBottom
                                ? 'hand-to-deck-bottom'
                                : battleToHand
                                  ? 'battle-to-hand'
                                  : hpToHand
                                    ? 'hp-to-hand'
                                    : supportHand
                                      ? 'support-to-hand'
                                      : trashDeck
                                        ? 'trash-to-deck'
                                        : trashDeckBottom
                                          ? 'trash-to-deck-bottom'
                                          : trashToBreak
                                            ? 'trash-to-break'
                                            : revealHand
                                              ? 'reveal-hand'
                                              : deckTrash
                                                ? 'deck-to-trash'
                                                : 'move'
      addClause(clauses, source, match[0], 'cost', start, end, 'pattern')
      const amountMatch =
        discard ??
        supportTrash ??
        hpTrash ??
        battleTrash ??
        battleFaint ??
        battleBreak ??
        handBreak ??
        supportHand ??
        trashDeck ??
        trashDeckBottom ??
        hpToHand ??
        deckTrash
      costs.push({
        kind,
        amount: positionCookie?.[1] ? Number(positionCookie[1]) : amountMatch?.[1] ? Number(amountMatch[1]) : 1,
        clauseIds: [clauseId],
      })
      if (selfAndSupportTrash) {
        costs.push({
          kind: 'support-to-trash',
          amount: Number(selfAndSupportTrash[1]),
          clauseIds: [clauseId],
        })
      }
      if (selfAndHandBreak) {
        costs.push({
          kind: 'hand-to-break',
          amount: 1,
          clauseIds: [clauseId],
        })
      }
      continue
    }
    addClause(clauses, source, match[0], 'unsupported', start, end, 'unknown')
    costs.push({ kind: hasEnergy(energy) ? 'energy' : 'unknown', clauseIds: [clauseId] })
  }
  return { payments, costs }
}

const targetClauses = (
  source: CardTextSource,
  text: string,
  clauses: CardClauseFragment[],
  sourceType?: OfficialCardRecord['type'],
): ContractTarget[] => {
  const targets: ContractTarget[] = []
  const structuredRanges: Array<{ start: number; end: number }> = []
  // "select up to 1 Cookie in your battle area" names the owner after Cookie.
  // Keep this plain battle selector separate from qualified hand/Break choices.
  const plainBattleSelection = /\bselect\s+(up\s+to\s+)?(\d+)\s+Cookies?\s+(?:from|in)\s+(your opponent['’]s|your|either player['’]s)\s+battle\s+area\b/gi
  for (const match of text.matchAll(plainBattleSelection)) {
    const start = match.index ?? 0, end = start + match[0].length
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({ selector: { side: /opponent/i.test(match[3]) ? 'opponent' : /either/i.test(match[3]) ? 'either' : 'self', min: match[1] ? 0 : Number(match[2]), max: Number(match[2]) }, clauseIds: [clauseId], zone: 'battle' })
    structuredRanges.push({ start, end })
  }
  // BS9-025's trailing clause omits a number: the player may select another
  // one of their Cookies as the recipient of the attached +1 HP.  Treat this
  // as an optional battle Cookie selector and keep `excludeSource` explicit;
  // the runtime adapter binds it to `attachedHpAlternateTarget` while the
  // FLIP card itself still resolves to Trash.
  const anotherCookieSelection = /\bselect\s+another\s+of\s+(?:your)\s+Cookies?\b/gi
  for (const match of text.matchAll(anotherCookieSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: { side: 'self', min: 0, max: 1, excludeSource: true },
      clauseIds: [clauseId],
      zone: 'battle',
    })
    structuredRanges.push({ start, end })
  }
  // An equipped card is selected from the Cookie that hosts it, rather than
  // selecting that Cookie. Parse this narrow grammar before the generic
  // Cookie/card selector, which would otherwise consume the later word
  // "card" in the placement sentence and lose the Soul Jam qualifier.
  const equippedSelection =
    /\bselect\s+(up\s+to\s+)?(\d+)\s+of\s+(your opponent's|your)\s+equipped\s+\[([^\]]+)\]/gi
  for (const match of text.matchAll(equippedSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    const amount = Number(match[2])
    const keywordName = match[4].trim().toLowerCase()
    const keyword = keywordName === 'soul jam' ? ('soul-jam' as const) : undefined
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: {
        side: /opponent/i.test(match[3]) ? 'opponent' : 'self',
        min: match[1] ? 0 : amount,
        max: amount,
        ...(keyword ? { keyword } : {}),
      },
      clauseIds: [clauseId],
      zone: 'battle',
    })
    structuredRanges.push({ start, end })
  }
  const re = /select\s+(up\s+to\s+)?(\d+)\s+(?:of\s+)?(your opponent['’]s|your|either player['’]s)\s+([\s\S]*?)\b(?:cookies?|cards?)(?=\s|[.,;]|$)/gi
  for (const match of text.matchAll(re)) {
    const min = match[1] ? 0 : Number(match[2])
    const max = Number(match[2])
    const sideText = match[3].toLowerCase()
    const side = sideText.includes('opponent')
      ? 'opponent'
      : sideText.includes('either')
        ? 'either'
        : 'self'
    const descriptor = match[4] ?? ''
  const fullPhrase = text.slice(
    match.index ?? 0,
    Math.min(text.length, (match.index ?? 0) + match[0].length + 180),
  )
  // Restrict qualifiers to the current target clause.  A following Then/If
  // clause can contain a different HP condition for the already selected
  // Cookie and must not leak into this selector.
  const targetWindow = fullPhrase.split(/\b(?:during|then|if)\b/i, 1)[0]
  const targetQualifierWindow = targetWindow.split(/\b(?:that|this|their)\s+Cookie\b/i, 1)[0]
    const energyToken = descriptor.match(/\{([RYGBPK])\}/i)?.[1]?.toUpperCase()
    const energyColor = energyToken
      ? ENERGY_TOKEN_TO_COLOR[energyToken]
      : undefined
    const levelMatch = targetQualifierWindow.match(/LV\.\s*(\d+)(?:\s+(or\s+(?:lower|higher)))?/i)
    const level = levelMatch ? Number(levelMatch[1]) : undefined
    const levelQualifier = levelMatch?.[2]?.toLowerCase()
    const remainingHpMatch = targetQualifierWindow.match(
      /(?:remaining\s+HP\s+is\s+(\d+)(?:\s+or\s+(less|more))?|(?:has|with)\s+(\d+)\s+or\s+(less|more)\s+HP\s+remaining)/i,
    )
    const remainingHp = remainingHpMatch?.[1] ?? remainingHpMatch?.[3]
    const remainingHpQualifier = (
      remainingHpMatch?.[2] ?? remainingHpMatch?.[4]
    )?.toLowerCase()
    const clauseId = `${source}-${clauses.length + 1}`
    const start = match.index ?? 0
    structuredRanges.push({ start, end: start + match[0].length })
    addClause(clauses, source, match[0], 'target', start, start + match[0].length, 'pattern')
    targets.push({
      selector: {
        side,
        min,
        max,
        ...(energyColor && energyColor !== 'neutral' ? { energyColor } : {}),
        ...(level !== undefined && levelQualifier === 'or lower'
          ? { maxLevel: level }
          : level !== undefined && levelQualifier === 'or higher'
            ? { minLevel: level }
            : level !== undefined
              ? { minLevel: level, maxLevel: level }
              : {}),
        ...(remainingHp !== undefined && remainingHpQualifier === 'less'
          ? { maxRemainingHp: Number(remainingHp) }
          : remainingHp !== undefined && remainingHpQualifier === 'more'
            ? { minRemainingHp: Number(remainingHp) }
            : remainingHp !== undefined
              ? { remainingHp: Number(remainingHp) }
              : {}),
        ...(sourceType === 'cookie' && /\bother\b/i.test(descriptor)
          ? { excludeSource: true }
          : {}),
      },
      clauseIds: [clauseId],
    })
  }
  // BS8-003 的「all your Cookies that have 4 or less HP」沒有 select
  // 動詞，卻是必須完整結算的戰鬥區目標集合。以場上兩格上限表示 runtime
  // selector 的 max，並保留 allMatching 讓 contract 不把它弱化成任選一張。
  const allFriendlyHpGain =
    /\ball\s+your\s+Cookies?\s+that\s+have\s+(\d+)\s+or\s+less\s+HP\s+gain\s+\+?\d+\s+HP\b/gi
  for (const match of text.matchAll(allFriendlyHpGain)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: {
        side: 'self',
        min: 1,
        max: 2,
        maxRemainingHp: Number(match[1]),
        allMatching: true,
      },
      clauseIds: [clauseId],
      zone: 'battle',
    })
    structuredRanges.push({ start, end })
  }
  const specialPlayBattleSelection = /\bselect\s+(up\s+to\s+)?(\d+)\s+Cookie\s+that\s+has\s+Special\s+Play\s+in\s+your\s+battle\s+area\b/gi
  for (const match of text.matchAll(specialPlayBattleSelection)) {
    const start = match.index ?? 0, end = start + match[0].length
    if (structuredRanges.some(range => start < range.end && end > range.start)) continue
    const amount = Number(match[2]), clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({ selector: { side: 'self', min: match[1] ? 0 : amount, max: amount, hasSpecialPlay: true }, clauseIds: [clauseId], zone: 'battle' })
    structuredRanges.push({ start, end })
  }
  // BS8-050 的「LV.3 Cookie that was played from your break area during this
  // turn」沒有重複寫出 battle area，卻仍是場上 Cookie 的單一選擇。保留進場
  // 來源與回合限制，避免 audit 把一般 LV.3 目標誤當成充分證據。
  const currentTurnBreakEntrySelection =
    /\bselect\s+(up\s+to\s+)?(\d+)\s+(?:of\s+)?(?:your\s+)?LV\.\s*(\d+)\s+Cookie\s+that\s+was\s+played\s+from\s+your\s+break\s+area\s+during\s+this\s+turn\b/gi
  for (const match of text.matchAll(currentTurnBreakEntrySelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const amount = Number(match[2])
    const level = Number(match[3])
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: {
        side: 'self',
        min: match[1] ? 0 : amount,
        max: amount,
        minLevel: level,
        maxLevel: level,
        enteredFrom: 'break',
        enteredThisTurn: true,
      },
      clauseIds: [clauseId],
      zone: 'battle',
    })
    structuredRanges.push({ start, end })
  }
  const zoneSelection = /\bselect\s+(up\s+to\s+)?(\d+)\s+(?:\{([RYGBPK])\}\s+)?(?:LV\.\s*(\d+)(?:\s+or\s+(?:lower|higher))?\s+)?(?:(?:【Arena】|\[Arena\]|Arena)\s+)?(?:other\s+)?(?:cookies?|cards?)(?:\s+other\s+than\s+\[[^\]]+\])?\s+(?:from|in)\s+(your opponent's|opponent's|your|the|either player's)\s+(trash|break\s+area|support\s+area|hand|deck)\b/gi
  for (const match of text.matchAll(zoneSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const amount = Number(match[2])
    const level = match[4] ? Number(match[4]) : undefined
    const qualifier = match[0].match(/LV\.\s*\d+\s+(or\s+(?:lower|higher))/i)?.[1]?.toLowerCase()
    const color = match[3] ? ENERGY_TOKEN_TO_COLOR[match[3].toUpperCase()] : undefined
    const keyword = /(?:【Arena】|\[Arena\]|\bArena\b)/i.test(match[0])
      ? ('arena' as const)
      : undefined
    const sideText = match[5]?.toLowerCase() ?? ''
    const zoneText = match[6]?.toLowerCase() ?? ''
    const side = sideText.includes('opponent') ? 'opponent' : 'self'
    const zone = zoneText.includes('trash')
      ? 'trash'
      : zoneText.includes('break')
        ? 'break'
        : zoneText.includes('support')
          ? 'support'
          : zoneText.includes('hand')
            ? 'hand'
            : 'deck'
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: {
        side,
        min: match[1] ? 0 : amount,
        max: amount,
        ...(color && color !== 'neutral' ? { energyColor: color } : {}),
        ...(keyword ? { keyword } : {}),
        ...(level !== undefined && qualifier === 'or lower'
          ? { maxLevel: level }
          : level !== undefined && qualifier === 'or higher'
            ? { minLevel: level }
            : level !== undefined
              ? { minLevel: level, maxLevel: level }
              : {}),
      },
      clauseIds: [clauseId],
      zone,
    })
    structuredRanges.push({ start, end })
  }
  const namedTrashSelection = /\bselect\s+(up\s+to\s+)?(\d+)\s+\[([^\]]+)\]\s+in\s+your\s+trash\b/gi
  for (const match of text.matchAll(namedTrashSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const amount = Number(match[2])
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: {
        side: 'self',
        min: match[1] ? 0 : amount,
        max: amount,
        cardName: match[3],
      },
      clauseIds: [clauseId],
      zone: 'trash',
    })
    structuredRanges.push({ start, end })
  }
  const namedAlternativeTrashReturn =
    /\breturn\s+(up\s+to\s+)?(\d+)\s+\[([^\]]+)\]\s+or\s+\[([^\]]+)\]\s+from\s+your\s+trash\b/gi
  for (const match of text.matchAll(namedAlternativeTrashReturn)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const amount = Number(match[2])
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: {
        side: 'self',
        min: match[1] ? 0 : amount,
        max: amount,
        cardNames: [match[3], match[4]],
      },
      clauseIds: [clauseId],
      zone: 'trash',
    })
    structuredRanges.push({ start, end })
  }
  const keywordBattleAreaSelection =
    /\bselect\s+(up\s+to\s+)?(\d+)\s+(?:【|\[)(arena|beast)(?:】|\])\s+(?:cookies?|cards?)\s+(?:in|from)\s+(your opponent's|opponent's|your|either player's|the)\s+battle\s+area\b/gi
  for (const match of text.matchAll(keywordBattleAreaSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const sideText = (match[4] ?? '').toLowerCase()
    const side = sideText.includes('opponent')
      ? 'opponent'
      : sideText.includes('either') || sideText === 'the'
        ? 'either'
        : 'self'
    const amount = Number(match[2])
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: {
        side,
        min: match[1] ? 0 : amount,
        max: amount,
        keyword: match[3].toLowerCase() as 'arena' | 'beast',
      },
      clauseIds: [clauseId],
      zone: 'battle',
    })
    structuredRanges.push({ start, end })
  }
  const battleAreaSelection = /\bselect\s+(up\s+to\s+)?(\d+)\s+((?:other\s+)?(?:\{[RYGBPK]\}\s+)?(?:(?:【Arena】|\[Arena\]|Arena)\s+)?(?:\{[RYGBPK]\}\s+)?(?:LV\.\s*\d+(?:\s+or\s+(?:lower|higher))?\s+)?(?:cookies?|cards?)(?:\s+that\s+is\s+LV\.\s*\d+(?:\s+or\s+(?:lower|higher))?)?(?:\s+(?:that\s+does\s+not\s+have|without)\s+(?:【Skill】|\[Skill\]|Skill))?)\s+(?:in|from)\s+(your opponent's|your|either player's|the)\s+battle\s+area\b/gi
  for (const match of text.matchAll(battleAreaSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const fullPhrase = text.slice(
      start,
      Math.min(text.length, start + match[0].length + 180),
    )
    const descriptor = match[3] ?? ''
    const sideText = (match[4] ?? '').toLowerCase()
    const side = sideText.includes('opponent')
      ? 'opponent'
      : sideText.includes('either') || sideText === 'the'
        ? 'either'
        : 'self'
    const amount = Number(match[2])
    const colorToken = descriptor.match(/\{([RYGBPK])\}/i)?.[1]?.toUpperCase()
    const color = colorToken ? ENERGY_TOKEN_TO_COLOR[colorToken] : undefined
    const keyword = /\barena\b/i.test(descriptor) ? ('arena' as const) : undefined
    // Official card text commonly qualifies an Arena battle target as a
    // Cookie that does not have Skill (or, equivalently, "without Skill").
    // Keep that restriction in the contract selector so the runtime's
    // `noSkillOnly` binding is audited instead of treating any Arena Cookie
    // as sufficient evidence (for example BS7-036).
    const noSkillOnly = /\b(?:does\s+not\s+have|without)\s+(?:【Skill】|\[Skill\]|Skill)/i.test(
      fullPhrase,
    )
    const levelMatch = descriptor.match(/LV\.\s*(\d+)(?:\s+(or\s+(?:lower|higher)))?/i)
    const level = levelMatch ? Number(levelMatch[1]) : undefined
    const qualifier = levelMatch?.[2]?.toLowerCase()
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: {
        side,
        min: match[1] ? 0 : amount,
        max: amount,
        ...(color && color !== 'neutral' ? { energyColor: color } : {}),
        ...(keyword ? { keyword } : {}),
        ...(noSkillOnly ? { noSkillOnly: true } : {}),
        ...(level !== undefined && qualifier === 'or lower'
          ? { maxLevel: level }
          : level !== undefined && qualifier === 'or higher'
            ? { minLevel: level }
            : level !== undefined
              ? { minLevel: level, maxLevel: level }
              : {}),
        ...(sourceType === 'cookie' && /\bother\b/i.test(descriptor)
          ? { excludeSource: true }
          : {}),
      },
      clauseIds: [clauseId],
      zone: 'battle',
    })
    structuredRanges.push({ start, end })
  }
  // A few cards offer a Cookie *or* a Stage as one alternate target (for
  // example, a LV.1 Cookie from the opponent's battle area or a Stage from
  // either player's Stage area).  Keep the Stage branch as its own typed
  // selector so the runtime `allowStage` binding can prove both domains.
  const stageSelection = /\bor\s+(\d+)\s+stage(?:\s+cards?)?\s+from\s+(either player's|your opponent's|opponent's|your)\s+stage\s+area\b/gi
  for (const match of text.matchAll(stageSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const amount = Number(match[1])
    const previousText = text.slice(Math.max(0, start - 180), start)
    const sideText = (match[2] ?? '').toLowerCase()
    const side = sideText.includes('either') ? 'either' : sideText.includes('opponent') ? 'opponent' : 'self'
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: {
        side,
        min: /select\s+up\s+to\b/i.test(previousText) ? 0 : amount,
        max: amount,
        cardType: 'stage',
      },
      clauseIds: [clauseId],
      zone: 'stage',
    })
    structuredRanges.push({ start, end })
  }
  const supportSelection = /\bselect\s+(?:(up\s+to)\s+)?(\d+|any\s+number)\s+(?:\{([RYGBPK])\}\s+)?(?:(active)\s+)?(?:cards?|cookies?)\s+(?:in|from)\s+(your opponent's|opponent's|your|the|either player's)\s+support\s+area\b/gi
  for (const match of text.matchAll(supportSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const anyNumber = /^any\s+number$/i.test(match[2] ?? '')
    const amount = anyNumber ? Number.MAX_SAFE_INTEGER : Number(match[2])
    const sideText = (match[5] ?? '').toLowerCase()
    const side = sideText.includes('opponent')
      ? 'opponent'
      : sideText.includes('either')
        ? 'either'
        : 'self'
    const color = match[3]
      ? ENERGY_TOKEN_TO_COLOR[match[3].toUpperCase()]
      : undefined
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: {
        side,
        min: match[1] || anyNumber ? 0 : amount,
        max: amount,
        ...(color && color !== 'neutral' ? { energyColor: color } : {}),
        ...(match[4] ? { activeOnly: true } : {}),
      },
      clauseIds: [clauseId],
      zone: 'support',
    })
    structuredRanges.push({ start, end })
  }
  // Bracketed support-area movements are card-selection costs (for example
  // BS3-061／BS3-069).  They are not effect targets in the prose, but the
  // runtime exposes the public support selector and the contract must retain
  // that evidence for binding regressions.
  const bracketSupportSelection = /<[^>]*\b(?:place|return|take|put)\s+(\d+)\s+cards?\s+from\s+your\s+support\s+area\b[^>]*>/gi
  for (const match of text.matchAll(bracketSupportSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const amount = Number(match[1])
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: { side: 'self', min: amount, max: amount },
      clauseIds: [clauseId],
      zone: 'support',
    })
    structuredRanges.push({ start, end })
  }
  const eachPlayerSelection = /\bselect\s+1\s+(?:a\s+)?(?:cookie|card)s?\s+from\s+each\s+player\b/gi
  for (const match of text.matchAll(eachPlayerSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    const prefix = text.slice(0, start)
    if (/<\s*$/i.test(prefix)) {
      const optionalThenCost = /\bThen\s*,?\s*<\s*$/i.test(prefix)
      targets.push({
        selector: { side: 'either', min: optionalThenCost ? 0 : 2, max: 2, countPerPlayer: 1 },
        clauseIds: [clauseId], zone: 'battle',
      })
    } else {
      // Ordinary effect selections (e.g. P-082) are not declaration costs.
      for (const side of ['self', 'opponent'] as const) {
        targets.push({ selector: { side, min: 1, max: 1 }, clauseIds: [clauseId], zone: 'battle' })
      }
    }
    structuredRanges.push({ start, end })
  }
  const viewedCardSelection = /\bselect\s+(up\s+to\s+)?(\d+)\s+(?:\{([RYGBPK])\}\s+)?(?:cookies?|cards?)\s+from\s+(?:the\s+)?viewed\s+cards\b/gi
  for (const match of text.matchAll(viewedCardSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const amount = Number(match[2])
    const color = match[3]
      ? ENERGY_TOKEN_TO_COLOR[match[3].toUpperCase()]
      : undefined
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: {
        side: 'self',
        min: match[1] ? 0 : amount,
        max: amount,
        ...(color && color !== 'neutral' ? { energyColor: color } : {}),
      },
      clauseIds: [clauseId],
      zone: 'deck',
    })
    structuredRanges.push({ start, end })
  }
  const keepSupportSelection = /\bselect\s+(\d+)\s+cards?\s+to\s+keep\s+in\s+your\s+support\s+area\b/gi
  for (const match of text.matchAll(keepSupportSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const amount = Number(match[1])
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: { side: 'self', min: amount, max: amount },
      clauseIds: [clauseId],
      zone: 'support',
    })
    structuredRanges.push({ start, end })
  }
  const sameLevelBreakToTrash = /\bplace\s+(up\s+to\s+)?(\d+)\s+cookie\s+with\s+the\s+same\s+LV\.\s+as\s+that\s+cookie\s+from\s+your\s+break\s+area\s+into\s+your\s+trash\b/gi
  for (const match of text.matchAll(sameLevelBreakToTrash)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const amount = Number(match[2])
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: {
        side: 'self',
        min: match[1] ? 0 : amount,
        max: amount,
        sameLevelAsPreviousEffectTarget: true,
      },
      clauseIds: [clauseId],
      zone: 'break',
    })
    structuredRanges.push({ start, end })
  }
  const namedBreakPlay = /\bplay\s+(up\s+to\s+)?(\d+)\s+\[([^\]]+)\]\s+from\s+your\s+break\s+area\b/gi
  for (const match of text.matchAll(namedBreakPlay)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const amount = Number(match[2])
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: {
        side: 'self',
        min: match[1] ? 0 : amount,
        max: amount,
        cardName: match[3].trim(),
      },
      clauseIds: [clauseId],
      zone: 'break',
    })
    structuredRanges.push({ start, end })
  }
  const namedBattleSelection = /\bselect\s+(up\s+to\s+)?(\d+)\s+\[([^\]]+)\]\s+in\s+(your|your opponent's)\s+battle\s+area\b/gi
  for (const match of text.matchAll(namedBattleSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const amount = Number(match[2])
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({ selector: { side: match[4].toLowerCase() === 'your' ? 'self' : 'opponent',
      min: match[1] ? 0 : amount, max: amount, cardName: match[3].trim() }, clauseIds: [clauseId], zone: 'battle' })
    structuredRanges.push({ start, end })
  }
  // Any remaining Select / play-from-zone phrase is still a player choice.
  // Do not silently treat it as an untargeted effect when no safe selector
  // grammar exists; the contract must stop at needs-review instead.
  const battleBlockerSelection = /\bselect\s+(up\s+to\s+)?(\d+)\s+Cookies?\s+that\s+(?:has|have)\s+(?:【Blocker】|\{bl\}|Blocker)\s+in\s+your\s+battle\s+area\b/gi
  for (const match of text.matchAll(battleBlockerSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some(range => start < range.end && end > range.start)) continue
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({ selector: { side: 'self', min: match[1] ? 0 : Number(match[2]), max: Number(match[2]), blockerOnly: true }, clauseIds: [clauseId], zone: 'battle' })
    structuredRanges.push({ start, end })
  }
  const unresolvedSelection = /\bselect\b[^.]+(?:\.|$)/gi
  for (const match of text.matchAll(unresolvedSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    if (/\bof\s+(?:the\s+)?following\b/i.test(match[0])) continue
    if (/\b(?:from|in)\s+(?:(?:your|the|opponent's|your opponent's|either player's)\s+)?(?:trash|break\s+area|support\s+area|hand|deck|viewed\s+cards)/i.test(match[0])) continue
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'unknown')
    targets.push({
      selector: {},
      clauseIds: [clauseId],
      unresolved: 'selection phrase has no safe selector mapping',
    })
  }
  const unresolvedZoneSelection = /\b(?:play|place|return|take|put)\s+(?:up\s+to\s+)?\d+\b[^.]*\b(?:from|in)\s+(?:your opponent's|opponent's|your|the)\s+(?:trash|break\s+area|support\s+area|hand|deck)/gi
  for (const match of text.matchAll(unresolvedZoneSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    // Do not treat a bracketed cost/movement as a player target.  Costs are
    // recorded by `bracketClauses`; this pass is only for effect targets.
    const before = text.slice(0, start)
    const openAngle = Math.max(before.lastIndexOf('<'), before.lastIndexOf('《'))
    const closeAngle = Math.max(before.lastIndexOf('>'), before.lastIndexOf('》'))
    if (openAngle > closeAngle) continue
    // "that Cookie's top HP" is a dependent HP movement, not a second
    // player-selected card.  The selected Cookie target already represents
    // the decision; adding a synthetic self/trash selector makes valid cards
    // (BS3-116, P-031) look unresolved.
    if (
      /\b(?:top\s+of\s+)?(?:that|this|their|the selected)\s+Cookie['’]?s\s+(?:top\s+)?HP/i.test(
        match[0],
      ) ||
      /\b(?:that|this|their|the selected)\s+Cookie['’]?s\s+(?:top\s+)?HP/i.test(
        match[0],
      ) ||
      /\b(?:their|that|this|your)\s+(?:attached\s+)?HP(?:\s+cards?)?/i.test(
        match[0],
      )
    ) continue
    // Moving cards from the top of a deck is an untargeted deck operation;
    // only an explicit `select` phrase is a player choice.
    if (
      /\bfrom\s+(?:the\s+)?top\s+of\s+(?:your|their|the|your opponent's|opponent's)\s+deck/i.test(
        match[0],
      )
    ) continue
    const amountMatch = match[0].match(/(?:up\s+to\s+)?(\d+)/i)
    if (!amountMatch) continue
    const amount = Number(amountMatch[1])
    const energy = parseEnergy(match[0])
    const targetEnergyColor = Object.keys(energy).find(
      (color) => color !== 'neutral',
    ) as EffectTargetSelector['energyColor'] | undefined
    const selector: Partial<EffectTargetSelector> = {
      side: /opponent/i.test(match[0]) ? 'opponent' : 'self',
      min: /up\s+to/i.test(match[0]) ? 0 : amount,
      max: amount,
      ...(targetEnergyColor ? { energyColor: targetEnergyColor } : {}),
      ...( /(?:【Arena】|\[Arena\]|\bArena\b)/i.test(match[0])
        ? { keyword: 'arena' as const }
        : {}),
    }
    const zone = /trash/i.test(match[0])
      ? 'trash'
      : /break/i.test(match[0])
        ? 'break'
        : /support/i.test(match[0])
          ? 'support'
          : /hand/i.test(match[0])
            ? 'hand'
            : 'deck'
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, start + match[0].length, 'unknown')
    targets.push({
      selector,
      clauseIds: [clauseId],
      zone,
    })
  }
  return targets
}

const addActionClauses = (
  source: CardTextSource,
  text: string,
  clauses: CardClauseFragment[],
): void => {
  const stripped = stripMarkupTags(text).replace(
    /(?:<|《)[^>》]+(?:>|》)/g,
    (markup) => ' '.repeat(markup.length),
  )
  // `LV.` is an abbreviation inside a sentence (for example BS11-092's
  // "the LV. of this Cookie ..."), not an end-of-sentence boundary.
  const separator = /(?<!LV\.)(?<=[.!?])\s+|;\s+|\bThen,?\s*/gi
  let cursor = 0
  const sentences: Array<{ text: string; start: number; end: number }> = []
  for (const match of stripped.matchAll(separator)) {
    const end = match.index ?? cursor
    sentences.push({ text: stripped.slice(cursor, end), start: cursor, end })
    cursor = end + match[0].length
  }
  sentences.push({ text: stripped.slice(cursor), start: cursor, end: stripped.length })

  for (const sentence of sentences) {
    const normalized = normalizeWhitespace(sentence.text)
    if (!normalized) continue
    const match = ACTION_PATTERNS.find(([pattern]) => pattern.test(normalized))
    if (match) {
      if (match[1] === 'target') continue
      addClause(
        clauses,
        source,
        normalized,
        match[1],
        sentence.start,
        sentence.end,
        'pattern',
      )
    } else {
      // Attack／FLIP names are printed between the payment marker and the
      // executable text.  They are display labels, not omitted rule clauses;
      // keeping them as unsupported text made every no-follow-up attack name
      // look like a parser gap (for example BS6-040 and P-078).
      if (source === 'attack' || source === 'flip') continue
      // `{sk}` is the official display marker for a named skill.  A lone
      // marker plus title (for example BS4-004) has no executable clause.
      if (source === 'skill' && /^\s*\{sk\}/i.test(normalized)) continue
      if (source === 'skill' && /^(?:【Blocker】|\{bl\})$/i.test(normalized)) {
        addClause(clauses, source, normalized, 'effect', sentence.start, sentence.end, 'exact')
        continue
      }
      // A parenthetical ordering reminder is an explicit resolution rule, not
      // an unsupported effect.  Preserve it as an order clause so the
      // contract still records the source evidence without inventing a
      // runtime effect kind.
      if (/cannot switch the order of HP cards/i.test(normalized)) {
        addClause(
          clauses,
          source,
          normalized,
          'order',
          sentence.start,
          sentence.end,
          'pattern',
        )
        continue
      }
      addClause(
        clauses,
        source,
        normalized,
        'unsupported',
        sentence.start,
        sentence.end,
        'unknown',
      )
    }
  }
  for (const match of stripped.matchAll(/\bthen\b/gi)) {
    const start = match.index ?? 0
    addClause(clauses, source, match[0], 'then', start, start + match[0].length, 'exact')
  }
}

const collectCostEvidence = (
  cost: Record<string, unknown>,
  result: {
    effectKinds: Set<string>
    targetSelectors: Partial<EffectTargetSelector>[]
    energyCosts: EnergyCost[]
    abilityCostKeys: Set<string>
  },
): void => {
  Object.keys(cost).forEach((costKey) => result.abilityCostKeys.add(costKey))
  result.targetSelectors.push(...runtimeSelectorsForCost(cost))
  const directEnergy: EnergyCost = {}
  for (const color of Object.keys(ENERGY_TOKEN_TO_COLOR).map(
    (token) => ENERGY_TOKEN_TO_COLOR[token],
  )) {
    const amount = cost[color]
    if (typeof amount === 'number' && amount > 0) {
      directEnergy[color] = amount
    }
  }
  if (hasEnergy(directEnergy)) result.energyCosts.push(directEnergy)
  if (cost.energy && typeof cost.energy === 'object') {
    result.energyCosts.push(cost.energy as EnergyCost)
  }
}

const collectRuntime = (value: unknown, result: {
  effectKinds: Set<string>
  targetSelectors: Partial<EffectTargetSelector>[]
  energyCosts: EnergyCost[]
  abilityCostKeys: Set<string>
}): void => {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item) => collectRuntime(item, result))
    return
  }
  const record = value as Record<string, unknown>
  if (record.handCostDestination === 'deck-bottom' && typeof record.discardHand === 'number' && record.discardHand > 0) {
    result.effectKinds.add('reveal-hand')
    result.effectKinds.add('hand-to-deck-bottom')
  }
  if (record.handCostDestination === 'deck-bottom' && record.cost && typeof record.cost === 'object' &&
    typeof (record.cost as Record<string, unknown>).discardHand === 'number' &&
    ((record.cost as Record<string, unknown>).discardHand as number) > 0) {
    result.effectKinds.add('reveal-hand')
    result.effectKinds.add('hand-to-deck-bottom')
  }
  if (typeof record.kind === 'string') {
    result.effectKinds.add(record.kind)
    if (record.target && typeof record.target === 'object') {
      result.targetSelectors.push(record.target as Partial<EffectTargetSelector>)
    }
    const movementSelector = runtimeSelectorForEffect(record)
    if (movementSelector) result.targetSelectors.push(movementSelector)
    result.targetSelectors.push(...additionalRuntimeSelectorsForEffect(record))
    // support-to-hp has two selection domains: a support card and a Cookie
    // target.  The latter is already carried by `record.target`; expose the
    // former as selector evidence so a bracketed support-card cost can bind
    // without pretending it is a battlefield Cookie.
    // A bracketed hand-to-deck-bottom cost is modeled by the adapter as a
    // `discard-hand` effect whose destination is the deck bottom (for example
    // P-045).  Expose that shape as the contract-level movement kind so the
    // cost clause can bind to real runtime evidence.
    if (record.kind === 'discard-hand' && record.destination === 'deck-bottom') {
      result.effectKinds.add('hand-to-deck-bottom')
    }
    // A source-only field movement is the runtime shape used when a Cookie
    // pays the printed cost「Place this Cookie in your trash」(BS11-033).
    // Expose the semantic cost kind so the contract can bind it without
    // treating every field-to-trash effect as a self-cost.
    if (
      record.kind === 'field-to-trash' &&
      record.target &&
      typeof record.target === 'object' &&
      (record.target as Record<string, unknown>).sourceOnly === true
    ) {
      result.effectKinds.add('self-to-trash')
    }
    if (record.kind === 'support-to-hp') {
      result.targetSelectors.push({
        side: 'self',
        min: record.optional === true ? 0 : 1,
        max: 1,
        ...(typeof record.energyColor === 'string'
          ? { energyColor: record.energyColor as EffectTargetSelector['energyColor'] }
          : {}),
      })
    }
  }
  // Attached-HP FLIPs do not carry their default recipient as a regular
  // CardEffect: the host Cookie is resolved by battle.ts. Still expose the
  // concrete +1 HP family and the optional alternate-recipient selector to
  // the contract audit so printed BS9-025 target/cost clauses bind to runtime
  // evidence instead of being reported as unresolved.
  if (typeof record.attachedHpBonus === 'number' && record.attachedHpBonus > 0) {
    result.effectKinds.add('gain-hp')
  }
  if (
    record.attachedHpAlternateTarget &&
    typeof record.attachedHpAlternateTarget === 'object'
  ) {
    result.targetSelectors.push(
      record.attachedHpAlternateTarget as Partial<EffectTargetSelector>,
    )
  }
  if (record.energyCost && typeof record.energyCost === 'object') {
    result.energyCosts.push(record.energyCost as EnergyCost)
  }
  if (record.attackEnergyCost && typeof record.attackEnergyCost === 'object') {
    result.energyCosts.push(record.attackEnergyCost as EnergyCost)
  }
  if (record.sourceEnergy && typeof record.sourceEnergy === 'object') {
    result.energyCosts.push(record.sourceEnergy as EnergyCost)
  }
  // Stage cards carry the printed placement cost on `StageAbility.placementCost`;
  // it is the runtime evidence for the source's play-cost payment clause.
  if (record.placementCost && typeof record.placementCost === 'object') {
    result.energyCosts.push(record.placementCost as EnergyCost)
  }
  for (const [key, child] of Object.entries(record)) {
    if (
      key === 'kind' ||
      key === 'target' ||
      key === 'energyCost' ||
      key === 'attackEnergyCost' ||
      key === 'sourceEnergy'
    ) continue
    if ((key === 'cost' || key === 'faintCost') && child && typeof child === 'object') {
      collectCostEvidence(child as Record<string, unknown>, result)
    }
    if (key === 'alternativeCosts' && Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object') {
          collectCostEvidence(item as Record<string, unknown>, result)
        }
      }
    }
    collectRuntime(child, result)
  }
}

const runtimeEvidenceFromCard = (card: GameCard | null): RuntimeCardEvidence => {
  if (!card) return { card, effects: [] }
  return {
    card,
    effects: card.effects ?? [],
    skill: card.skill
      ? {
          trigger: card.skill.trigger,
          oncePerTurn: card.skill.oncePerTurn,
          oncePerGame: card.skill.oncePerGame,
          yourTurn: card.skill.yourTurn,
          restSource: card.skill.restSource,
          equippedAttackDisablesFlip: card.skill.equippedAttackDisablesFlip,
          equippedAttackBlockerPrevention: card.skill.equippedAttackBlockerPrevention,
          equippedAttackTrigger: card.skill.equippedAttackTrigger,
          battleOpponentAttackEffectPrevention: card.skill.battleOpponentAttackEffectPrevention,
          cost: card.skill.cost,
          faintCost: card.skill.faintCost,
          sourceEnergy: card.skill.sourceEnergy,
          effects: [
            ...card.skill.effects,
            ...(card.skill.onPlayEffects ?? []),
            ...(card.skill.faintEffects ?? []),
            ...(card.skill.friendlyFaintEffects ?? []),
            ...(card.skill.passiveEffects ?? []),
          ],
        }
      : undefined,
    attackEffects: card.type === 'cookie' ? card.attackEffects : undefined,
    flip: card.flip
      ? {
          cost: card.flip.cost,
          effects: card.flip.effects,
          ...(card.flip.attachedHpAlternateTarget
            ? { attachedHpAlternateTarget: card.flip.attachedHpAlternateTarget }
            : {}),
        }
      : undefined,
    ability: card.item
      ? {
          cost: card.item.cost,
          sourceEnergy: card.item.sourceEnergy,
          // 這裡只保留物品啟動時立刻結算的效果，才能和 GameCard 根層的
          // effect sequence 一一對照；裝備後攻擊效果仍由上方的全卡遞迴
          // collectRuntime 收集，不得混成這次物品啟動的 Then 序列。
          effects: card.item.effects,
          ...(card.item.equippedAttackEffects
            ? { equippedAttackEffects: card.item.equippedAttackEffects }
            : {}),
        }
      : card.stageAbility
        ? {
            cost: card.stageAbility.cost,
            restSource: card.stageAbility.restSource,
            oncePerTurn: card.stageAbility.oncePerTurn,
            effects: card.stageAbility.effects,
          }
        : card.trap
          ? {
              cost: card.trap.cost,
              sourceEnergy: card.trap.sourceEnergy,
              effects: card.trap.effects,
            }
          : undefined,
  }
}

const flattenRuntimeEffects = (evidence: RuntimeCardEvidence): CardEffect[] => {
  const result: CardEffect[] = []
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    const record = value as Record<string, unknown>
    if (typeof record.kind === 'string') result.push(record as unknown as CardEffect)
    for (const key of ['effects', 'thenEffects', 'modes']) visit(record[key])
  }
  visit(evidence.effects)
  visit(evidence.skill?.effects)
  visit(evidence.skill?.equippedAttackTrigger?.effects)
  visit(evidence.attackEffects)
  visit(evidence.flip?.effects)
  visit(evidence.ability?.effects)
  return result
}

type TurnFaintConditionRequirement = {
  side: 'self' | 'opponent'
  count: number
  label: 'friendly-cookie-fainted-this-turn' | 'opponent-cookie-fainted-this-turn'
}

type AttackFaintConditionRequirement = {
  side: 'opponent'
  count: 1
  label: 'opponent-cookie-fainted-in-current-battle'
}

/**
 * 條件句不能只被 clause ledger 分類後就算完成：若 adapter 忘了把條件
 * 寫進 runtime，舊版 shadow audit 仍可能因傷害／目標都存在而回報 verified。
 * 這裡列出規則層已有明確計數器的「本回合 Cookie 昏厥」語句，讓 contract
 * 對照實際 EffectCondition；未知或遺漏時至少會落到 needs-review。
 */
const requiredTurnFaintConditions = (
  record: OfficialCardRecord,
): TurnFaintConditionRequirement[] => {
  if (record.type !== 'cookie') return []

  const requirements = new Map<
    string,
    TurnFaintConditionRequirement
  >()
  const conditionPattern =
    /(?:during\s+this\s+turn,\s*)?if\s+(?:(\d+)\s+or\s+more\s+of\s+)?(your\s+opponent['’]s|your)\s+Cookies?\s+(?:has\s+)?fainted(?!\s+from\s+this\s+Cookie['’]s\s+attack)(?:\s+(?:during\s+)?this\s+turn)?/gi

  for (const text of Object.values(sourceSegments(record))) {
    if (!text) continue
    for (const match of text.matchAll(conditionPattern)) {
      const side = /^your\s+opponent/i.test(match[2]) ? 'opponent' : 'self'
      const count = match[1] ? Number(match[1]) : 1
      const label = side === 'self'
        ? 'friendly-cookie-fainted-this-turn'
        : 'opponent-cookie-fainted-this-turn'
      requirements.set(`${label}:${count}`, { side, count, label })
    }
  }

  return [...requirements.values()]
}

const requiredAttackFaintConditions = (
  record: OfficialCardRecord,
): AttackFaintConditionRequirement[] => {
  if (record.type !== 'cookie') return []

  const requirements: AttackFaintConditionRequirement[] = []
  const conditionPattern =
    /(?:if|when)\s+your\s+opponent['’]s\s+Cookie\s+(?:has\s+)?faint(?:s|ed)?\s+from\s+this\s+Cookie['’]s\s+attack/gi

  for (const text of Object.values(sourceSegments(record))) {
    if (!text) continue
    if (conditionPattern.test(text)) {
      requirements.push({
        side: 'opponent',
        count: 1,
        label: 'opponent-cookie-fainted-in-current-battle',
      })
      conditionPattern.lastIndex = 0
    }
  }

  return requirements
}

const hasRuntimeTurnFaintCondition = (
  evidence: RuntimeCardEvidence,
  requirement: TurnFaintConditionRequirement,
): boolean =>
  flattenRuntimeEffects(evidence).some((effect) => {
    const condition = (effect as CardEffect & { condition?: unknown }).condition
    if (!condition || typeof condition !== 'object') return false
    const candidate = condition as Record<string, unknown>
    return (
      candidate.kind === 'cookies-fainted-this-turn-at-least' &&
      candidate.side === requirement.side &&
      candidate.count === requirement.count
    )
  })

const hasRuntimeAttackFaintCondition = (
  evidence: RuntimeCardEvidence,
  requirement: AttackFaintConditionRequirement,
): boolean =>
  flattenRuntimeEffects(evidence).some((effect) => {
    const condition = (effect as CardEffect & { condition?: unknown }).condition
    return (
      condition !== null &&
      typeof condition === 'object' &&
      (condition as Record<string, unknown>).kind === requirement.label
    )
  })

const hasRuntimeThenEffects = (evidence: RuntimeCardEvidence): boolean => {
  // `attackEffects` is the runtime slot for the printed post-attack/Then
  // sequence.  Older cards do not carry a nested `thenEffects` property, but
  // the ordered array itself is the executable evidence and is consumed one
  // effect at a time by the battle resolver.
  if (evidence.attackEffects !== undefined && evidence.attackEffects.length > 0) {
    return true
  }
  let found = false
  const visit = (value: unknown): void => {
    if (found || !value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    const record = value as Record<string, unknown>
    if ('thenEffects' in record) {
      found = true
      return
    }
    for (const key of ['effects', 'modes']) visit(record[key])
  }
  visit(evidence.effects)
  visit(evidence.skill?.effects)
  visit(evidence.attackEffects)
  visit(evidence.flip?.effects)
  visit(evidence.ability?.effects)
  return found
}

const hasRuntimeConditionalStep = (evidence: RuntimeCardEvidence): boolean =>
  flattenRuntimeEffects(evidence).some((effect) => 'condition' in effect ||
    (effect.kind === 'reveal-top-deck' || effect.kind === 'reveal-bottom-deck') && Boolean(effect.match))

const runtimeEffectsForSource = (
  evidence: RuntimeCardEvidence,
  source: CardTextSource,
): CardEffect[] => {
  if (source === 'flip') return evidence.flip?.effects ?? []
  if (source === 'attack') {
    if (evidence.card?.type === 'cookie') return evidence.attackEffects ?? []
    return evidence.ability?.effects ?? evidence.effects
  }
  if (source === 'skill') {
    if (evidence.card?.type === 'cookie') {
      return evidence.skill?.effects ?? evidence.effects
    }
    return evidence.ability?.effects ?? evidence.effects
  }
  return evidence.ability?.effects ?? evidence.effects
}

const hasConsistentMirroredEffectOrder = (
  evidence: RuntimeCardEvidence,
  source: CardTextSource,
): boolean => {
  if (
    evidence.card?.type === 'cookie' ||
    (source !== 'attack' && source !== 'skill') ||
    !evidence.ability?.effects ||
    evidence.effects.length === 0
  ) return true
  const flattenKinds = (effects: readonly CardEffect[]): string[] => {
    const kinds: string[] = []
    const visit = (effect: CardEffect): void => {
      kinds.push(effect.kind)
      if ('thenEffects' in effect && effect.thenEffects) effect.thenEffects.forEach(visit)
      if (effect.kind === 'choose-one') effect.modes.forEach((mode) => mode.effects.forEach(visit))
    }
    effects.forEach(visit)
    return kinds
  }
  const rootKinds = flattenKinds(evidence.effects)
  const abilityKinds = flattenKinds(evidence.ability.effects)
  return (
    rootKinds.length === abilityKinds.length &&
    rootKinds.every((kind, index) => kind === abilityKinds[index])
  )
}

const uniqueRuntimeEffectIndex = (
  candidates: readonly string[],
  runtimeKinds: readonly string[],
): number | null => {
  const candidateSet = new Set(candidates)
  const indexes = runtimeKinds
    .map((kind, index) => (candidateSet.has(kind) ? index : -1))
    .filter((index) => index >= 0)
  return indexes.length === 1 ? indexes[0] : null
}

/**
 * Prove each printed Then boundary against concrete effect indexes.  Kinds
 * are taken from the already-structured contract steps, while the runtime
 * sequence comes from the source-specific ability array.  When both sides
 * have unique anchors, their indexes must be strictly increasing; historical
 * clauses without two classified anchors retain the existing structural gate.
 */
const coversResolutionOrder = (
  contract: CardBehaviorContract,
  evidence: RuntimeCardEvidence,
): boolean => {
  const hasLegacyStructuralEvidence = (): boolean =>
    hasRuntimeThenEffects(evidence) ||
    hasRuntimeConditionalStep(evidence) ||
    flattenRuntimeEffects(evidence).length >= 2
  const clausesById = new Map(contract.clauses.map((clause) => [clause.id, clause]))
  const thenSteps = contract.steps.filter((step) => step.role === 'then')
  if (thenSteps.length === 0) return true

  return thenSteps.every((thenStep) => {
    const thenClause = clausesById.get(thenStep.clauseIds[0])
    if (!thenClause) return false
    if (!hasConsistentMirroredEffectOrder(evidence, thenClause.source)) return false
    const runtimeEffects = runtimeEffectsForSource(evidence, thenClause.source)
    const runtimeKinds = runtimeEffects.map((effect) => effect.kind)
    if (runtimeKinds.length === 0) return hasLegacyStructuralEvidence()

    const beforeStep = [...contract.steps]
      .slice(0, thenStep.order)
      .reverse()
      .find((step) => {
        if (step.role !== 'effect' || step.runtimeKinds.length === 0) return false
        return clausesById.get(step.clauseIds[0])?.source === thenClause.source
      })
    if (beforeStep && thenStep.runtimeKinds.length > 0) {
      const beforeIndex = uniqueRuntimeEffectIndex(beforeStep.runtimeKinds, runtimeKinds)
      const afterIndex = uniqueRuntimeEffectIndex(thenStep.runtimeKinds, runtimeKinds)
      if (
        beforeIndex !== null &&
        afterIndex !== null &&
        beforeIndex !== afterIndex
      ) {
        return beforeIndex < afterIndex
      }
    }

    // Some historical contracts do not yet classify both sides into runtime
    // kinds.  Keep their existing structural gate until the parser can supply
    // two concrete anchors; do not manufacture effect indexes from prose.
    return hasLegacyStructuralEvidence()
  })
}

const effectKindsForClause = (clause: CardClauseFragment): string[] => {
  const text = clause.text.toLowerCase()
  const kinds: string[] = []

  // Printed attack modifiers contain the word "damage", but they are not a
  // direct damage effect.  Keep the exact runtime family so an order audit can
  // bind the clause to a concrete effect index instead of merely observing
  // that both kinds exist somewhere on the card.
  if (/\b(?:gains?|deals?|receives?)\s+[+-]\d+\s+attack\s+damage\b/.test(text)) {
    kinds.push('modify-attack', 'modify-all-attack')
  }
  if (/\breturn\b[\s\S]*\bto (?:your|the) deck\b/.test(text)) {
    kinds.push('trash-to-deck', 'trash-to-deck-all', 'hand-to-deck-and-draw')
  }
  if (/\b(?:lv\.?|level)\b[\s\S]*\bbecomes?\b/.test(text)) {
    kinds.push('set-cookie-level')
  }
  if (/damage|deal|receives/.test(text)) kinds.push('damage', 'damage-all')
  if (/draw/.test(text)) kinds.push('draw', 'draw-up-to')
  if (/discard/.test(text)) kinds.push('discard-hand', 'opponent-discard-hand')
  if (/cannot add hp[\s\S]*card effects/.test(text)) kinds.push('prevent-opponent-hp-gain')
  if (/(?:view|rearrange)[\s\S]*hp/.test(text)) kinds.push('reorder-hp')
  if (/return[\s\S]*from your trash to your hand/.test(text)) kinds.push('trash-to-hand')
  if (/\b(?:receives?|takes?)\s+[+-]\d+\s+damage\s+from\s+effects\b/.test(text)) {
    kinds.push('modify-damage-received')
  }
  if (/unaffected by your opponent['’]s trap effects/.test(text)) {
    kinds.push('disable-traps')
  }
  if (/gain(?:s)?\s+\+?\d+\s+hp/.test(text)) kinds.push('gain-hp')
  if (/top[\s\S]*hp[\s\S]*(?:into|to) (?:your )?trash/.test(text)) kinds.push('hp-to-trash')
  if (/rest/.test(text)) kinds.push('rest-cookie', 'rest-support')
  if (/\bplace\s+(?:up\s+to\s+)?\d+\s+cookie\s+with\s+the\s+same\s+LV\.\s+as\s+that\s+cookie\s+from\s+your\s+break\s+area\s+into\s+your\s+trash\b/.test(text)) {
    kinds.push('break-to-trash')
  }
  if (/\bplay\s+(?:up\s+to\s+)?\d+\s+\[[^\]]+\]\s+from\s+your\s+break\s+area\b/.test(text)) {
    kinds.push('break-to-battle')
  }
  if (/play|place|put|return|move|take/.test(text)) kinds.push('move')
  return [...new Set(kinds)]
}

const buildContract = (
  record: OfficialCardRecord,
  evidence: RuntimeCardEvidence,
): CardBehaviorContract => {
  const clauses: CardClauseFragment[] = []
  const payments: ContractPayment[] = []
  const costs: ContractCost[] = []
  const targets: ContractTarget[] = []
  const timingMarkers = new Set<string>()
  const segments = sourceSegments(record)
  for (const [source, text] of Object.entries(segments) as [CardTextSource, string][]) {
    const normalizedSourceText = stripMarkupTags(text)
    const parsed = parseOfficialCardText(normalizedSourceText)
    if (!parsed) continue
    parsed.markers
      .filter((marker) => {
        if (!TIMING_MARKERS.has(marker)) return false
        const markerMatches = [...parsed.raw.matchAll(/\{([a-z]+)\}/gi)]
          .filter((match) => match[1]?.toLowerCase() === marker.toLowerCase())
        return markerMatches.some((match) => {
          const index = match.index ?? 0
          const prefix = parsed.raw.slice(Math.max(0, index - 64), index)
          // `Activate that Cookie's On Play or Activate` is a nested
          // Extra-Deck choice, not a timing marker of the attacking Cookie.
          if (/\bthat\s+Cookie['’]s(?:\s+\{(?:ap|mob)\})?\s*(?:or\s+)?$/i.test(prefix)) {
            return false
          }
          // `cannot activate On Play` describes a restriction, not this
          // card's own On Play timing.
          if (marker === 'ap' && /cannot\s+activate\s*$/i.test(prefix)) return false
          return true
        })
      })
      .forEach((marker) => {
        timingMarkers.add(marker)
        addClause(clauses, source, `{${marker}}`, 'timing', 0, text.length, 'exact')
      })
    const bracket = bracketClauses(source, text, clauses)
    payments.push(...bracket.payments)
    costs.push(...bracket.costs)
    targets.push(...targetClauses(source, text, clauses, record.type))
    addActionClauses(source, text, clauses)
    if (parsed.unknownTokens.length > 0) {
      addClause(clauses, source, parsed.unknownTokens.join(' '), 'unsupported', 0, text.length, 'unknown')
    }
  }
  const runtime = { effectKinds: new Set<string>() }
  collectRuntime(evidence.card, {
    effectKinds: runtime.effectKinds,
    targetSelectors: [],
    energyCosts: [],
    abilityCostKeys: new Set<string>(),
  })
  if (evidence.extraDeckPlayCost) {
    collectCostEvidence(
      evidence.extraDeckPlayCost as unknown as Record<string, unknown>,
      {
        effectKinds: runtime.effectKinds,
        targetSelectors: [],
        energyCosts: [],
        abilityCostKeys: new Set<string>(),
      },
    )
  }
  const sourceOrder = new Map(
    (Object.keys(segments) as CardTextSource[]).map((source, index) => [source, index]),
  )
  const resolutionClauses = clauses
    .filter((item) => item.role === 'effect' || item.role === 'then')
    .map((clause, insertionOrder) => ({ clause, insertionOrder }))
    .sort((left, right) =>
      (sourceOrder.get(left.clause.source) ?? Number.MAX_SAFE_INTEGER) -
        (sourceOrder.get(right.clause.source) ?? Number.MAX_SAFE_INTEGER) ||
      left.clause.start - right.clause.start ||
      left.insertionOrder - right.insertionOrder,
    )
  const steps: ContractResolutionStep[] = resolutionClauses.map(({ clause }, order) => ({
    order,
    role: clause.role === 'then' ? 'then' : 'effect',
    clauseIds: [clause.id],
    runtimeKinds: effectKindsForClause(clause).filter((kind) => runtime.effectKinds.has(kind)),
  }))
  // A Then marker is an ordering edge, not an executable effect itself.  Bind
  // it to the first classified continuation in the same source segment so the
  // contract records which runtime kind must occur after the boundary.
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]
    if (step.role !== 'then') continue
    const clause = clauses.find((candidate) => step.clauseIds.includes(candidate.id))
    if (!clause) continue
    let continuation: ContractResolutionStep | undefined
    for (const candidate of steps.slice(index + 1)) {
      const candidateClause = clauses.find((item) =>
        candidate.clauseIds.includes(item.id),
      )
      if (candidateClause?.source !== clause.source) break
      if (candidate.role === 'then') break
      if (candidate.runtimeKinds.length > 0) {
        continuation = candidate
        break
      }
    }
    if (continuation) step.runtimeKinds = [...continuation.runtimeKinds]
  }
  const blockers: string[] = []
  if (evidence.unsupportedReason) blockers.push(`runtime:${evidence.unsupportedReason}`)
  for (const requirement of requiredTurnFaintConditions(record)) {
    if (!hasRuntimeTurnFaintCondition(evidence, requirement)) {
      blockers.push(`condition evidence missing: ${requirement.label}`)
    }
  }
  for (const requirement of requiredAttackFaintConditions(record)) {
    if (!hasRuntimeAttackFaintCondition(evidence, requirement)) {
      blockers.push(`condition evidence missing: ${requirement.label}`)
    }
  }
  // A FLIP card is still rendered as a Cookie at runtime, so merely seeing
  // its normal attack fields is not evidence that its HP-attached text was
  // converted.  Require a FlipAbility whenever official FLIP text exists;
  // otherwise an omitted adapter branch can incorrectly pass every generic
  // payment/attack check (as BS7-002 did).
  if (record.type === 'flip' && segments.flip && evidence.flip === undefined) {
    blockers.push('FLIP text has no runtime flip ability')
  }
  const fullSourceText = Object.values(segments).join(' ')
  const flattenedRuntimeEffects = flattenRuntimeEffects(evidence)
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-040') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const effect = skill?.effects[0]
    if (card?.type !== 'cookie' || card.attack !== 3 || card.attackEnergyCost?.green !== 2 || card.attackEnergyCost?.neutral !== 1 || card.attackEffects?.length ||
      skill?.trigger !== 'activate' || !skill.oncePerTurn || skill.yourTurn || skill.restSource ||
      Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) || skill.cost.discardHand !== 0 ||
      skill.cost.supportToHand !== 1 || skill.cost.supportToHandType !== 'cookie' || skill.cost.supportToHandColor !== undefined ||
      effect?.kind !== 'hand-to-support' || effect.amount !== 1 || effect.keyword !== 'arena' || !effect.optional || effect.rested !== true ||
      effect.energyColor !== undefined || effect.cardName !== undefined) {
      blockers.push('BS12-040 lacks Cookie-only support return cost or optional rested placement of any hand Arena card')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-041') {
    const card = evidence.card
    if (card?.type !== 'cookie' || card.name !== 'Basil Pesto Cookie' || card.level !== 1 || card.hp !== 2 ||
      card.energyColor !== 'green' || card.attack !== 1 || card.attackCost !== 1 || card.attackEnergyCost?.neutral !== 1 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'neutral' && (value ?? 0) !== 0) ||
      card.skill || card.attackEffects?.length || !card.keywords?.includes('arena')) {
      blockers.push('BS12-041 lacks the printed green Arena LV1/HP2 N ordinary one damage or invents a skill/Then')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-039') {
    const card = evidence.card
    if (card?.type !== 'cookie' || card.name !== 'Melon Soda Cookie' || card.level !== 3 || card.hp !== 4 ||
      card.energyColor !== 'green' || card.attack !== 4 || card.attackCost !== 3 || card.attackEnergyCost?.neutral !== 3 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'neutral' && (value ?? 0) !== 0) ||
      card.skill || card.attackEffects?.length || !card.keywords?.includes('arena')) {
      blockers.push('BS12-039 lacks the printed green Arena LV3/HP4 NNN ordinary four damage or invents a skill/Then')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-038') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const effect = skill?.effects[0]
    if (card?.type !== 'cookie' || card.attack !== 2 || card.attackEnergyCost?.green !== 1 || card.attackEnergyCost?.neutral !== 1 ||
      skill?.trigger !== 'on-play' || !skill.fromSupportArea || skill.yourTurn || skill.oncePerTurn || skill.restSource ||
      Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) || skill.cost.discardHand !== 0 ||
      effect?.kind !== 'deck-to-support' || effect.amount !== 1 || effect.rested !== true || effect.condition?.kind !== 'support-count-less-than-opponent' || effect.condition.difference !== 1) {
      blockers.push('BS12-038 lacks support-origin free On Play, strictly fewer own support cards, or rested top-deck placement')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-037') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const damage = skill?.effects[0]
    const then = card?.type === 'cookie' ? card.attackEffects?.[0] : undefined
    const extraDamage = then?.kind === 'optional-cost-attack' ? then.effects[0] : undefined
    if (card?.type !== 'cookie' || card.attack !== 3 || card.attackEnergyCost?.yellow !== 3 ||
      skill?.trigger !== 'activate' || !skill.oncePerTurn || skill.yourTurn || skill.restSource || skill.cost.energy?.yellow !== 1 || skill.cost.discardHand !== 0 ||
      damage?.kind !== 'damage-by-break-count' || damage.perCount !== 1 || damage.groupSize !== 4 || damage.keyword !== 'arena' || damage.breakEnergyColor !== undefined || damage.minBreakLevel !== undefined || damage.exactBreakLevel !== undefined ||
      damage.target.side !== 'opponent' || damage.target.min !== 0 || damage.target.max !== 1 ||
      then?.kind !== 'optional-cost-attack' || then.cost.energy?.neutral !== 1 || extraDamage?.kind !== 'damage' || extraDamage.amount !== 1 || extraDamage.target.side !== 'opponent' || extraDamage.target.min !== 0 || extraDamage.target.max !== 1 || extraDamage.target.attackTargetOnly) {
      blockers.push('BS12-037 lacks Y1 once-per-turn every-four own Arena damage or independently paid N1 optional opponent Then target')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-036') {
    const card = evidence.card
    const then = card?.type === 'cookie' ? card.attackEffects?.[0] : undefined
    const play = then?.kind === 'optional-cost-attack' ? then.effects[0] : undefined
    const cost = then?.kind === 'optional-cost-attack' ? then.cost.cookieToBreakArea : undefined
    if (card?.type !== 'cookie' || card.attackEffects?.length !== 1 || then?.kind !== 'optional-cost-attack' ||
      then.effects.length !== 1 || then.payBeforeCondition !== true || then.resolution !== undefined || then.mandatory === true ||
      Object.keys(then.cost).some(key => !['energy', 'cookieToBreakArea'].includes(key)) || Object.values(then.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      cost?.count !== 1 || cost.keyword !== 'arena' || cost.excludeSource !== true || cost.zones.length !== 1 || cost.zones[0] !== 'battle' ||
      Object.keys(cost).some(key => !['count', 'keyword', 'excludeSource', 'zones'].includes(key)) ||
      play?.kind !== 'break-to-battle' || play.amount !== 1 || play.optional !== true || play.exactLevel !== 1 || play.keyword !== 'arena' ||
      play.excludeBreakPaymentCardNumber !== true || Object.keys(play).some(key => !['kind', 'amount', 'optional', 'exactLevel', 'keyword', 'excludeBreakPaymentCardNumber'].includes(key))) {
      blockers.push('BS12-036 lacks R003 other own battle Arena cost and optional own Break LV1 Arena revival of a different paid card number')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-035') {
    const card = evidence.card
    const then = card?.type === 'cookie' ? card.attackEffects?.[0] : undefined
    if (card?.type !== 'cookie' || card.attack !== 1 || card.attackEnergyCost?.yellow !== 1 || card.attackEffects?.length !== 1 ||
      then?.kind !== 'damage' || then.amount !== 1 || then.target.side !== 'opponent' || then.target.min !== 0 || then.target.max !== 1 ||
      Object.keys(then.target).some(key => !['side', 'min', 'max'].includes(key)) ||
      then.condition?.kind !== 'break-area-card-count-at-least' || then.condition.side !== 'self' || then.condition.count !== 4 || then.condition.keyword !== 'arena' ||
      Object.keys(then.condition).some(key => !['kind', 'side', 'count', 'keyword'].includes(key))) {
      blockers.push('BS12-035 lacks R002 four own Arena Break Cookies and optional independently selected opponent one-damage Then')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-034') {
    const gameCard = evidence.card
    const skill = gameCard?.type === 'cookie' ? gameCard.skill : undefined
    const boost = skill?.effects[0]
    const outer = gameCard?.type === 'cookie' ? gameCard.attackEffects?.[0] : undefined
    const cost = outer?.kind === 'optional-cost-attack' ? outer.cost.cookieToBreakArea : undefined
    const hp = outer?.kind === 'optional-cost-attack' ? outer.effects[0] : undefined
    if (gameCard?.type !== 'cookie' || gameCard.attack !== 2 || gameCard.attackEnergyCost?.yellow !== 2 ||
      skill?.trigger !== 'passive' || skill.yourTurn || skill.oncePerTurn || skill.restSource ||
      boost?.kind !== 'modify-attack' || boost.amount !== 1 || boost.duration !== 'persistent' || !boost.target.sourceOnly ||
      boost.condition?.kind !== 'break-area-card-count-at-least' || boost.condition.count !== 4 || boost.condition.keyword !== 'arena' || boost.condition.side !== 'self' || boost.condition.color !== undefined ||
      cost?.count !== 1 || cost.keyword !== 'arena' || cost.zones.length !== 2 || !cost.zones.includes('hand') || !cost.zones.includes('battle') ||
      hp?.kind !== 'gain-hp' || hp.amount !== 2 || hp.target?.side !== 'self' || hp.target.min !== 0 || hp.target.max !== 1 || hp.target.minLevel !== 1 || hp.target.maxLevel !== 1) {
      blockers.push('BS12-034 lacks four own Arena passive +1 or a single hand-or-battle Arena Break cost before optional own LV1 +2 HP')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-033') {
    const skill = evidence.card?.skill
    const draw = skill?.effects[0]
    if (evidence.card?.type !== 'cookie' || skill?.trigger !== 'break-by-arena-effect' || skill.yourTurn !== true ||
      skill.oncePerTurn || skill.restSource || skill.faint || skill.afterDamage || skill.fromBreakArea ||
      Object.entries(skill.cost.energy ?? {}).some(([, value]) => value !== undefined && value !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => key !== 'energy' && value !== undefined && value !== 0) ||
      skill.effects.length !== 1 || draw?.kind !== 'draw-up-to' || draw.max !== 1 ||
      draw.condition !== undefined || draw.untilHandSize !== undefined) {
      blockers.push('BS12-033 lacks free own-turn source Break entry by Arena effect trigger and optional draw up to one')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-032') {
    const skill = evidence.card?.skill
    const hp = skill?.effects[0]
    if (evidence.card?.type !== 'cookie' || skill?.trigger !== 'break-by-arena-effect' || skill.yourTurn !== true ||
      skill.oncePerTurn || skill.restSource || skill.faint || skill.afterDamage || skill.fromBreakArea ||
      Object.values(skill.cost.energy ?? {}).some(value => value !== undefined && value !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => key !== 'energy' && value !== undefined && value !== 0) ||
      skill.effects.length !== 1 || hp?.kind !== 'gain-hp' || hp.amount !== 1 || hp.condition !== undefined ||
      hp.target?.side !== 'self' || hp.target.min !== 0 || hp.target.max !== 1 || hp.target.keyword !== undefined ||
      hp.target.energyColor !== undefined || hp.target.sourceOnly || hp.target.excludeSource || hp.perBreakCard !== undefined) {
      blockers.push('BS12-032 lacks free own-turn source Break entry by Arena effect trigger and optional any own Cookie one HP')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-031') {
    const item = evidence.card?.item
    const cost = item?.cost
    const battle = cost?.trashBattleCookie
    const draw = item?.effects[0]
    const damage = item?.effects[1]
    if (evidence.card?.type !== 'item' || cost?.energy?.yellow !== 2 ||
      Object.entries(cost.energy ?? {}).some(([key, value]) => key !== 'yellow' && value !== undefined && value !== 0) ||
      Object.entries(cost).some(([key, value]) => !['energy', 'trashBattleCookie'].includes(key) && value !== undefined && value !== 0) ||
      battle?.count !== 1 || battle.toBreakArea !== true || battle.energyColor !== 'yellow' || battle.keyword !== 'arena' ||
      battle.faint === true || battle.sourceOnly === true || battle.excludeSource === true || battle.level !== undefined ||
      battle.minLevel !== undefined || battle.maxLevel !== undefined || battle.hasSpecialPlay === true ||
      item?.effects.length !== 2 || draw?.kind !== 'draw-up-to' || draw.max !== 1 || draw.condition !== undefined ||
      damage?.kind !== 'damage' || damage.amount !== 1 || damage.condition !== undefined ||
      damage.target.side !== 'opponent' || damage.target.min !== 0 || damage.target.max !== 1 ||
      damage.target.energyColor !== undefined || damage.target.keyword !== undefined || damage.target.attackTargetOnly === true) {
      blockers.push('BS12-031 lacks YY and one own yellow Arena battle Cookie directly to break before independent optional draw one and optional opponent one damage')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-030') {
    const stage = evidence.card?.stageAbility
    const effect = stage?.effects[0]
    if (evidence.card?.type !== 'stage' || stage?.placementCost.yellow !== 1 ||
      Object.entries(stage.placementCost).some(([key, value]) => key !== 'yellow' && value !== undefined && value !== 0) ||
      stage.cost.energy?.yellow !== 1 || Object.entries(stage.cost.energy ?? {}).some(([key, value]) => key !== 'yellow' && value !== undefined && value !== 0) ||
      Object.entries(stage.cost).some(([key, value]) => key !== 'energy' && value !== undefined && value !== 0) ||
      stage.restSource !== true || stage.allowInactiveConditionalEffects !== true || stage.oncePerTurn === true ||
      stage.ownerIndependent === true || stage.endPhase === true || stage.triggered === true ||
      stage.effects.length !== 1 || effect?.kind !== 'gain-hp' || effect.amount !== 1 ||
      effect.target?.side !== 'self' || effect.target.min !== 0 || effect.target.max !== 1 ||
      effect.target.keyword !== undefined || effect.target.energyColor !== undefined || effect.target.sourceOnly === true ||
      effect.target.excludeSource === true || effect.condition?.kind !== 'arena-cookie-placed-in-break-this-turn') {
      blockers.push('BS12-030 lacks Y placement and Y plus source rest activation before conditional optional own Cookie one HP for this-turn Arena break entry')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-029') {
    const trap = evidence.card?.trap
    const cost = trap?.cost
    const reduction = trap?.effects[0]
    const draw = trap?.effects[1]
    const condition = draw?.kind === 'draw-up-to' ? draw.condition : undefined
    if (evidence.card?.type !== 'trap' || cost?.energy?.yellow !== 2 ||
      Object.entries(cost.energy ?? {}).some(([key, value]) => key !== 'yellow' && value !== undefined && value !== 0) ||
      Object.entries(cost).some(([key, value]) => key !== 'energy' && value !== undefined && value !== 0) ||
      trap?.condition !== undefined || trap?.conditionalCost !== undefined || trap?.alternativeCosts !== undefined ||
      trap?.effects.length !== 2 || reduction?.kind !== 'modify-attack' || reduction.amount !== -2 || reduction.duration !== 'this-turn' ||
      reduction.condition !== undefined || reduction.target.side !== 'opponent' || reduction.target.min !== 0 || reduction.target.max !== 1 ||
      reduction.target.attackTargetOnly === true || reduction.target.energyColor !== undefined || reduction.target.keyword !== undefined ||
      draw?.kind !== 'draw-up-to' || draw.max !== 1 || condition?.kind !== 'break-area-card-count-at-least' ||
      condition.side !== 'self' || condition.count !== 4 || condition.color !== 'yellow' || condition.keyword !== 'arena' ||
      condition.minLevel !== undefined || condition.maxLevel !== undefined) {
      blockers.push('BS12-029 lacks YY optional opponent this-turn -2 then optional draw one for four own yellow Arena break Cookies')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-028') {
    const item = evidence.card?.item
    const cost = item?.cost
    const effect = item?.effects[0]
    if (evidence.card?.type !== 'item' || cost?.energy?.yellow !== 1 ||
      Object.entries(cost.energy ?? {}).some(([key, value]) => key !== 'yellow' && value !== undefined && value !== 0) ||
      Object.entries(cost).some(([key, value]) => !['energy', 'handToBreakArea'].includes(key) && value !== undefined && value !== 0) ||
      cost.handToBreakArea?.count !== 1 || cost.handToBreakArea.keyword !== 'arena' ||
      cost.handToBreakArea.energyColor !== undefined || cost.handToBreakArea.minLevel !== undefined || cost.handToBreakArea.maxLevel !== undefined ||
      item?.effects.length !== 1 || effect?.kind !== 'draw-up-to' || effect.max !== 3 || effect.condition !== undefined) {
      blockers.push('BS12-028 lacks Y1 and one any-color hand Arena Cookie to break before optional draw up to three')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-027') {
    const trap = evidence.card?.trap
    const condition = trap?.conditionalCost?.condition
    const effect = trap?.effects[0]
    const costMatches = (cost: AbilityCost | undefined, yellow: number) => cost !== undefined &&
      (cost.energy?.yellow ?? 0) === yellow && Object.entries(cost.energy ?? {}).every(([key, value]) => key === 'yellow' || value === undefined || value === 0) &&
      Object.entries(cost).every(([key, value]) => key === 'energy' || value === undefined || value === 0)
    if (!costMatches(trap?.cost, 1) || !costMatches(trap?.conditionalCost?.cost, 0) || trap?.condition !== undefined ||
      trap?.alternativeCosts !== undefined || condition?.kind !== 'break-area-card-count-at-least' ||
      condition.count !== 4 || condition.color !== 'yellow' || condition.keyword !== 'arena' ||
      trap?.effects.length !== 1 || effect?.kind !== 'modify-attack' || effect.amount !== -1 || effect.duration !== 'this-turn' ||
      effect.target.side !== 'opponent' || effect.target.min !== 0 || effect.target.max !== 1 || effect.target.attackTargetOnly === true ||
      effect.target.energyColor !== undefined || effect.target.keyword !== undefined) {
      blockers.push('BS12-027 lacks Y1 reduced to zero by four own yellow Arena break Cookies or optional opponent this-turn -1')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-025') {
    const skill = evidence.card?.skill
    const gain = skill?.effects[0]
    if (skill?.trigger !== 'on-play' || skill.yourTurn !== false || skill.restSource !== false ||
      Object.values(skill.cost.energy ?? {}).some(amount => amount !== undefined && amount !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => key !== 'energy' && value !== undefined && value !== 0) ||
      skill.effects.length !== 1 || gain?.kind !== 'gain-hp' || gain.amount !== 1 || gain.condition !== undefined || gain.perBreakCard !== undefined ||
      gain.target?.side !== 'self' || gain.target.min !== 0 || gain.target.max !== 1 || gain.target.cardName !== 'Caramel Choux Cookie' ||
      gain.target.energyColor !== undefined || gain.target.keyword !== undefined || gain.target.sourceOnly === true || gain.target.excludeSource === true) {
      blockers.push('BS12-025 lacks free On Play or zero-to-one own Caramel Choux Cookie gaining one HP')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-026') {
    const optional = evidence.card?.type === 'cookie' ? evidence.card.attackEffects?.[0] : undefined
    const damage = optional?.kind === 'optional-cost-attack' ? optional.effects[0] : undefined
    const condition = damage?.kind === 'damage' ? damage.condition : undefined
    const count = condition?.kind === 'any-of' ? condition.conditions[0] : undefined
    const event = condition?.kind === 'any-of' ? condition.conditions[1] : undefined
    if (evidence.card?.type !== 'cookie' || evidence.card.attackEffects?.length !== 1 || optional?.kind !== 'optional-cost-attack' ||
      optional.resolution === 'ability' || optional.mandatory === true || optional.payBeforeCondition !== true || optional.cost.discardHand !== 1 ||
      Object.values(optional.cost.energy ?? {}).some(amount => amount !== undefined && amount !== 0) ||
      Object.entries(optional.cost).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined && value !== 0) ||
      optional.effects.length !== 1 || damage?.kind !== 'damage' || damage.amount !== 1 ||
      damage.target.side !== 'opponent' || damage.target.min !== 1 || damage.target.max !== 1 || damage.target.attackTargetOnly !== true ||
      damage.target.energyColor !== undefined || damage.target.keyword !== undefined ||
      condition?.kind !== 'any-of' || condition.conditions.length !== 2 || count?.kind !== 'break-area-card-count-at-least' ||
      count.side !== 'self' || count.count !== 4 || count.keyword !== 'arena' || count.color !== undefined || count.minLevel !== undefined || count.maxLevel !== undefined ||
      event?.kind !== 'arena-cookie-placed-in-break-this-turn') {
      blockers.push('BS12-026 lacks one-hand cost before the Arena count OR turn-event condition and original-defender damage')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-023') {
    const skill = evidence.card?.skill
    const gain = skill?.effects[0]
    if (skill?.trigger !== 'on-play' || skill.yourTurn !== false || skill.restSource !== false ||
      Object.values(skill.cost.energy ?? {}).some(amount => amount !== undefined && amount !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => key !== 'energy' && value !== undefined && value !== 0) ||
      skill.effects.length !== 1 || gain?.kind !== 'gain-hp' || gain.amount !== 1 || gain.condition !== undefined ||
      gain.perBreakCard?.keyword !== 'arena' || gain.perBreakCard.divisor !== 3 || gain.perBreakCard.minLevel !== undefined || gain.perBreakCard.exactLevel !== undefined || gain.perBreakCard.energyColor !== undefined ||
      gain.target?.side !== 'self' || gain.target.sourceOnly !== true || gain.target.min !== 1 || gain.target.max !== 1) {
      blockers.push('BS12-023 lacks free On Play or one source HP per three own break Arena Cookies')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-058') {
    const card = evidence.card
    const flip = card?.flip
    const draw = flip?.effects[0]
    if (card?.type !== 'cookie' || card.name !== 'Peppermint Cookie' || card.energyColor !== 'blue' || !card.keywords?.includes('arena') ||
      card.level !== 1 || card.hp !== 1 || card.attack !== 1 || card.attackEnergyCost?.blue !== 1 || card.skill || card.attackEffects?.length ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'blue' && (value ?? 0) !== 0) ||
      !flip || flip.handCostDestination !== 'deck-bottom' || flip.cost.discardHand !== 1 || flip.cost.discardHandKeyword !== 'arena' ||
      Object.values(flip.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.keys(flip.cost).some(key => !['energy', 'discardHand', 'discardHandKeyword'].includes(key)) ||
      flip.attachedHpBonus || flip.attachedHpAlternateTarget || flip.effects.length !== 1 || draw?.kind !== 'draw-up-to' || draw.max !== 2 || draw.condition) {
      blockers.push('BS12-058 lacks printed B one or FLIP reveal one any Arena hand card to own deck bottom before draw zero to two')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-057') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const move = skill?.effects[0]
    if (card?.type !== 'cookie' || card.name !== 'Marbleberry Cookie' || card.energyColor !== 'blue' || !card.keywords?.includes('arena') ||
      card.level !== 2 || card.hp !== 4 || card.attack !== 2 || card.attackEnergyCost?.blue !== 2 || card.attackEnergyCost?.neutral !== 1 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => !['blue', 'neutral'].includes(key) && (value ?? 0) !== 0) || card.attackEffects?.length ||
      !skill || skill.trigger !== 'on-play' || skill.yourTurn || skill.oncePerTurn || skill.restSource || skill.oncePerGame ||
      skill.fromSupportArea || skill.fromBreakArea || skill.fromTrashArea || skill.onPlayFromBreakArea || skill.activationOriginThisTurn ||
      skill.cost.discardHand !== 1 || skill.cost.discardHandColor !== 'blue' || skill.cost.discardHandKeyword !== 'arena' ||
      Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) || Object.keys(skill.cost).some(key => !['energy', 'discardHand', 'discardHandColor', 'discardHandKeyword'].includes(key)) ||
      skill.effects.length !== 1 || move?.kind !== 'field-to-deck-bottom' || move.hpOnly || move.allowStage || move.battleSide || move.condition ||
      move.target.side !== 'opponent' || move.target.min !== 0 || move.target.max !== 1 || move.target.maxLevel !== 2 ||
      Object.keys(move.target).some(key => !['side', 'min', 'max', 'maxLevel'].includes(key))) {
      blockers.push('BS12-057 lacks printed BBN ordinary two or On Play one same blue AND Arena hand cost before optional one opponent LV2-or-lower Cookie to deck bottom')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-056') {
    const card = evidence.card
    const requirement = evidence.extraDeckPlayRequirement
    const named = requirement?.kind === 'any-of' ? requirement.conditions[0] : undefined
    const supports = requirement?.kind === 'any-of' ? requirement.conditions[1] : undefined
    const optional = card?.type === 'cookie' ? card.attackEffects?.[0] : undefined
    const ready = optional?.kind === 'optional-cost-attack' ? optional.effects[0] : undefined
    if (card?.type !== 'cookie' || card.name !== 'Apple Faerie Cookie' || card.energyColor !== 'green' || !card.keywords?.includes('arena') ||
      card.level !== 2 || card.hp !== 3 || card.attack !== 2 || card.attackEnergyCost?.neutral !== 2 || card.skill ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'neutral' && (value ?? 0) !== 0) ||
      evidence.extraDeckPlayMode !== 'enter-battle' || evidence.extraDeckPlayCost || requirement?.kind !== 'any-of' || requirement.conditions.length !== 2 ||
      named?.kind !== 'battle-area-has-named-cookie' || named.side !== 'self' || named.name !== 'Candy Apple Cookie' || named.keyword !== 'arena' || named.negate || named.excludeSource ||
      supports?.kind !== 'support-color-count-at-least' || supports.color !== 'green' || supports.count !== 7 ||
      card.attackEffects?.length !== 1 || optional?.kind !== 'optional-cost-attack' || optional.resolution === 'ability' || optional.mandatory || optional.payBeforeCondition || optional.sourceEnergy ||
      optional.cost.discardHand !== 1 || Object.values(optional.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.keys(optional.cost).some(key => !['energy', 'discardHand'].includes(key)) || optional.effects.length !== 1 ||
      ready?.kind !== 'set-active' || ready.supportCount !== 1 || ready.selectable !== true || ready.optional !== true || ready.restedOnly !== false ||
      ready.energyColor !== undefined || ready.condition?.kind !== 'player-started-second') {
      blockers.push('BS12-056 lacks ordinary EXTRA entry with same own Candy Apple AND Arena OR seven green supports, printed NN two, or second-player one-any-hand optional zero-to-one any support ready')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-055') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const choice = skill?.effects[0]
    const modes = choice?.kind === 'choose-one' ? choice.modes : []
    const moves = modes.map(mode => mode.effects[0])
    if (card?.type !== 'cookie' || card.name !== 'Herb Cookie' || card.energyColor !== 'green' || !card.keywords?.includes('arena') ||
      card.level !== 2 || card.hp !== 2 || card.attack !== 1 || card.attackEnergyCost?.green !== 1 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'green' && (value ?? 0) !== 0) || card.attackEffects?.length ||
      !skill || skill.trigger !== 'activate' || skill.oncePerTurn || skill.yourTurn || skill.restSource ||
      skill.activationOriginThisTurn !== 'support' || skill.fromSupportArea || skill.fromBreakArea || skill.fromTrashArea || skill.oncePerGame ||
      skill.cost.discardHand !== 1 || skill.cost.selfToTrash !== true || Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.keys(skill.cost).some(key => !['energy', 'discardHand', 'selfToTrash'].includes(key)) || skill.effects.length !== 1 ||
      choice?.kind !== 'choose-one' || choice.condition || modes.length !== 2 || modes.some(mode => mode.effects.length !== 1) ||
      moves.some((move, index) => move?.kind !== 'deck-to-support' || move.amount !== (index === 0 ? 1 : 0) || move.rested !== true ||
        Object.keys(move).some(key => !['kind', 'amount', 'rested'].includes(key)))) {
      blockers.push('BS12-055 lacks this source battle entry from support this turn, discard one any hand plus source trash cost, paid zero or one deck support as rested, or printed G ordinary one')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-054') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const move = skill?.effects[0]
    if (card?.type !== 'cookie' || card.name !== 'Mint Choco Cookie' || card.energyColor !== 'green' || !card.keywords?.includes('arena') ||
      card.level !== 2 || card.hp !== 4 || card.attack !== 3 || card.attackEnergyCost?.green !== 2 || card.attackEnergyCost?.neutral !== 1 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => !['green', 'neutral'].includes(key) && (value ?? 0) !== 0) || card.attackEffects?.length ||
      !skill || skill.trigger !== 'activate' || skill.oncePerTurn !== true || skill.yourTurn || skill.restSource ||
      skill.fromSupportArea || skill.fromBreakArea || skill.fromTrashArea || skill.oncePerGame ||
      skill.cost.supportToTrash !== 1 || Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => !['energy', 'supportToTrash', 'discardHand'].includes(key) && (value ?? 0) !== 0) || (skill.cost.discardHand ?? 0) !== 0 ||
      skill.effects.length !== 1 || move?.kind !== 'trash-to-support' || move.amount !== 1 || move.cookieOnly !== true || move.rested !== true || move.optional !== true ||
      Object.keys(move).some(key => !['kind', 'amount', 'cookieOnly', 'rested', 'optional'].includes(key))) {
      blockers.push('BS12-054 lacks once-per-turn Activate one any support trash cost and optional one any own trash Cookie to support as rested, or printed GGN ordinary three')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-053') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const reduce = skill?.effects[0]
    const damage = card?.type === 'cookie' ? card.attackEffects?.[0] : undefined
    if (card?.type !== 'cookie' || card.name !== 'Kumiho Cookie' || card.energyColor !== 'green' || !card.keywords?.includes('arena') ||
      card.level !== 3 || card.hp !== 6 || card.attack !== 3 || card.attackEnergyCost?.green !== 3 || card.attackEnergyCost?.neutral !== 1 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => !['green', 'neutral'].includes(key) && (value ?? 0) !== 0) ||
      !skill || skill.trigger !== 'opponent-attack' || skill.oncePerTurn !== true || skill.yourTurn || skill.restSource ||
      skill.fromSupportArea || skill.fromBreakArea || skill.fromTrashArea || skill.oncePerGame ||
      skill.cost.supportToTrash !== 1 || Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => !['energy', 'supportToTrash', 'discardHand'].includes(key) && (value ?? 0) !== 0) || (skill.cost.discardHand ?? 0) !== 0 ||
      skill.effects.length !== 1 || reduce?.kind !== 'modify-attack' || reduce.amount !== -2 || reduce.duration !== 'this-turn' ||
      reduce.target.side !== 'opponent' || reduce.target.min !== 0 || reduce.target.max !== 1 || reduce.condition !== undefined ||
      Object.keys(reduce.target).some(key => !['side', 'min', 'max'].includes(key)) || card.attackEffects?.length !== 1 ||
      damage?.kind !== 'damage-all' || damage.amount !== 1 || damage.side !== 'opponent' || damage.sequential !== true ||
      damage.target?.side !== 'opponent' || damage.target.min !== 1 || damage.target.max !== 2 ||
      Object.keys(damage.target).some(key => !['side', 'min', 'max'].includes(key)) ||
      damage.condition?.kind !== 'all-support-rested' || damage.condition.side !== 'self') {
      blockers.push('BS12-053 lacks once-per-turn opponent attack response with one any support trash cost and optional opponent ordinary minus two, or all own supports rested sequential opponent one damage after GGGN ordinary three')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-052') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const damage = skill?.effects[0]
    if (card?.type !== 'cookie' || card.name !== 'Cocoa Cookie' || card.energyColor !== 'green' || !card.keywords?.includes('arena') ||
      card.level !== 1 || card.hp !== 2 || card.attack !== 2 || card.attackEnergyCost?.green !== 1 || card.attackEnergyCost?.neutral !== 1 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => !['green', 'neutral'].includes(key) && (value ?? 0) !== 0) || card.attackEffects?.length ||
      !skill || skill.trigger !== 'on-play' || skill.fromSupportArea !== true || skill.yourTurn || skill.oncePerTurn || skill.restSource ||
      skill.fromBreakArea || skill.fromTrashArea || skill.onPlayFromBreakArea || skill.oncePerGame ||
      skill.cost.discardHand !== 1 || Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => !['energy', 'discardHand'].includes(key) && (value ?? 0) !== 0) || skill.effects.length !== 1 ||
      damage?.kind !== 'damage' || damage.amount !== 1 || damage.target.side !== 'opponent' || damage.target.min !== 0 || damage.target.max !== 1 ||
      Object.keys(damage.target).some(key => !['side', 'min', 'max'].includes(key)) || damage.condition !== undefined) {
      blockers.push('BS12-052 lacks support-origin On Play, discard one any hand card before optional one opponent one damage, or printed GN ordinary two')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-051') {
    const card = evidence.card
    const move = card?.type === 'cookie' ? card.attackEffects?.[0] : undefined
    if (card?.type !== 'cookie' || card.name !== 'Cream Ferret Cookie' || card.level !== 1 || card.hp !== 2 || card.attack !== 1 ||
      card.energyColor !== 'green' || !card.keywords?.includes('arena') || card.attackEnergyCost?.green !== 1 ||
      Object.entries(card.attackEnergyCost).some(([key, value]) => key !== 'green' && (value ?? 0) !== 0) || card.skill !== undefined || card.attackEffects?.length !== 1 ||
      move?.kind !== 'support-to-battle' || move.amount !== 1 || move.optional !== true || move.keyword !== 'arena' || move.energyColor !== undefined ||
      move.minLevel !== undefined || move.maxLevel !== undefined || move.exactLevel !== undefined || move.condition !== undefined || move.thenEffects !== undefined) {
      blockers.push('BS12-051 lacks printed G ordinary one then optional one own support Arena Cookie play without color or level restriction')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-050') {
    const card = evidence.card
    const item = card?.item
    const move = item?.effects[0]
    if (card?.type !== 'item' || card.name !== 'Wonderful Melody' || card.energyColor !== 'green' || !card.keywords?.includes('arena') ||
      !item || item.cost.energy?.green !== 3 || Object.entries(item.cost.energy).some(([key, value]) => key !== 'green' && (value ?? 0) !== 0) ||
      Object.entries(item.cost).some(([key, value]) => key !== 'energy' && (value ?? 0) !== 0) || item.effects.length !== 1 ||
      move?.kind !== 'trash-to-support' || move.amount !== 1 || move.cookieOnly !== true || move.keyword !== 'arena' || move.rested !== true || move.optional !== true ||
      move.energyColor !== undefined || move.cardName !== undefined || move.minLevel !== undefined || move.maxLevel !== undefined || move.condition !== undefined) {
      blockers.push('BS12-050 lacks fixed GGG then optional one own trash Arena Cookie to support REST without color or level restriction')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-049') {
    const card = evidence.card
    const trap = card?.trap
    const reduction = trap?.effects[0]
    const then = trap?.effects[1]
    const draw = then?.kind === 'optional-cost-attack' ? then.effects[0] : undefined
    if (card?.type !== 'trap' || card.name !== 'Immersed Audience' || card.energyColor !== 'green' || !card.keywords?.includes('arena') ||
      !trap || trap.cost.energy?.green !== 1 || trap.condition !== undefined || trap.conditionalCost !== undefined ||
      Object.entries(trap.cost.energy).some(([key, value]) => key !== 'green' && (value ?? 0) !== 0) ||
      Object.entries(trap.cost).some(([key, value]) => key !== 'energy' && (value ?? 0) !== 0) ||
      trap.effects.length !== 2 || reduction?.kind !== 'modify-attack' || reduction.amount !== -1 || reduction.duration !== 'this-turn' ||
      reduction.target.side !== 'opponent' || reduction.target.min !== 0 || reduction.target.max !== 1 || reduction.condition !== undefined ||
      then?.kind !== 'optional-cost-attack' || then.resolution !== 'ability' || then.mandatory === true ||
      Object.values(then.cost.energy ?? {}).some(value => (value ?? 0) !== 0) || then.cost.supportToHand !== 1 || then.cost.supportToHandKeyword !== 'arena' ||
      Object.entries(then.cost).some(([key, value]) => !['energy', 'supportToHand', 'supportToHandKeyword'].includes(key) && (value ?? 0) !== 0) ||
      then.effects.length !== 1 || draw?.kind !== 'draw-up-to' || draw.max !== 1 || draw.condition !== undefined) {
      blockers.push('BS12-049 lacks G optional opponent minus one followed by optional one any-type Arena support return cost then optional one draw')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-048') {
    const card = evidence.card
    const ability = card?.stageAbility
    const play = ability?.effects[0]
    const then = play?.kind === 'support-to-battle' ? play.thenEffects?.[0] : undefined
    const rest = then?.kind === 'optional-cost-attack' ? then.effects[0] : undefined
    const fixedGreen = (cost: EnergyCost | undefined) => cost?.green === 1 &&
      Object.entries(cost).every(([key, value]) => key === 'green' || (value ?? 0) === 0)
    if (card?.type !== 'stage' || card.name !== 'Orchestra Hall' || card.energyColor !== 'green' || !card.keywords?.includes('arena') ||
      !ability || !fixedGreen(ability.placementCost) || ability.restSource !== true || ability.oncePerTurn === true ||
      ability.triggered === true || ability.endPhase === true ||
      Object.values(ability.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(ability.cost).some(([key, value]) => key !== 'energy' && (value ?? 0) !== 0) ||
      ability.effects.length !== 1 || play?.kind !== 'support-to-battle' || play.amount !== 1 || play.optional !== true || play.keyword !== 'arena' ||
      play.energyColor !== undefined || play.condition !== undefined || play.thenEffects?.length !== 1 ||
      then?.kind !== 'optional-cost-attack' || then.resolution !== 'ability' || then.mandatory === true || !fixedGreen(then.cost.energy) ||
      Object.entries(then.cost).some(([key, value]) => key !== 'energy' && (value ?? 0) !== 0) || then.effects.length !== 1 ||
      rest?.kind !== 'rest-support' || rest.side !== 'opponent' || rest.amount !== 1 || rest.optional !== true ||
      rest.energyColor !== undefined || rest.activeOnly === true || rest.condition !== undefined) {
      blockers.push('BS12-048 lacks G placement, source REST optional Arena support Cookie entry and optional G paid opponent support rest only after actual entry')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-047') {
    const card = evidence.card
    const trap = card?.type === 'trap' ? card.trap : undefined
    const reduce = trap?.effects[0]
    const draw = trap?.effects[1]
    if (card?.type !== 'trap' || card.name !== 'Beautiful Harmony' || card.energyColor !== 'green' || !card.keywords?.includes('arena') ||
      !trap || trap.cost.energy?.green !== 2 || trap.condition !== undefined || trap.conditionalCost !== undefined ||
      Object.entries(trap.cost.energy ?? {}).some(([key, value]) => key !== 'green' && (value ?? 0) !== 0) ||
      Object.entries(trap.cost).some(([key, value]) => key !== 'energy' && (value ?? 0) !== 0) ||
      trap.effects.length !== 2 || reduce?.kind !== 'modify-attack' || reduce.amount !== -2 || reduce.duration !== 'this-turn' ||
      reduce.target?.side !== 'opponent' || reduce.target.min !== 0 || reduce.target.max !== 1 || reduce.condition !== undefined ||
      draw?.kind !== 'draw-up-to' || draw.max !== 1 || draw.condition?.kind !== 'support-count-at-least' || draw.condition.count !== 7 ||
      draw.condition.energyColor !== undefined || draw.condition.keyword !== undefined || draw.condition.restedOnly !== undefined) {
      blockers.push('BS12-047 lacks fixed GG payment, optional opponent minus two ordinary damage and independent draw at seven own supports of any type')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-046') {
    const card = evidence.card
    const item = card?.type === 'item' ? card.item : undefined
    const draw = item?.effects[0]
    if (card?.type !== 'item' || card.name !== 'E-Z Camera' || card.energyColor !== 'green' || !card.keywords?.includes('arena') ||
      !item || item.allowInactiveConditionalEffects !== true || item.cost.energy?.green !== 1 ||
      Object.entries(item.cost.energy ?? {}).some(([key, value]) => key !== 'green' && (value ?? 0) !== 0) ||
      Object.entries(item.cost).some(([key, value]) => key !== 'energy' && (value ?? 0) !== 0) ||
      item.effects.length !== 1 || draw?.kind !== 'draw-up-to' || draw.max !== 2 ||
      draw.condition?.kind !== 'cookie-played-from-support-this-turn') {
      blockers.push('BS12-046 lacks G1 payment and optional zero to two draw after an actual own support Cookie entry this turn')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-045') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const draw = skill?.effects[0]
    if (card?.type !== 'cookie' || card.name !== 'Clover Cookie' || card.level !== 1 || card.hp !== 2 || card.energyColor !== 'green' ||
      card.attack !== 2 || card.attackCost !== 2 || card.attackEnergyCost?.green !== 1 || card.attackEnergyCost?.neutral !== 1 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'green' && key !== 'neutral' && (value ?? 0) !== 0) ||
      card.attackEffects?.length || !card.keywords?.includes('arena') || !skill || skill.trigger !== 'on-play' ||
      skill.oncePerTurn === true || skill.yourTurn === true || skill.restSource === true ||
      Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => key !== 'energy' && (value ?? 0) !== 0) ||
      skill.effects.length !== 1 || draw?.kind !== 'draw-up-to' || draw.max !== 1 ||
      draw.condition?.kind !== 'support-count-at-least' || draw.condition.count !== 5 ||
      draw.condition.energyColor !== undefined || draw.condition.keyword !== undefined || draw.condition.restedOnly !== undefined) {
      blockers.push('BS12-045 lacks free On Play draw zero to one at five own supports of any color, type and rest state, or printed GN2')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-044') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const play = skill?.effects[0]
    const ready = play?.kind === 'support-to-battle' ? play.thenEffects?.[0] : undefined
    if (card?.type !== 'cookie' || card.name !== 'Herb Teapot' || card.level !== 1 || card.hp !== 2 || card.energyColor !== 'green' ||
      card.attack !== 2 || card.attackCost !== 2 || card.attackEnergyCost?.green !== 2 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'green' && (value ?? 0) !== 0) ||
      card.attackEffects?.length || !card.keywords?.includes('arena') || !skill || skill.trigger !== 'activate' ||
      skill.oncePerTurn !== true || skill.yourTurn === true || skill.restSource === true ||
      Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => key !== 'energy' && (value ?? 0) !== 0) ||
      skill.effects.length !== 1 || play?.kind !== 'support-to-battle' || play.amount !== 1 || play.optional !== true || play.keyword !== 'arena' ||
      play.energyColor !== undefined || play.condition !== undefined || play.thenEffects?.length !== 1 ||
      ready?.kind !== 'set-active' || ready.supportCount !== 1 || ready.selectable !== true || ready.optional !== true ||
      ready.restedOnly !== false || ready.energyColor !== undefined || ready.condition?.kind !== 'previous-effect-target-card-name' ||
      ready.condition.cardName !== 'Herb Cookie') {
      blockers.push('BS12-044 lacks free once-per-turn optional support Arena entry then optional support ready only for just-played Herb Cookie and GG2')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-043') {
    const card = evidence.card
    const flip = card?.type === 'cookie' ? card.flip : undefined
    const effect = flip?.effects[0]
    if (card?.type !== 'cookie' || card.name !== 'Coffee Candy Cookie' || card.level !== 3 || card.hp !== 3 || card.energyColor !== 'green' ||
      card.attack !== 3 || card.attackCost !== 3 || card.attackEnergyCost?.green !== 3 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'green' && (value ?? 0) !== 0) ||
      card.skill || card.attackEffects?.length || !card.keywords?.includes('arena') || !flip ||
      Object.values(flip.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(flip.cost).some(([key, value]) => key !== 'energy' && (value ?? 0) !== 0) ||
      flip.effects.length !== 1 || effect?.kind !== 'rest-support' || effect.side !== 'opponent' || effect.amount !== 1 ||
      effect.optional !== true || effect.activeOnly === true || effect.energyColor !== undefined ||
      effect.condition?.kind !== 'support-count-at-least' || effect.condition.count !== 5 ||
      effect.condition.energyColor !== 'green' || effect.condition.keyword !== 'arena') {
      blockers.push('BS12-043 lacks five own green Arena support cards before optional opponent support REST and printed GGG3')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-064') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const reveal = skill?.effects[0]
    const draw = reveal?.kind === 'reveal-bottom-deck' ? reveal.effects?.[0] : undefined
    if (card?.type !== 'cookie' || card.name !== 'Cream Puff Cookie' || card.energyColor !== 'blue' || card.level !== 3 || card.hp !== 5 ||
      card.attack !== 3 || card.attackCost !== 3 || card.attackEnergyCost?.blue !== 2 || card.attackEnergyCost.neutral !== 1 ||
      Object.entries(card.attackEnergyCost).some(([key, value]) => !['blue', 'neutral'].includes(key) && (value ?? 0) !== 0) ||
      card.flip || card.attackEffects?.length || !card.keywords?.includes('arena') || skill?.trigger !== 'on-play' ||
      skill.oncePerTurn || skill.yourTurn || skill.restSource ||
      Object.entries(skill.cost).some(([key, value]) => key === 'energy'
        ? Object.values(value ?? {}).some(amount => amount !== undefined && amount !== 0) : value !== undefined && value !== 0) ||
      skill.effects.length !== 1 || reveal?.kind !== 'reveal-bottom-deck' || reveal.requireCard !== true || reveal.addMatchedToHand !== true ||
      reveal.match?.type !== 'cookie' || reveal.match.level !== 2 || reveal.match.keyword !== 'arena' ||
      Object.keys(reveal.match).some(key => !['type', 'level', 'keyword'].includes(key)) ||
      reveal.cookieDestination !== undefined || reveal.otherwiseDestination !== undefined ||
      reveal.effects?.length !== 1 || draw?.kind !== 'draw-up-to' || draw.max !== 2 || draw.untilHandSize !== undefined || draw.condition !== undefined) {
      blockers.push('BS12-064 lacks required bottom reveal, same LV2 Arena Cookie to hand then optional two draws and printed BBN3/HP5')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-072') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const move = skill?.effects[0]
    if (card?.type !== 'cookie' || card.name !== 'Cream Soda Cookie' || card.energyColor !== 'blue' || !card.keywords?.includes('arena') ||
      card.level !== 2 || card.hp !== 3 || card.attack !== 2 || card.attackEnergyCost?.blue !== 2 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'blue' && (value ?? 0) !== 0) ||
      !skill || skill.trigger !== 'activate' || skill.oncePerTurn !== true || skill.restSource || skill.yourTurn || skill.sourceEnergy ||
      skill.fromSupportArea || skill.fromBreakArea || skill.fromTrashArea || skill.oncePerGame ||
      skill.cost.energy?.blue !== 1 || Object.entries(skill.cost.energy ?? {}).some(([key, value]) => key !== 'blue' && (value ?? 0) !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => key !== 'energy' && value !== undefined && value !== 0) ||
      skill.effects.length !== 1 || move?.kind !== 'field-to-deck-bottom' || move.hpOnly || move.allowStage || move.battleSide || move.condition || move.deferAwakenedUnderlay ||
      move.target.side !== 'self' || move.target.min !== 0 || move.target.max !== 1 || move.target.maxLevel !== 2 || move.target.keyword !== 'arena' || move.target.excludeSource !== true ||
      Object.keys(move.target).some(key => !['side', 'min', 'max', 'maxLevel', 'keyword', 'excludeSource'].includes(key))) {
      blockers.push('BS12-072 lacks B1 Activate once-per-entry, exact optional other own LV2-or-lower Arena Cookie to deck bottom or BB ordinary two')
    }
    const then = card?.type === 'cookie' ? card.attackEffects?.[0] : undefined
    const reveal = then?.kind === 'optional-cost-attack' ? then.effects[0] : undefined
    const damage = reveal?.kind === 'reveal-bottom-deck' ? reveal.effects?.[0] : undefined
    if (card?.type !== 'cookie' || card.attackEffects?.length !== 1 || then?.kind !== 'optional-cost-attack' ||
      then.cost.discardHand !== 1 || Object.values(then.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.keys(then.cost).some(key => !['energy', 'discardHand'].includes(key)) || then.effects.length !== 1 || then.resolution !== undefined || then.mandatory === true || ('condition' in then && then.condition !== undefined) ||
      reveal?.kind !== 'reveal-bottom-deck' || reveal.requireCard !== true || reveal.addMatchedToHand !== true ||
      reveal.match?.type !== 'cookie' || reveal.match.level !== 2 || reveal.match.keyword !== 'arena' || reveal.condition !== undefined ||
      reveal.playMatchedAfterSourceTrash === true || reveal.cookieDestination !== undefined || reveal.otherwiseDestination !== undefined ||
      Object.keys(reveal.match).some(key => !['type', 'level', 'keyword'].includes(key)) || reveal.effects?.length !== 1 ||
      damage?.kind !== 'damage' || damage.amount !== 1 || damage.condition !== undefined || damage.target.side !== 'opponent' || damage.target.min !== 1 || damage.target.max !== 1 || damage.target.attackTargetOnly !== true ||
      Object.keys(damage.target).some(key => !['side', 'min', 'max', 'attackTargetOnly'].includes(key))) {
      blockers.push('BS12-072 lacks R004 discard one, required matching LV2 Arena bottom to hand, then one damage on original defender')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-073') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const reveal = skill?.effects[0]
    const discard = skill?.effects[1]
    const then = card?.type === 'cookie' ? card.attackEffects?.[0] : undefined
    const move = then?.kind === 'optional-cost-attack' ? then.effects[0] : undefined
    if (card?.type !== 'cookie' || card.name !== 'DJ Miya' || card.energyColor !== 'blue' || !card.keywords?.includes('arena') ||
      card.level !== 2 || card.hp !== 2 || card.attack !== 2 || card.attackEnergyCost?.blue !== 2 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'blue' && (value ?? 0) !== 0) ||
      !skill || skill.trigger !== 'on-play' || skill.oncePerTurn || skill.restSource || skill.yourTurn || skill.sourceEnergy ||
      skill.fromSupportArea || skill.fromBreakArea || skill.fromTrashArea || skill.oncePerGame || skill.effectConditionsAtResolution !== true ||
      Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => key !== 'energy' && value !== undefined && value !== 0) ||
      skill.effects.length !== 2 || reveal?.kind !== 'reveal-bottom-deck' || reveal.requireCard !== true || reveal.addMatchedToHand !== true ||
      reveal.match?.type !== 'cookie' || reveal.match.level !== 2 || reveal.match.keyword !== 'arena' || reveal.match.excludeCardName !== 'DJ Miya' ||
      Object.keys(reveal.match).some(key => !['type', 'level', 'keyword', 'excludeCardName'].includes(key)) ||
      reveal.condition || reveal.cookieDestination || reveal.otherwiseDestination || reveal.playMatchedAfterSourceTrash || (reveal.effects?.length ?? 0) !== 0 ||
      discard?.kind !== 'opponent-discard-hand' || discard.count !== 1 || discard.condition?.kind !== 'opponent-hand-count-at-least' || discard.condition.count !== 6 ||
      card.attackEffects?.length !== 1 || then?.kind !== 'optional-cost-attack' || then.mandatory || then.sourceEnergy ||
      then.cost.discardHand !== 1 || Object.values(then.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(then.cost).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined && value !== 0) ||
      then.effects.length !== 1 || move?.kind !== 'field-to-deck-bottom' || move.hpOnly || move.allowStage || move.battleSide || move.condition || move.deferAwakenedUnderlay ||
      move.target.side !== 'self' || move.target.min !== 1 || move.target.max !== 1 || move.target.sourceOnly !== true ||
      Object.keys(move.target).some(key => !['side', 'min', 'max', 'sourceOnly'].includes(key))) {
      blockers.push('BS12-073 lacks required exact non-DJ LV2 Arena bottom return, independent opponent six-hand discard or paid source-only bottom movement')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-075') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const discard = skill?.effects[0]
    if (card?.type !== 'cookie' || card.name !== 'Gnome Band' || card.energyColor !== 'purple' || !card.keywords?.includes('arena') ||
      card.level !== 2 || card.hp !== 3 || card.attack !== 2 || card.attackEnergyCost?.purple !== 2 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'purple' && (value ?? 0) !== 0) || card.attackEffects?.length ||
      !skill || skill.trigger !== 'activate' || skill.oncePerTurn || skill.restSource !== true || skill.yourTurn || skill.sourceEnergy ||
      skill.fromSupportArea || skill.fromBreakArea || skill.fromTrashArea || skill.oncePerGame || skill.effectConditionsAtResolution !== true ||
      skill.cost.discardHand !== 1 || Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined && value !== 0) ||
      skill.effects.length !== 1 || discard?.kind !== 'opponent-discard-hand' || discard.count !== 1 ||
      discard.destination && discard.destination !== 'trash' || discard.condition?.kind !== 'opponent-hand-count-at-least' || discard.condition.count !== 5) {
      blockers.push('BS12-075 lacks paid one-hand discard and source REST Activate, opponent five-hand chosen discard or PP ordinary two')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-074') {
    const card = evidence.card
    const requirement = evidence.extraDeckPlayRequirement
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const draw = skill?.effects[0]
    const then = card?.type === 'cookie' ? card.attackEffects?.[0] : undefined
    const reveal = then?.kind === 'optional-cost-attack' ? then.effects[0] : undefined
    const move = reveal?.kind === 'reveal-bottom-deck' ? reveal.effects?.[0] : undefined
    if (card?.type !== 'cookie' || card.name !== 'Popping Candy Cookie' || card.energyColor !== 'blue' || !card.keywords?.includes('arena') ||
      card.level !== 3 || card.hp !== 5 || card.attack !== 3 || card.attackEnergyCost?.blue !== 3 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'blue' && (value ?? 0) !== 0) ||
      evidence.extraDeckPlayMode !== 'enter-battle' || evidence.extraDeckPlayCost || requirement?.kind !== 'arena-cookie-placed-from-battle-to-deck-bottom-this-turn' || requirement.side !== 'self' ||
      !skill || skill.trigger !== 'on-play' || skill.oncePerTurn || skill.restSource || skill.yourTurn || skill.oncePerGame || skill.sourceEnergy ||
      skill.fromSupportArea || skill.fromBreakArea || skill.fromTrashArea || skill.effects.length !== 1 ||
      Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) || Object.entries(skill.cost).some(([key, value]) => key !== 'energy' && value !== undefined && value !== 0) ||
      draw?.kind !== 'draw-up-to' || draw.max !== 2 || draw.condition?.kind !== 'player-started-second' || draw.untilHandSize !== undefined ||
      card.attackEffects?.length !== 1 || then?.kind !== 'optional-cost-attack' || then.mandatory || then.sourceEnergy ||
      Object.values(then.cost.energy ?? {}).some(value => (value ?? 0) !== 0) || Object.entries(then.cost).some(([key, value]) => key !== 'energy' && value !== undefined && value !== 0) ||
      then.effects.length !== 1 || reveal?.kind !== 'reveal-bottom-deck' || reveal.requireCard !== true || reveal.addMatchedToHand !== true ||
      reveal.match?.type !== 'cookie' || reveal.match.level !== 2 || reveal.match.keyword !== 'arena' || Object.keys(reveal.match).some(key => !['type', 'level', 'keyword'].includes(key)) ||
      reveal.condition || reveal.cookieDestination || reveal.otherwiseDestination || reveal.playMatchedAfterSourceTrash || reveal.effects?.length !== 1 ||
      move?.kind !== 'field-to-deck-bottom' || move.hpOnly !== true || move.allowStage || move.battleSide || move.condition || move.deferAwakenedUnderlay ||
      move.target.side !== 'opponent' || move.target.min !== 0 || move.target.max !== 1 || Object.keys(move.target).some(key => !['side', 'min', 'max'].includes(key))) {
      blockers.push('BS12-074 lacks precise own Arena battle-to-bottom EXTRA history, second-player up-to-two draws or BBB3 and matched-bottom return before optional opponent top HP to its owner bottom')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-068') {
    const card = evidence.card
    const ability = card?.item
    const draw = ability?.effects[0]
    const bounce = ability?.effects[1]
    if (card?.type !== 'item' || card.name !== 'Bone-afide Multivitamin Jelly' || card.energyColor !== 'blue' || !card.keywords?.includes('arena') ||
      !ability || ability.cost.blue !== 1 || Object.entries(ability.cost).some(([key, value]) => key !== 'blue' && value !== undefined && value !== 0) ||
      ability.sourceEnergy !== undefined || ability.activationCostOverride !== undefined || ability.equippedAttackEffects?.length || ability.allowInactiveConditionalEffects === true ||
      ability.effects.length !== 2 || draw?.kind !== 'draw-up-to' || draw.max !== 1 || draw.condition !== undefined || draw.untilHandSize !== undefined ||
      bounce?.kind !== 'support-to-hand' || bounce.side !== 'opponent' || bounce.amount !== 2 || bounce.optional !== true ||
      bounce.condition?.kind !== 'support-count-less-than-opponent' || bounce.condition.difference !== 2 ||
      bounce.anyNumber === true || bounce.keepCount !== undefined || bounce.cardType !== undefined || bounce.energyColor !== undefined || bounce.maxLevel !== undefined || bounce.thenEffects?.length) {
      blockers.push('BS12-068 lacks B optional one draw then exact support difference two and opponent zero to two supports returned to opponent hand')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-069') {
    const card = evidence.card
    const ability = card?.item
    const reveal = ability?.effects[0]
    const damage = reveal?.kind === 'reveal-bottom-deck' ? reveal.effects?.[0] : undefined
    if (card?.type !== 'item' || card.name !== 'Pop Pop Photocard' || card.energyColor !== 'blue' || !card.keywords?.includes('arena') ||
      !ability || ability.cost.blue !== 2 || Object.entries(ability.cost).some(([key, value]) => key !== 'blue' && value !== undefined && value !== 0) ||
      ability.sourceEnergy !== undefined || ability.activationCostOverride !== undefined || ability.equippedAttackEffects?.length || ability.allowInactiveConditionalEffects === true ||
      ability.effects.length !== 1 || reveal?.kind !== 'reveal-bottom-deck' || reveal.requireCard !== true || reveal.addMatchedToHand !== true ||
      reveal.match?.type !== 'cookie' || reveal.match.level !== 2 || reveal.match.keyword !== 'arena' || Object.keys(reveal.match).some(key => !['type', 'level', 'keyword'].includes(key)) ||
      reveal.condition !== undefined || reveal.cookieDestination !== undefined || reveal.otherwiseDestination !== undefined ||
      reveal.effects?.length !== 1 || damage?.kind !== 'damage' || damage.amount !== 1 || damage.condition !== undefined ||
      damage.target.side !== 'opponent' || damage.target.min !== 0 || damage.target.max !== 1 || Object.keys(damage.target).some(key => !['side', 'min', 'max'].includes(key))) {
      blockers.push('BS12-069 lacks BB required bottom reveal, exact same LV2 Arena Cookie to hand then opponent zero to one damage')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-071') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const reveal = skill?.effects[0]
    if (card?.type !== 'cookie' || card.name !== 'Ice Pop Cookie' || card.energyColor !== 'blue' || !card.keywords?.includes('arena') ||
      card.level !== 1 || card.hp !== 3 || card.attack !== 1 || (card.attackEffects?.length ?? 0) !== 0 ||
      card.attackEnergyCost?.blue !== 1 || card.attackEnergyCost.neutral !== 1 ||
      Object.entries(card.attackEnergyCost).some(([key, value]) => !['blue', 'neutral'].includes(key) && (value ?? 0) !== 0) ||
      !skill || skill.trigger !== 'activate' || skill.oncePerTurn !== true || skill.restSource === true || skill.yourTurn === true ||
      Object.entries(skill.cost).some(([key, value]) => key !== 'energy' && value !== undefined && value !== 0) ||
      Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) || skill.sourceEnergy !== undefined ||
      skill.effects.length !== 1 || reveal?.kind !== 'reveal-bottom-deck' || reveal.playMatchedAfterSourceTrash !== true ||
      reveal.match?.type !== 'cookie' || reveal.match.level !== 2 || reveal.match.keyword !== 'arena' ||
      Object.keys(reveal.match).some(key => !['type', 'level', 'keyword'].includes(key)) ||
      reveal.requireCard === true || reveal.addMatchedToHand === true || reveal.condition !== undefined ||
      reveal.cookieDestination !== undefined || reveal.otherwiseDestination !== undefined || (reveal.effects?.length ?? 0) !== 0) {
      blockers.push('BS12-071 lacks free once-per-entry Activate, exact LV2 Arena bottom reveal before optional source trash cost and same bottom play')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-070') {
    const card = evidence.card
    const then = card?.type === 'cookie' ? card.attackEffects?.[0] : undefined
    const reveal = then?.kind === 'optional-cost-attack' ? then.effects[0] : undefined
    const damage = reveal?.kind === 'reveal-bottom-deck' ? reveal.effects?.[0] : undefined
    if (card?.type !== 'cookie' || card.name !== 'Stardust Cookie' || card.energyColor !== 'blue' || !card.keywords?.includes('arena') ||
      card.level !== 2 || card.hp !== 2 || card.attack !== 2 || card.skill !== undefined ||
      card.attackEnergyCost?.blue !== 2 || Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'blue' && value !== undefined && value !== 0) ||
      card.attackEffects?.length !== 1 || then?.kind !== 'optional-cost-attack' || then.resolution === 'ability' || then.mandatory === true ||
      then.sourceEnergy !== undefined || then.payBeforeCondition === true || then.effectText !== normalizeOfficialCardRecord(record).attackText ||
      Object.values(then.cost.energy ?? {}).some(amount => amount !== 0) || Object.entries(then.cost).some(([key, value]) => key !== 'energy' && value !== undefined && value !== 0) ||
      then.effects.length !== 1 || reveal?.kind !== 'reveal-bottom-deck' || reveal.requireCard !== true || reveal.addMatchedToHand !== true ||
      reveal.match?.type !== 'cookie' || reveal.match.level !== 2 || reveal.match.keyword !== 'arena' || Object.keys(reveal.match).some(key => !['type', 'level', 'keyword'].includes(key)) ||
      reveal.condition !== undefined || reveal.cookieDestination !== undefined || reveal.otherwiseDestination !== undefined ||
      reveal.effects?.length !== 1 || damage?.kind !== 'damage-all' || damage.amount !== 1 || damage.side !== 'opponent' || damage.sequential !== true ||
      damage.condition !== undefined || damage.minRemainingHp !== undefined || damage.excludeSource === true || damage.excludeCardName !== undefined ||
      damage.target?.side !== 'opponent' || damage.target.min !== 1 || damage.target.max !== 2 || Object.keys(damage.target).some(key => !['side', 'min', 'max'].includes(key))) {
      blockers.push('BS12-070 lacks BB ordinary two and optional required bottom reveal, exact same LV2 Arena Cookie to hand then all opponents ordered one damage')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-067') {
    const card = evidence.card
    const ability = card?.stageAbility
    const reveal = ability?.effects[0]
    const blueOnly = (cost: EnergyCost | undefined) => cost?.blue === 1 &&
      Object.entries(cost).every(([key, value]) => key === 'blue' || (value ?? 0) === 0)
    if (card?.type !== 'stage' || card.name !== 'Comeback Stage' || card.energyColor !== 'blue' || !card.keywords?.includes('arena') ||
      !ability || !blueOnly(ability.placementCost) || !blueOnly(ability.cost.energy) || ability.restSource !== true ||
      Object.entries(ability.cost).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined && value !== 0) ||
      (ability.cost.discardHand ?? 0) !== 0 || ability.oncePerTurn === true || ability.triggered === true ||
      ability.endPhase === true || ability.ownerIndependent === true || ability.allowInactiveConditionalEffects === true || ability.specialVictory !== undefined ||
      ability.effects.length !== 1 || reveal?.kind !== 'reveal-bottom-deck' || reveal.requireCard !== true || reveal.addMatchedToHand !== true ||
      reveal.match?.type !== 'cookie' || reveal.match.level !== 2 || reveal.match.keyword !== 'arena' ||
      Object.keys(reveal.match).some(key => !['type', 'level', 'keyword'].includes(key)) ||
      reveal.condition !== undefined || reveal.cookieDestination !== undefined || reveal.otherwiseDestination !== undefined ||
      (reveal.effects?.length ?? 0) !== 0) {
      blockers.push('BS12-067 lacks separate B placement and B source REST activation with required exact LV2 Arena Cookie bottom return only')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-066') {
    const card = evidence.card
    const trap = card?.type === 'trap' ? card.trap : undefined
    const reveal = trap?.effects[0]
    const modifier = reveal?.kind === 'reveal-bottom-deck' ? reveal.effects?.[0] : undefined
    if (card?.type !== 'trap' || card.energyColor !== 'blue' || !card.keywords?.includes('arena') ||
      !trap || trap.cost.energy?.blue !== 1 || trap.cost.discardHand !== 0 ||
      Object.entries(trap.cost).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined && value !== 0) ||
      Object.entries(trap.cost.energy ?? {}).some(([key, value]) => key !== 'blue' && (value ?? 0) !== 0) ||
      trap.condition !== undefined || trap.conditionalCost !== undefined || trap.alternativeCosts?.length ||
      trap.effects.length !== 1 || reveal?.kind !== 'reveal-bottom-deck' || reveal.requireCard !== true ||
      reveal.addMatchedToHand !== true || reveal.match?.type !== 'cookie' || reveal.match.level !== 2 || reveal.match.keyword !== 'arena' ||
      Object.keys(reveal.match).some(key => !['type', 'level', 'keyword'].includes(key)) ||
      reveal.condition !== undefined || reveal.cookieDestination !== undefined || reveal.otherwiseDestination !== undefined ||
      reveal.effects?.length !== 1 || modifier?.kind !== 'modify-attack' || modifier.amount !== -2 || modifier.duration !== 'this-turn' ||
      modifier.condition !== undefined || modifier.target.side !== 'opponent' || modifier.target.min !== 0 || modifier.target.max !== 1 ||
      Object.keys(modifier.target).some(key => !['side', 'min', 'max'].includes(key))) {
      blockers.push('BS12-066 lacks B required bottom reveal, exact same LV2 Arena Cookie to hand and conditional opponent reduction')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-065') {
    const card = evidence.card
    const trap = card?.type === 'trap' ? card.trap : undefined
    const front = trap?.effects[0]
    const then = trap?.effects[1]
    const draw = then?.kind === 'optional-cost-attack' ? then.effects[0] : undefined
    if (card?.type !== 'trap' || card.energyColor !== 'blue' || !card.keywords?.includes('arena') ||
      !trap || trap.cost.energy?.blue !== 1 || trap.cost.discardHand !== 0 ||
      Object.entries(trap.cost).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined && value !== 0) ||
      Object.entries(trap.cost.energy ?? {}).some(([key, value]) => key !== 'blue' && (value ?? 0) !== 0) ||
      trap.condition !== undefined || trap.conditionalCost !== undefined || trap.alternativeCosts?.length ||
      trap.effects.length !== 2 || front?.kind !== 'modify-attack' || front.amount !== -1 || front.duration !== 'this-turn' ||
      front.condition !== undefined || front.target.side !== 'opponent' || front.target.min !== 0 || front.target.max !== 1 ||
      Object.keys(front.target).some(key => !['side', 'min', 'max'].includes(key)) ||
      then?.kind !== 'optional-cost-attack' || then.resolution !== 'ability' || then.mandatory || then.sourceEnergy ||
      then.cost.discardHand !== 1 || then.cost.discardHandType !== 'cookie' || then.cost.discardHandLevel !== 2 ||
      then.cost.discardHandKeyword !== 'arena' || then.cost.handCostDestination !== 'deck-bottom' ||
      Object.entries(then.cost.energy ?? {}).some(([, value]) => (value ?? 0) !== 0) ||
      Object.keys(then.cost).some(key => !['energy', 'discardHand', 'discardHandType', 'discardHandLevel', 'discardHandKeyword', 'handCostDestination'].includes(key)) ||
      then.effects.length !== 1 || draw?.kind !== 'draw-up-to' || draw.max !== 1 || draw.condition !== undefined || draw.untilHandSize !== undefined) {
      blockers.push('BS12-065 lacks B reduction then optional public exact LV2 Arena Cookie hand cost to bottom before draw up to one')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-077') {
    const card = evidence.card
    const skill = evidence.skill
    const equip = skill?.effects?.[0]
    if (card?.type !== 'cookie' || card.name !== 'Spotlight Fan' || card.energyColor !== 'purple' || card.level !== 1 || card.hp !== 3 ||
      !card.keywords?.includes('arena') || card.attack !== 1 || card.attackEnergyCost?.purple !== 1 || card.attackEnergyCost.neutral !== 1 ||
      Object.entries(card.attackEnergyCost).some(([key, value]) => !['purple', 'neutral'].includes(key) && (value ?? 0) !== 0) || card.flip || card.attackEffects?.length ||
      skill?.trigger !== 'activate' || skill.oncePerTurn !== true || skill.yourTurn || skill.restSource ||
      skill.cost?.energy?.purple !== 1 || Object.entries(skill.cost?.energy ?? {}).some(([key, value]) => key !== 'purple' && (value ?? 0) !== 0) ||
      Object.entries(skill.cost ?? {}).some(([key, value]) => key !== 'energy' && value !== undefined && value !== 0) ||
      skill.effects?.length !== 1 || equip?.kind !== 'equip-source' || equip.sourceZone !== 'battle' ||
      equip.target?.side !== 'self' || equip.target.min !== 1 || equip.target.max !== 1 || equip.target.cardName !== 'Rockstar Cookie' ||
      Object.keys(equip.target).some(key => !['side', 'min', 'max', 'cardName'].includes(key)) ||
      skill.equippedAttackBlockerPrevention?.hostCardName !== 'Rockstar Cookie' || skill.equippedAttackDisablesFlip || skill.equippedAttackTrigger || equip.battleSourceDisposition?.hp !== 'trash' || equip.battleSourceDisposition.replacement !== 'none' ||
      Object.keys(equip.battleSourceDisposition).some(key => !['hp', 'replacement'].includes(key))) {
      blockers.push('BS12-077 lacks P Once Per Turn Rockstar Equip, named-host battle Blocker prevention or PN ordinary one')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-078') {
    const card = evidence.card
    const flip = card?.flip
    const discard = flip?.effects?.[0]
    if (card?.type !== 'cookie' || card.name !== 'Onion Cookie' || card.energyColor !== 'purple' || card.level !== 3 || card.hp !== 3 ||
      !card.keywords?.includes('arena') || card.attack !== 3 || card.attackEnergyCost?.purple !== 3 ||
      Object.entries(card.attackEnergyCost).some(([key, value]) => key !== 'purple' && (value ?? 0) !== 0) || card.attackEffects?.length || evidence.skill ||
      !flip || flip.cost.discardHand !== 1 || flip.cost.discardHandColor !== 'purple' || flip.cost.discardHandKeyword !== 'arena' ||
      Object.keys(flip.cost).some(key => !['energy', 'discardHand', 'discardHandColor', 'discardHandKeyword'].includes(key)) ||
      Object.values(flip.cost.energy ?? {}).some(value => (value ?? 0) !== 0) || flip.handCostDestination || flip.attachedHpBonus || flip.attachedHpAlternateTarget ||
      flip.effects?.length !== 1 || discard?.kind !== 'opponent-discard-hand' || discard.count !== 2 ||
      discard.condition?.kind !== 'opponent-hand-count-at-least' || discard.condition.count !== 5 ||
      discard.destination && discard.destination !== 'trash') {
      blockers.push('BS12-078 lacks purple Arena any-card hand FLIP cost, five-hand condition, opponent-chosen two trash or PPP ordinary three')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-062') {
    const card = evidence.card
    const skill = evidence.skill
    const equip = skill?.effects?.[0]
    const trigger = skill?.equippedAttackTrigger
    const draw = trigger?.effects[0]
    if (card?.type !== 'cookie' || card.name !== 'Angel Lightstick' || card.level !== 1 || card.hp !== 3 ||
      card.energyColor !== 'blue' || card.attack !== 1 || card.attackCost !== 2 ||
      card.attackEnergyCost?.blue !== 1 || card.attackEnergyCost.neutral !== 1 ||
      Object.entries(card.attackEnergyCost).some(([key, value]) => !['blue', 'neutral'].includes(key) && (value ?? 0) !== 0) ||
      card.flip || card.attackEffects?.length || !card.keywords?.includes('arena') ||
      skill?.trigger !== 'activate' || skill.oncePerTurn !== true || skill.yourTurn || skill.restSource ||
      skill.cost?.energy?.blue !== 1 || Object.entries(skill.cost?.energy ?? {}).some(([key, value]) => key !== 'blue' && (value ?? 0) !== 0) ||
      Object.entries(skill.cost ?? {}).some(([key, value]) => key !== 'energy' && value !== undefined && value !== 0) ||
      skill.effects?.length !== 1 || equip?.kind !== 'equip-source' || equip.sourceZone !== 'battle' ||
      equip.target?.side !== 'self' || equip.target.min !== 1 || equip.target.max !== 1 || equip.target.cardName !== 'Popping Candy Cookie' ||
      Object.keys(equip.target).some(key => !['side', 'min', 'max', 'cardName'].includes(key)) ||
      equip.battleSourceDisposition?.hp !== 'trash' || equip.battleSourceDisposition.replacement !== 'none' ||
      Object.keys(equip.battleSourceDisposition).some(key => !['hp', 'replacement'].includes(key)) ||
      trigger?.hostCardName !== 'Popping Candy Cookie' || trigger.effects.length !== 1 ||
      draw?.kind !== 'draw-up-to' || draw.max !== 2 || draw.untilHandSize !== undefined ||
      draw.condition?.kind !== 'hand-count-at-most' || draw.condition.count !== 5 ||
      Object.keys(draw.condition).some(key => !['kind', 'count'].includes(key))) {
      blockers.push('BS12-062 lacks B Once Per Turn named-host Equip or the hand-at-most-five attack-declaration draw up to two')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-063') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const effect = skill?.effects[0]
    if (card?.type !== 'cookie' || card.name !== 'CAKE POPs' || card.level !== 2 || card.hp !== 2 ||
      card.energyColor !== 'blue' || card.attack !== 3 || card.attackCost !== 2 || card.attackEnergyCost?.blue !== 2 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'blue' && (value ?? 0) !== 0) ||
      card.flip || card.attackEffects?.length || !card.keywords?.includes('arena') ||
      skill?.trigger !== 'passive' || skill.oncePerTurn || skill.yourTurn || skill.restSource ||
      Object.entries(skill.cost).some(([key, value]) => key === 'energy'
        ? Object.values(value ?? {}).some(amount => amount !== undefined && amount !== 0)
        : value !== undefined && value !== 0) ||
      skill.effects.length !== 1 || effect?.kind !== 'modify-damage-received' || effect.amount !== 0 ||
      effect.duration !== 'persistent' || effect.damageType !== 'all' || effect.minimumDamage !== 2 || effect.setDamageTo !== 1 ||
      effect.target?.side !== 'self' || effect.target.min !== 1 || effect.target.max !== 1 || effect.target.sourceOnly !== true ||
      Object.keys(effect.target).some(key => !['side', 'min', 'max', 'sourceOnly'].includes(key)) ||
      effect.condition?.kind !== 'battle-area-has-named-cookie' || effect.condition.side !== 'self' ||
      effect.condition.name !== 'Popping Candy Cookie' ||
      Object.keys(effect.condition).some(key => !['kind', 'side', 'name'].includes(key))) {
      blockers.push('BS12-063 lacks source-only all-damage reduction from two or more to one while own Popping Candy Cookie is in battle')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-060') {
    const card = evidence.card
    if (card?.type !== 'cookie' || card.name !== 'Sorbet Shark Cookie' || card.level !== 2 || card.hp !== 2 || card.energyColor !== 'blue' ||
      card.attack !== 2 || card.attackCost !== 2 || card.attackEnergyCost?.blue !== 2 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'blue' && (value ?? 0) !== 0) ||
      card.skill || card.attackEffects?.length || !card.keywords?.includes('arena')) blockers.push('BS12-060 lacks the printed blue Arena LV2/HP2 BB ordinary two damage')
    const flip = evidence.card?.type === 'cookie' ? evidence.card.flip : undefined
    const gain = flip?.effects[0]
    if (flip?.cost.discardHand !== 1 || Object.values(flip.cost.energy ?? {}).some(amount => amount !== undefined && amount !== 0) ||
      Object.entries(flip.cost).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined && value !== 0) ||
      flip.handCostDestination !== undefined || flip.effects.length !== 1 || gain?.kind !== 'gain-hp' || gain.amount !== 1 || gain.condition !== undefined ||
      gain.target?.side !== 'self' || gain.target.min !== 0 || gain.target.max !== 1 || gain.target.keyword !== 'arena' ||
      gain.target.energyColor !== undefined || gain.target.sourceOnly === true || gain.target.excludeSource === true) {
      blockers.push('BS12-060 lacks one hand discard or zero-to-one own Arena Cookie gaining one HP')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-042') {
    const card = evidence.card
    if (card?.type !== 'cookie' || card.name !== 'Chamomile Cookie' || card.level !== 1 || card.hp !== 1 || card.energyColor !== 'green' ||
      card.attack !== 1 || card.attackCost !== 1 || card.attackEnergyCost?.green !== 1 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'green' && (value ?? 0) !== 0) ||
      card.skill || card.attackEffects?.length || !card.keywords?.includes('arena')) blockers.push('BS12-042 lacks the printed green Arena LV1/HP1 G ordinary one damage')
    const flip = evidence.card?.type === 'cookie' ? evidence.card.flip : undefined
    const gain = flip?.effects[0]
    if (flip?.cost.discardHand !== 1 || Object.values(flip.cost.energy ?? {}).some(amount => amount !== undefined && amount !== 0) ||
      Object.entries(flip.cost).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined && value !== 0) ||
      flip.effects.length !== 1 || gain?.kind !== 'gain-hp' || gain.amount !== 1 || gain.condition !== undefined ||
      gain.target?.side !== 'self' || gain.target.min !== 0 || gain.target.max !== 1 || gain.target.keyword !== 'arena' ||
      gain.target.energyColor !== undefined || gain.target.sourceOnly === true || gain.target.excludeSource === true) {
      blockers.push('BS12-042 lacks one hand discard or zero-to-one own Arena Cookie gaining one HP')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-080') {
    const card = evidence.card
    const flip = card?.type === 'cookie' ? card.flip : undefined
    const gain = flip?.effects[0]
    if (card?.type !== 'cookie' || card.name !== 'Kohlrabi Cookie' || card.level !== 1 || card.hp !== 1 || card.energyColor !== 'purple' ||
      card.attack !== 1 || card.attackCost !== 1 || card.attackEnergyCost?.purple !== 1 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'purple' && (value ?? 0) !== 0) ||
      card.skill || card.attackEffects?.length || !card.keywords?.includes('arena') ||
      flip?.cost.discardHand !== 1 || Object.values(flip.cost.energy ?? {}).some(amount => amount !== undefined && amount !== 0) ||
      Object.entries(flip.cost).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined && value !== 0) ||
      flip.handCostDestination !== undefined || (flip.attachedHpBonus ?? 0) !== 0 ||
      flip.effects.length !== 1 || gain?.kind !== 'gain-hp' || gain.amount !== 1 || gain.condition !== undefined ||
      gain.target?.side !== 'self' || gain.target.min !== 0 || gain.target.max !== 1 || gain.target.keyword !== 'arena' ||
      Object.entries(gain.target).some(([key, value]) => !['side', 'min', 'max', 'keyword'].includes(key) && value !== undefined)) {
      blockers.push('BS12-080 lacks P ordinary one, one unrestricted hand trash cost or zero-to-one own Arena Cookie gaining one HP')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-022') {
    const flip = evidence.card?.type === 'cookie' ? evidence.card.flip : undefined
    const gain = flip?.effects[0]
    if (flip?.cost.discardHand !== 1 || Object.values(flip.cost.energy ?? {}).some(amount => amount !== undefined && amount !== 0) ||
      Object.entries(flip.cost).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined && value !== 0) ||
      flip.effects.length !== 1 || gain?.kind !== 'gain-hp' || gain.amount !== 1 || gain.condition !== undefined ||
      gain.target?.side !== 'self' || gain.target.min !== 0 || gain.target.max !== 1 || gain.target.keyword !== 'arena' ||
      gain.target.energyColor !== undefined || gain.target.sourceOnly === true || gain.target.excludeSource === true) {
      blockers.push('BS12-022 lacks one hand discard or zero-to-one own Arena Cookie gaining one HP')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-021') {
    const skill = evidence.card?.skill
    const gain = skill?.effects[0]
    if (skill?.trigger !== 'on-play' || skill.yourTurn !== true || skill.restSource !== false ||
      Object.values(skill.cost.energy ?? {}).some(amount => amount !== undefined && amount !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => key !== 'energy' && value !== undefined && value !== 0) ||
      skill.effects.length !== 1 || gain?.kind !== 'gain-hp' || gain.amount !== 1 || gain.target?.side !== 'self' ||
      gain.target.sourceOnly !== true || gain.target.min !== 1 || gain.target.max !== 1 ||
      gain.condition?.kind !== 'arena-cookie-placed-in-break-this-turn') {
      blockers.push('BS12-021 lacks free own-turn On Play, source-only one HP, or this-turn Arena break-entry history')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-020') {
    const flip = evidence.card?.type === 'cookie' ? evidence.card.flip : undefined
    const gain = flip?.effects[0]
    const condition = gain?.kind === 'gain-hp' ? gain.condition : undefined
    if (flip?.cost.discardHand !== 1 || Object.values(flip.cost.energy ?? {}).some(amount => amount !== undefined && amount !== 0) ||
      flip.effects.length !== 1 || gain?.kind !== 'gain-hp' || gain.amount !== 1 || gain.target?.side !== 'self' || gain.target.min !== 0 || gain.target.max !== 2 ||
      gain.target.keyword !== undefined || gain.target.energyColor !== undefined || gain.target.sourceOnly === true ||
      condition?.kind !== 'break-area-card-count-at-least' || condition.side !== 'self' || condition.count !== 4 || condition.keyword !== 'arena' || condition.color !== undefined) {
      blockers.push('BS12-020 lacks one-hand FLIP cost, own four-Arena break count, or unrestricted zero-to-two own Cookie HP targets')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-018') {
    const skill = evidence.card?.skill
    const ready = skill?.effects[0]
    const damage = evidence.card?.type === 'cookie' ? evidence.card.attackEffects?.[0] : undefined
    const cost = evidence.extraDeckPlayCost
    const requirement = evidence.extraDeckPlayRequirement
    if (evidence.extraDeckPlayMode !== 'enter-battle' || requirement?.kind !== 'break-level-at-least' || requirement.level !== 4 ||
      cost?.discardHand !== 1 || cost.discardHandKeyword !== 'arena' ||
      Object.values(cost.energy ?? {}).some(amount => amount !== undefined && amount !== 0) ||
      Object.entries(cost).some(([key, value]) => !['energy', 'discardHand', 'discardHandKeyword'].includes(key) && value !== undefined && value !== 0) ||
      skill?.trigger !== 'activate' || skill.oncePerTurn !== true || skill.restSource !== false ||
      Object.values(skill.cost?.energy ?? {}).some(amount => amount !== undefined && amount !== 0) ||
      Object.entries(skill.cost ?? {}).some(([key, value]) => key !== 'energy' && value !== undefined && value !== 0) ||
      skill.effects.length !== 1 || ready?.kind !== 'set-cookie-active' || ready.target.side !== 'self' || ready.target.min !== 0 || ready.target.max !== 1 ||
      ready.target.keyword !== 'arena' || ready.target.energyColor !== 'red' || ready.target.excludeSource !== true || ready.target.sourceOnly === true ||
      evidence.card?.type !== 'cookie' || evidence.card.attackEffects?.length !== 1 || damage?.kind !== 'damage' || damage.amount !== 1 ||
      damage.target.side !== 'opponent' || damage.target.min !== 0 || damage.target.max !== 1 || damage.target.attackTargetOnly === true ||
      damage.target.energyColor !== undefined || damage.target.keyword !== undefined || damage.condition?.kind !== 'player-started-second') {
      blockers.push('BS12-018 lacks LV4/Arena EXTRA cost, separate free other-red-Arena Activate, or selectable second-player damage Then')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-017') {
    const skill = evidence.card?.skill
    const ready = skill?.effects[0]
    const damage = evidence.card?.type === 'cookie' ? evidence.card.attackEffects?.[0] : undefined
    const condition = damage?.kind === 'damage' ? damage.condition : undefined
    if (skill?.trigger !== 'activate' || skill.oncePerTurn !== true || skill.restSource !== false || skill.cost?.discardHand !== 1 ||
      Object.values(skill.cost?.energy ?? {}).some(amount => amount !== undefined && amount !== 0) ||
      Object.entries(skill.cost ?? {}).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined && value !== 0) ||
      skill.effects.length !== 1 || ready?.kind !== 'set-cookie-active' ||
      ready.target.side !== 'self' || ready.target.min !== 0 || ready.target.max !== 1 ||
      ready.target.keyword !== 'arena' || ready.target.excludeSource !== true || ready.target.energyColor !== undefined || ready.target.sourceOnly === true ||
      evidence.card?.type !== 'cookie' || evidence.card.attackEffects?.length !== 1 ||
      damage?.kind !== 'damage' || damage.amount !== 1 || damage.target.side !== 'opponent' || damage.target.min !== 0 || damage.target.max !== 1 ||
      damage.target.attackTargetOnly === true || damage.target.energyColor !== undefined || damage.target.keyword !== undefined ||
      condition?.kind !== 'battle-area-has-named-cookie' || condition.side !== 'self' || condition.name !== 'Apple Faerie Cookie' || condition.negate === true) {
      blockers.push('BS12-017 lacks one-hand discard cost, other-Arena ready, or optional opponent damage with friendly Apple Faerie')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-016') {
    const skill = evidence.card?.skill
    const ready = skill?.effects[0]
    const rest = skill?.effects[1]
    const damage = evidence.card?.type === 'cookie' ? evidence.card.attackEffects?.[0] : undefined
    if (skill?.trigger !== 'activate' || skill.oncePerTurn !== true || skill.restSource !== false ||
      Object.values(skill.cost?.energy ?? {}).some(amount => amount !== undefined && amount !== 0) ||
      Object.entries(skill.cost ?? {}).some(([key, value]) => key !== 'energy' && value !== undefined && value !== 0) ||
      skill.effects.length !== 2 || ready?.kind !== 'set-cookie-active' ||
      ready.target.side !== 'self' || ready.target.min !== 0 || ready.target.max !== 1 ||
      ready.target.keyword !== 'arena' || ready.target.excludeSource !== true || ready.target.energyColor !== undefined ||
      rest?.kind !== 'rest-cookie' || rest.target.side !== 'self' || rest.target.min !== 0 || rest.target.max !== 1 || rest.target.sourceOnly !== true ||
      damage?.kind !== 'damage' || damage.amount !== 2 || damage.target.side !== 'opponent' ||
      damage.target.min !== 1 || damage.target.max !== 1 || damage.target.attackTargetOnly !== true ||
      damage.condition?.kind !== 'source-set-active-by-effect-this-turn') {
      blockers.push('BS12-016 lacks ordered free other-Arena ready, optional source REST, or original-defender effect-ready damage Then')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-015') {
    const damage = evidence.card?.type === 'cookie' ? evidence.card.attackEffects?.[0] : undefined
    const condition = damage?.kind === 'damage' ? damage.condition : undefined
    if (damage?.kind !== 'damage' || damage.amount !== 1 ||
      damage.target.side !== 'opponent' || damage.target.attackTargetOnly !== true || damage.target.min !== 1 || damage.target.max !== 1 ||
      condition?.kind !== 'battle-area-has-keyword' || condition.side !== 'self' ||
      condition.keyword !== 'arena' || condition.excludeSource !== true) {
      blockers.push('BS12-015 original-defender damage Then lacks the other friendly Arena condition or user-ruled target')
    }
  }
  if (/During the Active Phase, if there is no other.*Arena.*Cookie in your battle area, this Cookie is not set as active/i.test(fullSourceText)) {
    const prevention = evidence.card?.skill?.effects.find(effect => effect.kind === 'prevent-source-active-phase')
    const condition = prevention?.condition
    if (evidence.card?.skill?.trigger !== 'passive' || condition?.kind !== 'battle-area-cookie-count' ||
      condition.side !== 'self' || condition.count !== 0 || condition.keyword !== 'arena' ||
      condition.excludeSource !== true || condition.energyColor !== undefined) {
      blockers.push('Active Phase source readiness restriction lacks the other friendly Arena condition')
    }
  }
  if (record.type === 'item' && /Select up to 1 \{R\}.*Arena.*Cookie in your battle area\.\s*During this turn, that Cookie gains \+1 attack damage\.\s*Then, set that Cookie as active/i.test(fullSourceText)) {
    const modifier = evidence.card?.item?.effects[0]
    if (modifier?.kind !== 'modify-attack' || modifier.amount !== 1 || modifier.duration !== 'this-turn' ||
      modifier.target.side !== 'self' || modifier.target.min !== 0 || modifier.target.max !== 1 ||
      modifier.target.energyColor !== 'red' || modifier.target.keyword !== 'arena' ||
      !modifier.thenEffects?.some(effect => effect.kind === 'set-cookie-active' && effect.target.previousEffectTargetOnly &&
        effect.target.side === 'self' && effect.target.min === 0 && effect.target.max === 1 &&
        effect.target.energyColor === 'red' && effect.target.keyword === 'arena')) {
      blockers.push('red Arena attack bonus and same-target ready Then have no complete runtime evidence')
    }
  }
  if (record.type === 'item' && /Select up to 2.*\{R\}.*Arena.*Cookies in your battle area\.\s*Set those Cookies as active/i.test(fullSourceText) &&
    !evidence.card?.item?.effects.some(effect => effect.kind === 'set-cookie-active' &&
      effect.target.side === 'self' && effect.target.min === 0 && effect.target.max === 2 &&
      effect.target.energyColor === 'red' && effect.target.keyword === 'arena')) {
    blockers.push('optional red Arena Cookie readying has no complete runtime evidence')
  }
  if (record.type === 'stage' && /When your turn ends, select up to 1.*Arena.*Cookie in your battle area\.\s*Set that Cookie as active/i.test(fullSourceText)) {
    const stage = evidence.card?.stageAbility
    if (stage?.endPhase !== true || stage.endPhaseScope !== 'your-turn' ||
      !stage.effects.some(effect => effect.kind === 'set-cookie-active' &&
        effect.target.side === 'self' && effect.target.min === 0 && effect.target.max === 1 && effect.target.keyword === 'arena')) {
      blockers.push('own end-turn Arena Cookie readying has no complete runtime evidence')
    }
  }
  if (/Set 2.*Arena.*Cookies in your battle area as rested/i.test(fullSourceText)) {
    const hasOptionalThenCost = /Then,\s*<set 2.*Arena.*Cookies in your battle area as rested/i.test(fullSourceText)
    const optional = evidence.ability?.effects?.find(effect => effect.kind === 'optional-cost-attack' && effect.resolution === 'ability')
    const cost = hasOptionalThenCost && optional?.kind === 'optional-cost-attack'
      ? optional.cost.battleCookiePosition : hasOptionalThenCost ? undefined : evidence.ability?.cost?.battleCookiePosition
    if (cost?.count !== 2 || cost.position !== 'rested' || cost.keyword !== 'arena') {
      blockers.push('Arena Cookie resting cost has no complete runtime evidence')
    }
    if (hasOptionalThenCost && /that Cookie deals an additional -1 attack damage/i.test(fullSourceText) &&
      !(optional?.kind === 'optional-cost-attack' && optional.effects.some(effect => effect.kind === 'modify-attack' &&
        effect.amount === -1 && effect.duration === 'this-turn' && effect.target.side === 'opponent' && effect.target.previousEffectTargetOnly))) {
      blockers.push('additional attack reduction has no linked optional Then evidence')
    }
  }
  // Require the intersection, not independent red and Arena counts.
  if (/there are 4 \{R\}.*Arena.*cards or more in your support area/i.test(fullSourceText) &&
    !runtimeEffectsForSource(evidence, 'skill').some(effect => 'condition' in effect &&
      effect.condition?.kind === 'support-count-at-least' && effect.condition.count === 4 &&
      effect.condition.energyColor === 'red' && effect.condition.keyword === 'arena')) {
    blockers.push('red Arena support threshold has no complete runtime evidence')
  }
  const hasRuntimeEffect = (kind: string): boolean =>
    flattenedRuntimeEffects.some((effect) => effect.kind === kind)
  if (
    /cannot add HP to Cookies via card effects/i.test(fullSourceText) &&
    !hasRuntimeEffect('prevent-opponent-hp-gain')
  ) {
    blockers.push('opponent HP-gain prevention has no runtime effect')
  }
  if (/rearrange them in any order/i.test(fullSourceText) && !hasRuntimeEffect('reorder-hp')) {
    blockers.push('HP rearrangement has no runtime effect')
  }
  if (/unaffected by your opponent['’]s trap effects/i.test(fullSourceText)) {
    const equippedEffects = evidence.ability?.equippedAttackEffects ?? []
    if (!equippedEffects.some((effect) => effect.kind === 'disable-traps')) {
      blockers.push('equipped trap immunity has no runtime effect')
    }
  }
  if (/when that cookie attacks, your opponent cannot activate FLIP during this battle/i.test(fullSourceText) &&
    evidence.skill?.equippedAttackDisablesFlip !== true) {
    blockers.push('equipped battle FLIP prevention has no runtime evidence')
  }
  if (flattenedRuntimeEffects.some(effect => effect.kind === 'equip-source' && effect.sourceZone === 'battle' &&
    (effect.battleSourceDisposition?.hp !== 'trash' || effect.battleSourceDisposition.replacement !== 'none'))) {
    blockers.push('Cookie Equip HP and replacement ruling is unconfirmed')
  }
  if (/discard 1 Cookie that has FLIP from your hand or place 1 card from the top of this Cookie's HP/i.test(fullSourceText)) {
    const chooseOne = flattenedRuntimeEffects.find((effect) => effect.kind === 'choose-one')
    const discard = flattenedRuntimeEffects.find((effect) => effect.kind === 'discard-hand')
    if (
      !chooseOne ||
      !discard ||
      discard.cookieOnly !== true ||
      discard.hasFlip !== true ||
      !hasRuntimeEffect('hp-to-trash')
    ) {
      blockers.push('FLIP discard or source HP choice lacks exact runtime evidence')
    }
  }
  if (/return up to 2 \{Y\} Cookies that have FLIP from your trash to your hand/i.test(fullSourceText)) {
    const recovery = flattenedRuntimeEffects.find((effect) => effect.kind === 'trash-to-hand')
    if (
      !recovery ||
      recovery.max !== 2 ||
      recovery.energyColor !== 'yellow' ||
      recovery.cookieOnly !== true ||
      recovery.hasFlip !== true
    ) {
      blockers.push('yellow FLIP Cookie trash recovery lacks exact runtime filters')
    }
  }
  if (/another \[Chess Choco Cookie\][\s\S]*all your Cookies gain \+1 HP/i.test(fullSourceText)) {
    const gain = flattenedRuntimeEffects.find((effect) => effect.kind === 'gain-hp')
    const condition = gain?.condition as Record<string, unknown> | undefined
    const target = gain?.target as Record<string, unknown> | undefined
    if (
      !gain ||
      gain.amount !== 1 ||
      target?.side !== 'self' ||
      target.allMatching !== true ||
      condition?.kind !== 'battle-area-has-named-cookie' ||
      condition.name !== 'Chess Choco Cookie' ||
      condition.excludeSource !== true
    ) {
      blockers.push('named twin all-Cookie HP gain lacks exact runtime evidence')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-081') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const redirect = skill?.effects[0]
    if (card?.type !== 'cookie' || card.name !== 'Pudding Cookie' || card.level !== 1 || card.hp !== 2 || card.energyColor !== 'purple' ||
      !card.keywords?.includes('arena') || card.attack !== 1 || card.attackCost !== 1 || card.attackEnergyCost?.purple !== 1 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'purple' && (value ?? 0) !== 0) ||
      card.flip || card.attackEffects?.length || skill?.trigger !== 'block' || skill.restSource || skill.oncePerTurn || skill.yourTurn ||
      skill.cost.discardHand !== 1 || skill.cost.discardHandColor !== 'purple' || skill.cost.discardHandKeyword !== 'arena' ||
      Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => !['energy', 'discardHand', 'discardHandColor', 'discardHandKeyword'].includes(key) && value !== undefined) ||
      skill.effects.length !== 1 || redirect?.kind !== 'redirect-attack' || redirect.condition !== undefined ||
      redirect.target?.side !== 'self' || redirect.target.min !== 1 || redirect.target.max !== 1 || redirect.target.sourceOnly !== true ||
      Object.entries(redirect.target).some(([key, value]) => !['side', 'min', 'max', 'sourceOnly'].includes(key) && value !== undefined)) {
      blockers.push('BS12-081 lacks P ordinary one or unrestricted-type purple Arena hand-cost Blocker without REST, Once or Your Turn')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-088') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const redirect = skill?.effects[0]
    const draw = skill?.faintEffects?.[0]
    if (card?.type !== 'cookie' || card.name !== 'Black Sapphire Cookie' || card.level !== 1 || card.hp !== 3 || card.energyColor !== 'purple' ||
      !card.keywords?.includes('arena') || card.attack !== 1 || card.attackCost !== 2 || card.attackEnergyCost?.purple !== 1 || card.attackEnergyCost?.neutral !== 1 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => !['purple', 'neutral'].includes(key) && (value ?? 0) !== 0) ||
      card.flip || card.attackEffects?.length || skill?.trigger !== 'block' || skill.restSource || skill.oncePerTurn || skill.yourTurn || !skill.faint || skill.faintOptional ||
      skill.onPlayEffects?.length || skill.passiveEffects?.length || skill.sourceEnergy || skill.afterDamage || skill.endPhase || skill.oncePerGame ||
      skill.cost.discardHand !== 1 || skill.cost.discardHandColor !== 'purple' || skill.cost.discardHandKeyword !== 'arena' ||
      Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => !['energy', 'discardHand', 'discardHandColor', 'discardHandKeyword'].includes(key) && value !== undefined) ||
      skill.effects.length !== 1 || redirect?.kind !== 'redirect-attack' || redirect.condition !== undefined ||
      redirect.target?.side !== 'self' || redirect.target.min !== 1 || redirect.target.max !== 1 || redirect.target.sourceOnly !== true ||
      Object.entries(redirect.target).some(([key, value]) => !['side', 'min', 'max', 'sourceOnly'].includes(key) && value !== undefined) ||
      skill.faintCost?.discardHand !== 1 || skill.faintCost.discardHandKeyword !== 'arena' ||
      Object.values(skill.faintCost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.faintCost).some(([key, value]) => !['energy', 'discardHand', 'discardHandKeyword'].includes(key) && value !== undefined) ||
      skill.faintEffects?.length !== 1 || draw?.kind !== 'draw-up-to' || draw.max !== 2 ||
      Object.entries(draw).some(([key, value]) => !['kind', 'max'].includes(key) && value !== undefined)) {
      blockers.push('BS12-088 lacks PN ordinary one, purple Arena hand Blocker and independent any-color Arena hand-cost faint draw up to two')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-089') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const redirect = skill?.effects[0]
    if (card?.type !== 'cookie' || card.name !== 'Werewolf Cookie' || card.level !== 2 || card.hp !== 5 || card.energyColor !== 'purple' ||
      !card.keywords?.includes('arena') || card.attack !== 2 || card.attackCost !== 3 || card.attackEnergyCost?.purple !== 2 || card.attackEnergyCost?.neutral !== 1 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => !['purple', 'neutral'].includes(key) && (value ?? 0) !== 0) ||
      card.flip || card.attackEffects?.length || skill?.trigger !== 'block' || skill.restSource || skill.oncePerTurn || skill.yourTurn || skill.faint ||
      skill.faintEffects?.length || skill.faintCost || skill.onPlayEffects?.length || skill.passiveEffects?.length || skill.sourceEnergy || skill.afterDamage || skill.endPhase || skill.oncePerGame ||
      skill.cost.discardHand !== 1 || skill.cost.discardHandColor !== 'purple' || skill.cost.discardHandKeyword !== 'arena' ||
      Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => !['energy', 'discardHand', 'discardHandColor', 'discardHandKeyword'].includes(key) && value !== undefined) ||
      skill.effects.length !== 1 || redirect?.kind !== 'redirect-attack' || redirect.condition !== undefined ||
      redirect.target?.side !== 'self' || redirect.target.min !== 1 || redirect.target.max !== 1 || redirect.target.sourceOnly !== true ||
      Object.entries(redirect.target).some(([key, value]) => !['side', 'min', 'max', 'sourceOnly'].includes(key) && value !== undefined) ||
      skill.battleOpponentAttackEffectPrevention?.level !== 3 ||
      Object.entries(skill.battleOpponentAttackEffectPrevention).some(([key, value]) => key !== 'level' && value !== undefined)) {
      blockers.push('BS12-089 lacks PPN ordinary two, purple Arena hand Blocker or battle-only opponent exact LV3 attack-effect prevention')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-092') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const requirement = evidence.extraDeckPlayRequirement
    const cost = evidence.extraDeckPlayCost
    const battleCost = cost?.trashBattleCookie
    const faint = skill?.friendlyFaintEffects?.[0]
    const then = card?.type === 'cookie' ? card.attackEffects?.[0] : undefined
    const hasOtherKeys = (value: object, allowed: string[]) => Object.entries(value).some(([key, item]) => !allowed.includes(key) && item !== undefined)
    if (card?.type !== 'cookie' || card.name !== 'Black Lemonade Cookie' || card.level !== 3 || card.hp !== 5 || card.energyColor !== 'purple' || !card.keywords?.includes('arena') ||
      card.attack !== 4 || card.attackCost !== 4 || card.attackEnergyCost?.purple !== 4 || Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'purple' && (value ?? 0) !== 0) ||
      card.flip || card.awakenHpBonus !== undefined || card.extraDeckOrigin !== 'extra' || evidence.extraDeckPlayMode !== 'enter-battle' ||
      requirement?.kind !== 'break-blocker-cookie-count-at-least' || requirement.count !== 3 || requirement.keyword !== 'arena' || hasOtherKeys(requirement, ['kind', 'count', 'keyword']) ||
      !cost || Object.values(cost.energy ?? {}).some(value => (value ?? 0) !== 0) || hasOtherKeys(cost, ['energy', 'trashBattleCookie']) ||
      battleCost?.count !== 1 || battleCost.energyColor !== 'purple' || battleCost.maxLevel !== 2 || hasOtherKeys(battleCost, ['count', 'energyColor', 'maxLevel']) ||
      skill?.trigger !== 'passive' || skill.oncePerTurn || skill.yourTurn || skill.restSource || skill.faint || skill.faintEffects?.length || skill.faintCost ||
      skill.onPlayEffects?.length || skill.passiveEffects?.length || skill.sourceEnergy || skill.afterDamage || skill.endPhase || skill.fromBreakArea || skill.fromSupportArea || skill.fromTrashArea ||
      skill.effects.length !== 0 || (skill.cost.discardHand ?? 0) !== 0 || Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) || hasOtherKeys(skill.cost, ['energy', 'discardHand']) ||
      skill.friendlyFaintEffects?.length !== 1 || faint?.kind !== 'opponent-discard-hand' || faint.count !== 1 || hasOtherKeys(faint, ['kind', 'count', 'condition']) ||
      faint.condition?.kind !== 'opponent-hand-count-at-least' || faint.condition.count !== 3 || hasOtherKeys(faint.condition, ['kind', 'count']) ||
      card.attackEffects?.length !== 1 || then?.kind !== 'opponent-discard-hand' || then.count !== 1 || hasOtherKeys(then, ['kind', 'count', 'condition']) ||
      then.condition?.kind !== 'player-started-second' || hasOtherKeys(then.condition, ['kind'])) {
      blockers.push('BS12-092 lacks three own Break Arena Blocker Cookies, purple LV2-or-lower battle-to-trash EXTRA cost, living friendly-faint three-hand opponent discard or independent second-player PPPP four Then')
    }
  }
  if (['BS12-109','BS12-110','BS12-111','BS12-112'].includes(record.baseCardNumber || record.cardNumber.split('@')[0])) {
    const number=record.baseCardNumber || record.cardNumber.split('@')[0],card=evidence.card
    const canonical=(value:unknown):string=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value!==null&&typeof value==='object'?'{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}':JSON.stringify(value)??'undefined'
    const same=(value:unknown,expected:unknown)=>canonical(value)===canonical(expected)
    const base=card?.type==='cookie'&&card.id===number&&card.cardColor==='black'&&card.energyColor==='black'&&same(card.keywords,['arena'])&&!card.flip
    if(number==='BS12-109'){
      if(!base||card?.type!=='cookie'||card.name!=='Licorice Cookie'||card.level!==1||card.hp!==2||card.attack!==2||card.attackCost!==2||!same(card.attackEnergyCost,{black:2})||card.skill!==undefined||card.extraDeckOrigin!==undefined||!same(card.attackEffects,[{kind:'hand-to-hp',condition:{kind:'opponent-support-count-at-least',count:3},target:{side:'self',min:0,max:1},selectTarget:true,optional:true,handHasSpecialPlay:true,handPlacementRequired:true,faceUp:true,hpPlacement:'top'}]))blockers.push('BS12-109 lacks R006 opponent three support cards then optional own Cookie with required printed Special Play hand Cookie as face-up TOP HP')
    }else if(number==='BS12-110'){
      const skill=card?.type==='cookie'?card.skill:undefined
      if(!base||card?.type!=='cookie'||card.name!=='Agar Agar Cookie'||card.level!==1||card.hp!==3||card.attack!==1||card.attackCost!==2||!same(card.attackEnergyCost,{black:1,neutral:1})||(card.attackEffects?.length??0)!==0||card.extraDeckOrigin!==undefined||skill?.trigger!=='activate'||skill.oncePerTurn||skill.restSource||skill.yourTurn||!same(skill.cost,{energy:{},discardHand:0,selfToTrash:true})||!same(skill.effects,[{kind:'draw-up-to',max:1,condition:{kind:'support-count-at-least',count:3,energyColor:'black'}}])||skill.passiveEffects?.length||skill.onPlayEffects?.length)blockers.push('BS12-110 lacks black Arena LV1 HP3 KN1 free nonOnce Activate three black support CARDS, self+HP Trash then draw0-1')
    }else if(number==='BS12-111'){
      const skill=card?.type==='cookie'?card.skill:undefined
      if(!base||card?.type!=='cookie'||card.name!=='Poison Mushroom Cookie'||card.level!==3||card.hp!==5||card.attack!==2||card.attackCost!==2||!same(card.attackEnergyCost,{black:2})||card.extraDeckOrigin!=='extra'||evidence.extraDeckPlayMode!=='enter-battle'||evidence.extraDeckPlayCost!==undefined||!same(evidence.extraDeckPlayRequirement,{kind:'all-of',conditions:[{kind:'opponent-support-count-at-least',count:4},{kind:'battle-area-has-special-play-cookie',side:'self'}]})||skill?.trigger!=='passive'||skill.oncePerTurn||skill.restSource||skill.yourTurn||!same(skill.cost,{energy:{},discardHand:0})||!same(skill.effects,[])||!same(skill.passiveEffects,[{kind:'modify-attack',amount:1,duration:'persistent',target:{side:'self',min:0,max:1,allMatching:true,excludeSource:true,energyColor:'black',keyword:'arena'}}])||!same(card.attackEffects,[{kind:'gain-hp',amount:1,target:{side:'self',min:1,max:1,sourceOnly:true},condition:{kind:'player-started-second'}}]))blockers.push('BS12-111 lacks exact EXTRA opponent four support CARDS plus any own SpecialPlay Cookie, other own blackArena aura and KK2 second-player sourceHP1')
    }else{
      const skill=card?.type==='cookie'?card.skill:undefined,then=card?.type==='cookie'?card.attackEffects?.[0]:undefined
      if(!base||card?.type!=='cookie'||card.name!=='Red Velvet Cookie'||card.level!==2||card.hp!==4||card.attack!==3||card.attackCost!==3||!same(card.attackEnergyCost,{black:3})||card.extraDeckOrigin!==undefined||!same(skill?.specialPlayCost,{energy:{},discardHand:0,trashBattleCookie:{count:1,energyColor:'black',level:1,hasSpecialPlay:true}})||card.attackEffects?.length!==1||then?.kind!=='optional-cost-attack'||then.resolution!==undefined||!same(then.cost,{energy:{},discardHand:0,selfToTrash:true})||!same(then.effects,[{kind:'trash-to-hand',max:2,cookieOnly:true,keyword:'arena',minLevel:1,maxLevel:1}]))blockers.push('BS12-112 lacks blackArena LV2 HP4 SpecialPlay blackLV1Special cost and KKK3 optional source+HPTrash then0-2 ownTrash LV1Arena Cookie recovery')
    }
  }
  if (['BS12-106','BS12-107','BS12-108'].includes(record.baseCardNumber || record.cardNumber.split('@')[0])) {
    const number=record.baseCardNumber || record.cardNumber.split('@')[0],card=evidence.card
    const other=(value:object,allowed:string[])=>Object.entries(value).some(([k,v])=>!allowed.includes(k)&&v!==undefined)
    const energy=(value:EnergyCost|undefined,black:number,neutral=0)=>value?.black===black&&(value.neutral??0)===neutral&&!Object.entries(value).some(([k,v])=>!['black','neutral'].includes(k)&&(v??0)!==0)
    const free=(value:EnergyCost|undefined)=>value!==undefined&&Object.values(value).every(v=>(v??0)===0)
    const base=card?.id===number&&card.cardColor==='black'&&card.energyColor==='black'&&card.keywords?.length===1&&card.keywords[0]==='arena'
    if(number==='BS12-106') {
      const a=card?.type==='trap'?card.trap:undefined,first=a?.effects[0],target=first?.kind==='modify-attack'?first.target:undefined,then=a?.effects[1],cost=then?.kind==='optional-cost-attack'?then.cost:undefined,recovery=then?.kind==='optional-cost-attack'?then.effects[0]:undefined
      if(!base||card?.type!=='trap'||card.name!=='Bad and Dark'||!energy(a?.cost.energy,2)||a?.cost.discardHand!==0||other(a?.cost??{},['energy','discardHand'])||other(a??{},['text','cost','effects'])||a?.effects.length!==2||JSON.stringify(card.effects)!==JSON.stringify(a.effects)||
        first?.kind!=='modify-attack'||first.amount!==-2||first.duration!=='this-turn'||other(first??{},['kind','amount','duration','target'])||target?.side!=='opponent'||target.min!==0||target.max!==1||other(target??{},['side','min','max'])||
        then?.kind!=='optional-cost-attack'||then.resolution!=='ability'||then.effects.length!==1||other(then??{},['kind','resolution','cost','effectText','effects'])||!free(cost?.energy)||cost?.discardHand!==1||other(cost??{},['energy','discardHand'])||
        recovery?.kind!=='trash-to-hand'||recovery.max!==1||recovery.cookieOnly!==true||recovery.keyword!=='arena'||recovery.hasSpecialPlay!==true||other(recovery??{},['kind','max','cookieOnly','keyword','hasSpecialPlay']))blockers.push('BS12-106 lacks independent KK Trap primary minus2 and optional Then anyHand discard1 before SpecialPlay Arena Cookie recovery')
    } else if(number==='BS12-107') {
      const then=card?.type==='cookie'?card.attackEffects?.[0]:undefined,cost=then?.kind==='optional-cost-attack'?then.cost:undefined,recovery=then?.kind==='optional-cost-attack'?then.effects[0]:undefined
      if(!base||card?.type!=='cookie'||card.name!=='Pomegranate Cookie'||card.level!==1||card.hp!==2||card.attack!==2||card.attackCost!==2||!energy(card.attackEnergyCost,1,1)||card.skill!==undefined||card.flip!==undefined||card.extraDeckOrigin!==undefined||card.attackEffects?.length!==1||
        then?.kind!=='optional-cost-attack'||then.resolution!==undefined||then.effects.length!==1||other(then??{},['kind','cost','effectText','effects'])||!free(cost?.energy)||cost?.discardHand!==1||other(cost??{},['energy','discardHand'])||
        recovery?.kind!=='trash-to-hand'||recovery.max!==1||recovery.cookieOnly!==true||recovery.keyword!=='arena'||other(recovery??{},['kind','max','cookieOnly','keyword']))blockers.push('BS12-107 lacks black Arena LV1 HP2 KN2 and optional Then anyHand discard1 before Arena Cookie recovery')
    } else {
      const s=card?.type==='cookie'?card.skill:undefined,draw=s?.effects[0],condition=draw?.kind==='draw-up-to'?draw.condition:undefined,hand=condition?.kind==='all-of'?condition.conditions[0]:undefined,witness=condition?.kind==='all-of'?condition.conditions[1]:undefined
      if(!base||card?.type!=='cookie'||card.name!=='Schwarzwälder'||card.level!==1||card.hp!==2||card.attack!==1||card.attackCost!==1||!energy(card.attackEnergyCost,1)||(card.attackEffects?.length??0)!==0||card.flip!==undefined||card.extraDeckOrigin!==undefined||
        s?.trigger!=='activate'||s.oncePerTurn!==true||s.restSource!==false||s.yourTurn!==false||[s.faint,s.endPhase,s.afterDamage,s.oncePerGame,s.fromBreakArea,s.onPlayFromBreakArea,s.fromTrashArea,s.fromSupportArea].some(v=>v!==false)||other(s??{},['trigger','oncePerTurn','restSource','yourTurn','cost','text','effects','faint','endPhase','afterDamage','oncePerGame','fromBreakArea','onPlayFromBreakArea','fromTrashArea','fromSupportArea'])||!free(s.cost.energy)||s.cost.discardHand!==0||other(s.cost,['energy','discardHand'])||s.effects.length!==1||
        draw?.kind!=='draw-up-to'||draw.max!==1||other(draw??{},['kind','max','condition'])||condition?.kind!=='all-of'||condition.conditions.length!==2||other(condition??{},['kind','conditions'])||
        hand?.kind!=='hand-count-at-most'||hand.count!==5||other(hand??{},['kind','count'])||witness?.kind!=='battle-area-has-color'||witness.side!=='self'||witness.color!=='black'||witness.keyword!=='arena'||witness.excludeSource!==true||other(witness??{},['kind','side','color','keyword','excludeSource']))blockers.push('BS12-108 lacks black Arena LV1 HP2 K1 free ActivateOnce draw1 with Hand<=5 and another same black Arena Cookie')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-105') {
    const card = evidence.card, trap = card?.type === 'trap' ? card.trap : undefined, effect = trap?.effects[0]
    const condition = effect?.kind === 'modify-attack' && effect.condition?.kind === 'battle-area-has-color' ? effect.condition : undefined
    const target = effect?.kind === 'modify-attack' ? effect.target : undefined
    const extra = (value: object, allowed: string[]) => Object.entries(value).some(([key, item]) => !allowed.includes(key) && item !== undefined)
    if (card?.type !== 'trap' || card.name !== 'Perfect Stage' || card.cardColor !== 'black' || card.energyColor !== 'black' ||
      card.keywords?.length !== 1 || !card.keywords.includes('arena') || trap?.cost.energy?.black !== 1 ||
      Object.entries(trap?.cost.energy ?? {}).some(([key, value]) => key !== 'black' && (value ?? 0) !== 0) ||
      trap?.cost.discardHand !== 0 || extra(trap?.cost ?? {}, ['energy', 'discardHand']) || extra(trap ?? {}, ['text', 'cost', 'effects']) || trap?.effects.length !== 1 ||
      effect?.kind !== 'modify-attack' || effect.amount !== -2 || effect.duration !== 'this-turn' || extra(effect ?? {}, ['kind', 'amount', 'duration', 'condition', 'target']) ||
      condition?.side !== 'self' || condition.color !== 'black' || condition.keyword !== 'arena' || extra(condition ?? {}, ['kind', 'side', 'color', 'keyword']) ||
      target?.side !== 'opponent' || target.min !== 0 || target.max !== 1 || extra(target ?? {}, ['side', 'min', 'max'])) {
      blockers.push('BS12-105 lacks black Arena K1 Trap, same own battle Cookie black and Arena condition or optional opponent current-turn minus two')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-104') {
    const card = evidence.card, ability = card?.type === 'item' ? card.item : undefined
    const draw = ability?.effects[0], buff = ability?.effects[1], target = buff?.kind === 'modify-attack' ? buff.target : undefined
    const hasOtherKeys = (value: object, allowed: string[]) => Object.entries(value).some(([key, item]) => !allowed.includes(key) && item !== undefined)
    const blackOne = (energy: EnergyCost | undefined) => energy?.black === 1 &&
      !Object.entries(energy).some(([key, value]) => key !== 'black' && (value ?? 0) !== 0)
    if (card?.type !== 'item' || card.name !== 'Recipe For Acting Success' || card.cardColor !== 'black' || card.energyColor !== 'black' ||
      card.keywords?.length !== 1 || !card.keywords.includes('arena') || !blackOne(ability?.cost.energy) || ability?.cost.discardHand !== 0 ||
      hasOtherKeys(ability?.cost ?? {}, ['energy', 'discardHand']) || hasOtherKeys(ability ?? {}, ['cost', 'text', 'effects']) || ability?.effects.length !== 2 ||
      draw?.kind !== 'draw-up-to' || draw.max !== 1 || hasOtherKeys(draw ?? {}, ['kind', 'max']) ||
      buff?.kind !== 'modify-attack' || buff.amount !== 1 || buff.duration !== 'this-turn' || hasOtherKeys(buff ?? {}, ['kind', 'amount', 'duration', 'target']) ||
      target?.side !== 'self' || target.min !== 0 || target.max !== 1 || target.hasSpecialPlay !== true ||
      hasOtherKeys(target ?? {}, ['side', 'min', 'max', 'hasSpecialPlay'])) {
      blockers.push('BS12-104 lacks black Arena K1 Item, independent optional draw one then own Special Play Cookie attack plus one this turn')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-103') {
    const card = evidence.card, ability = card?.type === 'item' ? card.item : undefined, effect = ability?.effects[0]
    const hasOtherKeys = (value: object, allowed: string[]) => Object.entries(value).some(([key, item]) => !allowed.includes(key) && item !== undefined)
    const blackOne = (energy: EnergyCost | undefined) => energy?.black === 1 &&
      !Object.entries(energy).some(([key, value]) => key !== 'black' && (value ?? 0) !== 0)
    if (card?.type !== 'item' || card.name !== "Veteran Director's Sunglasses" || card.cardColor !== 'black' || card.energyColor !== 'black' ||
      card.keywords?.length !== 1 || !card.keywords.includes('arena') || !blackOne(ability?.cost.energy) || ability?.cost.discardHand !== 0 ||
      hasOtherKeys(ability?.cost ?? {}, ['energy', 'discardHand']) || hasOtherKeys(ability ?? {}, ['cost', 'text', 'effects']) || ability?.effects.length !== 1 ||
      effect?.kind !== 'inspect-deck' || effect.lookCount !== 4 || effect.pickCount !== 1 || effect.optionalPick !== true || effect.revealPicked !== true ||
      effect.filterColor !== 'black' || effect.filterKeyword !== 'arena' || effect.restDestination !== 'trash' ||
      (effect.side !== undefined && effect.side !== 'self') || (effect.pickDestination !== undefined && effect.pickDestination !== 'hand') ||
      hasOtherKeys(effect ?? {}, ['kind', 'lookCount', 'pickCount', 'optionalPick', 'revealPicked', 'filterColor', 'filterKeyword', 'restDestination', 'side', 'pickDestination'])) {
      blockers.push('BS12-103 lacks black Arena K1 Item, four own top cards, optional revealed black Arena card to hand or all unchosen cards to trash')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-102') {
    const card = evidence.card, ability = card?.type === 'stage' ? card.stageAbility : undefined
    const recovery = ability?.effects[0]
    const hasOtherKeys = (value: object, allowed: string[]) => Object.entries(value).some(([key, item]) => !allowed.includes(key) && item !== undefined)
    const blackOne = (energy: EnergyCost | undefined) => energy?.black === 1 &&
      !Object.entries(energy).some(([key, value]) => key !== 'black' && (value ?? 0) !== 0)
    if (card?.type !== 'stage' || card.name !== "Manager Scarlet's Coffee Truck" || card.cardColor !== 'black' || card.energyColor !== 'black' ||
      card.keywords?.length !== 1 || !card.keywords.includes('arena') ||
      !blackOne(ability?.placementCost) || !blackOne(ability?.cost.energy) || ability?.cost.discardHand !== 0 ||
      hasOtherKeys(ability?.cost ?? {}, ['energy', 'discardHand']) || ability?.restSource !== true ||
      hasOtherKeys(ability ?? {}, ['placementCost', 'cost', 'text', 'effects', 'restSource']) || ability?.effects.length !== 1 ||
      recovery?.kind !== 'trash-to-hand' || recovery.max !== 1 || recovery.cookieOnly !== true || recovery.keyword !== 'arena' || recovery.hasSpecialPlay !== true ||
      hasOtherKeys(recovery ?? {}, ['kind', 'max', 'cookieOnly', 'keyword', 'hasSpecialPlay'])) {
      blockers.push('BS12-102 lacks black Arena Stage, K placement, K plus source REST activation or up to one own trash Arena Cookie with Special Play recovery')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-101') {
    const card = evidence.card, then = card?.type === 'cookie' ? card.attackEffects?.[0] : undefined
    const draw = then?.kind === 'optional-cost-attack' ? then.effects[0] : undefined
    const cost = then?.kind === 'optional-cost-attack' ? then.cost : undefined
    const hasOtherKeys = (value: object, allowed: string[]) => Object.entries(value).some(([key, item]) => !allowed.includes(key) && item !== undefined)
    if (card?.type !== 'cookie' || card.name !== 'Chess Choco Cookie' || card.cardColor !== 'black' || card.energyColor !== 'black' ||
      card.level !== 1 || card.hp !== 2 || card.attack !== 1 || card.attackCost !== 1 || card.attackEnergyCost?.black !== 1 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'black' && (value ?? 0) !== 0) ||
      card.keywords?.length !== 1 || !card.keywords.includes('arena') || card.skill || card.flip || card.extraDeckOrigin || card.awakenHpBonus !== undefined ||
      card.attackEffects?.length !== 1 || then?.kind !== 'optional-cost-attack' || (then.resolution !== undefined && then.resolution !== 'attack') ||
      hasOtherKeys(then ?? {}, ['kind', 'cost', 'effects', 'effectText', 'resolution']) ||
      cost?.discardHand !== 1 || cost.discardHandType !== 'cookie' || cost.discardHandKeyword !== 'arena' ||
      Object.values(cost.energy ?? {}).some(value => (value ?? 0) !== 0) || hasOtherKeys(cost ?? {}, ['energy', 'discardHand', 'discardHandType', 'discardHandKeyword']) ||
      then.effects.length !== 1 || draw?.kind !== 'draw-up-to' || draw.max !== 1 || hasOtherKeys(draw ?? {}, ['kind', 'max'])) {
      blockers.push('BS12-101 lacks black Arena LV1 HP2, K1 ordinary one and optional one Arena Cookie hand discard before drawing up to one')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-100') {
    const card = evidence.card, skill = card?.type === 'cookie' ? card.skill : undefined
    const special = skill?.specialPlayCost, battle = special?.trashBattleCookie
    const flip = card?.type === 'cookie' ? card.flip : undefined, recovery = flip?.effects[0]
    const hasOtherKeys = (value: object, allowed: string[]) => Object.entries(value).some(([key, item]) => !allowed.includes(key) && item !== undefined)
    const free = (cost: AbilityCost | undefined) => cost?.discardHand === 0 && !Object.values(cost.energy ?? {}).some(value => (value ?? 0) !== 0)
    if (card?.type !== 'cookie' || card.name !== 'Strategist Cake Hound' || card.cardColor !== 'black' || card.energyColor !== 'black' ||
      card.level !== 1 || card.hp !== 1 || card.attack !== 2 || card.attackCost !== 2 || card.attackEnergyCost?.black !== 2 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'black' && (value ?? 0) !== 0) ||
      card.keywords?.length !== 1 || !card.keywords.includes('arena') || card.extraDeckOrigin || card.awakenHpBonus !== undefined || card.attackEffects?.length ||
      skill?.trigger !== 'passive' || skill.oncePerTurn || skill.yourTurn || skill.restSource || skill.effects.length ||
      skill.faint || skill.faintCost || skill.faintEffects?.length || skill.onPlayEffects?.length || skill.passiveEffects?.length || skill.friendlyFaintEffects?.length ||
      skill.afterDamage || skill.endPhase || skill.sourceEnergy || skill.fromBreakArea || skill.fromSupportArea || skill.fromTrashArea ||
      !free(skill.cost) || hasOtherKeys(skill.cost, ['energy', 'discardHand']) ||
      !free(special) || hasOtherKeys(special ?? {}, ['energy', 'discardHand', 'trashBattleCookie']) ||
      battle?.count !== 1 || battle.energyColor !== 'black' || battle.level !== 1 || hasOtherKeys(battle ?? {}, ['count', 'energyColor', 'level']) ||
      !free(flip?.cost) || hasOtherKeys(flip?.cost ?? {}, ['energy', 'discardHand']) ||
      hasOtherKeys(flip ?? {}, ['text', 'cost', 'effects']) || flip?.effects.length !== 1 ||
      recovery?.kind !== 'trash-to-hand' || recovery.max !== 1 || recovery.cookieOnly !== true || recovery.keyword !== 'arena' || recovery.hasSpecialPlay !== true ||
      hasOtherKeys(recovery ?? {}, ['kind', 'max', 'cookieOnly', 'keyword', 'hasSpecialPlay'])) {
      blockers.push('BS12-100 lacks black Arena LV1 HP1, black LV1 Special Play, KK ordinary two or free own trash Arena Cookie with Special Play recovery up to one')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-099') {
    const card = evidence.card, skill = card?.type === 'cookie' ? card.skill : undefined
    const recovery = skill?.effects[0]
    const hasOtherKeys = (value: object, allowed: string[]) => Object.entries(value).some(([key, item]) => !allowed.includes(key) && item !== undefined)
    if (card?.type !== 'cookie' || card.name !== 'Cake Hound' || card.cardColor !== 'black' || card.energyColor !== 'black' ||
      card.level !== 1 || card.hp !== 2 || card.attack !== 2 || card.attackCost !== 2 || card.attackEnergyCost?.black !== 2 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'black' && (value ?? 0) !== 0) ||
      card.keywords?.length !== 1 || !card.keywords.includes('arena') || card.flip || card.extraDeckOrigin || card.awakenHpBonus !== undefined || card.attackEffects?.length ||
      skill?.trigger !== 'passive' || skill.faint !== true || skill.oncePerTurn || skill.yourTurn || skill.restSource || skill.faintOptional ||
      skill.faintCost || skill.faintEffects?.length || skill.onPlayEffects?.length || skill.passiveEffects?.length || skill.friendlyFaintEffects?.length ||
      skill.afterDamage || skill.endPhase || skill.sourceEnergy || skill.specialPlayCost || skill.fromBreakArea || skill.fromSupportArea || skill.fromTrashArea ||
      skill.cost.discardHand !== 0 || Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      skill.cost.deckToTrash?.amount !== 3 || hasOtherKeys(skill.cost, ['energy', 'discardHand', 'deckToTrash']) ||
      hasOtherKeys(skill.cost.deckToTrash ?? {}, ['amount']) || skill.effects.length !== 1 ||
      recovery?.kind !== 'trash-to-hand' || recovery.max !== 1 || recovery.cookieOnly !== true || recovery.energyColor !== 'black' || recovery.keyword !== 'arena' ||
      hasOtherKeys(recovery ?? {}, ['kind', 'max', 'cookieOnly', 'energyColor', 'keyword'])) {
      blockers.push('BS12-099 lacks black Arena LV1 HP2, KK ordinary two or faint-only top-three cost before zero-to-one own trash black Arena Cookie recovery')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-098') {
    const card = evidence.card, skill = card?.type === 'cookie' ? card.skill : undefined
    const special = skill?.specialPlayCost, battle = special?.trashBattleCookie
    const flip = card?.type === 'cookie' ? card.flip : undefined, gain = flip?.effects[0]
    const field = gain?.kind === 'gain-hp' && gain.condition?.kind === 'battle-area-has-color' ? gain.condition : undefined
    const target = gain?.kind === 'gain-hp' ? gain.target : undefined
    if (card?.type !== 'cookie' || card.name !== 'Caramel Pudding Cake Hound' || card.cardColor !== 'black' || card.energyColor !== 'black' ||
      card.level !== 1 || card.hp !== 1 || card.attack !== 2 || card.attackCost !== 2 || card.attackEnergyCost?.black !== 2 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'black' && (value ?? 0) !== 0) ||
      card.keywords?.length !== 1 || !card.keywords.includes('arena') || card.extraDeckOrigin || card.attackEffects?.length ||
      skill?.trigger !== 'passive' || skill.oncePerTurn || skill.restSource || skill.yourTurn || skill.effects.length ||
      skill.faint || skill.faintEffects?.length || skill.onPlayEffects?.length || skill.passiveEffects?.length || skill.afterDamage || skill.endPhase || skill.sourceEnergy ||
      skill.cost.discardHand !== 0 || Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined) ||
      special?.discardHand !== 0 || Object.values(special?.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(special ?? {}).some(([key, value]) => !['energy', 'discardHand', 'trashBattleCookie'].includes(key) && value !== undefined) ||
      battle?.count !== 1 || battle.energyColor !== 'black' || battle.level !== 1 ||
      Object.entries(battle ?? {}).some(([key, value]) => !['count', 'energyColor', 'level'].includes(key) && value !== undefined) ||
      flip?.cost.discardHand !== 0 || Object.values(flip?.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(flip?.cost ?? {}).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined) ||
      Object.entries(flip ?? {}).some(([key, value]) => !['text', 'cost', 'effects'].includes(key) && value !== undefined) ||
      flip?.effects.length !== 1 || gain?.kind !== 'gain-hp' || gain.amount !== 1 ||
      Object.entries(gain ?? {}).some(([key, value]) => !['kind', 'amount', 'target', 'condition'].includes(key) && value !== undefined) ||
      target?.side !== 'self' || target.min !== 1 || target.max !== 1 || target.sourceOnly !== true || target.minLevel !== 2 ||
      Object.entries(target ?? {}).some(([key, value]) => !['side', 'min', 'max', 'sourceOnly', 'minLevel'].includes(key) && value !== undefined) ||
      field?.side !== 'self' || field.color !== 'black' || field.keyword !== 'arena' ||
      Object.entries(field ?? {}).some(([key, value]) => !['kind', 'side', 'color', 'keyword'].includes(key) && value !== undefined)) {
      blockers.push('BS12-098 lacks black Arena LV1 HP1, black LV1 Special Play, KK ordinary two or free fixed original LV2-or-higher HP bearer gain requiring one own black Arena battle Cookie')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-096') {
    const card = evidence.card, skill = card?.type === 'cookie' ? card.skill : undefined
    const special = skill?.specialPlayCost, battle = special?.trashBattleCookie
    const flip = card?.type === 'cookie' ? card.flip : undefined, draw = flip?.effects[0]
    const condition = draw?.kind === 'draw-up-to' && draw.condition?.kind === 'all-of' ? draw.condition : undefined
    const hand = condition?.conditions.find(c => c.kind === 'hand-count-at-most')
    const field = condition?.conditions.find(c => c.kind === 'battle-area-has-color')
    if (card?.type !== 'cookie' || card.name !== 'Crimson Danger Cake Hound' || card.cardColor !== 'black' || card.energyColor !== 'black' ||
      card.level !== 1 || card.hp !== 1 || card.attack !== 2 || card.attackCost !== 2 || card.attackEnergyCost?.black !== 2 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'black' && (value ?? 0) !== 0) ||
      card.keywords?.length !== 1 || !card.keywords.includes('arena') || card.extraDeckOrigin || card.attackEffects?.length ||
      skill?.trigger !== 'passive' || skill.oncePerTurn || skill.restSource || skill.yourTurn || skill.effects.length ||
      skill.faint || skill.faintEffects?.length || skill.onPlayEffects?.length || skill.passiveEffects?.length || skill.afterDamage || skill.endPhase || skill.sourceEnergy ||
      skill.cost.discardHand !== 0 || Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined) ||
      special?.discardHand !== 0 || Object.values(special?.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(special ?? {}).some(([key, value]) => !['energy', 'discardHand', 'trashBattleCookie'].includes(key) && value !== undefined) ||
      battle?.count !== 1 || battle.energyColor !== 'black' || battle.level !== 1 ||
      Object.entries(battle ?? {}).some(([key, value]) => !['count', 'energyColor', 'level'].includes(key) && value !== undefined) ||
      flip?.cost.discardHand !== 0 || Object.values(flip?.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(flip?.cost ?? {}).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined) ||
      Object.entries(flip ?? {}).some(([key, value]) => !['text', 'cost', 'effects'].includes(key) && value !== undefined) ||
      flip?.effects.length !== 1 || draw?.kind !== 'draw-up-to' || draw.max !== 2 || draw.untilHandSize !== undefined ||
      Object.entries(draw ?? {}).some(([key, value]) => !['kind', 'max', 'condition'].includes(key) && value !== undefined) ||
      !condition || condition.conditions.length !== 2 || Object.keys(condition).some(key => !['kind', 'conditions'].includes(key)) ||
      hand?.count !== 5 || Object.keys(hand ?? {}).some(key => !['kind', 'count'].includes(key)) ||
      field?.side !== 'self' || field.color !== 'black' || field.keyword !== 'arena' ||
      Object.entries(field ?? {}).some(([key, value]) => !['kind', 'side', 'color', 'keyword'].includes(key) && value !== undefined)) {
      blockers.push('BS12-096 lacks black Arena LV1 HP1, black LV1 Special Play, KK ordinary two or free draw up to two requiring both own hand at most five and one own black Arena battle Cookie')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-095') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const special = skill?.specialPlayCost
    const battle = special?.trashBattleCookie
    const flip = card?.type === 'cookie' ? card.flip : undefined
    const hp = flip?.effects[0]
    if (card?.type !== 'cookie' || card.name !== 'Blueberry Cake Hound' || card.cardColor !== 'black' || card.energyColor !== 'black' ||
      card.level !== 1 || card.hp !== 1 || card.attack !== 2 || card.attackCost !== 2 || card.attackEnergyCost?.black !== 2 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'black' && (value ?? 0) !== 0) ||
      card.keywords?.length !== 1 || !card.keywords.includes('arena') || card.extraDeckOrigin || card.attackEffects?.length ||
      skill?.trigger !== 'passive' || skill.oncePerTurn || skill.restSource || skill.yourTurn || skill.effects.length ||
      skill.faint || skill.faintEffects?.length || skill.onPlayEffects?.length || skill.passiveEffects?.length || skill.afterDamage || skill.endPhase || skill.sourceEnergy ||
      skill.cost.discardHand !== 0 || Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined) ||
      special?.discardHand !== 0 || Object.values(special?.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(special ?? {}).some(([key, value]) => !['energy', 'discardHand', 'trashBattleCookie'].includes(key) && value !== undefined) ||
      battle?.count !== 1 || battle.energyColor !== 'black' || battle.level !== 1 ||
      Object.entries(battle ?? {}).some(([key, value]) => !['count', 'energyColor', 'level'].includes(key) && value !== undefined) ||
      flip?.cost.discardHand !== 1 || Object.values(flip?.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(flip?.cost ?? {}).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined) ||
      (flip && 'condition' in flip && flip.condition !== undefined) || flip?.handCostDestination || flip?.effects.length !== 1 || hp?.kind !== 'gain-hp' || hp.amount !== 1 || hp.condition || !hp.target ||
      hp.target.side !== 'self' || hp.target.min !== 0 || hp.target.max !== 1 || hp.target.keyword !== 'arena' ||
      Object.entries(hp.target).some(([key, value]) => !['side', 'min', 'max', 'keyword'].includes(key) && value !== undefined)) {
      blockers.push('BS12-095 lacks black Arena LV1 HP1, independent black LV1 Special Play, KK ordinary two or paid zero-to-one own Arena HP FLIP')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-097') {
    const card = evidence.card
    if (card?.type !== 'cookie' || card.name !== 'Subtle Jasmine Cake Hound' || card.cardColor !== 'black' || card.energyColor !== 'black' ||
      card.level !== 1 || card.hp !== 2 || card.attack !== 1 || card.attackCost !== 1 || card.attackEnergyCost?.neutral !== 1 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'neutral' && (value ?? 0) !== 0) ||
      card.keywords?.length !== 1 || !card.keywords.includes('arena') || card.skill || card.flip || card.extraDeckOrigin ||
      card.effects?.length || card.attackEffects?.length) {
      blockers.push('BS12-097 lacks black Arena LV1 HP2, neutral-one ordinary one or invents an unprinted ability')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-094') {
    const card = evidence.card
    if (card?.type !== 'cookie' || card.name !== 'Butter Roll Cookie' || card.cardColor !== 'black' || card.energyColor !== 'black' ||
      card.level !== 3 || card.hp !== 4 || card.attack !== 4 || card.attackCost !== 3 || card.attackEnergyCost?.neutral !== 3 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'neutral' && (value ?? 0) !== 0) ||
      card.keywords?.length !== 1 || !card.keywords.includes('arena') || card.skill || card.flip || card.extraDeckOrigin ||
      card.effects?.length || card.attackEffects?.length) {
      blockers.push('BS12-094 lacks black Arena LV3 HP4, neutral-three ordinary four or invents an unprinted ability')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-093') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const redirect = skill?.effects[0]
    const then = card?.type === 'cookie' ? card.attackEffects?.[0] : undefined
    const bottom = then?.kind === 'optional-cost-attack' ? then.cost.trashToDeckBottom : undefined
    const damage = then?.kind === 'optional-cost-attack' ? then.effects[0] : undefined
    if (card?.type !== 'cookie' || card.name !== 'Rockstar Cookie' || card.level !== 2 || card.hp !== 4 || card.energyColor !== 'purple' ||
      card.keywords?.length !== 1 || !card.keywords.includes('arena') || card.attack !== 3 || card.attackCost !== 3 || card.attackEnergyCost?.purple !== 2 || card.attackEnergyCost?.neutral !== 1 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => !['purple', 'neutral'].includes(key) && (value ?? 0) !== 0) ||
      card.flip || card.attackEffects?.length !== 1 || skill?.trigger !== 'block' || skill.restSource || skill.oncePerTurn || skill.yourTurn || skill.faint || skill.faintEffects?.length || skill.faintCost ||
      skill.onPlayEffects?.length || skill.passiveEffects?.length || skill.sourceEnergy || skill.afterDamage || skill.endPhase || skill.oncePerGame || skill.battleOpponentAttackEffectPrevention ||
      skill.cost.discardHand !== 1 || skill.cost.discardHandColor !== 'purple' || skill.cost.discardHandKeyword !== 'arena' ||
      Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => !['energy', 'discardHand', 'discardHandColor', 'discardHandKeyword'].includes(key) && value !== undefined) ||
      skill.effects.length !== 1 || redirect?.kind !== 'redirect-attack' || redirect.condition !== undefined ||
      redirect.target?.side !== 'self' || redirect.target.min !== 1 || redirect.target.max !== 1 || redirect.target.sourceOnly !== true ||
      Object.entries(redirect.target).some(([key, value]) => !['side', 'min', 'max', 'sourceOnly'].includes(key) && value !== undefined) ||
      then?.kind !== 'optional-cost-attack' || then.mandatory || then.resolution || then.sourceEnergy || then.payBeforeCondition || then.effects.length !== 1 ||
      Object.values(then.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(then.cost).some(([key, value]) => !['energy', 'trashToDeckBottom'].includes(key) && value !== undefined) ||
      bottom?.count !== 2 || bottom.cookieOnly !== true || bottom.blockerOnly !== true ||
      Object.entries(bottom).some(([key, value]) => !['count', 'cookieOnly', 'blockerOnly'].includes(key) && value !== undefined) ||
      damage?.kind !== 'damage' || damage.amount !== 1 || damage.condition !== undefined ||
      Object.entries(damage).some(([key, value]) => !['kind', 'amount', 'target'].includes(key) && value !== undefined) ||
      damage.target.side !== 'opponent' || damage.target.min !== 0 || damage.target.max !== 1 ||
      Object.entries(damage.target).some(([key, value]) => !['side', 'min', 'max'].includes(key) && value !== undefined)) {
      blockers.push('BS12-093 lacks PPN ordinary three, purple Arena hand Blocker or optional ordered two own trash Blocker Cookie bottom cost before up-to-one opposing one damage')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-091') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const redirect = skill?.effects[0]
    const recover = skill?.faintEffects?.[0]
    if (card?.type !== 'cookie' || card.name !== 'Caramel Arrow Cookie' || card.level !== 1 || card.hp !== 2 || card.energyColor !== 'purple' ||
      !card.keywords?.includes('arena') || card.attack !== 2 || card.attackCost !== 2 || card.attackEnergyCost?.purple !== 1 || card.attackEnergyCost?.neutral !== 1 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => !['purple', 'neutral'].includes(key) && (value ?? 0) !== 0) ||
      card.flip || card.attackEffects?.length || skill?.trigger !== 'block' || skill.restSource || skill.oncePerTurn || skill.yourTurn || !skill.faint || skill.faintOptional ||
      skill.onPlayEffects?.length || skill.passiveEffects?.length || skill.sourceEnergy || skill.afterDamage || skill.endPhase || skill.oncePerGame || skill.battleOpponentAttackEffectPrevention ||
      skill.cost.discardHand !== 1 || skill.cost.discardHandColor !== 'purple' || skill.cost.discardHandKeyword !== 'arena' ||
      Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => !['energy', 'discardHand', 'discardHandColor', 'discardHandKeyword'].includes(key) && value !== undefined) ||
      skill.effects.length !== 1 || redirect?.kind !== 'redirect-attack' || redirect.condition !== undefined ||
      redirect.target?.side !== 'self' || redirect.target.min !== 1 || redirect.target.max !== 1 || redirect.target.sourceOnly !== true ||
      Object.entries(redirect.target).some(([key, value]) => !['side', 'min', 'max', 'sourceOnly'].includes(key) && value !== undefined) ||
      !skill.faintCost || Object.values(skill.faintCost.energy ?? {}).some(value => (value ?? 0) !== 0) || skill.faintCost.deckToTrash?.amount !== 3 ||
      Object.entries(skill.faintCost).some(([key, value]) => !['energy', 'deckToTrash'].includes(key) && value !== undefined) ||
      skill.faintEffects?.length !== 1 || recover?.kind !== 'trash-to-hand' || recover.max !== 1 || recover.cookieOnly !== true || recover.blockerOnly !== true ||
      recover.excludeCardName !== 'Caramel Arrow Cookie' ||
      Object.entries(recover).some(([key, value]) => !['kind', 'max', 'cookieOnly', 'blockerOnly', 'excludeCardName'].includes(key) && value !== undefined)) {
      blockers.push('BS12-091 lacks PN ordinary two, purple Arena hand Blocker or independent top-three faint cost before own trash other-name Blocker Cookie recovery')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-090') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const redirect = skill?.effects[0]
    const move = skill?.faintEffects?.[0]
    const condition = move && 'condition' in move ? move.condition : undefined
    if (card?.type !== 'cookie' || card.name !== 'Milky Way Cookie' || card.level !== 2 || card.hp !== 4 || card.energyColor !== 'purple' ||
      !card.keywords?.includes('arena') || card.attack !== 3 || card.attackCost !== 3 || card.attackEnergyCost?.purple !== 2 || card.attackEnergyCost?.neutral !== 1 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => !['purple', 'neutral'].includes(key) && (value ?? 0) !== 0) ||
      card.flip || card.attackEffects?.length || skill?.trigger !== 'block' || skill.restSource || skill.oncePerTurn || skill.yourTurn || !skill.faint || skill.faintOptional ||
      skill.onPlayEffects?.length || skill.passiveEffects?.length || skill.sourceEnergy || skill.afterDamage || skill.endPhase || skill.oncePerGame || skill.battleOpponentAttackEffectPrevention ||
      skill.cost.discardHand !== 1 || skill.cost.discardHandColor !== 'purple' || skill.cost.discardHandKeyword !== 'arena' ||
      Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => !['energy', 'discardHand', 'discardHandColor', 'discardHandKeyword'].includes(key) && value !== undefined) ||
      skill.effects.length !== 1 || redirect?.kind !== 'redirect-attack' || redirect.condition !== undefined ||
      redirect.target?.side !== 'self' || redirect.target.min !== 1 || redirect.target.max !== 1 || redirect.target.sourceOnly !== true ||
      Object.entries(redirect.target).some(([key, value]) => !['side', 'min', 'max', 'sourceOnly'].includes(key) && value !== undefined) ||
      !skill.faintCost || Object.values(skill.faintCost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.faintCost).some(([key, value]) => key !== 'energy' && value !== undefined) ||
      skill.faintEffects?.length !== 1 || move?.kind !== 'break-to-trash' || move.max !== 1 || move.exactLevel !== 1 ||
      Object.entries(move).some(([key, value]) => !['kind', 'max', 'exactLevel', 'condition'].includes(key) && value !== undefined) ||
      condition?.kind !== 'break-blocker-cookie-count-at-least' || condition.count !== 4 ||
      Object.entries(condition).some(([key, value]) => !['kind', 'count'].includes(key) && value !== undefined)) {
      blockers.push('BS12-090 lacks PPN ordinary three, purple Arena hand Blocker or free faint four-Blocker own Break LV1-to-trash selection')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-082') {
    const card = evidence.card
    const skill = card?.type === 'cookie' ? card.skill : undefined
    const tax = skill?.effects[0]
    if (card?.type !== 'cookie' || card.name !== 'DJ Cookie' || card.level !== 1 || card.hp !== 2 || card.energyColor !== 'purple' ||
      !card.keywords?.includes('arena') || card.attack !== 2 || card.attackCost !== 2 || card.attackEnergyCost?.purple !== 2 ||
      Object.entries(card.attackEnergyCost ?? {}).some(([key, value]) => key !== 'purple' && (value ?? 0) !== 0) ||
      card.flip || card.attackEffects?.length || skill?.trigger !== 'passive' || skill.restSource || skill.oncePerTurn || skill.yourTurn ||
      (skill.cost.discardHand ?? 0) !== 0 || Object.values(skill.cost.energy ?? {}).some(value => (value ?? 0) !== 0) ||
      Object.entries(skill.cost).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined) ||
      skill.effects.length !== 1 || tax?.kind !== 'require-item-activate-discard-hand' || tax.count !== 1 ||
      Object.entries(tax).some(([key, value]) => !['kind', 'count'].includes(key) && value !== undefined)) {
      blockers.push('BS12-082 lacks continuous battle-source opponent Item discard one and PP ordinary two without REST, Once or Your Turn')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-083') {
    const card = evidence.card
    const ability = card?.item
    const play = ability?.effects[0]
    if (card?.type !== 'item' || card.name !== 'Rock Spirit Guitar String' || card.energyColor !== 'purple' ||
      !card.keywords?.includes('arena') || ability?.cost.energy?.purple !== 1 ||
      Object.entries(ability.cost.energy ?? {}).some(([key, value]) => key !== 'purple' && (value ?? 0) !== 0) ||
      (ability.cost.discardHand ?? 0) !== 0 ||
      Object.entries(ability.cost).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined) ||
      ability.effects.length !== 1 || play?.kind !== 'trash-to-battle' || play.amount !== 1 || !play.optional || !play.blockerOnly ||
      Object.entries(play).some(([key, value]) => !['kind', 'amount', 'optional', 'blockerOnly'].includes(key) && value !== undefined)) {
      blockers.push('BS12-083 lacks P1 Item playing zero-to-one own trash Blocker Cookie without added restrictions')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-084') {
    const card = evidence.card
    const ability = card?.stageAbility
    const discard = ability?.effects[0]
    const bottom = ability?.cost.trashToDeckBottom
    if (card?.type !== 'stage' || card.name !== 'Summer Soda Festival' || card.energyColor !== 'purple' || !card.keywords?.includes('arena') ||
      ability?.placementCost.purple !== 1 || Object.entries(ability.placementCost).some(([key, value]) => key !== 'purple' && (value ?? 0) !== 0) ||
      ability.cost.energy?.purple !== 1 || Object.entries(ability.cost.energy ?? {}).some(([key, value]) => key !== 'purple' && (value ?? 0) !== 0) ||
      (ability.cost.discardHand ?? 0) !== 0 || Object.entries(ability.cost).some(([key, value]) => !['energy', 'discardHand', 'trashToDeckBottom'].includes(key) && value !== undefined) ||
      bottom?.count !== 2 || !bottom.cookieOnly || !bottom.blockerOnly || Object.entries(bottom).some(([key, value]) => !['count', 'cookieOnly', 'blockerOnly'].includes(key) && value !== undefined) ||
      !ability.restSource || ability.oncePerTurn || ability.endPhase || ability.triggered || !ability.allowInactiveConditionalEffects ||
      ability.effects.length !== 1 || discard?.kind !== 'opponent-discard-hand' || discard.count !== 1 ||
      discard.condition?.kind !== 'opponent-hand-count-at-least' || discard.condition.count !== 6 ||
      Object.entries(discard).some(([key, value]) => !['kind', 'count', 'condition'].includes(key) && value !== undefined)) {
      blockers.push('BS12-084 lacks independent P placement and P REST two trash Blockers in chosen bottom order before six-hand opponent discard')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-085') {
    const card = evidence.card
    const ability = card?.item
    const shuffle = ability?.effects[0]
    const condition = shuffle?.kind === 'trash-to-deck-all' ? shuffle.condition : undefined
    if (card?.type !== 'item' || card.name !== 'Rainbow Headphones' || card.energyColor !== 'purple' || !card.keywords?.includes('arena') ||
      ability?.cost.energy?.purple !== 1 || Object.entries(ability.cost.energy ?? {}).some(([key, value]) => key !== 'purple' && (value ?? 0) !== 0) ||
      (ability.cost.discardHand ?? 0) !== 0 || Object.entries(ability.cost).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined) ||
      ability.allowInactiveConditionalEffects !== true || ability.effects.length !== 1 ||
      shuffle?.kind !== 'trash-to-deck-all' || shuffle.side !== 'self' ||
      Object.entries(shuffle).some(([key, value]) => !['kind', 'side', 'condition'].includes(key) && value !== undefined) ||
      condition?.kind !== 'trash-blocker-cookie-count-at-least' || condition.count !== 5 ||
      Object.entries(condition).some(([key, value]) => !['kind', 'count'].includes(key) && value !== undefined)) {
      blockers.push('BS12-085 lacks P1 then five own trash Blocker Cookies before shuffling every own trash card')
    }
  }
  if (clauses.some((clause) => clause.role === 'unsupported')) blockers.push('source contains unclassified clause')
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-086') {
    const card = evidence.card
    const trap = card?.trap
    const effect = trap?.effects[0]
    const selector = effect?.kind === 'modify-attack' ? effect.target : undefined
    if (card?.type !== 'trap' || card.name !== 'True Rock Spirit' || card.energyColor !== 'purple' || !card.keywords?.includes('arena') ||
      trap?.cost.energy?.purple !== 1 || Object.entries(trap.cost.energy ?? {}).some(([key, value]) => key !== 'purple' && (value ?? 0) !== 0) ||
      (trap.cost.discardHand ?? 0) !== 0 || Object.entries(trap.cost).some(([key, value]) => !['energy', 'discardHand'].includes(key) && value !== undefined) ||
      trap.condition !== undefined || trap.effects.length !== 1 ||
      Object.entries(trap).some(([key, value]) => !['cost', 'effects', 'text', 'condition'].includes(key) && value !== undefined) ||
      effect?.kind !== 'modify-attack' || effect.amount !== 2 || effect.duration !== 'own-next-turn' ||
      Object.entries(effect).some(([key, value]) => !['kind', 'amount', 'duration', 'target'].includes(key) && value !== undefined) ||
      selector?.side !== 'self' || selector.min !== 0 || selector.max !== 1 || selector.blockerOnly !== true ||
      Object.entries(selector).some(([key, value]) => !['side', 'min', 'max', 'blockerOnly'].includes(key) && value !== undefined)) {
      blockers.push('BS12-086 lacks P1 and optional own printed Blocker +2 attack through own next turn end')
    }
  }
  if ((record.baseCardNumber || record.cardNumber.split('@')[0]) === 'BS12-087') {
    const card = evidence.card
    const trap = card?.trap
    const first = trap?.effects[0]
    const then = first?.kind === 'modify-attack' ? first.thenEffects?.[0] : undefined
    const condition = then?.kind === 'modify-attack' ? then.condition : undefined
    const hasOtherKeys = (value: object, allowed: string[]) => Object.entries(value).some(([key, item]) => !allowed.includes(key) && item !== undefined)
    if (card?.type !== 'trap' || card.name !== 'Coming To An Understanding' || card.energyColor !== 'purple' || !card.keywords?.includes('arena') ||
      trap?.cost.energy?.purple !== 2 || Object.entries(trap.cost.energy ?? {}).some(([key, value]) => key !== 'purple' && (value ?? 0) !== 0) ||
      (trap.cost.discardHand ?? 0) !== 0 || hasOtherKeys(trap.cost, ['energy', 'discardHand']) ||
      trap.condition !== undefined || trap.effects.length !== 1 || hasOtherKeys(trap, ['cost', 'effects', 'text', 'condition']) ||
      first?.kind !== 'modify-attack' || first.amount !== -2 || first.duration !== 'this-turn' ||
      hasOtherKeys(first, ['kind', 'amount', 'duration', 'target', 'thenEffects']) ||
      first.target.side !== 'opponent' || first.target.min !== 0 || first.target.max !== 1 || hasOtherKeys(first.target, ['side', 'min', 'max']) ||
      first.thenEffects?.length !== 1 || then?.kind !== 'modify-attack' || then.amount !== -1 || then.duration !== 'this-turn' ||
      hasOtherKeys(then, ['kind', 'amount', 'duration', 'target', 'condition']) ||
      then.target.side !== 'opponent' || then.target.min !== 0 || then.target.max !== 1 || then.target.previousEffectTargetOnly !== true ||
      hasOtherKeys(then.target, ['side', 'min', 'max', 'previousEffectTargetOnly']) ||
      condition?.kind !== 'trash-keyword-count-at-least' || condition.keyword !== 'arena' || condition.count !== 10 ||
      hasOtherKeys(condition, ['kind', 'keyword', 'count'])) {
      blockers.push('BS12-087 lacks PP optional opponent this-turn -2 then same target -1 for ten own trash Arena cards')
    }
  }
  const runtimeArrays = {
    targetSelectors: [] as Partial<EffectTargetSelector>[],
    energyCosts: [] as EnergyCost[],
    abilityCostKeys: new Set<string>(),
  }
  collectRuntime(evidence.card, { effectKinds: new Set<string>(), ...runtimeArrays })
  if (evidence.extraDeckPlayCost) {
    collectCostEvidence(
      evidence.extraDeckPlayCost as unknown as Record<string, unknown>,
      { effectKinds: new Set<string>(), ...runtimeArrays },
    )
  }
  if (
    payments.length > 0 &&
    runtimeArrays.energyCosts.length === 0 &&
    !evidence.skill?.sourceEnergy &&
    !evidence.ability?.sourceEnergy
  ) {
    blockers.push('payment clause has no runtime energy evidence')
  }
  const thenCount = clauses.filter((clause) => clause.role === 'then').length
  if (
    thenCount > 0 &&
    !hasRuntimeThenEffects(evidence) &&
    !hasRuntimeConditionalStep(evidence) &&
    flattenRuntimeEffects(evidence).length < 2
  ) {
    blockers.push('Then clause has no runtime thenEffects evidence')
  }
  const runtimeTiming: ContractTiming['runtime'] = {
    ...(evidence.skill?.trigger ? { trigger: evidence.skill.trigger } : {}),
    ...(evidence.skill?.oncePerTurn !== undefined ? { oncePerTurn: evidence.skill.oncePerTurn } : {}),
    ...(evidence.skill?.yourTurn !== undefined ? { yourTurn: evidence.skill.yourTurn } : {}),
  }
  if (timingMarkers.has('mob') || timingMarkers.has('ap')) {
    if (evidence.skill === undefined && evidence.ability === undefined) blockers.push('timing marker has no runtime ability')
  }
  if (
    timingMarkers.has('t1') &&
    (evidence.skill?.oncePerTurn ?? evidence.ability?.oncePerTurn) !== true
  ) {
    blockers.push('once-per-turn marker missing runtime flag')
  }
  if (timingMarkers.has('mt') && evidence.skill?.yourTurn !== true) blockers.push('your-turn marker missing runtime flag')
  return {
    schemaVersion: 1,
    cardId: record.cardNumber,
    baseCardId: record.baseCardNumber,
    sourceHash: hashSource(record),
    source: { cardNumber: record.cardNumber, type: record.type, segments },
    timing: { markers: [...timingMarkers].sort(), runtime: runtimeTiming },
    clauses,
    payments,
    costs,
    targets,
    steps,
    status:
      blockers.length > 0
        ? evidence.unsupportedReason
          ? 'blocked'
          : 'needs-review'
        : 'verified',
    blockers,
  }
}

const isRuntimeExtraCard = (card: GameCard | ExtraDeckCard): card is ExtraDeckCard => card.type === 'extra' || card.type === 'awakened'

export const analyzeOfficialCardBehavior = (
  record: OfficialCardRecord,
  runtimeCard?: GameCard | ExtraDeckCard | null,
): CardBehaviorAudit => {
  // 契約必須稽核「runtime 實際消費的來源」：轉換邊界的正規化（例如
  // BS4-080@2 欄位併寫、BS6 傷害 errata）發生在 adapter 內，若契約仍以
  // 原始記錄建立子句，這些已修正的來源就永遠找不到 runtime evidence。
  const normalized = normalizeOfficialCardRecord(record)
  const conversion = runtimeCard === undefined && normalized.type !== 'extra'
    ? convertOfficialCardToGameCard(normalized)
    : null
  const runtimeExtra = runtimeCard && isRuntimeExtraCard(runtimeCard) ? runtimeCard : undefined
  const extraConversion = runtimeExtra ? { status: 'converted' as const, extraDeckCard: runtimeExtra } : runtimeCard === undefined && normalized.type === 'extra'
    ? convertOfficialCardToExtraDeckCard(normalized)
    : null
  const card = runtimeCard === undefined
    ? conversion?.status === 'converted'
      ? conversion.gameCard
      : extraConversion?.status === 'converted'
        ? materializeExtraDeckCookie(extraConversion.extraDeckCard)
        : null
      : runtimeCard === null ? null : isRuntimeExtraCard(runtimeCard)
        ? materializeExtraDeckCookie(runtimeCard)
        : runtimeCard
  const extraDeckPlayCost = extraConversion?.status === 'converted'
    ? extraConversion.extraDeckCard.extraDeckPlayCost
    : undefined
  const evidence: RuntimeCardEvidence = {
    ...runtimeEvidenceFromCard(card),
    ...(extraDeckPlayCost ? { extraDeckPlayCost } : {}),
    ...(extraConversion?.status === 'converted' ? {
      extraDeckPlayMode: extraConversion.extraDeckCard.extraDeckPlayMode,
      extraDeckPlayRequirement: extraConversion.extraDeckCard.playRequirement,
    } : {}),
    unsupportedReason:
      conversion?.status === 'unsupported'
        ? conversion.reason
        : extraConversion?.status === 'unsupported'
          ? extraConversion.reason
          : undefined,
  }
  const contract = buildContract(normalized, evidence)
  const runtime = {
    effectKinds: [] as string[],
    targetSelectors: [] as Partial<EffectTargetSelector>[],
    energyCosts: [] as EnergyCost[],
    abilityCostKeys: [] as string[],
    timing: undefined as ContractTiming['runtime'],
  }
  const sets = {
    effectKinds: new Set<string>(),
    targetSelectors: runtime.targetSelectors,
    energyCosts: runtime.energyCosts,
    abilityCostKeys: new Set<string>(),
  }
  collectRuntime(card, sets)
  if (evidence.extraDeckPlayCost) {
    collectCostEvidence(
      evidence.extraDeckPlayCost as unknown as Record<string, unknown>,
      sets,
    )
  }
  runtime.effectKinds = [...sets.effectKinds].sort()
  runtime.abilityCostKeys = [...sets.abilityCostKeys].sort()
  runtime.timing = contract.timing.runtime
  const paymentCovered = contract.payments.every((payment) =>
    runtime.energyCosts.some((energy) => energyMatches(payment.energy, energy)) ||
      (payment.kind === 'source-energy' &&
        Boolean(evidence.skill?.sourceEnergy ?? evidence.ability?.sourceEnergy)),
  )
  const costCovered = contract.costs.every((cost) => {
    if (cost.kind === 'unknown') return false
    if (cost.kind === 'energy') return runtime.energyCosts.length > 0
    if (cost.kind === 'reveal-deck-bottom') return flattenRuntimeEffects(evidence).some(effect => effect.kind === 'reveal-bottom-deck' && effect.requireCard === true)
    const keys = new Set(runtime.abilityCostKeys)
    const kinds = new Set(runtime.effectKinds)
    if (cost.kind === 'ready-cookie' || (cost.kind === 'rest-cookie' && keys.has('battleCookiePosition'))) {
      const selections = [evidence.skill?.cost?.battleCookiePosition, evidence.ability?.cost?.battleCookiePosition,
        ...flattenRuntimeEffects(evidence).flatMap(effect => effect.kind === 'optional-cost-attack' ? [effect.cost.battleCookiePosition] : [])]
      return selections.some(selection => selection?.position === (cost.kind === 'ready-cookie' ? 'active' : 'rested') && selection.count === cost.amount)
    }
    if (cost.kind === 'discard-hand') {
      return keys.has('discardHand') || keys.has('discardAllHand') || kinds.has('discard-hand')
    }
    if (cost.kind === 'support-to-trash') return keys.has('supportToTrash') || kinds.has('support-to-trash')
    if (cost.kind === 'hp-to-trash') return keys.has('hpToTrash') || kinds.has('hp-to-trash')
    if (cost.kind === 'hp-to-hand') return keys.has('hpToHand') || kinds.has('hp-to-hand')
    if (cost.kind === 'battle-to-trash') return keys.has('trashBattleCookie') || kinds.has('battle-to-trash')
    if (cost.kind === 'battle-to-break' || cost.kind === 'faint') {
      return keys.has('trashBattleCookie') || (cost.kind === 'battle-to-break' && keys.has('cookieToBreakArea')) || kinds.has('battle-to-break')
    }
    if (cost.kind === 'hand-to-break') {
      return keys.has('handToBreakArea') || keys.has('cookieToBreakArea') || kinds.has('hand-to-break')
    }
    if (cost.kind === 'battle-to-hand') {
      return keys.has('battleCookieToHand') || kinds.has('battle-to-hand') || kinds.has('return-to-hand')
    }
    if (cost.kind === 'support-to-hand') {
      return keys.has('supportToHand') || kinds.has('support-to-hand')
    }
    if (cost.kind === 'deck-to-trash') {
      return keys.has('deckToTrash') || kinds.has('deck-to-trash')
    }
    if (cost.kind === 'trash-to-break') {
      return (
        // P-082 models「place 1 Cookie … from your trash into your break
        // area」as the trap's alternative cost key.
        keys.has('trashCookieToBreakArea') || kinds.has('trash-to-break')
      )
    }
    if (cost.kind === 'trash-to-deck') {
      return keys.has('trashToDeck') || kinds.has('trash-to-deck')
    }
    if (cost.kind === 'trash-to-deck-bottom') {
      return keys.has('trashToDeckBottom') || kinds.has('trash-to-deck-bottom')
    }
    if (cost.kind === 'self-to-trash') {
      return (
        flattenRuntimeEffects(evidence).some(effect => effect.kind === 'reveal-bottom-deck' && effect.playMatchedAfterSourceTrash === true) ||
        keys.has('selfToTrash') ||
        keys.has('stageSourceToTrash') ||
        // The adapter represents a self-trash payment as the generic
        // battle-cookie trash key when the source is the attacking Cookie.
        keys.has('trashBattleCookie') ||
        kinds.has('self-to-trash') ||
        // Stage cards model「Place this card in the trash.」as the
        // `stage-source-to-trash` effect instead of an AbilityCost key
        // (BS2-081).
        kinds.has('stage-source-to-trash')
      )
    }
    if (cost.kind === 'self-to-break') {
      return (
        keys.has('selfToBreakArea') ||
        keys.has('selfToFaint') ||
        kinds.has('self-to-break')
      )
    }
    if (cost.kind === 'rest-source') {
      return evidence.skill?.restSource === true || evidence.ability?.restSource === true
    }
    return [
      'move',
      'trash-to-battle',
      'break-to-battle',
      'break-to-hand',
      'hand-to-battle',
      'hand-to-break',
      'support-to-hand',
      'support-to-support',
      'hand-to-support',
      'trash-to-support',
      'trash-to-hand',
      'battle-to-deck-bottom',
      'field-to-deck-bottom',
      'self-to-deck-bottom',
      'return-to-deck-bottom',
      'stage-source-to-deck',
      'break-to-trash',
      'break-source-to-trash',
      'hand-to-deck-bottom',
      'place-source-to-support',
      'rest-cookie',
      'battle-to-hand',
      'hp-to-hand',
      'return-to-hand',
      'trash-to-break',
      'reveal-hand',
      'deck-to-trash',
    ].some((kind) => kinds.has(kind))
      || [
        'battleToDeckBottom',
        'selfToDeckBottom',
        'handToDeckBottom',
        'breakToTrash',
      ].some((key) => keys.has(key))
  })
  const targetCovered = contract.targets.every((target) =>
    target.unresolved !== undefined
      ? false
      : runtime.targetSelectors.some((selector) => selectorMatches(target.selector, selector)),
  )
  const resolutionOrderCovered = coversResolutionOrder(contract, evidence)
  const timingCovered = contract.timing.markers.every((marker) => {
    if (marker === 't1') {
      return (evidence.skill?.oncePerTurn ?? evidence.ability?.oncePerTurn) === true
    }
    if (marker === 'mt') return evidence.skill?.yourTurn === true
    if (marker === 'mob' || marker === 'ap') return evidence.skill !== undefined || evidence.ability !== undefined
    if (marker === 'bl') return evidence.skill?.trigger === 'block'
    return true
  })
  const errors = [...contract.blockers]
  if (!paymentCovered) errors.push('payment evidence missing')
  if (!costCovered) errors.push('cost evidence missing')
  if (!targetCovered) errors.push('target evidence unresolved')
  if (!resolutionOrderCovered) errors.push('resolution order evidence missing')
  if (!timingCovered) errors.push('timing evidence missing')
  if (errors.length > 0 && contract.status === 'verified') {
    contract.status = 'needs-review'
    contract.blockers = [...new Set(errors)]
  }
  return {
    contract,
    runtime,
    checks: {
      sourceHashStable: contract.sourceHash === hashSource(normalized),
      paymentCovered,
      costCovered,
      targetCovered,
      resolutionOrderCovered,
      timingCovered,
    },
    errors: [...new Set(errors)],
  }
}
