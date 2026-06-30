import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const OFFICIAL_SITE_URL = 'https://cookierunbraverse.com'
const CATEGORY_TITLE = 'BOOSTER PACK [BRAVE BEGINNING]'

const toOptionalString = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const toOptionalNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const toBoolean = (value) => Number(value) === 1

const splitCardNumber = (cardNumber) => {
  const [baseCardNumber, variant] = cardNumber.split('@', 2)
  return { baseCardNumber, variant: variant ?? null }
}

const normalizeKeyword = (value) => {
  const keyword = toOptionalString(value)
  if (!keyword) return []
  return keyword.split(/[,/|]/).map((e) => e.trim()).filter(Boolean)
}

const CARD_TYPES = new Set(['COOKIE', 'ITEM', 'TRAP', 'STAGE', 'FLIP', 'EXTRA'])

const normalizeOfficialCard = (rawCard, sourceUrl) => {
  const cardNumber = toOptionalString(rawCard.card_no)
  const name = toOptionalString(rawCard.card_name)
  const imageUrl = toOptionalString(rawCard.card_image)
  if (!cardNumber || !name || !imageUrl) return null

  const officialType = toOptionalString(rawCard.card_type)?.toUpperCase()
  const { baseCardNumber, variant } = splitCardNumber(cardNumber)

  return {
    sourceId: Number(rawCard.card_idx),
    locale: toOptionalString(rawCard.site_lang) ?? 'en',
    cardNumber,
    baseCardNumber,
    variant,
    name,
    type: officialType && CARD_TYPES.has(officialType) ? officialType.toLowerCase() : 'unknown',
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

const createImportDocument = ({ cards, locale, sourceUrl, importedAt, series }) => ({
  schemaVersion: 1,
  source: {
    provider: 'CookieRun: Braverse official website',
    pageUrl: `${OFFICIAL_SITE_URL}/${locale}/cardList`,
    datasetUrl: sourceUrl,
    locale,
    fetchedAt: importedAt,
    filter: { categoryTitle: CATEGORY_TITLE, series },
    importedCount: cards.length,
    imagesDownloaded: false,
  },
  cards,
})

const getDatasetUrl = (locale = 'en') => `${OFFICIAL_SITE_URL}/data/json/cardList_${locale}.json`

const runImport = async () => {
  const locale = 'en'
  const sourceUrl = getDatasetUrl(locale)
  const importedAt = new Date().toISOString()

  console.log(`正在從 ${sourceUrl} 擷取卡片資料...`)
  const response = await fetch(sourceUrl, {
    headers: { accept: 'application/json', 'user-agent': 'braverse-brave-beginning-importer/0.1' },
  })

  if (!response.ok) {
    throw new Error(`官方卡表請求失敗：HTTP ${response.status}`)
  }

  const payload = await response.json()
  const rawCards = payload.cardList

  const matchingCards = rawCards.filter(
    (card) => toOptionalString(card.card_product_title) === CATEGORY_TITLE,
  )
  console.log(`找到 ${matchingCards.length} 張 BRAVE BEGINNING 卡片`)

  const normalizedCards = matchingCards
    .map((card) => normalizeOfficialCard(card, sourceUrl))
    .filter(Boolean)

  const bs1Cards = normalizedCards.filter((c) => c.cardNumber.startsWith('BS1-'))
  const bs2Cards = normalizedCards.filter((c) => c.cardNumber.startsWith('BS2-'))

  console.log(`BS1 系列：${bs1Cards.length} 張`)
  console.log(`BS2 系列：${bs2Cards.length} 張`)

  const outputDir = resolve('data/cards')
  await mkdir(outputDir, { recursive: true })

  const bs1Doc = createImportDocument({ cards: bs1Cards, locale, sourceUrl, importedAt, series: 'BS1' })
  const bs2Doc = createImportDocument({ cards: bs2Cards, locale, sourceUrl, importedAt, series: 'BS2' })

  const bs1Path = resolve('data/cards/official-brave-beginning-bs1.en.json')
  const bs2Path = resolve('data/cards/official-brave-beginning-bs2.en.json')

  await writeFile(bs1Path, `${JSON.stringify(bs1Doc, null, 2)}\n`, 'utf8')
  await writeFile(bs2Path, `${JSON.stringify(bs2Doc, null, 2)}\n`, 'utf8')

  console.log(`\n匯入完成：`)
  console.log(`  BS1 → ${bs1Path} (${bs1Cards.length} 張)`)
  console.log(`  BS2 → ${bs2Path} (${bs2Cards.length} 張)`)

  return { bs1Doc, bs2Doc }
}

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isDirectExecution) {
  try {
    await runImport()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
