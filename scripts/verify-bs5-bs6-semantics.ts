import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCard } from '../src/game/starter-deck'
import { parseOfficialCardText } from '../src/cards/official-text-parser'
import { normalizeOfficialCardRecord } from '../src/cards/official-card-adapter'
import type { OfficialCardRecord } from '../src/cards/types'
import type {
  AbilityCost,
  CardEffect,
  EnergyCost,
  GameCard,
} from '../src/game/types'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const series = (process.argv[2] ?? 'bs5').toLowerCase()
if (series !== 'bs5' && series !== 'bs6') {
  throw new Error(`usage: verify-bs5-bs6-semantics.ts <bs5|bs6>`)
}

interface SemanticIssue {
  cardNumber: string
  field: string
  official: string
  runtime: string
}

const issues: SemanticIssue[] = []
let checked = 0

const ENERGY_COLORS = new Set([
  'red',
  'yellow',
  'green',
  'blue',
  'purple',
  'black',
  'neutral',
])

const ENERGY_SYMBOL_MAP: Record<string, string> = {
  R: 'red',
  Y: 'yellow',
  G: 'green',
  B: 'blue',
  P: 'purple',
  K: 'black',
  N: 'neutral',
}

/** 合併 AbilityCost 的頂層顏色鍵與 `energy` 子物件。 */
const abilityEnergy = (cost: AbilityCost | EnergyCost | undefined): EnergyCost => {
  if (!cost) return {}
  const merged: EnergyCost = {}
  if ('energy' in cost && cost.energy) Object.assign(merged, cost.energy)
  for (const [key, value] of Object.entries(cost)) {
    if (ENERGY_COLORS.has(key) && typeof value === 'number' && value > 0) {
      merged[key as keyof EnergyCost] = value
    }
  }
  return merged
}

const energyToText = (cost: Partial<Record<string, number>> | undefined) =>
  cost
    ? Object.entries(cost)
        .filter(([, amount]) => (amount ?? 0) > 0)
        .map(([color, amount]) => `${color}:${amount}`)
        .sort()
        .join(',')
    : ''

const hasDamageEffect = (effects: CardEffect[] | undefined, amount: number) =>
  Boolean(
    effects?.some((effect) => {
      if (effect.kind === 'damage-by-break-count' && 'perCount' in effect) {
        return effect.perCount === amount
      }
      if (
        (effect.kind === 'damage' || effect.kind === 'damage-all') &&
        'amount' in effect
      ) {
        return effect.amount === amount
      }
      return false
    }),
  )

/** 包含 optional-cost-attack 內層 effects 的完整效果集合。 */
const flattenEffects = (effects: CardEffect[] | undefined): CardEffect[] => {
  if (!effects) return []
  return effects.flatMap((effect) =>
    effect.kind === 'optional-cost-attack' && 'effects' in effect
      ? [effect, ...(effect.effects ?? [])]
      : [effect],
  )
}

const hasModifyAttackEffect = (
  effects: CardEffect[] | undefined,
  amount: number,
) =>
  Boolean(
    flattenEffects(effects).some(
      (effect) =>
        effect.kind === 'modify-attack' &&
        'amount' in effect &&
        effect.amount === amount,
    ),
  )

const hasDrawUpToEffect = (effects: CardEffect[] | undefined, max: number) =>
  Boolean(
    flattenEffects(effects).some(
      (effect) =>
        (effect.kind === 'draw-up-to' && 'max' in effect && effect.max === max) ||
        (effect.kind === 'draw-up-to-then-discard' &&
          'max' in effect &&
          effect.max === max) ||
        (effect.kind === 'draw-up-to-break-cookie-count' &&
          'amountPerCookie' in effect &&
          effect.amountPerCookie === max),
    ),
  )

const hasDrawEffect = (effects: CardEffect[] | undefined, count: number) =>
  Boolean(
    flattenEffects(effects).some(
      (effect) =>
        effect.kind === 'draw' &&
        'amount' in effect &&
        effect.amount === count,
    ),
  )

const hasHpToTrashEffect = (effects: CardEffect[] | undefined, amount: number) =>
  Boolean(
    effects?.some(
      (effect) =>
        effect.kind === 'hp-to-trash' &&
        'amount' in effect &&
        (effect.amount ?? 1) === amount,
    ),
  )

