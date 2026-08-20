import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  convertOfficialCardToGameCard,
  normalizeOfficialCardRecord,
} from '../src/cards/official-card-adapter'
import {
  convertOfficialAttackEffects,
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
  convertOfficialFlipAbility,
  convertOfficialItemAbility,
  convertOfficialStageAbility,
  convertOfficialTrapAbility,
} from '../src/cards/official-effect-adapter'
import type { CardEffect, GameCard } from '../src/game'
import type { OfficialCardRecord } from '../src/cards/types'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'docs/bs5-bs6-card-text-effects-code-map.md')

const seriesSources = {
  BS5: {
    path: 'data/cards/official-age-of-heroes-and-kingdoms-bs5.en.json',
    label: 'BS5',
  },
  BS6: {
    path: 'data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json',
    label: 'BS6',
  },
} as const

type Series = keyof typeof seriesSources

interface OfficialDataset {
  schemaVersion: number
  source: {
    provider: string
    pageUrl: string
    datasetUrl: string
    fetchedAt: string
    totalAvailable: number
    matchedAvailable: number
    importedCount: number
  }
  cards: OfficialCardRecord[]
}

interface SourceFile {
  path: string
  lines: string[]
}

const adapterPaths = [
  'src/cards/official-card-adapter.ts',
  'src/cards/official-effect-adapter.ts',
  'src/cards/official-effect-adapter-bs5.test.ts',
  'src/cards/official-effect-adapter-bs6.test.ts',
  'src/game/skills.ts',
  'src/game/battle.ts',
  'src/game/commands.ts',
  'src/game/turn.ts',
  'src/game/effects/execute.ts',
  'src/game/effects/pending.ts',
]

const readSourceFiles = async (): Promise<SourceFile[]> =>
  Promise.all(
    adapterPaths.map(async (path) => ({
      path,
      lines: (await readFile(resolve(root, path), 'utf8')).split(/\r?\n/),
    })),
  )

const sourceFile = (files: SourceFile[], path: string): SourceFile =>
  files.find((file) => file.path === path)!

const lineNumbersContaining = (file: SourceFile, value: string): number[] =>
  file.lines
    .map((line, index) => (line.includes(value) ? index + 1 : null))
    .filter((line): line is number => line !== null)

const firstExportLine = (file: SourceFile, declaration: string): number =>
  lineNumbersContaining(file, `export const ${declaration}`)[0] ?? 0

const oneLine = (value: string | null | undefined): string =>
  value?.replace(/\s+/g, ' ').trim() || '—'

const inline = (value: string): string => value.replaceAll('`', "'")

const json = (value: unknown): string =>
  `\`${inline(JSON.stringify(value))}\``

const jsonOrDash = (value: unknown): string =>
  value === undefined || value === null ? '—' : json(value)

const effectKinds = (effects: unknown): string[] => {
  const kinds = new Set<string>()
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return
    for (const item of value) {
      if (!item || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      if (typeof record.kind === 'string') kinds.add(record.kind)
      visit(record.effects)
      if (Array.isArray(record.modes)) {
        for (const mode of record.modes) {
          if (mode && typeof mode === 'object') {
            visit((mode as Record<string, unknown>).effects)
          }
        }
      }
    }
  }
  visit(effects)
  return [...kinds].sort()
}

const effectRows = (effects: CardEffect[] | undefined): string[] => {
  if (!effects || effects.length === 0) return ['  - 無 runtime effect（純文字／數值／時機或無效果文字）。']
  return effects.flatMap((effect, index) => [
    `  - ${index + 1}. \`${effect.kind}\`：${json(effect)}`,
  ])
}

const gameCardEffects = (gameCard: GameCard | undefined): CardEffect[] => {
  if (!gameCard) return []
  if (gameCard.type === 'cookie') return gameCard.skill?.effects ?? []
  if (gameCard.type === 'item') return gameCard.item?.effects ?? []
  if (gameCard.type === 'stage') return gameCard.stageAbility?.effects ?? []
  if (gameCard.type === 'trap') return gameCard.trap?.effects ?? []
  return gameCard.flip?.effects ?? []
}

