import { describe, expect, it } from 'vitest'
import type { GameCard } from '../../game'
import type { OfficialCardRecord } from '../types'
import { analyzeOfficialCardBehavior } from './ledger'

const makeRecord = (overrides: Partial<OfficialCardRecord> = {}): OfficialCardRecord => ({
  sourceId: 1,
  locale: 'en',
  cardNumber: 'TEST-001',
  baseCardNumber: 'TEST-001',
  variant: null,
  name: 'Contract Test Cookie',
  type: 'cookie',
  officialType: 'COOKIE',
  rarity: 'C',
  grade: 'COMMON',
  level: 1,
  hp: 2,
  energyType: 'PURPLE',
  color: 'PURPLE',
  skill: { name: 'Test', text: null },
  attackText: null,
  flipText: null,
  keywords: [],
  product: { id: 1, title: 'Test', category: null },
  restrictions: { banned: false, limited: false },
  flags: { enabled: true, hidden: false, extra: false },
  imageUrl: 'https://example.invalid/card.webp',
  officialUpdatedAt: null,
  sourceUrl: 'https://example.invalid/cards.json',
  ...overrides,
})

const makeCard = (overrides: Partial<GameCard> = {}): GameCard => ({
  id: 'TEST-001',
  instanceId: 'TEST-001:1',
  name: 'Contract Test Cookie',
  type: 'cookie',
  level: 1,
  hp: 2,
  attack: 1,
  attackCost: 0,
  attackEnergyCost: {},
  ...overrides,
})

describe('card behavior contract shadow ledger', () => {
  it('detects a missing energy payment on a faint-triggered play', () => {
    const source = makeRecord({
      skill: {
        name: 'Remember',
        text: 'When this Cookie faints, <can be used as {P}.> Play up to 1 {P} Cookie from your trash.',
      },
    })
    const runtime = makeCard({
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: {},
        text: source.skill.text ?? '',
        effects: [{ kind: 'trash-to-battle', amount: 1, optional: true, energyColor: 'purple' }],
        faint: true,
      },
    })
    const audit = analyzeOfficialCardBehavior(source, runtime)
    expect(audit.checks.paymentCovered).toBe(false)
    expect(audit.errors).toContain('payment evidence missing')
  })

  it('accepts source-energy when runtime carries the same energy on the effect', () => {
    const source = makeRecord({
      skill: {
        name: 'Remember',
        text: 'When this Cookie faints, <can be used as {P}.> Play up to 1 {P} Cookie from your trash.',
      },
    })
    const runtime = makeCard({
      effects: [{
        kind: 'trash-to-battle',
        amount: 1,
        optional: true,
        energyColor: 'purple',
        energyCost: { purple: 1 },
      }],
    })
    expect(analyzeOfficialCardBehavior(source, runtime).checks.paymentCovered).toBe(true)
  })

  it('catches a Select up to target whose runtime min changed to one', () => {
    const source = makeRecord({
      skill: {
        name: 'Target',
        text: "Select up to 1 of your opponent's Cookies.",
      },
    })
    const runtime = makeCard({
      effects: [{
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1 },
      }],
    })
    const audit = analyzeOfficialCardBehavior(source, runtime)
    expect(audit.checks.targetCovered).toBe(false)
    expect(audit.errors).toContain('target evidence unresolved')
  })

  it('requires an ordered runtime Then continuation', () => {
    const source = makeRecord({
      skill: {
        name: 'Then',
        text: 'Deal 1 damage. Then, draw up to 1 card from your deck.',
      },
    })
    const runtime = makeCard({ effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } }] })
    const audit = analyzeOfficialCardBehavior(source, runtime)
    expect(audit.checks.resolutionOrderCovered).toBe(false)
    expect(audit.errors).toContain('resolution order evidence missing')
  })

  it('does not use a card name to excuse an unsupported cost clause', () => {
    const source = makeRecord({
      cardNumber: 'BS6-101',
      baseCardNumber: 'BS6-101',
      name: 'A different display name',
      skill: { name: 'Unknown', text: 'When this Cookie faints, <Choose a secret payment.> Play up to 1 Cookie from your trash.' },
    })
    const audit = analyzeOfficialCardBehavior(source, makeCard())
    expect(audit.contract.costs.some((cost) => cost.kind === 'unknown')).toBe(true)
    expect(audit.contract.status).toBe('needs-review')
  })

  it('changes the provenance hash when official text changes', () => {
    const first = analyzeOfficialCardBehavior(makeRecord({ attackText: '<{R}> Attack {da} 1' }), makeCard())
    const second = analyzeOfficialCardBehavior(makeRecord({ attackText: '<{R}> Attack {da} 2' }), makeCard())
    expect(first.contract.sourceHash).not.toBe(second.contract.sourceHash)
  })
})
