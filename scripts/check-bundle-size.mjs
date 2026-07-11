import { readFileSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function parseArgs(argv) {
  let maxRawKb = 850
  let maxGzipKb = 180

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--max-raw-kb' && i + 1 < argv.length) {
      maxRawKb = Number(argv[++i])
    } else if (argv[i] === '--max-gzip-kb' && i + 1 < argv.length) {
      maxGzipKb = Number(argv[++i])
    }
  }

  return { maxRawKb, maxGzipKb }
}

const { maxRawKb, maxGzipKb } = parseArgs(process.argv.slice(2))

const assetsDir = resolve(root, 'dist', 'assets')
let files
try {
  files = readdirSync(assetsDir).filter(
    (f) => f.startsWith('index-') && f.endsWith('.js'),
  )
} catch {
  console.error(
    'ERROR: dist/assets/ directory not found. Run `npm run build` first.',
  )
  process.exit(1)
}

if (files.length === 0) {
  console.error(
    'ERROR: No index-*.js bundle found in dist/assets/. Run `npm run build` first.',
  )
  process.exit(1)
}

const filePath = resolve(assetsDir, files[0])
const raw = readFileSync(filePath)
const gzipped = gzipSync(raw)

const rawKb = raw.length / 1024
const gzipKb = gzipped.length / 1024

const rawOk = rawKb <= maxRawKb
const gzipOk = gzipKb <= maxGzipKb

console.log(`Bundle: ${files[0]}`)
console.log(
  `  Raw:  ${rawKb.toFixed(2)} KiB (budget: ${maxRawKb} KiB) ${
    rawOk ? 'OK' : 'EXCEEDED'
  }`,
)
console.log(
  `  Gzip: ${gzipKb.toFixed(2)} KiB (budget: ${maxGzipKb} KiB) ${
    gzipOk ? 'OK' : 'EXCEEDED'
  }`,
)

if (!rawOk || !gzipOk) {
  process.exit(1)
}