const conversionLabel = (card: OfficialCardRecord): string => {
  const normalized = normalizeOfficialCardRecord(card)
  const conversion = convertOfficialCardToGameCard(card)
  const primary = convertOfficialCardEffects(normalized)
  const attack = convertOfficialAttackEffects(normalized)
  const ability =
    card.type === 'cookie'
      ? convertOfficialCookieSkill(normalized)
      : card.type === 'flip'
        ? convertOfficialFlipAbility(normalized)
        : card.type === 'item'
          ? convertOfficialItemAbility(normalized)
          : card.type === 'stage'
            ? convertOfficialStageAbility(normalized)
            : card.type === 'trap'
              ? convertOfficialTrapAbility(normalized)
              : undefined
  const primaryText =
    primary.status === 'supported'
      ? '通用 CardEffect 已轉接'
      : primary.reason === 'no-effect-text'
        ? '無主效果文字（通常為僅攻擊文字）'
        : '通用 CardEffect 未直接轉接；請看專用 adapter'
  const abilityText = card.type === 'cookie' || card.type === 'flip'
    ? card.skill.text || card.flipText
      ? ability
        ? '能力已轉接'
        : '能力待查'
      : '無能力文字'
    : card.skill.text || card.attackText
      ? ability
        ? '專用能力 adapter 已轉接'
        : '專用能力 adapter 待查'
      : '無能力文字'
  const attackText = /\bThen\b/i.test(normalized.attackText ?? '')
    ? attack
      ? 'Attack Then 已轉接'
      : 'Attack Then 待查'
    : '無 Attack Then'
  const status = conversion.status === 'converted'
    ? 'GameCard converted'
    : `GameCard unsupported：${conversion.reason}`
  return `${status}；Primary：${primaryText}；Ability：${abilityText}；${attackText}`
}

