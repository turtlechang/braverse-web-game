import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const candidatePath = path.join(
  root,
  'data',
  'candidates',
  'official-a-game-of-truth-and-deceit-bs9.en.json',
)
const formalPath = path.join(
  root,
  'data',
  'cards',
  'official-a-game-of-truth-and-deceit-bs9.en.json',
)
const datasetPath = fs.existsSync(candidatePath) ? candidatePath : formalPath
const strictPath = path.join(root, '.tmp-bs9-contracts-current-audit.json')
const browserRoots = [path.join(root, 'test-results'), path.join(root, 'output', 'playwright')]
const reviewWhitelist = new Set()
const cardIdPattern = /BS9-\d{3}(?:@\d+)?/i

const fail = (message) => {
  throw new Error(message)
}

const readJson = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(`Cannot read JSON ${path.relative(root, filePath)}: ${error.message}`)
  }
}

const walkJsonFiles = (directory) => {
  if (!fs.existsSync(directory)) return []
  const files = []
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const filePath = path.join(current, entry.name)
      if (entry.isDirectory()) visit(filePath)
      else if (entry.isFile() && /^bs9-.*\.json$/i.test(entry.name)) files.push(filePath)
    }
  }
  visit(directory)
  return files
}

const extractCardId = (value) => {
  if (typeof value !== 'string') return undefined
  return value.match(cardIdPattern)?.[0].toUpperCase()
}

const rowCardId = (row) => {
  for (const value of [
    row.cardNumber,
    row.card,
    row.exactId,
    row.id,
    row.route,
    row.label,
    row.scenario,
  ]) {
    const cardId = extractCardId(value)
    if (cardId) return cardId
  }
  return undefined
}

const rowIsNegative = (row) => {
  if (row.negative === true) return true
  return [row.route, row.label, row.scenario, row.mode, row.kind]
    .filter((value) => typeof value === 'string')
    .some((value) => /negative|unmet|blocked|illegal|unavailable|no[-_ ]?match/i.test(value))
}

const imageField = (row, field) => {
  const direct = row[field]
  if (typeof direct === 'boolean') return direct
  const nested = row.imageEvidence?.[field]
  return typeof nested === 'boolean' ? nested : undefined
}

const expectedImageUrl = (row) =>
  row.expectedImageUrl ?? row.imageEvidence?.expectedImageUrl ?? row.imageEvidence?.imageUrl

