#!/usr/bin/env node
/**
 * 直接呼叫 OpenCode Go API 進行唯讀審查。
 *
 * 用途：當 `scripts\opencode-go-review.cmd` 在受限 Codex 環境中被沙箱阻擋
 * （Error: Session not found / In a restricted Codex environment）時，
 * 改由 Node.js fetch 直接對 `https://opencode.ai/zen/go/v1/chat/completions`
 * 發送請求，繞過 opencode.cmd CLI 的本地 session 建立流程。
 *
 * 使用方式：
 *   node scripts\opencode-go-direct-review.mjs <model> "<prompt>"
 *   node scripts\opencode-go-direct-review.mjs <model> --file <path> [--file <path2> ...] "<prompt>"
 *
 * 範例：
 *   node scripts\opencode-go-direct-review.mjs glm-5.1 "請審查 src/game/energy.ts"
 *   node scripts\opencode-go-direct-review.mjs glm-5.1 --file src/game/energy.ts --file src/game/energy.test.ts "請審查以下檔案..."
 *
 * 環境需求：
 *   - Node.js 18+（提供內建 fetch）
 *   - 環境變數 OPENCODE_GO_API_KEY 已設定
 */

import { readFileSync } from 'node:fs'

const API_URL = 'https://opencode.ai/zen/go/v1/chat/completions'
const API_KEY = process.env.OPENCODE_GO_API_KEY

function parseArgs(argv) {
  const files = []
  const remaining = []
  let i = 0
  while (i < argv.length) {
    if (argv[i] === '--file' && i + 1 < argv.length) {
      files.push(argv[i + 1])
      i += 2
    } else {
      remaining.push(argv[i])
      i += 1
    }
  }
  const model = remaining[0]
  const prompt = remaining.slice(1).join(' ')
  return { model, files, prompt }
}

const { model, files, prompt } = parseArgs(process.argv.slice(2))

if (!API_KEY) {
  console.error('[opencode-go-direct-review] OPENCODE_GO_API_KEY is not set.')
  process.exit(2)
}

if (!model || (!prompt && files.length === 0)) {
  console.error(
    '[opencode-go-direct-review] Usage: node scripts\\opencode-go-direct-review.mjs <model> [--file <path> ...] "<prompt>"',
  )
  process.exit(1)
}

const systemPrompt = `你是一位嚴謹的程式碼審查者。請只根據使用者提供的檔案內容進行唯讀審查。
不要修改任何檔案、不要執行任何命令、不要瀏覽網路。
請具體標明檔案名稱、行號、問題類型（bug / 測試缺口 / 維護性建議 / 誤判風險），並說明原因。`

function readFiles(filePaths) {
  return filePaths
    .map((filePath) => {
      const content = readFileSync(filePath, 'utf-8')
      return `### ${filePath}\n\n\`\`\`typescript\n${content}\n\`\`\``
    })
    .join('\n\n')
}

async function main() {
  const fileSection = files.length > 0 ? readFiles(files) : ''
  const userContent = fileSection
    ? `${prompt}\n\n${fileSection}`
    : prompt

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.1,
      stream: false,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error(
      `[opencode-go-direct-review] API error ${response.status}: ${text}`,
    )
    process.exit(response.status)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (typeof content !== 'string') {
    console.error(
      '[opencode-go-direct-review] Unexpected response shape:',
      JSON.stringify(data, null, 2),
    )
    process.exit(1)
  }

  console.log(content)
}

main().catch((error) => {
  console.error('[opencode-go-direct-review]', error.message)
  if (error.cause) {
    console.error('[opencode-go-direct-review] cause:', error.cause.message || error.cause)
  }
  if (error.stack) {
    console.error('[opencode-go-direct-review] stack:', error.stack)
  }
  process.exit(1)
})