const adapterFunctionRefs = (
  files: SourceFile[],
  card: OfficialCardRecord,
): string[] => {
  const adapter = sourceFile(files, 'src/cards/official-effect-adapter.ts')
  const cardAdapter = sourceFile(files, 'src/cards/official-card-adapter.ts')
  const refs: string[] = []
  const addFunction = (path: string, declaration: string) => {
    const line = firstExportLine(sourceFile(files, path), declaration)
    if (line > 0) refs.push(`\`${path}:${line}\` (${declaration})`)
  }

  addFunction('src/cards/official-card-adapter.ts', 'convertOfficialCardToGameCard')
  addFunction('src/cards/official-card-adapter.ts', 'normalizeOfficialCardRecord')
  addFunction('src/cards/official-effect-adapter.ts', 'convertOfficialCardEffects')
  if (card.type === 'cookie') addFunction('src/cards/official-effect-adapter.ts', 'convertOfficialCookieSkill')
  if (card.type === 'flip') addFunction('src/cards/official-effect-adapter.ts', 'convertOfficialFlipAbility')
  if (card.type === 'item') addFunction('src/cards/official-effect-adapter.ts', 'convertOfficialItemAbility')
  if (card.type === 'stage') addFunction('src/cards/official-effect-adapter.ts', 'convertOfficialStageAbility')
  if (card.type === 'trap') addFunction('src/cards/official-effect-adapter.ts', 'convertOfficialTrapAbility')
  if (card.type === 'cookie' || card.type === 'flip') {
    addFunction('src/cards/official-effect-adapter.ts', 'convertOfficialAttackEffects')
  }

  const exactLines = [
    ...lineNumbersContaining(adapter, `'${card.cardNumber}'`),
    ...lineNumbersContaining(adapter, `'${card.baseCardNumber}'`),
  ]
  const uniqueExactLines = [...new Set(exactLines)].sort((left, right) => left - right)
  if (uniqueExactLines.length > 0) {
    refs.push(
      `卡號專用 mapping：${uniqueExactLines.slice(0, 8).map((line) => `\`src/cards/official-effect-adapter.ts:${line}\``).join('、')}`,
    )
  }

  const normalizationLines = [
    ...lineNumbersContaining(cardAdapter, card.cardNumber),
    ...lineNumbersContaining(cardAdapter, card.baseCardNumber),
  ]
  const uniqueNormalizationLines = [...new Set(normalizationLines)].sort((left, right) => left - right)
  if (uniqueNormalizationLines.length > 0) {
    refs.push(
      `資料正規化／官方欄位修正：${uniqueNormalizationLines.slice(0, 6).map((line) => `\`src/cards/official-card-adapter.ts:${line}\``).join('、')}`,
    )
  }

  return refs
}

const runtimeFunctionRefs = (files: SourceFile[], card: OfficialCardRecord, effects: CardEffect[]): string[] => {
  const refs: string[] = []
  const add = (path: string, line: number, label: string) => refs.push(`\`${path}:${line}\` (${label})`)

  if (card.type === 'cookie') {
    add('src/game/skills.ts', 683, 'canActivateCookieSkill')
    add('src/game/skills.ts', 898, 'activateCookieSkill')
  }
  if (card.type === 'flip') add('src/game/battle.ts', 2568, 'resolveFlip')
  if (card.type === 'item') add('src/game/commands.ts', 2096, 'play-item command')
  if (card.type === 'stage') {
    add('src/game/commands.ts', 2173, 'play-stage command')
    add('src/game/turn.ts', 209, 'stage end-phase processing')
  }
  if (card.type === 'trap') {
    add('src/game/battle.ts', 927, 'playTrap')
    add('src/game/battle.ts', 1191, 'trap effect queue')
  }
  if (card.type === 'cookie' || card.type === 'flip') {
    add('src/game/battle.ts', 1830, 'advanceAttackEffect')
    add('src/game/battle.ts', 2077, 'resolveAttackEffect')
  }
  add('src/game/effects/execute.ts', 336, 'executeCardEffect')

  const effectFile = sourceFile(files, 'src/game/effects/execute.ts')
  const battleFile = sourceFile(files, 'src/game/battle.ts')
  const commandFile = sourceFile(files, 'src/game/commands.ts')
  const kindRefs = effectKinds(effects).flatMap((kind) => {
    const pattern = `effect.kind === '${kind}'`
    const matches = [
      ...lineNumbersContaining(effectFile, pattern).map((line) => ({ path: effectFile.path, line })),
      ...lineNumbersContaining(battleFile, pattern).map((line) => ({ path: battleFile.path, line })),
      ...lineNumbersContaining(commandFile, pattern).map((line) => ({ path: commandFile.path, line })),
    ]
    const match = matches[0]
    return match
      ? [`effect kind \`${kind}\`：\`${match.path}:${match.line}\``]
      : []
  })
  refs.push(...kindRefs.slice(0, 10))
  return [...new Set(refs)]
}

const testRefs = (files: SourceFile[], card: OfficialCardRecord): string[] => {
  const refs: string[] = []
  for (const file of files.filter((candidate) => candidate.path.includes('official-effect-adapter-bs'))) {
    const lines = lineNumbersContaining(file, card.cardNumber)
    if (lines.length > 0) refs.push(`\`${file.path}:${lines[0]}\``)
  }
  return refs
}

