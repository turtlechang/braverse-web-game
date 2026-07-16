import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../src/cards'
import { getAllCardPoolEntries } from '../src/game/card-pool'
import type { GameCard } from '../src/game/types'
import { validateCardEffectSemantics } from './lib/card-effect-validation'

const getConvertedCard = (cardNumber: string) => {
  const entry = getAllCardPoolEntries().find((card) => card.cardNumber === cardNumber)
  if (!entry) throw new Error(`Missing fixture ${cardNumber}`)
  const conversion = convertOfficialCardToGameCard(entry)
  if (conversion.status !== 'converted') throw new Error(`Unsupported fixture ${cardNumber}`)
  return { entry, card: conversion.gameCard }
}

describe('validateCardEffectSemantics', () => {
  it('accepts every enabled card in the current official pool', () => {
    const errors = getAllCardPoolEntries().flatMap((entry) => {
      if (!entry.flags.enabled || entry.flags.hidden || entry.type === 'extra' || entry.type === 'unknown') {
        return []
      }
      const conversion = convertOfficialCardToGameCard(entry)
      return conversion.status === 'converted'
        ? validateCardEffectSemantics(entry, conversion.gameCard)
        : [`${entry.cardNumber}: unsupported`]
    })

    expect(errors).toEqual([])
  })

  it('rejects a cookie skill shell with no executable effects', () => {
    const { entry, card } = getConvertedCard('ST5-007')
    const brokenCard: GameCard = {
      ...card,
      skill: card.skill ? { ...card.skill, effects: [] } : undefined,
    }

    expect(validateCardEffectSemantics(entry, brokenCard)).toContain(
      'ST5-007 Yoga Cookie: 技能文字必須轉出含至少 1 個效果的 skill',
    )
  })

  it('rejects a high-risk contract when ST5-022 optional draw becomes mandatory', () => {
    const { entry, card } = getConvertedCard('ST5-022')
    const brokenCard: GameCard = {
      ...card,
      stageAbility: card.stageAbility
        ? { ...card.stageAbility, effects: [{ kind: 'draw', amount: 1 }] }
        : undefined,
    }

    const errors = validateCardEffectSemantics(entry, brokenCard)
    expect(errors.some((error) => error.includes('You can draw 1'))).toBe(true)
    expect(errors.some((error) => error.includes('stageAbility.effects.0.kind'))).toBe(true)
  })

  it('rejects a high-risk compound trap when its second effect disappears', () => {
    const { entry, card } = getConvertedCard('BS2-079')
    const brokenCard: GameCard = {
      ...card,
      trap: card.trap
        ? { ...card.trap, effects: card.trap.effects.slice(0, 1) }
        : undefined,
    }

    const errors = validateCardEffectSemantics(entry, brokenCard)
    expect(errors.some((error) => error.includes('trap.effects.length'))).toBe(true)
    expect(errors.some((error) => error.includes('trap.effects.1.kind'))).toBe(true)
  })
})
