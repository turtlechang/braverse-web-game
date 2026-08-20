import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../official-card-adapter'
import type { OfficialCardRecord } from '../types'
import { analyzeOfficialCardBehavior } from './ledger'

/**
 * 剩餘契約稽核的付款／代價／Then／時機證據回歸。
 *
 * 這批卡曾是 audit 的 needs-review（payment evidence missing ×16、
 * payment clause has no runtime energy evidence ×3、cost evidence missing
 * ×9、Then／once-per-turn／resolution order／timing 各 ×1，合計 25 筆）。
 * 測試以正式 data/cards 記錄建立契約，確認每一張都已與 runtime 證據綁定。
 */
const REGRESSION_CARDS = [
  'BS3-047', 'BS3-096', 'BS4-088', 'BS5-066', 'BS6-043', 'BS6-086',
  'BS1-026', 'BS1-078', 'BS2-051', 'P-125', 'P-028', 'P-032',
  'ST1-022', 'ST4-022', 'ST3-022', 'ST5-022',
  'BS4-080@2', 'BS5-092@1', 'BS5-092', 'BS5-093@1', 'BS5-093',
  'BS2-081', 'P-045', 'P-082', 'P-100',
]

const loadRecords = (): OfficialCardRecord[] => {
  const cardsDir = resolve(process.cwd(), 'data', 'cards')
  return readdirSync(cardsDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .flatMap((file) => {
      const parsed = JSON.parse(readFileSync(resolve(cardsDir, file), 'utf8')) as {
        cards?: OfficialCardRecord[]
      }
      return parsed.cards ?? []
    })
}

const records = loadRecords()

describe('contract payment/cost/then evidence regression', () => {
  it.each(REGRESSION_CARDS)('%s binds all source clauses to runtime evidence', (cardNumber) => {
    const record = records.find((card) => card.cardNumber === cardNumber)
    expect(record, 'missing data record ' + cardNumber).toBeDefined()
    const audit = analyzeOfficialCardBehavior(record!)
    expect(audit.contract.status, audit.errors.join(' | ')).toBe('verified')
    expect(audit.errors, audit.errors.join(' | ')).toEqual([])
    expect(audit.checks.paymentCovered).toBe(true)
    expect(audit.checks.costCovered).toBe(true)
    expect(audit.checks.targetCovered).toBe(true)
    expect(audit.checks.resolutionOrderCovered).toBe(true)
    expect(audit.checks.timingCovered).toBe(true)
  })

  it('stage placement cost is collected as runtime energy evidence', () => {
    const audit = analyzeOfficialCardBehavior(
      records.find((card) => card.cardNumber === 'ST3-022')!,
    )
    // ST3-022 只有「《{G}》 Place in your stage area.」一個能量付款子句。
    expect(audit.contract.payments).toHaveLength(1)
    expect(audit.runtime.energyCosts).toContainEqual({ green: 1 })
  })

  it('BS5-092 models the bracketed return-to-deck clause as a trashToDeck cost', () => {
    const record = records.find((card) => card.cardNumber === 'BS5-092')!
    const converted = convertOfficialCardToGameCard(record)
    expect(converted.status).toBe('converted')
    if (converted.status !== 'converted') throw new Error('conversion failed')
    expect(converted.gameCard.skill?.trigger).toBe('opponent-attack')
    expect(converted.gameCard.skill?.cost.trashToDeck).toEqual({
      count: 3,
      nonCookieOnly: true,
    })
  })

  it('BS5-093 models the purple non-FLIP return-to-deck clause as a trashToDeck cost', () => {
    const record = records.find((card) => card.cardNumber === 'BS5-093')!
    const converted = convertOfficialCardToGameCard(record)
    expect(converted.status).toBe('converted')
    if (converted.status !== 'converted') throw new Error('conversion failed')
    expect(converted.gameCard.skill?.trigger).toBe('activate')
    expect(converted.gameCard.skill?.cost.trashToDeck).toEqual({
      count: 3,
      energyColor: 'purple',
      excludeFlip: true,
      cookieOnly: true,
    })
  })

  it('BS4-080@2 normalization splits skill and attack and carries the Then draw', () => {
    const record = records.find((card) => card.cardNumber === 'BS4-080@2')!
    const converted = convertOfficialCardToGameCard(record)
    expect(converted.status).toBe('converted')
    if (converted.status !== 'converted') throw new Error('conversion failed')
    const gameCard = converted.gameCard
    if (gameCard.type !== 'cookie') throw new Error('expected cookie card')
    expect(gameCard.skill?.trigger).toBe('block')
    expect(gameCard.skill?.oncePerTurn).toBe(true)
    expect(gameCard.skill?.restSource).toBe(true)
    expect(gameCard.attackText).toContain('Then,')
    expect(gameCard.attackEffects).toContainEqual(
      expect.objectContaining({
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'hand-count-at-most', count: 5 },
      }),
    )
  })

  it.each([
    'BS4-014',
    'BS4-014@1',
    'BS4-080',
    'BS4-080@1',
    'BS4-080@2',
  ])('%s keeps both the Blocker redirect and its printed modifier', (cardNumber) => {
    const record = records.find((card) => card.cardNumber === cardNumber)!
    const converted = convertOfficialCardToGameCard(record)
    expect(converted.status).toBe('converted')
    if (converted.status !== 'converted') throw new Error('conversion failed')

    expect(converted.gameCard.skill?.trigger).toBe('block')
    expect(converted.gameCard.skill?.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'redirect-attack' }),
        expect.objectContaining({ kind: 'modify-damage-received', amount: -1 }),
      ]),
    )
  })

  it.each(['BS4-080@1', 'BS4-080@2'])(
    '%s carries the promotion-only attack Then draw',
    (cardNumber) => {
      const record = records.find((card) => card.cardNumber === cardNumber)!
      const converted = convertOfficialCardToGameCard(record)
      expect(converted.status).toBe('converted')
      if (converted.status !== 'converted') throw new Error('conversion failed')
      if (converted.gameCard.type !== 'cookie') {
        throw new Error('expected cookie card')
      }

      expect(converted.gameCard.attackEffects).toContainEqual(
        expect.objectContaining({
          kind: 'draw-up-to',
          max: 2,
          condition: { kind: 'hand-count-at-most', count: 5 },
        }),
      )
    },
  )

  it('BS2-079 binds the printed Then order to runtime effect indexes', () => {
    const record = records.find((card) => card.cardNumber === 'BS2-079')!
    const converted = convertOfficialCardToGameCard(record)
    expect(converted.status).toBe('converted')
    if (converted.status !== 'converted') throw new Error('conversion failed')
    const gameCard = converted.gameCard
    expect(gameCard.trap?.effects.map((effect) => effect.kind)).toEqual([
      'modify-attack',
      'trash-to-deck',
    ])

    const orderedAudit = analyzeOfficialCardBehavior(record, gameCard)
    expect(orderedAudit.checks.resolutionOrderCovered).toBe(true)
    expect(orderedAudit.contract.status).toBe('verified')

    const swappedEffects = [...(gameCard.trap?.effects ?? [])].reverse()
    const swappedAudit = analyzeOfficialCardBehavior(record, {
      ...gameCard,
      effects: swappedEffects,
      trap: gameCard.trap
        ? { ...gameCard.trap, effects: swappedEffects }
        : undefined,
    })
    expect(swappedAudit.checks.resolutionOrderCovered).toBe(false)
    expect(swappedAudit.errors).toContain('resolution order evidence missing')
    expect(swappedAudit.contract.status).toBe('needs-review')
  })

  it('P-100 normalization restores the FLIP ability with its discard cost', () => {
    const record = records.find((card) => card.cardNumber === 'P-100')!
    const converted = convertOfficialCardToGameCard(record)
    expect(converted.status).toBe('converted')
    if (converted.status !== 'converted') throw new Error('conversion failed')
    const p100Card = converted.gameCard
    if (p100Card.type !== 'cookie') throw new Error('expected cookie card')
    expect(p100Card.attackEnergyCost).toEqual({ blue: 1 })
    expect(p100Card.flip?.cost.discardHand).toBe(1)
    expect(p100Card.flip?.attachedHpBonus).toBe(1)
  })

  it('P-099 normalization restores the FLIP draw ability from its misplaced attack text', () => {
    const record = records.find((card) => card.cardNumber === 'P-099')!
    const converted = convertOfficialCardToGameCard(record)
    expect(converted.status).toBe('converted')
    if (converted.status !== 'converted') throw new Error('conversion failed')
    const p099Card = converted.gameCard
    if (p099Card.type !== 'cookie') throw new Error('expected cookie card')
    // 官方把「Draw up to 1 card from your deck.」併進 attackText 尾段；修正後
    // 攻擊文字回復為 "<{G}> Alien Pup Secret Agent {da} 1"，FLIP 能力單獨存在。
    expect(p099Card.attackText).toBe('<{G}> Alien Pup Secret Agent {da} 1')
    expect(p099Card.attackEnergyCost).toEqual({ green: 1 })
    expect(p099Card.flip?.text).toBe('Draw up to 1 card from your deck.')
    expect(p099Card.flip?.cost).toEqual({ energy: {}, discardHand: 0 })
    expect(p099Card.flip?.effects).toContainEqual({ kind: 'draw-up-to', max: 1 })
    // effectText 不再空白，CardDetailModal 的 FLIP 段落能渲染。
    expect(p099Card.effectText).toContain('Draw up to 1 card from your deck.')
  })

  it('P-045 keeps the hand-to-deck-bottom payment as the first effect, not a double cost', () => {
    const record = records.find((card) => card.cardNumber === 'P-045')!
    const converted = convertOfficialCardToGameCard(record)
    expect(converted.status).toBe('converted')
    if (converted.status !== 'converted') throw new Error('conversion failed')
    expect(converted.gameCard.skill?.cost).toEqual({ energy: {}, discardHand: 0 })
    expect(converted.gameCard.skill?.effects[0]).toEqual({
      kind: 'discard-hand',
      count: 1,
      destination: 'deck-bottom',
    })
  })
})