const renderCard = (files: SourceFile[], sourcePath: string, card: OfficialCardRecord, variant: boolean): string[] => {
  const normalized = normalizeOfficialCardRecord(card)
  const conversion = convertOfficialCardToGameCard(card)
  const gameCard = conversion.status === 'converted' ? conversion.gameCard : undefined
  const skill = convertOfficialCookieSkill(normalized)
  const flip = convertOfficialFlipAbility(normalized)
  const item = convertOfficialItemAbility(normalized)
  const stage = convertOfficialStageAbility(normalized)
  const trap = convertOfficialTrapAbility(normalized)
  const attack = convertOfficialAttackEffects(normalized)
  const effectSet = gameCardEffects(gameCard)
  const title = variant
    ? `${card.cardNumber}｜${card.name}（base ${card.baseCardNumber}）`
    : `${card.cardNumber}｜${card.name}${card.cardNumber === card.baseCardNumber ? '' : `（base ${card.baseCardNumber}；代表卡）`}`
  const lines = [
    `### ${title}`,
    `- 類型／顏色／等級／HP：${card.type}／${card.color ?? '—'}／${card.level ?? '—'}／${card.hp ?? '—'}`,
    `- 官方資料：\`${sourcePath}\`；產品：${oneLine(card.product.title)}；限制：${card.restrictions.banned ? 'Banned' : card.restrictions.limited ? 'Limited' : '無'}`,
    '- 官方卡面文字：',
    `  - Skill name：\`${inline(oneLine(card.skill.name))}\``,
    `  - Skill text：\`${inline(oneLine(card.skill.text))}\``,
    `  - Attack text：\`${inline(oneLine(card.attackText))}\``,
    `  - FLIP text：\`${inline(oneLine(card.flipText))}\``,
  ]
  if (JSON.stringify(normalized) !== JSON.stringify(card)) {
    lines.push(
      `- runtime 正規化後文字：Skill=\`${inline(oneLine(normalized.skill.text))}\`；Attack=\`${inline(oneLine(normalized.attackText))}\`；FLIP=\`${inline(oneLine(normalized.flipText))}\`。`,
    )
  }
  lines.push(`- 轉接狀態：${conversionLabel(card)}`)
  lines.push('- runtime 效果：')
  if (skill) {
    lines.push(`  - Cookie skill：trigger=${skill.trigger}；oncePerTurn=${skill.oncePerTurn}；yourTurn=${skill.yourTurn}；cost=${json(skill.cost)}；flags=${json({ restSource: skill.restSource, faint: skill.faint, endPhase: skill.endPhase, afterDamage: skill.afterDamage, oncePerGame: skill.oncePerGame, fromBreakArea: skill.fromBreakArea, fromTrashArea: skill.fromTrashArea, fromSupportArea: skill.fromSupportArea })}`)
    lines.push(...effectRows(skill.effects))
  } else if (flip) {
    lines.push(`  - FLIP：cost=${json(flip.cost)}；attachedHpBonus=${flip.attachedHpBonus ?? '—'}`)
    lines.push(...effectRows(flip.effects))
  } else if (item) {
    lines.push(`  - Item：cost=${json(item.cost)}${item.activationCostOverride ? `；activationCostOverride=${json(item.activationCostOverride)}` : ''}`)
    lines.push(...effectRows(item.effects))
  } else if (stage) {
    lines.push(`  - Stage：placementCost=${json(stage.placementCost)}；activationCost=${json(stage.cost)}；restSource=${stage.restSource}；endPhase=${stage.endPhase ?? false}${stage.specialVictory ? `；specialVictory=${json(stage.specialVictory)}` : ''}`)
    lines.push(...effectRows(stage.effects))
  } else if (trap) {
    lines.push(`  - Trap：cost=${json(trap.cost)}；condition=${jsonOrDash(trap.condition)}`)
    lines.push(...effectRows(trap.effects))
  } else {
    lines.push('  - 無可轉接的主動／觸發能力。')
  }
  if (attack) {
    lines.push('  - Attack Then effects：')
    lines.push(...effectRows(attack))
  }
  if (effectSet.length > 0 && !skill && !flip && !item && !stage && !trap) {
    lines.push('  - GameCard effects：')
    lines.push(...effectRows(effectSet))
  }
  lines.push('- 對應程式碼：')
  lines.push(`  - 資料記錄：\`${sourcePath}\`（以 cardNumber=${card.cardNumber} 搜尋該 JSON 記錄）。`)
  lines.push(...adapterFunctionRefs(files, card).map((ref) => `  - Adapter：${ref}`))
  lines.push(...runtimeFunctionRefs(files, card, [...effectSet, ...(attack ?? [])]).map((ref) => `  - Runtime：${ref}`))
  const tests = testRefs(files, card)
  if (tests.length > 0) lines.push(`  - 直接 adapter 測試：${tests.join('、')}`)
  lines.push('')
  return lines
}

