import { describe, expect, it } from 'vitest'
import { assessFragment, compareFlipState, makeInventory, recordHash, sha256, sourceFragments, viewports } from './lib/bs10-bs11-verification.mjs'

const record = { cardNumber: 'BS11-003', baseCardNumber: 'BS11-003', flipText: 'Draw up to 1 card from your deck.', attackText: '<{R}{R}{R}> Passionate Step {da} 3' }
const reviewed = [{ cardNumber: record.cardNumber, effect: 'flip', text: record.flipText, artHash: 'art', branches: ['draw-one', 'draw-zero', 'decline'] }]
const proof = () => reviewed[0].branches.flatMap((branch) => viewports.map((viewport) => ({
  cardNumber: record.cardNumber, effect: 'flip', branch, viewport, status: 'PASS', fingerprint: 'current', recordHash: recordHash(record),
  expectationHash: sha256(JSON.stringify(reviewed[0])), artHash: 'art', normalClicks: true, exactState: true, imageLoaded: true, scope: 'local-test-state',
})))
describe('BS10/BS11 evidence acceptance', () => {
  it('never upgrades discovered scripts into semantic coverage or inherits a base proof for a variant', () => {
    const rows = makeInventory([record, { ...record, cardNumber: 'BS11-003@1' }], [{ path: 'old.mjs', cardNumbers: ['BS11-003'] }], reviewed, proof(), 'current')
    expect(rows[0].effects.find((effect) => effect.kind === 'flip').status).toBe('local-browser-verified')
    expect(rows[0].effects.find((effect) => effect.kind === 'attack').status).toBe('needs-independent-expectation')
    expect(rows[1].effects.every((effect) => effect.status === 'needs-independent-expectation')).toBe(true)
  })
  it.each(['fingerprint', 'recordHash', 'artHash', 'expectationHash'])('invalidates changed %s', (field) => {
    const rows = proof(); rows[0][field] = 'changed'
    expect(assessFragment(record, sourceFragments(record)[1], reviewed, rows, 'current').missing).toHaveLength(1)
  })
  it.each(['normalClicks', 'exactState', 'imageLoaded'])('rejects absent %s', (field) => {
    const rows = proof(); rows[0][field] = false
    expect(assessFragment(record, sourceFragments(record)[1], reviewed, rows, 'current').status).toBe('missing-or-stale-evidence')
  })
  it('rejects missing branches, duplicates and failed reruns', () => {
    const fragment = sourceFragments(record)[1]
    expect(assessFragment(record, fragment, reviewed, proof().slice(1), 'current').missing).toHaveLength(1)
    expect(assessFragment(record, fragment, reviewed, [...proof(), proof()[0]], 'current').missing).toHaveLength(1)
    const rows = proof(); rows[0].status = 'FAIL'
    expect(assessFragment(record, fragment, reviewed, rows, 'current').status).toBe('failed')
  })
  it('marks printed text changes for independent review', () => {
    expect(assessFragment(record, { kind: 'flip', text: 'Draw 2.' }, reviewed, proof(), 'current').status).toBe('source-changed')
  })
  it('keeps Then as a separate source fragment', () => {
    expect(sourceFragments({ ...record, attackText: 'Hit {da} 1 Then draw 1.' }).map((item) => item.kind)).toEqual(['attack', 'attack-then', 'flip'])
  })
})

describe('FLIP exact public-state comparator (validator mutations, not engine mutations)', () => {
  const before = { bottom: { hand: 1, deck: 2, trash: 0, support: [], battle: [{ id: 'bearer', hp: 1 }] }, top: { hand: 2 } }
  const after = { bottom: { ...before.bottom, hand: 2, deck: 1, trash: 1 }, top: before.top }
  it('accepts one draw and catches extra draw, free draw, HP, support and opponent mutations', () => {
    expect(compareFlipState(before, after, 'draw-one')).toEqual([])
    for (const mutation of [
      { ...after, bottom: { ...after.bottom, hand: 3 } },
      { ...after, bottom: { ...after.bottom, deck: 2 } },
      { ...after, bottom: { ...after.bottom, battle: [{ id: 'bearer', hp: 2 }] } },
      { ...after, bottom: { ...after.bottom, support: [{ rested: true }] } },
      { ...after, top: { hand: 3 } },
    ]) expect(compareFlipState(before, mutation, 'draw-one').length).toBeGreaterThan(0)
  })
  it.each(['draw-zero', 'decline'])('%s cannot draw a card', (mode) => {
    expect(compareFlipState(before, after, mode).length).toBeGreaterThan(0)
  })
})