const main = () => {
  const candidate = readJson(datasetPath)
  const records = Array.isArray(candidate.cards) ? candidate.cards : []
  if (records.length === 0) fail('Candidate dataset has no cards array')

  const candidateIds = records.map((record) => record.cardNumber).filter(Boolean)
  const candidateSet = new Set(candidateIds)
  if (candidateSet.size !== candidateIds.length) fail('Candidate cardNumber set contains duplicates')
  const candidateBaseIds = new Set(records.map((record) => record.baseCardNumber).filter(Boolean))
  const expectedBaseIds = new Set(
    Array.from({ length: 118 }, (_, index) => `BS9-${String(index + 1).padStart(3, '0')}`),
  )
  const missingBaseIds = [...expectedBaseIds].filter((id) => !candidateBaseIds.has(id))
  const extraBaseIds = [...candidateBaseIds].filter((id) => !expectedBaseIds.has(id))
  if (missingBaseIds.length || extraBaseIds.length) {
    fail(`Candidate base ID mismatch; missing=${missingBaseIds.join(',') || 'none'} extra=${extraBaseIds.join(',') || 'none'}`)
  }
  const candidateById = new Map(records.map((record) => [record.cardNumber, record]))
  const candidateMissingImages = records
    .filter((record) => typeof record.imageUrl !== 'string' || record.imageUrl.length === 0)
    .map((record) => record.cardNumber)
  if (candidateMissingImages.length > 0) {
    fail(`Candidate records missing imageUrl: ${candidateMissingImages.join(', ')}`)
  }
  const imageUrls = records.map((record) => record.imageUrl)
  if (new Set(imageUrls).size !== imageUrls.length) fail('Candidate imageUrl set contains duplicates')

  const strict = readJson(strictPath)
  const audits = Array.isArray(strict.audits) ? strict.audits : []
  if (audits.length !== records.length) {
    fail(`Strict audit count ${audits.length} does not match candidate count ${records.length}`)
  }
  const strictRows = new Map(audits.map((audit) => [audit.contract?.cardId, audit]))
  if (strictRows.size !== audits.length || [...strictRows.keys()].some((id) => !id)) {
    fail('Strict audit cardId set contains duplicates or missing IDs')
  }
  const strictIds = new Set(strictRows.keys())
  const strictMissing = candidateIds.filter((id) => !strictIds.has(id))
  const strictExtra = [...strictIds].filter((id) => !candidateSet.has(id))
  if (strictMissing.length || strictExtra.length) {
    fail(`Strict ID mismatch; missing=${strictMissing.join(',') || 'none'} extra=${strictExtra.join(',') || 'none'}`)
  }
  const needsReview = [...strictRows.values()]
    .filter((audit) => audit.contract?.status === 'needs-review')
    .map((audit) => audit.contract.cardId)
  const unexpectedReview = needsReview.filter((id) => !reviewWhitelist.has(id))
  if (unexpectedReview.length || needsReview.length !== reviewWhitelist.size) {
    fail(`Unexpected strict needs-review IDs: ${unexpectedReview.join(',') || 'none'}`)
  }

  const browserFiles = [...new Set(browserRoots.flatMap(walkJsonFiles))]
    .filter((filePath) => !filePath.endsWith('bs9-035-contract-debug.json'))
  if (browserFiles.length === 0) fail('No BS9 Browser reports found')
  const browserRows = []
  for (const filePath of browserFiles) {
    const report = readJson(filePath)
    if (!Array.isArray(report.results)) continue
    for (const row of report.results) browserRows.push({ ...row, reportPath: filePath })
  }
  if (browserRows.length === 0) fail('BS9 Browser reports contain no result rows')
  const browserIds = new Set()
  const positiveIds = new Set()
  const negativeIds = new Set()
  const failures = []
  const imageMismatches = []
  const imageNotLoaded = []
  const unknownIds = []
  const concealedImageRows = []
  const positiveRowsById = new Map()

  for (const row of browserRows) {
    const cardId = rowCardId(row)
    const relativeReport = path.relative(root, row.reportPath)
    if (!cardId) {
      unknownIds.push(relativeReport)
      continue
    }
    browserIds.add(cardId)
    if (rowIsNegative(row)) negativeIds.add(cardId)
    else {
      positiveIds.add(cardId)
      const rows = positiveRowsById.get(cardId) ?? []
      rows.push(row)
      positiveRowsById.set(cardId, rows)
    }
    if (row.status !== 'PASS') failures.push(`${cardId} in ${relativeReport}: ${row.status ?? 'missing status'}`)
    const expected = expectedImageUrl(row)
    const candidateImage = candidateById.get(cardId)?.imageUrl
    if (expected && candidateImage && expected !== candidateImage) {
      imageMismatches.push(`${cardId} in ${relativeReport}`)
    }
    const concealed =
      row.applicability === 'concealed-opponent-hand' ||
      row.imageEvidence?.applicability === 'concealed-opponent-hand'
    if (concealed) {
      concealedImageRows.push(cardId)
    } else if (imageField(row, 'exactImageLoaded') !== true) {
      imageNotLoaded.push(`${cardId} in ${relativeReport}`)
    }
  }

  const browserMissing = candidateIds.filter((id) => !browserIds.has(id))
  const browserExtra = [...browserIds].filter((id) => !candidateSet.has(id))
  const noPositive = candidateIds.filter((id) => !positiveIds.has(id))
  const noNegative = candidateIds.filter((id) => !negativeIds.has(id))
  if (
    unknownIds.length ||
    failures.length ||
    imageMismatches.length ||
    imageNotLoaded.length ||
    browserMissing.length ||
    browserExtra.length ||
    noPositive.length ||
    noNegative.length
  ) {
    fail(JSON.stringify({
      unknownIds,
      failures,
      imageMismatches,
      imageNotLoaded,
      browserMissing,
      browserExtra,
      noPositive,
      noNegative,
    }, null, 2))
  }

  // A PASS row proves that the route settled, but a route can still be only a
  // smoke interaction (for example, a FLIP modal whose effect is not exposed
  // in the report).  Keep this second, non-failing classification separate
  // from the strict image/ID gate so the aggregate never turns a smoke route
  // into a false claim of substantive effect settlement.
  const traceOutcomePattern = /效果結算|效果結果|受到|攻擊力|攻擊傷害|HP|放置|棄置|抽了|抽取|返回|回手|結算|免疫|減少|增加|休息|選擇目標|目標：/i
  const traceHasOutcome = (row) => (row.trace ?? []).some((entry) => {
    const steps = Array.isArray(entry.steps) ? entry.steps.filter((step) => typeof step === 'string') : []
    if (steps.length === 0) return false
    const text = steps.join(' ')
    if (entry.commandKind === 'resolve-flip' && /^FLIP 效果結果：已發動/.test(text)) return false
    return traceOutcomePattern.test(text)
  })
  const actionText = (row) => (Array.isArray(row.actions) ? row.actions : []).join(' ')
  const hasRuntimeAssertion = (row) =>
    row.traceHasExecutedEffectEvidence === true ||
    row.effectResolved === true ||
    typeof row.evidence === 'string' ||
    row.pureDamageSettlementEvidence === true ||
    row.hpAfter !== undefined ||
    row.afterHp !== undefined ||
    row.before !== undefined ||
    row.after !== undefined ||
    row.attackAfterSkill !== undefined ||
    row.attackAfter !== undefined ||
    row.restedAfter !== undefined ||
    row.drawCount !== undefined ||
    row.startingHp !== undefined
  const positiveEvidenceClass = (row) => {
    if (row.reviewOnly === true) return 'review-only'
    if (
      row.noOpReason ||
      /vanilla|no[-_ ]?op|legal-no-op|draw[-_ ]?up[-_ ]?to[-_ ]?zero|不抽牌|抽0/i.test(actionText(row))
    ) return 'legal-no-op'
    if (row.effectWitness && typeof row.effectWitness === 'object') return 'effect-witness'
    if (hasRuntimeAssertion(row)) return 'runtime-assertion'
    if (traceHasOutcome(row)) return 'trace-outcome'
    if (actionText(row)) return 'interaction-only'
    return 'smoke-only'
  }
  const evidenceRank = {
    'smoke-only': 0,
    'interaction-only': 1,
    'trace-outcome': 2,
    'runtime-assertion': 3,
    'effect-witness': 4,
    'legal-no-op': 5,
    'review-only': 6,
  }
  const positiveEvidenceById = new Map()
  for (const cardId of candidateIds) {
    const rows = positiveRowsById.get(cardId) ?? []
    const classes = rows.map(positiveEvidenceClass)
    const best = classes.reduce((current, value) =>
      (evidenceRank[value] ?? -1) > (evidenceRank[current] ?? -1) ? value : current,
      'smoke-only',
    )
    positiveEvidenceById.set(cardId, best)
  }
  const evidenceClassCounts = Object.fromEntries(
    [...new Set(positiveEvidenceById.values())].map((className) => [
      className,
      [...positiveEvidenceById.values()].filter((value) => value === className).length,
    ]),
  )
  const substantivePositiveIds = candidateIds.filter((id) =>
    ['effect-witness', 'runtime-assertion', 'trace-outcome'].includes(positiveEvidenceById.get(id)),
  )
  const evidenceGapIds = candidateIds.filter((id) =>
    ['interaction-only', 'smoke-only'].includes(positiveEvidenceById.get(id)),
  )

  const counts = {
    candidateRecords: records.length,
    candidateIds: candidateSet.size,
    candidateBaseIds: candidateBaseIds.size,
    uniqueCandidateImages: imageUrls.length,
    strictRows: audits.length,
    strictVerified: audits.filter((audit) => audit.contract?.status === 'verified').length,
    strictNeedsReview: needsReview.length,
    strictBlocked: audits.filter((audit) => audit.contract?.status === 'blocked').length,
    browserFiles: browserFiles.length,
    browserRows: browserRows.length,
    browserIds: browserIds.size,
    positiveIds: positiveIds.size,
    negativeIds: negativeIds.size,
    concealedImageRows: concealedImageRows.length,
    exactImageLoadedRows: browserRows.length - concealedImageRows.length,
  }
  console.log(JSON.stringify({
    ...counts,
    allIdsAligned: true,
    everyIdHasPositiveAndNegative: true,
    allBrowserRowsPass: true,
    imageMismatches: 0,
    reviewWhitelist: [...reviewWhitelist],
    positiveRowsWithEffectWitness: browserRows.filter((row) => !rowIsNegative(row) && row.effectWitness && typeof row.effectWitness === 'object').length,
    substantivePositiveIds: substantivePositiveIds.length,
    positiveEvidenceClassCounts: evidenceClassCounts,
    positiveEvidenceGapIds: evidenceGapIds,
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(`BS9 evidence audit failed: ${error.message}`)
  process.exitCode = 1
}
