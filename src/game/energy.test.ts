import { describe, expect, it } from 'vitest'
import {
  isEnergyColorCompatibleWithCost,
  selectEnergyPayment,
  validateEnergyPayment,
  type GameCard,
  type SupportCard,
} from '.'

const createSupport = (
  instanceId: string,
  energyColor: GameCard['energyColor'],
  rested = false,
  cardColor?: GameCard['cardColor'],
): SupportCard => ({
  card: {
    id: instanceId,
    instanceId,
    name: instanceId,
    type: 'item',
    energyColor,
    ...(cardColor ? { cardColor } : {}),
  },
  rested,
})

describe('energy payment', () => {
  const supports = [
    createSupport('red', 'red'),
    createSupport('blue', 'blue'),
    createSupport('wild', 'wild'),
    createSupport('rested-red', 'red', true),
  ]

  it('validates colored and neutral energy selections', () => {
    expect(
      validateEnergyPayment(
        { red: 1, neutral: 1 },
        supports,
        ['red', 'blue'],
      ),
    ).toMatchObject({ valid: true })
  })

  it('reports wrong colors and incorrect card counts', () => {
    expect(
      validateEnergyPayment({ red: 1 }, supports, ['blue']),
    ).toMatchObject({
      valid: false,
      reason: '所選支援卡的能量顏色不符合費用需求。',
    })
    expect(
      validateEnergyPayment({ red: 2 }, supports, ['red']),
    ).toMatchObject({
      valid: false,
      reason: '需要選擇 2 張支援卡，目前已選 1 張。',
    })
  })

  it('uses wild energy for missing colors and ignores rested supports', () => {
    expect(
      validateEnergyPayment(
        { red: 2 },
        supports,
        ['red', 'wild'],
      ),
    ).toMatchObject({ valid: true })
    expect(
      selectEnergyPayment({ red: 2 }, supports),
    ).toEqual(['red', 'wild'])
  })

  it('uses PURE support cards for Mix Cost but not specified colors', () => {
    const pureSupports = [createSupport('pure', 'pure', false, 'pure')]

    expect(
      validateEnergyPayment({ pure: 1 }, pureSupports, ['pure']),
    ).toMatchObject({ valid: true })
    expect(
      validateEnergyPayment({ red: 1 }, pureSupports, ['pure']),
    ).toMatchObject({ valid: false })
    expect(isEnergyColorCompatibleWithCost({ red: 1 }, 'pure')).toBe(false)
    expect(
      validateEnergyPayment({ neutral: 1 }, pureSupports, ['pure']),
    ).toMatchObject({ valid: true })
    expect(selectEnergyPayment({ pure: 1 }, pureSupports)).toEqual(['pure'])
    expect(selectEnergyPayment({ neutral: 1 }, pureSupports)).toEqual(['pure'])
  })

  it('treats BLACK as its own specified color while allowing it for Mix Cost', () => {
    const blackSupports = [createSupport('black', 'black')]

    expect(
      validateEnergyPayment({ black: 1 }, blackSupports, ['black']),
    ).toMatchObject({ valid: true })
    expect(
      validateEnergyPayment({ red: 1 }, blackSupports, ['black']),
    ).toMatchObject({ valid: false })
    expect(
      validateEnergyPayment({ neutral: 1 }, blackSupports, ['black']),
    ).toMatchObject({ valid: true })
  })

  it('allows every active support as a candidate for neutral attack costs', () => {
    const neutralSupports = [
      createSupport('red-neutral', 'red'),
      createSupport('untyped-neutral', undefined),
      createSupport('blue-neutral', 'blue'),
    ]

    expect(
      isEnergyColorCompatibleWithCost({ neutral: 3 }, undefined),
    ).toBe(true)
    expect(
      isEnergyColorCompatibleWithCost({ red: 1, neutral: 1 }, 'blue'),
    ).toBe(true)
    expect(isEnergyColorCompatibleWithCost({ red: 1 }, 'blue')).toBe(false)
    expect(
      validateEnergyPayment(
        { neutral: 3 },
        neutralSupports,
        ['red-neutral', 'untyped-neutral', 'blue-neutral'],
      ),
    ).toMatchObject({ valid: true })
  })
})
