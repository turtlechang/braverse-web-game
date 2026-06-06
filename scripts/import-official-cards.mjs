import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const DEFAULT_LOCALE = 'en'
export const DEFAULT_LIMIT = 10
export const DEFAULT_OUTPUT = 'data/cards/official-sample.en.json'
export const OFFICIAL_SITE_URL = 'https://cookierunbraverse.com'

const SUPPORTED_LOCALES = new Set(['en', 'asia', 'ko'])
const CARD_TYPES = new Set([
  'COOKIE',
  'ITEM',
  'TRAP',
  'STAGE',
  'FLIP',
  'EXTRA',
])

const toOptionalString = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const toOptionalNumber = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const toBoolean = (value) => Number(value) === 1

const splitCardNumber = (cardNumber) => {
  const [baseCardNumber, variant] = cardNumber.split('@', 2)
  return {
    baseCardNumber,
    variant: variant ?? null,
  }
}

const normalizeKeyword = (value) => {
  const keyword = toOptionalString(value)

  if (!keyword) {
    return []
  }

  return keyword
    .split(/[,/|]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export const getDatasetUrl = (locale = DEFAULT_LOCALE) => {
  if (!SUPPORTED_LOCALES.has(locale)) {
    throw new Error(`不支援的語系：${locale}`)
  }

  return `${OFFICIAL_SITE_URL}/data/json/cardList_${locale}.json`
}

export const normalizeOfficialCard = (rawCard, sourceUrl) => {
  if (!rawCard || typeof rawCard !== 'object') {
    throw new Error('官方卡牌資料必須是物件。')
  }

  const cardNumber = toOptionalString(rawCard.card_no)
  const name = toOptionalString(rawCard.card_name)
  const imageUrl = toOptionalString(rawCard.card_image)

  if (!cardNumber || !name || !imageUrl) {
    throw new Error('官方卡牌缺少卡號、名稱或圖片 URL。')
  }

  const officialType = toOptionalString(rawCard.card_type)?.toUpperCase()
  const { baseCardNumber, variant } = splitCardNumber(cardNumber)

  return {
    sourceId: Number(rawCard.card_idx),
    locale: toOptionalString(rawCard.site_lang) ?? DEFAULT_LOCALE,
    cardNumber,
    baseCardNumber,
    variant,
    name,
    type:
      officialType && CARD_TYPES.has(officialType)
        ? officialType.toLowerCase()
        : 'unknown',
    officialType: officialType ?? 'UNKNOWN',
    rarity: toOptionalString(rawCard.card_rare),
    grade: toOptionalString(rawCard.card_grade),
    level: toOptionalNumber(rawCard.card_level),
    hp: toOptionalNumber(rawCard.card_hp),
    energyType: toOptionalString(rawCard.card_energy_type),
    color: toOptionalString(rawCard.card_color),
    skill: {
      name: toOptionalString(rawCard.card_skill_name),
      text: toOptionalString(rawCard.card_skill_text),
    },
    attackText: toOptionalString(rawCard.card_attack_text),
    flipText: toOptionalString(rawCard.card_flip),
    keywords: normalizeKeyword(rawCard.card_keyword),
    product: {
      id: toOptionalNumber(rawCard.category_product_idx),
      title: toOptionalString(rawCard.card_product_title),
      category: toOptionalString(rawCard.card_product_category),
    },
    restrictions: {
      banned: toBoolean(rawCard.card_is_ban),
      limited: toBoolean(rawCard.card_is_limit),
    },
    flags: {
      enabled: toBoolean(rawCard.card_enable),
      hidden: toBoolean(rawCard.card_is_hidden),
      extra: toBoolean(rawCard.card_is_extra),
    },
    imageUrl,
    officialUpdatedAt: toOptionalString(rawCard.update_dt),
    sourceUrl,
  }
}

export const createImportDocument = ({
  rawCards,
  locale,
  limit,
  sourceUrl,
  importedAt = new Date().toISOString(),
}) => {
  if (!Array.isArray(rawCards)) {
    throw new Error('官方資料缺少 cardList 陣列。')
  }

  const cards = rawCards
    .slice(0, limit)
    .map((card) => normalizeOfficialCard(card, sourceUrl))

  return {
    schemaVersion: 1,
    source: {
      provider: 'CookieRun: Braverse official website',
      pageUrl: `${OFFICIAL_SITE_URL}/${locale}/cardList`,
      datasetUrl: sourceUrl,
      locale,
      fetchedAt: importedAt,
      totalAvailable: rawCards.length,
      importedCount: cards.length,
      imagesDownloaded: false,
    },
    cards,
  }
}

const parseArguments = (argumentsList) => {
  const options = {
    locale: DEFAULT_LOCALE,
    limit: DEFAULT_LIMIT,
    output: DEFAULT_OUTPUT,
  }

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    const nextValue = argumentsList[index + 1]

    if (argument === '--locale' && nextValue) {
      options.locale = nextValue
      index += 1
    } else if (argument === '--limit' && nextValue) {
      options.limit = Number(nextValue)
      index += 1
    } else if (argument === '--output' && nextValue) {
      options.output = nextValue
      index += 1
    } else {
      throw new Error(`不支援的參數：${argument}`)
    }
  }

  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100) {
    throw new Error('--limit 必須是 1 到 100 的整數。')
  }

  getDatasetUrl(options.locale)
  return options
}

export const runImport = async ({
  locale = DEFAULT_LOCALE,
  limit = DEFAULT_LIMIT,
  output = DEFAULT_OUTPUT,
  fetchImpl = fetch,
  importedAt,
} = {}) => {
  const sourceUrl = getDatasetUrl(locale)
  const response = await fetchImpl(sourceUrl, {
    headers: {
      accept: 'application/json',
      'user-agent': 'braverse-web-game-card-importer/0.1',
    },
  })

  if (!response.ok) {
    throw new Error(`官方卡表請求失敗：HTTP ${response.status}`)
  }

  const payload = await response.json()
  const document = createImportDocument({
    rawCards: payload.cardList,
    locale,
    limit,
    sourceUrl,
    importedAt,
  })
  const outputPath = resolve(output)

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')

  return { document, outputPath }
}

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isDirectExecution) {
  try {
    const options = parseArguments(process.argv.slice(2))
    const { document, outputPath } = await runImport(options)

    console.log(
      `Imported ${document.source.importedCount} of ${document.source.totalAvailable} cards to ${outputPath}`,
    )
    console.log('Image files were not downloaded.')
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
