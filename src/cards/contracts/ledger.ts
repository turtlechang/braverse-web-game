import { createHash } from 'node:crypto'
import type {
  CardEffect,
  EnergyCost,
  EffectTargetSelector,
  GameCard,
} from '../../game'
import { convertOfficialCardToGameCard } from '../official-card-adapter'
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
  [/\b(?:draw|reveal|inspect|look at)\b/i, 'effect'],
  [/\b(?:deal|receives?|gains?|damage|attack)\b|\{da\}/i, 'effect'],
  [/\b(?:play|place|return|move|put|take|trash|discard|rest|set)\b/i, 'effect'],
  [/\b(?:if|when|while|as long as|whenever)\b/i, 'condition'],
  [/\bselect\b/i, 'target'],
]

const normalizeWhitespace = (text: string): string =>
  text.replace(/\s+/g, ' ').trim()

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

const TIMING_MARKERS = new Set(['mob', 'ap', 't1', 'mt', 'bl'])

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
  ] as const) {
    if (expected[key] !== undefined && actual[key] !== expected[key]) return false
  }
  return true
}

const runtimeSelectorForEffect = (
  record: Record<string, unknown>,
): Partial<EffectTargetSelector> | null => {
  if (typeof record.kind !== 'string') return null
  const amount = typeof record.amount === 'number' ? record.amount : undefined
  const optional = record.optional === true
  const movementKinds = new Set([
    'trash-to-battle',
    'break-to-battle',
    'support-to-battle',
    'hand-to-battle',
    'trash-to-break',
    'break-to-trash',
    'support-to-hand',
    'support-to-support',
    'hand-to-support',
    'trash-to-support',
    'trash-to-hand',
    'flip-to-support',
  ])
  if (!movementKinds.has(record.kind)) return null
  return {
    side: 'self',
    ...(amount !== undefined ? { min: optional ? 0 : amount, max: amount } : {}),
    ...(typeof record.energyColor === 'string'
      ? { energyColor: record.energyColor as EffectTargetSelector['energyColor'] }
      : {}),
    ...(typeof record.maxLevel === 'number' ? { maxLevel: record.maxLevel } : {}),
    ...(typeof record.exactLevel === 'number'
      ? { minLevel: record.exactLevel, maxLevel: record.exactLevel }
      : {}),
  }
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
    if (/^\{[RYGBPKN]\}(?:\s*\{[RYGBPKN]\})*$/i.test(inner)) {
      addClause(clauses, source, match[0], 'payment', start, end, 'exact')
      payments.push({ kind: 'energy', energy, clauseIds: [clauseId] })
      continue
    }
    if (/can be used as\s+\{[RYGBPKN]\}/i.test(inner)) {
      addClause(clauses, source, match[0], 'payment', start, end, 'pattern')
      payments.push({ kind: 'source-energy', energy, clauseIds: [clauseId] })
      continue
    }
    const discard = inner.match(/discard\s+(\d+)\s+card/i)
    const supportTrash = inner.match(/place\s+(\d+)\s+cards?\s+from\s+your\s+support/i)
    const hpTrash = inner.match(/place\s+(\d+)\s+cards?\s+from\s+the\s+top\s+of\s+(?:your\s+)?(?:\{[RYGBPK]\}\s+)?cookie's\s+hp/i)
    const battleTrash = inner.match(/place\s+(\d+)\s+.*cookie.*battle\s+area.*trash/i)
    if (discard || supportTrash || hpTrash || battleTrash) {
      const kind = discard
        ? 'discard-hand'
        : supportTrash
          ? 'support-to-trash'
          : hpTrash
            ? 'hp-to-trash'
            : 'battle-to-trash'
      addClause(clauses, source, match[0], 'cost', start, end, 'pattern')
      costs.push({
        kind,
        amount: Number((discard ?? supportTrash ?? hpTrash ?? battleTrash)?.[1]),
        clauseIds: [clauseId],
      })
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
): ContractTarget[] => {
  const targets: ContractTarget[] = []
  const structuredRanges: Array<{ start: number; end: number }> = []
  const re = /select\s+(up\s+to\s+)?(\d+)\s+(?:of\s+)?(your opponent's|your|either player's)([^.]*?)(?:cookies?|cards?)/gi
  for (const match of text.matchAll(re)) {
    const min = match[1] ? 0 : Number(match[2])
    const max = Number(match[2])
    const sideText = match[3].toLowerCase()
    const side = sideText.includes('opponent')
      ? 'opponent'
      : sideText.includes('either')
        ? 'either'
        : 'self'
    const clauseId = `${source}-${clauses.length + 1}`
    const start = match.index ?? 0
    structuredRanges.push({ start, end: start + match[0].length })
    addClause(clauses, source, match[0], 'target', start, start + match[0].length, 'pattern')
    targets.push({ selector: { side, min, max }, clauseIds: [clauseId] })
  }
  // Any remaining Select / play-from-zone phrase is still a player choice.
  // Do not silently treat it as an untargeted effect when no safe selector
  // grammar exists; the contract must stop at needs-review instead.
  const unresolvedSelection = /\bselect\b[^.]+(?:\.|$)/gi
  for (const match of text.matchAll(unresolvedSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    if (/\bfrom\s+(?:your|the)\s+(?:trash|break\s+area|support\s+area|hand|deck)/i.test(match[0])) continue
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'unknown')
    targets.push({
      selector: {},
      clauseIds: [clauseId],
      unresolved: 'selection phrase has no safe selector mapping',
    })
  }
  const unresolvedZoneSelection = /\b(?:play|place|return|take|put)\s+(?:up\s+to\s+)?\d+\b[^.]*\bfrom\s+(?:your|the)\s+(?:trash|break\s+area|support\s+area|hand|deck)/gi
  for (const match of text.matchAll(unresolvedZoneSelection)) {
    const start = match.index ?? 0
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
  const stripped = text.replace(/(?:<|《)[^>》]+(?:>|》)/g, '')
  for (const sentence of stripped.split(/(?<=[.!?])\s+|;\s+|\bThen,?\s*/i)) {
    const normalized = normalizeWhitespace(sentence)
    if (!normalized) continue
    const match = ACTION_PATTERNS.find(([pattern]) => pattern.test(normalized))
    if (match) {
      if (match[1] === 'target') continue
      const role = /\bthen\b/i.test(normalized) ? 'then' : match[1]
      addClause(clauses, source, normalized, role, 0, text.length, 'pattern')
    } else {
      // Cookie attack names are printed between the payment and `{da}` marker.
      // They are display labels, not an omitted rule clause; the damage marker
      // above already supplies the executable attack evidence.
      if (source === 'attack' && /\{da\}|\bdeals?\s+\d+\s+damage\b/i.test(text)) continue
      addClause(clauses, source, normalized, 'unsupported', 0, text.length, 'unknown')
    }
  }
  if (/\bthen\b/i.test(text)) {
    addClause(clauses, source, 'Then', 'then', text.toLowerCase().indexOf('then'), text.length, 'exact')
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
  if (typeof record.kind === 'string') {
    result.effectKinds.add(record.kind)
    if (record.target && typeof record.target === 'object') {
      result.targetSelectors.push(record.target as Partial<EffectTargetSelector>)
    }
    const movementSelector = runtimeSelectorForEffect(record)
    if (movementSelector) result.targetSelectors.push(movementSelector)
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
  for (const [key, child] of Object.entries(record)) {
    if (
      key === 'kind' ||
      key === 'target' ||
      key === 'energyCost' ||
      key === 'attackEnergyCost' ||
      key === 'sourceEnergy'
    ) continue
    if (key === 'cost' && child && typeof child === 'object') {
      const cost = child as Record<string, unknown>
      Object.keys(cost).forEach((costKey) => result.abilityCostKeys.add(costKey))
      if (cost.energy && typeof cost.energy === 'object') {
        result.energyCosts.push(cost.energy as EnergyCost)
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
          yourTurn: card.skill.yourTurn,
          cost: card.skill.cost,
          sourceEnergy: card.skill.sourceEnergy,
          effects: card.skill.effects,
        }
      : undefined,
    attackEffects: card.type === 'cookie' ? card.attackEffects : undefined,
    flip: card.flip ? { cost: card.flip.cost, effects: card.flip.effects } : undefined,
    ability: card.item
      ? { cost: card.item.cost, effects: card.item.effects }
      : card.stageAbility
        ? { cost: card.stageAbility.cost, effects: card.stageAbility.effects }
        : card.trap
          ? { cost: card.trap.cost, effects: card.trap.effects }
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
  visit(evidence.attackEffects)
  visit(evidence.flip?.effects)
  visit(evidence.ability?.effects)
  return result
}

const hasRuntimeThenEffects = (evidence: RuntimeCardEvidence): boolean => {
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
  flattenRuntimeEffects(evidence).some((effect) => 'condition' in effect)

const effectKindsForClause = (clause: CardClauseFragment): string[] => {
  const text = clause.text.toLowerCase()
  const kinds: string[] = []
  if (/damage|deal|receives/.test(text)) kinds.push('damage', 'damage-all')
  if (/draw/.test(text)) kinds.push('draw', 'draw-up-to')
  if (/discard/.test(text)) kinds.push('discard-hand', 'opponent-discard-hand')
  if (/rest/.test(text)) kinds.push('rest-cookie', 'rest-support')
  if (/play|place|put|return|move|take/.test(text)) kinds.push('move')
  return kinds
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
    const parsed = parseOfficialCardText(text)
    if (!parsed) continue
    parsed.markers
      .filter((marker) => TIMING_MARKERS.has(marker))
      .forEach((marker) => {
        timingMarkers.add(marker)
        addClause(clauses, source, `{${marker}}`, 'timing', 0, text.length, 'exact')
      })
    const bracket = bracketClauses(source, text, clauses)
    payments.push(...bracket.payments)
    costs.push(...bracket.costs)
    targets.push(...targetClauses(source, text, clauses))
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
  const steps: ContractResolutionStep[] = []
  let order = 0
  for (const clause of clauses.filter((item) => item.role === 'effect' || item.role === 'then')) {
    steps.push({
      order: order++,
      role: clause.role === 'then' ? 'then' : 'effect',
      clauseIds: [clause.id],
      runtimeKinds: effectKindsForClause(clause).filter((kind) => runtime.effectKinds.has(kind)),
    })
  }
  const blockers: string[] = []
  if (evidence.unsupportedReason) blockers.push(`runtime:${evidence.unsupportedReason}`)
  if (clauses.some((clause) => clause.role === 'unsupported')) blockers.push('source contains unclassified clause')
  const runtimeArrays = {
    targetSelectors: [] as Partial<EffectTargetSelector>[],
    energyCosts: [] as EnergyCost[],
    abilityCostKeys: new Set<string>(),
  }
  collectRuntime(evidence.card, { effectKinds: new Set<string>(), ...runtimeArrays })
  if (payments.length > 0 && runtimeArrays.energyCosts.length === 0 && !evidence.skill?.sourceEnergy) {
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
  if (timingMarkers.has('t1') && evidence.skill?.oncePerTurn !== true) blockers.push('once-per-turn marker missing runtime flag')
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
    status: blockers.length > 0 ? (evidence.unsupportedReason ? 'blocked' : 'needs-review') : 'verified',
    blockers,
  }
}

export const analyzeOfficialCardBehavior = (
  record: OfficialCardRecord,
  runtimeCard?: GameCard | null,
): CardBehaviorAudit => {
  const conversion = runtimeCard === undefined ? convertOfficialCardToGameCard(record) : null
  const card = runtimeCard === undefined && conversion?.status === 'converted' ? conversion.gameCard : runtimeCard ?? null
  const evidence: RuntimeCardEvidence = {
    ...runtimeEvidenceFromCard(card),
    unsupportedReason: conversion?.status === 'unsupported' ? conversion.reason : undefined,
  }
  const contract = buildContract(record, evidence)
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
  runtime.effectKinds = [...sets.effectKinds].sort()
  runtime.abilityCostKeys = [...sets.abilityCostKeys].sort()
  runtime.timing = contract.timing.runtime
  const paymentCovered = contract.payments.every((payment) =>
    runtime.energyCosts.some((energy) => energyMatches(payment.energy, energy)) ||
      (payment.kind === 'source-energy' && Boolean(evidence.skill?.sourceEnergy)),
  )
  const costCovered = contract.costs.every((cost) => {
    if (cost.kind === 'unknown') return false
    if (cost.kind === 'energy') return runtime.energyCosts.length > 0
    const keys = new Set(runtime.abilityCostKeys)
    const kinds = new Set(runtime.effectKinds)
    if (cost.kind === 'discard-hand') return keys.has('discardHand') || kinds.has('discard-hand')
    if (cost.kind === 'support-to-trash') return keys.has('supportToTrash') || kinds.has('support-to-trash')
    if (cost.kind === 'hp-to-trash') return keys.has('hpToTrash') || kinds.has('hp-to-trash')
    if (cost.kind === 'battle-to-trash') return keys.has('trashBattleCookie') || kinds.has('battle-to-trash')
    return kinds.has('move')
  })
  const targetCovered = contract.targets.every((target) =>
    target.unresolved !== undefined
      ? false
      : runtime.targetSelectors.some((selector) => selectorMatches(target.selector, selector)),
  )
  const runtimeEffects = flattenRuntimeEffects(evidence)
  const resolutionOrderCovered =
    !contract.clauses.some((clause) => clause.role === 'then') ||
    hasRuntimeThenEffects(evidence) ||
    hasRuntimeConditionalStep(evidence) ||
    runtimeEffects.length >= 2
  const timingCovered = contract.timing.markers.every((marker) => {
    if (marker === 't1') return evidence.skill?.oncePerTurn === true
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
      sourceHashStable: contract.sourceHash === hashSource(record),
      paymentCovered,
      costCovered,
      targetCovered,
      resolutionOrderCovered,
      timingCovered,
    },
    errors: [...new Set(errors)],
  }
}
