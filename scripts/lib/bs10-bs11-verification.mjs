import { createHash } from 'node:crypto'

export const sha256 = (value) => createHash('sha256').update(value).digest('hex')
export const recordHash = (record) => sha256(JSON.stringify(record))
export const viewports = [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]
export const flipBranches = ['draw-one', 'draw-zero', 'decline']

// An inventory of SOURCE fragments, never an independent semantic oracle.
export const sourceFragments = (record) => {
  const fragments = []
  if (record.skill?.text) fragments.push({ kind: 'skill', text: record.skill.text })
  if (record.attackText) {
    const split = record.attackText.indexOf('Then')
    fragments.push({ kind: 'attack', text: split < 0 ? record.attackText : record.attackText.slice(0, split) })
    if (split >= 0) fragments.push({ kind: 'attack-then', text: record.attackText.slice(split) })
  }
  if (record.flipText) fragments.push({ kind: 'flip', text: record.flipText })
  return fragments.map((fragment) => ({ ...fragment, id: `${record.cardNumber}/${fragment.kind}` }))
}

export const assessFragment = (record, fragment, reviewed, evidence, fingerprint) => {
  const expectation = reviewed.find((item) => item.cardNumber === record.cardNumber && item.effect === fragment.kind)
  if (!expectation) return { status: 'needs-independent-expectation', missing: ['reviewed source and branch expectations'] }
  if (fragment.text !== expectation.text) return { status: 'source-changed', missing: ['re-review printed text'] }
  const missing = []
  const failures = []
  for (const branch of expectation.branches) for (const viewport of viewports) {
    const key = `${branch}/${viewport.width}x${viewport.height}`
    const rows = evidence.filter((row) => row.cardNumber === record.cardNumber && row.effect === fragment.kind &&
      row.branch === branch && row.viewport?.width === viewport.width && row.viewport?.height === viewport.height)
    const fresh = rows.filter((row) => row.fingerprint === fingerprint && row.recordHash === recordHash(record) &&
      row.artHash === expectation.artHash && row.expectationHash === sha256(JSON.stringify(expectation)))
    // Fail closed: duplicates, failed reruns and incomplete proof cannot be hidden by a PASS row.
    if (fresh.length !== 1 || fresh[0].status !== 'PASS' || fresh[0].normalClicks !== true ||
      fresh[0].exactState !== true || fresh[0].imageLoaded !== true || fresh[0].scope !== 'local-test-state') {
      missing.push(key)
      if (fresh.some((row) => row.status === 'FAIL')) failures.push(key)
    }
  }
  return { status: failures.length ? 'failed' : missing.length ? 'missing-or-stale-evidence' : 'local-browser-verified', missing, failures }
}

export const makeInventory = (records, references, reviewed, evidence, fingerprint) => records.map((record) => ({
  cardNumber: record.cardNumber,
  baseCardNumber: record.baseCardNumber,
  product: record.product?.title,
  imageUrl: record.imageUrl,
  recordHash: recordHash(record),
  // Exact literal matches are navigation hints, not coverage or approval.
  legacyReferences: references.filter((entry) => entry.cardNumbers.includes(record.cardNumber)).map((entry) => entry.path),
  effects: sourceFragments(record).map((fragment) => ({
    ...fragment,
    ...assessFragment(record, fragment, reviewed, evidence, fingerprint),
    formalBattle: 'unverified-by-this-run',
    online: 'unverified-by-this-run',
  })),
}))

export const compareFlipState = (before, after, mode, lethal = false) => {
  const draw = mode === 'draw-one' ? 1 : 0
  const errors = []
  const equal = (actual, expected, label) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push({ label, expected, actual })
  }
  equal(after.bottom.hand, before.bottom.hand + draw - (lethal ? 1 : 0), 'hand count')
  equal(after.bottom.deck, before.bottom.deck - draw - (lethal ? 5 : 0), 'deck count')
  equal(after.bottom.trash, before.bottom.trash + 1, 'revealed HP goes to trash')
  equal(after.bottom.support, before.bottom.support, 'own support unchanged')
  equal(after.top, before.top, 'opponent public state unchanged')
  equal(after.bottom.battle, lethal
    ? [{ id: 'BS10-003-replacement', name: 'Croissant Cookie', hp: 5, rested: false }]
    : before.bottom.battle, 'battle state after damage continuation')
  return errors
}
