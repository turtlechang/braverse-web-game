import { describe, expect, it, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  readdirSync,
} from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { generateCardPool } from './generate-card-pool'

const PROJECT_ROOT = process.cwd()
const CANDIDATES_DIR = join(PROJECT_ROOT, 'data', 'candidates')
const CARDS_DIR = join(PROJECT_ROOT, 'data', 'cards')
const VALIDATE_SCRIPT = join(PROJECT_ROOT, 'scripts', 'validate-candidate-cards.ts')
const PROMOTE_SCRIPT = join(PROJECT_ROOT, 'scripts', 'promote-candidate-cards.ts')
const GENERATED_POOL_PATH = join(
  PROJECT_ROOT,
  'src',
  'game',
  'generated-card-pool.ts',
)

const createCandidateFile = (filename: string, data: unknown) => {
  if (!existsSync(CANDIDATES_DIR)) {
    mkdirSync(CANDIDATES_DIR, { recursive: true })
  }
  writeFileSync(
    join(CANDIDATES_DIR, filename),
    JSON.stringify(data, null, 2),
    'utf8',
  )
}

const removeCandidateFile = (filename: string) => {
  const filePath = join(CANDIDATES_DIR, filename)
  if (existsSync(filePath)) {
    rmSync(filePath, { force: true })
  }
}

const removeOfficialFile = (filename: string) => {
  const filePath = join(CARDS_DIR, filename)
  if (existsSync(filePath)) {
    rmSync(filePath)
  }
}

