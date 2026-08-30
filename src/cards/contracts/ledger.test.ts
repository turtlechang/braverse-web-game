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

  it('rejects a FLIP card whose official flip text has no runtime FlipAbility', () => {
    const source = makeRecord({
      cardNumber: 'BS7-002',
      baseCardNumber: 'BS7-002',
      type: 'flip',
      officialType: 'FLIP',
      attackText: '<{R}{R}> Test {da} 2',
      flipText:
        'If there is a {R} 【Arena】 Cookie in your battle area, the LV.2 or higher Cookie with this card attached for HP gains +1 HP.',
    })
    const runtime = makeCard({ attack: 2, attackCost: 2, attackEnergyCost: { red: 2 } })

    const audit = analyzeOfficialCardBehavior(source, runtime)

    expect(audit.contract.status).toBe('needs-review')
    expect(audit.errors).toContain('FLIP text has no runtime flip ability')
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

  it('accepts an explicit target on next-Active-Phase prevention', () => {
    const source = makeRecord({
      skill: {
        name: 'Freeze',
        text: "Select up to 1 of your opponent's LV.1 Cookies. That Cookie is not set as active during your opponent's next Active Phase.",
      },
    })
    const runtime = makeCard({
      effects: [{
        kind: 'prevent-cookie-active-next-phase',
        target: { side: 'opponent', min: 0, max: 1, minLevel: 1, maxLevel: 1 },
      }],
    })

    expect(analyzeOfficialCardBehavior(source, runtime).checks.targetCovered).toBe(true)
  })

  it('binds an LV-qualified trash-to-break cost before a fixed bounded-sum return', () => {
    const source = makeRecord({
      skill: {
        name: 'Inspect',
        text: '【On Play】 <{Y}> <Place 1 LV.3 Cookie from your trash into your break area.> Select 2 Cookies in your break area with a total LV. sum of 3 or lower. Return those Cookies to your hand.',
      },
    })
    const runtime = makeCard({
      skill: {
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { yellow: 1 } },
        text: source.skill.text ?? '',
        effects: [
          { kind: 'trash-to-break', amount: 1, exactLevel: 3 },
          {
            kind: 'break-to-hand-by-level-sum',
            targetSum: 3,
            targetSumMode: 'at-most',
            cardCount: 2,
          },
        ],
      },
    })

    const audit = analyzeOfficialCardBehavior(source, runtime)
    expect(audit.contract.status, audit.errors.join(' | ')).toBe('verified')
    expect(audit.checks.costCovered).toBe(true)
    expect(audit.checks.targetCovered).toBe(true)
  })

  it('does not classify a bracketed one-from-each-player target as a cost', () => {
    const source = makeRecord({
      skill: {
        name: 'Spice',
        text: '【Activate】 【Once Per Turn】 <{R}> <Select 1 Cookie from each player.> Those Cookies receive 1 damage.',
      },
    })
    const runtime = makeCard({
      skill: {
        trigger: 'activate',
        oncePerTurn: true,
        yourTurn: false,
        restSource: false,
        cost: { energy: { red: 1 } },
        text: source.skill.text ?? '',
        effects: [
          { kind: 'damage', amount: 1, target: { side: 'self', min: 1, max: 1 } },
          { kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } },
        ],
      },
    })

    const audit = analyzeOfficialCardBehavior(source, runtime)
    expect(audit.contract.status, audit.errors.join(' | ')).toBe('verified')
    expect(audit.checks.costCovered).toBe(true)
    expect(audit.checks.targetCovered).toBe(true)
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

  it('keeps LV.1 in the target selector instead of truncating at the period', () => {
    const source = makeRecord({
      skill: {
        name: 'Level target',
        text: "Select up to 1 of your opponent's LV.1 Cookies.",
      },
    })
    const runtime = makeCard({
      skill: {
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: {},
        text: source.skill.text ?? '',
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
        }],
      },
    })
    const audit = analyzeOfficialCardBehavior(source, runtime)
    expect(audit.contract.targets[0]).toMatchObject({
      selector: { side: 'opponent', min: 0, max: 1, minLevel: 1, maxLevel: 1 },
    })
    expect(audit.contract.targets[0].unresolved).toBeUndefined()
  })

  it('keeps the Arena keyword when either-side battle targets are audited', () => {
    const source = makeRecord({
      skill: {
        name: 'Arena damage',
        text: "Select up to 1 【Arena】 Cookie in either player's battle area. That Cookie receives 1 damage.",
      },
    })
    const runtime = makeCard({
      skill: {
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: {},
        text: source.skill.text ?? '',
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'either', min: 0, max: 1, keyword: 'arena' },
        }],
      },
    })
    const audit = analyzeOfficialCardBehavior(source, runtime)
    expect(audit.checks.targetCovered).toBe(true)
    expect(audit.errors).not.toContain('target evidence unresolved')
  })

  it('treats an unqualified battle area selection as either player\'s battle area', () => {
    const source = makeRecord({
      skill: {
        name: 'Battle target',
        text: 'Select up to 1 Cookie in the battle area. That Cookie receives 1 damage.',
      },
    })
    const runtime = makeCard({
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: {},
        text: source.skill.text ?? '',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'either', min: 0, max: 1 },
          },
        ],
      },
    })

    const audit = analyzeOfficialCardBehavior(source, runtime)
    expect(audit.contract.targets[0]).toMatchObject({
      selector: { side: 'either', min: 0, max: 1 },
      zone: 'battle',
    })
    expect(audit.errors).not.toContain('target evidence unresolved')
  })

  it('keeps the no-Skill restriction on Arena battle targets', () => {
    const source = makeRecord({
      cardNumber: 'BS7-036',
      baseCardNumber: 'BS7-036',
      skill: {
        name: 'Unfaltering Stance',
        text: '【On Play】 Select up to 1 【Arena】 Cookie that does not have 【Skill】 in your battle area. That Cookie gains +1 HP.',
      },
    })
    const runtime = makeCard({
      skill: {
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: {},
        text: source.skill.text ?? '',
        effects: [{
          kind: 'gain-hp',
          amount: 1,
          target: { side: 'self', min: 0, max: 1, keyword: 'arena', noSkillOnly: true },
        }],
      },
    })
    const audit = analyzeOfficialCardBehavior(source, runtime)
    expect(audit.contract.targets[0]).toMatchObject({
      selector: { side: 'self', min: 0, max: 1, keyword: 'arena', noSkillOnly: true },
    })
    expect(audit.checks.targetCovered).toBe(true)
    expect(audit.errors).not.toContain('target evidence unresolved')
  })

  it('audits a required support-area Cookie selection as a target, not an unknown cost', () => {
    const source = makeRecord({
      cardNumber: 'BS7-057',
      baseCardNumber: 'BS7-057',
      skill: {
        name: 'Elimination mode on!',
        text: '【Activate】 <{G}{G}> <Select 1 LV.2 or higher 【Arena】 Cookie from your support area.> Place this card in your support area as rested. Then, play that Cookie.',
      },
    })
    const runtime = makeCard({
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { green: 2 } },
        text: source.skill.text ?? '',
        effects: [
          { kind: 'place-source-to-support', rested: true },
          {
            kind: 'support-to-battle',
            amount: 1,
            optional: false,
            minLevel: 2,
            keyword: 'arena',
          },
        ],
      },
    })
    const audit = analyzeOfficialCardBehavior(source, runtime)
    expect(audit.contract.costs).toHaveLength(0)
    expect(audit.contract.targets[0]).toMatchObject({
      selector: { side: 'self', min: 1, max: 1, minLevel: 2, keyword: 'arena' },
      zone: 'support',
    })
    expect(audit.checks.targetCovered).toBe(true)
    expect(audit.contract.status).toBe('verified')
  })

  it('classifies an Arena Cookie HP payment as hp-to-trash, not battle movement', () => {
    const source = makeRecord({
      skill: {
        name: 'Arena HP cost',
        text: '【On Play】 <Place 1 card from the top of your 【Arena】 Cookie\'s HP in your battle area into the trash.> Draw up to 1 card from your deck.',
      },
    })
    const runtime = makeCard({
      skill: {
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { hpToTrash: { amount: 1, keyword: 'arena' } },
        text: source.skill.text ?? '',
        effects: [{ kind: 'draw-up-to', max: 1 }],
      },
    })
    const audit = analyzeOfficialCardBehavior(source, runtime)
    expect(audit.contract.costs).toContainEqual(expect.objectContaining({ kind: 'hp-to-trash' }))
    expect(audit.checks.costCovered).toBe(true)
  })

  it('reads direct colour keys in an AbilityCost as payment evidence', () => {
    const source = makeRecord({
      attackText: '<{R}{N}> Deals 1 damage.',
    })
    const runtime = makeCard({
      attackEnergyCost: { red: 1, neutral: 1 },
    })
    const audit = analyzeOfficialCardBehavior(source, runtime)
    expect(audit.checks.paymentCovered).toBe(true)
    expect(audit.errors).not.toContain('payment evidence missing')
  })

  it('binds a self-to-trash optional cost instead of classifying it as unknown', () => {
    const source = makeRecord({
      attackText: '<{P}> <Place this Cookie in the trash.> Then, play 1 Cookie.',
    })
    const runtime = makeCard({
      attackEnergyCost: { purple: 1 },
      attackEffects: [{
        kind: 'optional-cost-attack',
        cost: { energy: { purple: 1 }, selfToTrash: true },
        effects: [],
        effectText: 'Place this Cookie in the trash.',
      }],
    })
    const audit = analyzeOfficialCardBehavior(source, runtime)
    expect(audit.contract.costs).toContainEqual(expect.objectContaining({ kind: 'self-to-trash' }))
    expect(audit.checks.costCovered).toBe(true)
    expect(audit.contract.status).toBe('verified')
  })

  it('classifies a self-to-deck-bottom cost when the official text omits "your"', () => {
    const source = makeRecord({
      skill: {
        name: 'Deck-bottom cost',
        text: '【Activate】 <Place this Cookie on the bottom of the deck.> Draw up to 1 card from your deck.',
      },
    })
    const runtime = makeCard({
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0, selfToDeckBottom: true },
        text: source.skill.text ?? '',
        effects: [{ kind: 'draw-up-to', max: 1 }],
      },
    })

    const audit = analyzeOfficialCardBehavior(source, runtime)

    expect(audit.contract.costs).toContainEqual(
      expect.objectContaining({ kind: 'self-to-deck-bottom' }),
    )
    expect(audit.checks.costCovered).toBe(true)
    expect(audit.contract.status).toBe('verified')
  })

  it('binds a source-and-hand break cost and a named break-area play in order', () => {
    const source = makeRecord({
      cardNumber: 'BS8-032',
      baseCardNumber: 'BS8-032',
      skill: {
        name: 'Constant Vigilance',
        text: '【Activate】 【Once Per Turn】 If there is a Cookie in your break area, <place this Cookie and a Cookie that is LV.2 or above from your hand into your break area.> Draw up to 2 cards from your deck. Then, play up to 1 [Golden Cheese Cookie] from your break area.',
      },
    })
    const runtime = makeCard({
      skill: {
        trigger: 'activate',
        oncePerTurn: true,
        yourTurn: false,
        restSource: false,
        cost: {},
        text: source.skill.text ?? '',
        effects: [
          {
            kind: 'battle-to-break',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
            condition: { kind: 'break-area-has-card', side: 'self' },
          },
          { kind: 'hand-to-break', amount: 1, minLevel: 2 },
          { kind: 'draw-up-to', max: 2 },
          { kind: 'break-to-battle', amount: 1, cardName: 'Golden Cheese Cookie' },
        ],
      },
    })

    const audit = analyzeOfficialCardBehavior(source, runtime)

    expect(audit.contract.costs.map((cost) => cost.kind)).toEqual([
      'battle-to-break',
      'hand-to-break',
    ])
    expect(audit.contract.targets).toContainEqual(expect.objectContaining({
      selector: { side: 'self', min: 0, max: 1, cardName: 'Golden Cheese Cookie' },
      zone: 'break',
    }))
    expect(audit.contract.clauses.filter((clause) => clause.role === 'unsupported')).toHaveLength(0)
    expect(audit.contract.status).toBe('verified')
  })

  it('binds a break-area target to the level of the preceding trash-to-break card', () => {
    const source = makeRecord({
      cardNumber: 'BS8-035',
      baseCardNumber: 'BS8-035',
      skill: {
        name: 'Fantastic Magic Show',
        text: '【On Play】 <Place 1 Cookie from your trash into the break area.> Place up to 1 Cookie with the same LV. as that Cookie from your break area into your trash.',
      },
    })
    const runtime = makeCard({
      skill: {
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: {},
        text: source.skill.text ?? '',
        effects: [
          { kind: 'trash-to-break', amount: 1 },
          {
            kind: 'break-to-trash',
            max: 1,
            sameLevelAsPreviousEffectTarget: true,
          },
        ],
      },
    })

    const audit = analyzeOfficialCardBehavior(source, runtime)

    expect(audit.contract.targets).toContainEqual(expect.objectContaining({
      selector: {
        side: 'self',
        min: 0,
        max: 1,
        sameLevelAsPreviousEffectTarget: true,
      },
      zone: 'break',
    }))
    expect(audit.checks.targetCovered).toBe(true)
    expect(audit.contract.status).toBe('verified')
  })

  it('accepts the ordered attackEffects array as Then evidence', () => {
    const source = makeRecord({
      attackText: '<{R}> Deals 1 damage. Then, draw up to 1 card from your deck.',
    })
    const runtime = makeCard({
      attackEnergyCost: { red: 1 },
      attackEffects: [
        { kind: 'draw-up-to', max: 1 },
      ],
    })
    const audit = analyzeOfficialCardBehavior(source, runtime)
    expect(audit.checks.resolutionOrderCovered).toBe(true)
    expect(audit.errors).not.toContain('resolution order evidence missing')
  })

  it('does not treat the Blocker keyword as a timing marker', () => {
    const source = makeRecord({
      attackText: '<{R}> During this turn, your opponent cannot activate 【Blocker】.',
    })
    const runtime = makeCard({
      attackEnergyCost: { red: 1 },
      attackEffects: [{ kind: 'disable-block', duration: 'this-turn', side: 'opponent' }],
    })
    const audit = analyzeOfficialCardBehavior(source, runtime)
    expect(audit.contract.timing.markers).not.toContain('bl')
    expect(audit.checks.timingCovered).toBe(true)
  })

  it('classifies HP, battle-area return, and reveal/discard clauses from official brackets', () => {
    const source = makeRecord({
      skill: {
        name: 'Parser variants',
        text: "<Place 1 card from the top of this Cookie's HP into the trash.> <Return 1 {B} LV.1 Cookie from your battle area to your hand.> <Reveal 2 【Arena】 cards from your hand.>",
      },
    })
    const audit = analyzeOfficialCardBehavior(source, makeCard())
    expect(audit.contract.clauses.filter((clause) => clause.role === 'unsupported')).toHaveLength(0)
    expect(audit.contract.costs.map((cost) => cost.kind)).toEqual([
      'hp-to-trash',
      'battle-to-hand',
      'reveal-hand',
    ])
  })

  it('treats raw single-letter energy exports as payment evidence', () => {
    const source = makeRecord({
      skill: {
        name: 'Raw payment',
        text: '{mob} <R> Draw up to 1 card from your deck.',
      },
    })
    const audit = analyzeOfficialCardBehavior(source, makeCard())
    expect(audit.contract.payments).toContainEqual(
      expect.objectContaining({ kind: 'energy', energy: { red: 1 } }),
    )
    expect(audit.contract.clauses.filter((clause) => clause.role === 'unsupported')).toHaveLength(0)
  })
})