const check = (
  cardNumber: string,
  field: string,
  official: string,
  runtime: string,
  pass: boolean,
) => {
  checked += 1
  if (!pass) {
    issues.push({ cardNumber, field, official, runtime })
  }
}

const source = JSON.parse(
  await readFile(
    resolve(root, `data/cards/official-age-of-heroes-and-kingdoms-${series}.en.json`),
    'utf8',
  ),
)
const cards = source.cards as OfficialCardRecord[]

for (const record of cards) {
  const cardNumber = record.cardNumber
  const runtime: GameCard = createCard(record, 'player-one', 1)
  // 以 adapter 正規化後的文字為準（例如 BS6-074 官方 API {da} 1 → 實體卡 3）。
  const official = normalizeOfficialCardRecord(record)

  // --- Attack text: energy cost + {da} damage -----------------------------
  if (
    official.type === 'cookie' &&
    official.attackText &&
    official.attackText.trim() &&
    runtime.type === 'cookie'
  ) {
    const parsed = parseOfficialCardText(official.attackText)
    if (!parsed) continue
    if (parsed.totalCost > 0) {
      const runtimeText = energyToText(runtime.attackEnergyCost)
      const officialText = energyToText(parsed.cost)
      check(
        cardNumber,
        'attack-energy-cost',
        `${officialText} (${parsed.totalCost})`,
        `${runtimeText} (${runtime.attackCost})`,
        runtimeText === officialText && runtime.attackCost === parsed.totalCost,
      )
    }
    if (parsed.damage !== null) {
      check(
        cardNumber,
        'attack-damage',
        `${parsed.damage}`,
        `${runtime.attack}`,
        runtime.attack === parsed.damage,
      )
    }
  }

  // --- Attack Then damage amounts -----------------------------------------
  if (
    official.type === 'cookie' &&
    /Then/i.test(official.attackText ?? '') &&
    runtime.type === 'cookie'
  ) {
    const thenText = official.attackText!.split(/\bThen\b/i).slice(1).join(' ')
    const amounts = [
      ...thenText.matchAll(/(?:Deals?|receives?)\s+(\d+)\s+damage/gi),
    ].map((match) => Number(match[1]))
    const thenEffects = flattenEffects(runtime.attackEffects)
    if (amounts.length > 0 && thenEffects.length === 0) {
      issues.push({
        cardNumber,
        field: 'attack-then-effects',
        official: `Then damage ${amounts.join('+')}`,
        runtime: 'no attackEffects',
      })
    } else {
      for (const amount of amounts) {
        check(
          cardNumber,
          'attack-then-damage',
          `${amount}`,
          thenEffects
            .filter((e) =>
              ['damage', 'damage-all', 'damage-by-break-count'].includes(e.kind),
            )
            .map((e) =>
              'perCount' in e ? e.perCount : 'amount' in e ? e.amount : '?',
            )
            .join(','),
          hasDamageEffect(thenEffects, amount),
        )
      }
    }
  }

  // --- Skill surface ------------------------------------------------------
  const skill = runtime.skill
  if (official.skill?.text?.trim() && skill) {
    const parsed = parseOfficialCardText(official.skill.text)
    if (parsed) {
      const runtimeText = energyToText(abilityEnergy(skill.cost))
      const officialText = energyToText(parsed.cost)
      if (parsed.totalCost > 0) {
        check(
          cardNumber,
          'skill-energy-cost',
          `${officialText} (${parsed.totalCost})`,
          `${runtimeText}`,
          runtimeText === officialText,
        )
      }

      // HP-to-trash COST: only when wrapped in a `<...>` cost marker.
      const costSection = (official.skill.text.match(/<([^<>]*)>/g) ?? [])
        .join(' ')
      const hpTrashCostMatch = costSection.match(
        /Place\s+(\d+)\s+cards?\s+from the top of\s+(?:(?:1 of|your)\s+\{([RYGBPK])\}\s+)?[^<>]*?HP into the trash/i,
      )
      if (hpTrashCostMatch) {
        const amount = Number(hpTrashCostMatch[1])
        const symbol = hpTrashCostMatch[2]
        const color = symbol ? ENERGY_SYMBOL_MAP[symbol] : undefined
        const runtimeHpTrash = skill.cost?.hpToTrash
        check(
          cardNumber,
          'skill-hp-to-trash-cost',
          `amount=${amount}${color ? ` color=${color}` : ''}`,
          runtimeHpTrash
            ? `amount=${runtimeHpTrash.amount ?? 1}${runtimeHpTrash.energyColor ? ` color=${runtimeHpTrash.energyColor}` : ''}`
            : 'none',
          Boolean(
            runtimeHpTrash &&
              (runtimeHpTrash.amount ?? 1) === amount &&
              (!color || runtimeHpTrash.energyColor === color),
          ),
        )
      } else {
        // Not a cost marker: it must be an effect then (e.g. end-phase
        // "place 1 card from the top of this Cookie's HP into the trash").
        const hpTrashEffectMatch = official.skill.text.match(
          /Place\s+(\d+)\s+cards?\s+from the top of[^<>]*?HP into the trash/i,
        )
        if (hpTrashEffectMatch) {
          const amount = Number(hpTrashEffectMatch[1])
          const allEffects = flattenEffects([
            ...(runtime.effects ?? []),
            ...skill.effects,
          ])
          check(
            cardNumber,
            'skill-hp-to-trash-effect',
            `${amount}`,
            allEffects
              .filter((e) => e.kind === 'hp-to-trash')
              .map((e) => ('amount' in e ? (e.amount ?? 1) : '?'))
              .join(','),
            hasHpToTrashEffect(allEffects, amount),
          )
        }
      }

      // Discard N cards: 只有包在 <...> 代價標記內才算技能代價；
      // 其他位置的 discard 是效果（例如 draw-up-to-then-discard）。
      const skillCostSection = (official.skill.text.match(/<([^<>]*)>/g) ?? [])
        .join(' ')
      const discardCostMatch = skillCostSection.match(
        /[Dd]iscard\s+(\d+)\s+cards?/,
      )
      if (discardCostMatch) {
        const amount = Number(discardCostMatch[1])
        check(
          cardNumber,
          'skill-discard-hand',
          `${amount}`,
          `${skill.cost?.discardHand ?? 0}`,
          (skill.cost?.discardHand ?? 0) === amount,
        )
      }

      // Damage phrases.
      const damageAmounts = [
        ...official.skill.text.matchAll(
          /(?:Deals?|receives?)\s+(\d+)\s+damage/gi,
        ),
      ].map((match) => Number(match[1]))
      const allEffects = flattenEffects([
        ...(runtime.effects ?? []),
        ...skill.effects,
      ])
      for (const amount of damageAmounts) {
        check(
          cardNumber,
          'skill-damage',
          `${amount}`,
          allEffects
            .filter((e) =>
              ['damage', 'damage-all', 'damage-by-break-count'].includes(e.kind),
            )
            .map((e) => ('perCount' in e ? e.perCount : 'amount' in e ? e.amount : '?'))
            .join(','),
          hasDamageEffect(allEffects, amount),
        )
      }

      // Gain +N attack.
      const gainMatch = official.skill.text.match(/gains?\s+\+(\d+)\s+attack/i)
      if (gainMatch) {
        const amount = Number(gainMatch[1])
        check(
          cardNumber,
          'skill-modify-attack',
          `${amount}`,
          allEffects
            .filter((e) => e.kind === 'modify-attack')
            .map((e) => ('amount' in e ? e.amount : '?'))
            .join(','),
          hasModifyAttackEffect(allEffects, amount),
        )
      }

      // Draw up to N / Draw N cards.
      const drawUpToMatch = official.skill.text.match(/[Dd]raw up to (\d+)/)
      if (drawUpToMatch) {
        const max = Number(drawUpToMatch[1])
        check(
          cardNumber,
          'skill-draw-up-to',
          `${max}`,
          allEffects
            .filter((e) =>
              ['draw-up-to', 'draw-up-to-then-discard', 'draw-up-to-break-cookie-count'].includes(
                e.kind,
              ),
            )
            .map((e) =>
              'max' in e ? e.max : 'amountPerCookie' in e ? e.amountPerCookie : '?',
            )
            .join(','),
          hasDrawUpToEffect(allEffects, max),
        )
      }
      const drawMatch = official.skill.text.match(/[Dd]raw (\d+) cards?/)
      if (drawMatch) {
        const count = Number(drawMatch[1])
        check(
          cardNumber,
          'skill-draw',
          `${count}`,
          allEffects
            .filter((e) => e.kind === 'draw')
            .map((e) => ('amount' in e ? e.amount : '?'))
            .join(','),
          hasDrawEffect(allEffects, count),
        )
      }
    }
  }

  // --- Non-cookie abilities (trap / item / stage): cost from attackText ----
  if (
    (official.type === 'trap' || official.type === 'item' || official.type === 'stage') &&
    official.attackText?.trim()
  ) {
    const parsed = parseOfficialCardText(official.attackText)
    if (parsed && parsed.totalCost > 0) {
      const ability = runtime.trap ?? runtime.item ?? runtime.stageAbility
      const runtimeText =
        official.type === 'stage'
          ? energyToText(ability?.placementCost)
          : energyToText(abilityEnergy(ability?.cost))
      const officialText = energyToText(parsed.cost)
      check(
        cardNumber,
        `${official.type}-energy-cost`,
        `${officialText} (${parsed.totalCost})`,
        `${runtimeText || 'empty'}`,
        runtimeText === officialText,
      )
    }
    if (parsed) {
      const damageAmounts = [
        ...official.attackText.matchAll(
          /(?:Deals?|receives?)\s+(\d+)\s+damage/gi,
        ),
      ].map((match) => Number(match[1]))
      const abilityEffects = flattenEffects([
        ...(runtime.trap?.effects ?? []),
        ...(runtime.item?.effects ?? []),
        ...(runtime.stageAbility?.effects ?? []),
        ...(runtime.effects ?? []),
      ])
      for (const amount of damageAmounts) {
        check(
          cardNumber,
          `${official.type}-damage`,
          `${amount}`,
          abilityEffects
            .filter((e) =>
              ['damage', 'damage-all', 'damage-by-break-count'].includes(e.kind),
            )
            .map((e) => ('perCount' in e ? e.perCount : 'amount' in e ? e.amount : '?'))
            .join(','),
          hasDamageEffect(abilityEffects, amount),
        )
      }
    }
  }

  // --- FLIP ability --------------------------------------------------------
  if ((official.flipText ?? official.skill?.text)?.trim() && runtime.flip) {
    const flipText = official.flipText ?? official.skill?.text ?? ''
    const parsed = parseOfficialCardText(flipText)
    if (parsed && parsed.totalCost > 0) {
      const runtimeText = energyToText(abilityEnergy(runtime.flip.cost))
      const officialText = energyToText(parsed.cost)
      check(
        cardNumber,
        'flip-energy-cost',
        `${officialText} (${parsed.totalCost})`,
        `${runtimeText || 'empty'}`,
        runtimeText === officialText,
      )
    }
    const drawUpToMatch = flipText.match(/[Dd]raw up to (\d+)/)
    if (drawUpToMatch) {
      const max = Number(drawUpToMatch[1])
      check(
        cardNumber,
        'flip-draw-up-to',
        `${max}`,
        runtime.flip.effects
          .filter((e) => e.kind === 'draw-up-to')
          .map((e) => ('max' in e ? e.max : '?'))
          .join(','),
        hasDrawUpToEffect(runtime.flip.effects, max),
      )
    }
  }
}

const byCard = new Map<string, SemanticIssue[]>()
for (const issue of issues) {
  const list = byCard.get(issue.cardNumber) ?? []
  list.push(issue)
  byCard.set(issue.cardNumber, list)
}

const report = {
  generatedAt: new Date().toISOString(),
  series: series.toUpperCase(),
  source: `data/cards/official-age-of-heroes-and-kingdoms-${series}.en.json`,
  summary: {
    records: cards.length,
    checks: checked,
    issues: issues.length,
    cardsWithIssues: byCard.size,
  },
  issues: [...byCard.entries()].map(([cardNumber, list]) => ({
    cardNumber,
    issues: list,
  })),
}

const outputPath = resolve(
  root,
  `docs/${series}-semantic-cost-audit-2026-08-15.json`,
)
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(
  `${series.toUpperCase()}: ${report.summary.records} records, ${report.summary.checks} checks, ${report.summary.issues} issues across ${report.summary.cardsWithIssues} cards`,
)
if (issues.length > 0) {
  for (const issue of issues) {
    console.log(
      `  ${issue.cardNumber} [${issue.field}] official=${issue.official} runtime=${issue.runtime}`,
    )
  }
  process.exitCode = 1
}
console.log(`Evidence: ${outputPath}`)