const TSX_BIN = join(PROJECT_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs')

const runValidate = () => {
  try {
    const output = execFileSync('node', [TSX_BIN, VALIDATE_SCRIPT], {
      encoding: 'utf8',
      cwd: PROJECT_ROOT,
      timeout: 30000,
    })
    return { exitCode: 0, output, errors: '' }
  } catch (error: unknown) {
    const err = error as {
      status: number | null
      stdout: string
      stderr: string
    }
    return {
      exitCode: err.status ?? 1,
      output: err.stdout ?? '',
      errors: err.stderr ?? '',
    }
  }
}

const runPromote = () => {
  try {
    const output = execFileSync('node', [TSX_BIN, PROMOTE_SCRIPT], {
      encoding: 'utf8',
      cwd: PROJECT_ROOT,
      timeout: 30000,
    })
    return { exitCode: 0, output, errors: '' }
  } catch (error: unknown) {
    const err = error as {
      status: number | null
      stdout: string
      stderr: string
    }
    return {
      exitCode: err.status ?? 1,
      output: err.stdout ?? '',
      errors: err.stderr ?? '',
    }
  }
}

const VALID_CARD = {
  sourceId: 99001,
  locale: 'en',
  cardNumber: 'CANDIDATE-001',
  baseCardNumber: 'CANDIDATE-001',
  variant: null,
  name: 'Test Candidate Cookie',
  type: 'cookie',
  officialType: 'COOKIE',
  rarity: 'C',
  grade: 'COMMON',
  level: 3,
  hp: 5,
  energyType: 'RED',
  color: 'RED',
  skill: {
    name: 'Test Skill',
    text: '{mob} {t1} 《{R}{R}》 This Cookie gains +1 HP.',
  },
  attackText: '<{R}{R}> Test Attack {da} 3',
  flipText: null,
  keywords: [],
  product: {
    id: 999,
    title: 'Test Candidate Set',
    category: null,
  },
  restrictions: {
    banned: false,
    limited: false,
  },
  flags: {
    enabled: true,
    hidden: false,
    extra: false,
  },
  imageUrl: 'https://example.com/test-candidate.webp',
  officialUpdatedAt: '2026-06-10T00:00:00.000Z',
  sourceUrl: 'https://example.com/cardList.json',
}

const VALID_FILE = {
  schemaVersion: 1,
  source: {
    provider: 'Test Provider',
    pageUrl: 'https://example.com/test',
    datasetUrl: 'https://example.com/test.json',
    locale: 'en',
    fetchedAt: '2026-06-10T00:00:00.000Z',
    totalAvailable: 1,
    matchedAvailable: 1,
    importedCount: 1,
    filter: { categoryTitle: 'Test Candidate Set' },
    imagesDownloaded: false,
  },
  cards: [VALID_CARD],
}

let generatedPoolBackup: string | null = null
let candidateFilesBackup: Map<string, string> = new Map()

const backupGeneratedPool = () => {
  generatedPoolBackup = existsSync(GENERATED_POOL_PATH)
    ? readFileSync(GENERATED_POOL_PATH, 'utf8')
    : null
}

const restoreGeneratedPool = () => {
  if (generatedPoolBackup !== null) {
    writeFileSync(GENERATED_POOL_PATH, generatedPoolBackup, 'utf8')
    generatedPoolBackup = null
  }
}

describe.sequential('candidate card pipeline', () => {
  beforeAll(() => {
    if (!existsSync(CANDIDATES_DIR)) {
      mkdirSync(CANDIDATES_DIR, { recursive: true })
    }
    candidateFilesBackup = new Map(
      readdirSync(CANDIDATES_DIR)
        .filter((file) => file.endsWith('.json'))
        .map((file) => [file, readFileSync(join(CANDIDATES_DIR, file), 'utf8')]),
    )
  })

  beforeEach(() => {
    if (!existsSync(CANDIDATES_DIR)) {
      mkdirSync(CANDIDATES_DIR, { recursive: true })
    }
    const existingFiles = readdirSync(CANDIDATES_DIR).filter((f) =>
      f.endsWith('.json'),
    )
    for (const file of existingFiles) {
      rmSync(join(CANDIDATES_DIR, file), { force: true })
    }
  })

  afterEach(() => {
    const files = existsSync(CANDIDATES_DIR)
      ? readdirSync(CANDIDATES_DIR).filter((f) => f.endsWith('.json'))
      : []
    for (const file of files) {
      removeCandidateFile(file)
    }
  })

  afterAll(() => {
    const files = existsSync(CANDIDATES_DIR)
      ? readdirSync(CANDIDATES_DIR).filter((file) => file.endsWith('.json'))
      : []
    for (const file of files) {
      removeCandidateFile(file)
    }
    for (const [file, content] of candidateFilesBackup) {
      writeFileSync(join(CANDIDATES_DIR, file), content, 'utf8')
    }
  })

  describe('validate:candidate', () => {
    it('passes with empty candidates directory', () => {
      const result = runValidate()
      expect(result.exitCode).toBe(0)
      expect(result.output).toContain('無 .json 檔案')
    })

    it('rejects malformed JSON', () => {
      writeFileSync(
        join(CANDIDATES_DIR, 'malformed.json'),
        '{ invalid',
        'utf8',
      )

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('JSON 解析失敗')
    })

    it('rejects file without cards array', () => {
      createCandidateFile('no-cards.json', {
        schemaVersion: 1,
        source: { provider: 'test', pageUrl: 'https://example.com', locale: 'en' },
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('缺少 cards 陣列')
    })

    it('rejects file without schemaVersion', () => {
      createCandidateFile('no-schema.json', {
        source: {
          provider: 'test',
          pageUrl: 'https://example.com',
          locale: 'en',
        },
        cards: [VALID_CARD],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('schemaVersion')
    })

    it('rejects file with non-number schemaVersion', () => {
      createCandidateFile('bad-schema-type.json', {
        schemaVersion: 'v1',
        source: {
          provider: 'test',
          pageUrl: 'https://example.com',
          locale: 'en',
        },
        cards: [VALID_CARD],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('schemaVersion 必須為 number')
    })

    it('rejects file without source object', () => {
      createCandidateFile('no-source.json', {
        schemaVersion: 1,
        cards: [VALID_CARD],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('source')
    })

    it('rejects file with invalid source structure', () => {
      createCandidateFile('bad-source.json', {
        schemaVersion: 1,
        source: 'not-an-object',
        cards: [VALID_CARD],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('source 必須為物件')
    })

    it('rejects file with missing source.provider string', () => {
      createCandidateFile('bad-source-fields.json', {
        schemaVersion: 1,
        source: {
          pageUrl: 'https://example.com',
          locale: 'en',
        },
        cards: [VALID_CARD],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('source.provider')
    })

    it('rejects card with wrong type for cardNumber', () => {
      createCandidateFile('bad-cardnumber-type.json', {
        ...VALID_FILE,
        cards: [{ ...VALID_CARD, cardNumber: 12345 }],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('cardNumber')
    })

    it('rejects card with invalid type value', () => {
      createCandidateFile('bad-type-enum.json', {
        ...VALID_FILE,
        cards: [{ ...VALID_CARD, type: 'invalid-type', cardNumber: 'CANDIDATE-TYPE-001' }],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('type 必須為合法值')
    })

    it('rejects card with non-number sourceId', () => {
      createCandidateFile('bad-sourceid.json', {
        ...VALID_FILE,
        cards: [
          {
            ...VALID_CARD,
            sourceId: 'not-a-number',
            cardNumber: 'CANDIDATE-SID-001',
          },
        ],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('sourceId 必須為 number')
    })

    it('rejects card with invalid flags structure', () => {
      createCandidateFile('bad-flags.json', {
        ...VALID_FILE,
        cards: [
          {
            ...VALID_CARD,
            cardNumber: 'CANDIDATE-FLAGS-001',
            flags: { enabled: 'yes', hidden: false, extra: false },
          },
        ],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('flags.enabled 必須為 boolean')
    })

    it('rejects missing flags object', () => {
      createCandidateFile('missing-flags.json', {
        ...VALID_FILE,
        cards: [{ ...VALID_CARD, cardNumber: 'CANDIDATE-NF-001', flags: 'invalid' }],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('flags 必須為物件')
    })

    it('rejects missing restrictions object', () => {
      createCandidateFile('missing-restrictions.json', {
        ...VALID_FILE,
        cards: [
          {
            ...VALID_CARD,
            cardNumber: 'CANDIDATE-NR-001',
            restrictions: 'invalid',
          },
        ],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('restrictions 必須為物件')
    })

    it('rejects missing product object', () => {
      createCandidateFile('missing-product.json', {
        ...VALID_FILE,
        cards: [
          {
            ...VALID_CARD,
            cardNumber: 'CANDIDATE-NP-001',
            product: 'invalid',
          },
        ],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('product 必須為物件')
    })

    it('rejects non-object card entry (primitive)', () => {
      createCandidateFile('primitive-card.json', {
        ...VALID_FILE,
        cards: ['not-a-card-object'],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('卡片資料必須為物件')
    })

    it('rejects top-level array instead of object', () => {
      createCandidateFile('array-top.json', [VALID_CARD])

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('頂層必須為物件')
    })

    it('rejects card with missing required fields', () => {
      createCandidateFile('missing-fields.json', {
        ...VALID_FILE,
        cards: [
          {
            cardNumber: 'MISS-001',
            name: 'Missing Fields Card',
            type: 'cookie',
          },
        ],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('缺少必填欄位')
    })

    it('rejects duplicate cardNumber within file', () => {
      createCandidateFile('dup-in-file.json', {
        ...VALID_FILE,
        cards: [VALID_CARD, { ...VALID_CARD, name: 'Copy' }],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('檔內重複')
    })

    it('rejects cardNumber that conflicts with official pool', () => {
      const existingCard = readFileSync(
        join(CARDS_DIR, 'official-sample.en.json'),
        'utf8',
      )
      const parsed = JSON.parse(existingCard)
      const firstCard = parsed.cards[0]

      createCandidateFile('conflict-official.json', {
        ...VALID_FILE,
        cards: [{ ...VALID_CARD, cardNumber: firstCard.cardNumber }],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('與正式卡池重複')
    })

    it('rejects card with unsupported conversion', () => {
      createCandidateFile('unsupported.json', {
        ...VALID_FILE,
        cards: [
          {
            ...VALID_CARD,
            cardNumber: 'CANDIDATE-UNSUPPORTED-001',
            type: 'cookie',
            officialType: 'COOKIE',
            level: null,
            hp: null,
          },
        ],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('無法轉換為 GameCard')
    })

    it('rejects cookie with skill text but no converted effect', () => {
      createCandidateFile('skill-no-effect.json', {
        ...VALID_FILE,
        cards: [
          {
            ...VALID_CARD,
            cardNumber: 'CANDIDATE-SKILL-001',
            skill: {
              name: 'Test Skill',
              text: 'This skill has no parseable effect.',
            },
            attackText: '<{R}> Basic Attack {da} 1',
          },
        ],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('有技能文字但未轉出 skill/effects')
    })

    it('rejects flip card with flip text but no converted flip effect', () => {
      createCandidateFile('flip-no-effect.json', {
        ...VALID_FILE,
        cards: [
          {
            ...VALID_CARD,
            cardNumber: 'CANDIDATE-FLIP-001',
            type: 'flip',
            officialType: 'FLIP',
            flipText: 'Some flip text that should be converted.',
            attackText: '<{R}> Flip Attack {da} 2',
            skill: { name: null, text: null },
          },
        ],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('有 FLIP 文字但未轉出 flip 效果')
    })

    it('passes with valid candidate card', () => {
      createCandidateFile('valid-candidate.json', VALID_FILE)

      const result = runValidate()
      expect(result.exitCode).toBe(0)
      expect(result.output).toContain('✓ 候選資料全部通過驗證')
    })

    it('accepts inventory candidates without runtime conversion', () => {
      createCandidateFile('inventory-candidate.json', {
        ...VALID_FILE,
        source: { ...VALID_FILE.source, candidateStatus: 'inventory' },
        cards: [
          {
            ...VALID_CARD,
            cardNumber: 'CANDIDATE-INVENTORY-001',
            level: null,
            hp: null,
          },
        ],
      })

      const result = runValidate()
      expect(result.exitCode).toBe(0)
      expect(result.output).toContain('inventory 候選')
    })
  })

  describe('promote:candidate', () => {
    afterEach(async () => {
      removeOfficialFile('candidate-promo-test.json')
      removeOfficialFile('candidate-promo-visible.json')
      restoreGeneratedPool()
      const { generateCardPool } = await import(
        './generate-card-pool.js'
      )
      generateCardPool()
    })

    it('rejects promote when candidate filename collides with official card', () => {
      createCandidateFile('official-sample.en.json', VALID_FILE)

      const result = runPromote()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('檔名碰撞')

      expect(existsSync(join(CANDIDATES_DIR, 'official-sample.en.json'))).toBe(
        true,
      )
    })

    it('does not delete candidate file on failed promote', () => {
      createCandidateFile('official-starter-deck-green.en.json', VALID_FILE)

      const result = runPromote()
      expect(result.exitCode).toBe(1)

      expect(
        existsSync(
          join(CANDIDATES_DIR, 'official-starter-deck-green.en.json'),
        ),
      ).toBe(true)
    })

    it('rejects promote for inventory-only candidates', () => {
      const inventoryFilename = 'inventory-not-ready.json'
      createCandidateFile(inventoryFilename, {
        ...VALID_FILE,
        source: { ...VALID_FILE.source, candidateStatus: 'inventory' },
        cards: [{ ...VALID_CARD, cardNumber: 'CANDIDATE-INVENTORY-PROMOTE-001' }],
      })

      const result = runPromote()
      expect(result.exitCode).toBe(1)
      expect(result.errors).toContain('不能 promote')
      expect(existsSync(join(CANDIDATES_DIR, inventoryFilename))).toBe(true)
    })

    it('promotes valid candidate to official cards', () => {
      backupGeneratedPool()
      const promoFilename = 'candidate-promo-test.json'
      const promoCardId = 'CANDIDATE-PROMO-001'
      createCandidateFile(promoFilename, {
        ...VALID_FILE,
        cards: [{ ...VALID_CARD, cardNumber: promoCardId }],
      })

      const result = runPromote()
      expect(result.exitCode).toBe(0)
      expect(result.output).toContain(promoFilename)

      expect(existsSync(join(CARDS_DIR, promoFilename))).toBe(true)
      expect(existsSync(join(CANDIDATES_DIR, promoFilename))).toBe(false)
    })

    it('promoted card is visible in card pool via generated registry', async () => {
      backupGeneratedPool()

      const promoFilename = 'candidate-promo-visible.json'
      const promoCardId = 'CANDIDATE-PROMO-VISIBLE-001'

      const targetFile = {
        ...VALID_FILE,
        cards: [{ ...VALID_CARD, cardNumber: promoCardId }],
      }
      createCandidateFile(promoFilename, targetFile)

      const promoResult = runPromote()
      expect(promoResult.exitCode).toBe(0)

      // 以獨立 generator readback 固定測試邊界，避免 Vitest 其他 worker 的
      // module cache 影響 card-pool import；promote 本身仍已在子程序執行 generator。
      generateCardPool()
      const poolContent = readFileSync(GENERATED_POOL_PATH, 'utf8')
      expect(poolContent).toContain(promoFilename)
      expect(poolContent).toContain('candidate_promo_visible_json')

      const promoJson = JSON.parse(
        readFileSync(join(CARDS_DIR, promoFilename), 'utf8'),
      )
      expect(promoJson.cards[0].cardNumber).toBe(promoCardId)
      expect(promoJson.cards[0].name).toBe('Test Candidate Cookie')
    })
  })
})