const compareCardNumber = (left: OfficialCardRecord, right: OfficialCardRecord) =>
  left.baseCardNumber.localeCompare(right.baseCardNumber, 'en', { numeric: true }) ||
  left.cardNumber.localeCompare(right.cardNumber, 'en', { numeric: true })

const getRepresentativeCards = (cards: OfficialCardRecord[]): OfficialCardRecord[] => {
  const grouped = new Map<string, OfficialCardRecord[]>()
  for (const card of cards) {
    const group = grouped.get(card.baseCardNumber) ?? []
    group.push(card)
    grouped.set(card.baseCardNumber, group)
  }
  return [...grouped.values()]
    .map((group) =>
      [...group].sort((left, right) => {
        const leftBase = left.cardNumber === left.baseCardNumber ? 0 : 1
        const rightBase = right.cardNumber === right.baseCardNumber ? 0 : 1
        return leftBase - rightBase || left.cardNumber.localeCompare(right.cardNumber, 'en', { numeric: true })
      })[0],
    )
    .sort(compareCardNumber)
}

const countBy = (cards: OfficialCardRecord[], field: 'type' | 'color') => {
  const counts = new Map<string, number>()
  for (const card of cards) {
    const value = field === 'type' ? card.type : card.color ?? 'COLORLESS'
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right))
}

const renderSummary = (series: Series, dataset: OfficialDataset, baseCards: OfficialCardRecord[]): string[] => {
  const source = seriesSources[series]
  const directBaseRecords = dataset.cards.filter((card) => card.cardNumber === card.baseCardNumber).length
  const variantRecords = dataset.cards.length - directBaseRecords
  return [
    `## ${series} 數量與資料口徑`,
    `- 正式資料檔：\`${source.path}\``,
    `- 官方資料來源：${dataset.source.datasetUrl}`,
    `- 抓取時間：${dataset.source.fetchedAt}`,
    `- 全部記錄：${dataset.cards.length}；不同 baseCardNumber：${baseCards.length}；直接本體記錄：${directBaseRecords}；異圖／變體記錄：${variantRecords}。`,
    `- 基礎卡類型：${countBy(baseCards, 'type').map(([key, count]) => `${key} ${count}`).join('、')}。`,
    `- 基礎卡顏色：${countBy(baseCards, 'color').map(([key, count]) => `${key} ${count}`).join('、')}。`,
    '',
  ]
}

const renderIndex = (files: SourceFile[]): string[] => {
  const cardAdapter = sourceFile(files, 'src/cards/official-card-adapter.ts')
  const effectAdapter = sourceFile(files, 'src/cards/official-effect-adapter.ts')
  return [
    '## 程式碼路由索引',
    '',
    '| 層級 | 程式碼出處 | 責任 |',
    '| --- | --- | --- |',
    `| 官方資料轉 runtime GameCard | \`src/cards/official-card-adapter.ts:${firstExportLine(cardAdapter, 'convertOfficialCardToGameCard')}\` | 欄位正規化、卡型、數值、能力掛載 |`,
    `| 文字通用效果 parser | \`src/cards/official-effect-adapter.ts:${firstExportLine(effectAdapter, 'convertOfficialCardEffects')}\` | 將卡面文字轉成 CardEffect[] |`,
    `| Cookie skill | \`src/cards/official-effect-adapter.ts:${firstExportLine(effectAdapter, 'convertOfficialCookieSkill')}\` | Activate／OnPlay／被動／成本／技能效果 |`,
    `| FLIP ability | \`src/cards/official-effect-adapter.ts:${firstExportLine(effectAdapter, 'convertOfficialFlipAbility')}\` | FLIP 成本與效果 |`,
    `| Item／Stage／Trap adapter | \`src/cards/official-effect-adapter.ts:${firstExportLine(effectAdapter, 'convertOfficialItemAbility')}\`, \`${firstExportLine(effectAdapter, 'convertOfficialStageAbility')}\`, \`${firstExportLine(effectAdapter, 'convertOfficialTrapAbility')}\` | 專用能力、條件與成本 |`,
    `| Attack Then | \`src/cards/official-effect-adapter.ts:${firstExportLine(effectAdapter, 'convertOfficialAttackEffects')}\` | 攻擊傷害文字後的效果序列 |`,
    '| 通用效果執行 | `src/game/effects/execute.ts:336` | CardEffect 的規則層結算 |',
    '| Cookie 技能執行 | `src/game/skills.ts:683`、`src/game/skills.ts:898` | 合法性與發動 |',
    '| 戰鬥／Attack Then／FLIP | `src/game/battle.ts:1830`、`src/game/battle.ts:2077`、`src/game/battle.ts:2568` | 戰鬥後效果與 FLIP 結算 |',
    '| Item／Stage command | `src/game/commands.ts:2096`、`src/game/commands.ts:2173` | 主要階段使用與 pending effect |',
    '| Trap command | `src/game/battle.ts:927`、`src/game/battle.ts:1191` | 陷阱回應窗、條件與效果佇列 |',
    '',
    '每張卡下方的 `Adapter` 會列出共用轉接函式與卡號專用 mapping；`Runtime` 會列出卡型入口與實際 effect kind 的第一個執行位置。這些程式碼位置是目前工作樹產生報告時的行號，若後續程式碼移動，請重新執行本報告產生器。',
    '',
  ]
}

