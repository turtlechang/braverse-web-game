/**
 * 候選卡牌 promote 工具（npm run promote:candidate）
 *
 * 流程：
 * 1. 掃描 data/candidates/*.json
 * 2. 檔名碰撞檢查 — 若任一候選檔名已存在於 data/cards/，拒絕全部（不刪除候選）
 * 3. 執行 validate:candidate（fail-fast）
 * 4. 全部檢查通過後，依序複製至 data/cards/
 * 5. 複製全部成功後，重新生成 src/game/generated-card-pool.ts
 * 6. 最後從 data/candidates/ 移除已 promote 的檔案
 *
 * 安全保證：
 * - 檔名碰撞時拒絕全部，不修改任何檔案
 * - 驗證失敗時不執行任何寫入
 * - 複製階段若任一失敗則 rollback（刪除已複製的檔案、還原 registry），候選全數保留
 * - 只在複製全部成功 + registry 重新生成後才刪除候選檔案
 *
 * 執行方式：tsx scripts/promote-candidate-cards.ts
 */
import {
  readdirSync,
  copyFileSync,
  unlinkSync,
  existsSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { generateCardPool, generatedPoolPath } from './generate-card-pool'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const candidatesDir = join(projectRoot, 'data', 'candidates')
const officialDir = join(projectRoot, 'data', 'cards')

let candidateFiles: string[]
try {
  candidateFiles = readdirSync(candidatesDir).filter((file) =>
    file.endsWith('.json'),
  )
} catch {
  console.log('候選目錄 data/candidates/ 不存在或無法讀取。')
  process.exit(0)
}

if (candidateFiles.length === 0) {
  console.log('data/candidates/ 中無 .json 檔案，無需 promote。')
  process.exit(0)
}

console.log(`找到 ${candidateFiles.length} 個候選檔案。`)

// --- Phase 1: 檔名碰撞檢查（不修改任何檔案）---
const existingOfficial = new Set(
  existsSync(officialDir)
    ? readdirSync(officialDir).filter((f) => f.endsWith('.json'))
    : [],
)

const collisions: string[] = []
for (const file of candidateFiles) {
  if (existingOfficial.has(file)) {
    collisions.push(file)
  }
}

if (collisions.length > 0) {
  console.error(
    `✗ 檔名碰撞：以下候選檔名已存在於 data/cards/ — ${collisions.join(', ')}`,
  )
  console.error('  請重新命名候選檔案後再試。候選檔案未變更。')
  process.exit(1)
}

console.log('通過檔名檢查，開始驗證...')

// --- Phase 2: 執行驗證 ---
const tsxBin = join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const validateScript = join(projectRoot, 'scripts', 'validate-candidate-cards.ts')

try {
  execFileSync('node', [tsxBin, validateScript, '--require-promotion-ready'], {
    stdio: 'inherit',
    cwd: projectRoot,
  })
} catch {
  console.error('✗ 驗證失敗，abort promote。候選檔案未變更。')
  process.exit(1)
}

console.log('驗證通過，開始複製...')

// --- Phase 3: 複製到正式卡池（含 rollback）---
const previousGeneratedPool = readFileSync(generatedPoolPath, 'utf8')
const copiedFiles: string[] = []

for (const file of candidateFiles) {
  const src = join(candidatesDir, file)
  const dest = join(officialDir, file)

  try {
    copyFileSync(src, dest)
    copiedFiles.push(file)
  } catch (error) {
    console.error(`✗ 複製 ${file} 失敗：${(error as Error).message}`)
    console.error('  正在 rollback 已複製的檔案...')

    for (const copied of copiedFiles) {
      try {
        rmSync(join(officialDir, copied), { force: true })
      } catch (rollbackError) {
        console.error(
          `  ⚠ rollback 失敗，${copied} 可能殘留於 data/cards/：${(rollbackError as Error).message}`,
        )
      }
    }

    writeFileSync(generatedPoolPath, previousGeneratedPool, 'utf8')

    console.error('  候選檔案全數保留。')
    process.exit(1)
  }
}

// --- Phase 4: 重新生成卡池 registry ---
try {
  generateCardPool()
} catch (error) {
  console.error(
    `✗ 重新生成卡池 registry 失敗：${(error as Error).message}`,
  )
  console.error('  正在 rollback 已複製的檔案...')

  for (const copied of copiedFiles) {
    try {
      rmSync(join(officialDir, copied), { force: true })
    } catch (rollbackError) {
      console.error(
        `  ⚠ rollback 失敗，${copied} 可能殘留於 data/cards/：${(rollbackError as Error).message}`,
      )
    }
  }

  writeFileSync(generatedPoolPath, previousGeneratedPool, 'utf8')
  console.error('  候選檔案全數保留。')
  process.exit(1)
}

// --- Phase 5: 從候選目錄移除 ---
for (const file of candidateFiles) {
  try {
    unlinkSync(join(candidatesDir, file))
  } catch (error) {
    console.warn(
      `⚠ 無法刪除候選檔案 ${file}：${(error as Error).message}（已複製到正式卡池）`,
    )
  }
}

const regeneratedCount = readdirSync(officialDir).filter((f) =>
  f.endsWith('.json'),
).length

console.log(
  `\n✓ 已 promote ${copiedFiles.length} 個檔案到 data/cards/（目前共 ${regeneratedCount} 個 JSON）：`,
)
for (const file of copiedFiles) console.log(`  → ${file}`)