const main = async () => {
  const files = await readSourceFiles()
  const output: string[] = [
    '# BS5／BS6 每張卡：文字描述、runtime 效果與程式碼出處',
    '',
    '> 本報告依正式 `data/cards/` 卡池產生；保留官方英文卡面文字，不自行補寫未確認的中文翻譯。`runtime effects` 是目前 adapter 產出的結構化 `CardEffect`／能力資料。',
    '',
    '## 報告範圍',
    '',
    '- 每個 `baseCardNumber` 列一張代表卡：BS5 111 張、BS6 107 張。',
    '- 另外逐筆列出所有 `@` 異圖／變體記錄；BS6-091 沒有無 `@` 的本體記錄，因此以 `BS6-091@2` 作為代表記錄。',
    '- 「通用 CardEffect 未直接轉接」不等於卡牌未支援：Item／Stage／Trap 可能由專用 adapter 轉接；報告會分開列出。',
    '- 每張卡的程式碼出處包含資料檔、adapter 函式、卡號專用 mapping（若有）、runtime 入口，以及 BS5／BS6 adapter 直接測試（若有）。',
    '',
    ...renderIndex(files),
  ]

  for (const [series, source] of Object.entries(seriesSources) as [Series, typeof seriesSources[Series]][]) {
    const dataset = JSON.parse(await readFile(resolve(root, source.path), 'utf8')) as OfficialDataset
    const baseCards = getRepresentativeCards(dataset.cards)
    const representativeNumbers = new Set(baseCards.map((card) => card.cardNumber))
    const variants = dataset.cards
      .filter((card) => card.cardNumber !== card.baseCardNumber && !representativeNumbers.has(card.cardNumber))
      .sort(compareCardNumber)
    output.push(`## ${series} 全卡對照`)
    output.push('', ...renderSummary(series, dataset, baseCards))
    output.push(`## ${series} 基礎卡代表（${baseCards.length}）`, '')
    for (const card of baseCards) output.push(...renderCard(files, source.path, card, false))
    output.push(`## ${series} 異圖／變體記錄（${variants.length}）`, '')
    for (const card of variants) output.push(...renderCard(files, source.path, card, true))
  }

  output.push(
    '## 使用方式',
    '',
    '- 查卡面文字：看每張卡的「官方卡面文字」。',
    '- 查規則層輸入：看「runtime 效果」的 `kind` 與 JSON。',
    '- 查實際程式：先看「程式碼路由索引」，再依每張卡的 `Adapter`／`Runtime` 行號進入對應檔案。',
    '- 查驗證：BS5／BS6 的 adapter 測試與逐色 Browser 稽核檔案位於 `src/cards/official-effect-adapter-bs5.test.ts`、`src/cards/official-effect-adapter-bs6.test.ts` 與 `docs/`。',
    '',
  )

  await writeFile(outputPath, `${output.join('\n')}\n`, 'utf8')
  console.log(`Generated ${outputPath}`)
}

await main()
