import { describe, expect, it } from 'vitest'
import {
  isEnergyColorCompatibleWithCost,
  getRemainingEnergyCost,
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

  it('pays Mix Cost with the most plentiful color and saves wild energy for later', () => {
    // 舊實作是照支援區順序抓，會先把 wild／稀有色燒在 Mix Cost 上，
    // 同一回合後面要付指定色時就付不出來。
    const mixed = [
      createSupport('red-1', 'red'),
      createSupport('wild-1', 'wild'),
      createSupport('blue-1', 'blue'),
      createSupport('red-2', 'red'),
    ]

    expect(selectEnergyPayment({ neutral: 2 }, mixed)).toEqual([
      'red-1',
      'red-2',
    ])
    expect(selectEnergyPayment({ blue: 1, neutral: 1 }, mixed)).toEqual([
      'blue-1',
      'red-1',
    ])
    // 只剩 wild 可用時仍然照付，不會因為想保留而付不出來。
    expect(
      selectEnergyPayment({ neutral: 1 }, [createSupport('wild-only', 'wild')]),
    ).toEqual(['wild-only'])
  })

  it('subtracts source-provided energy before choosing support payments', () => {
    expect(
      getRemainingEnergyCost({ red: 2 }, { red: 2 }),
    ).toEqual({})
    expect(
      getRemainingEnergyCost({ red: 2, neutral: 1 }, { red: 1 }),
    ).toEqual({ red: 1, neutral: 1 })
    expect(
      getRemainingEnergyCost({ neutral: 2 }, { blue: 1 }),
    ).toEqual({ neutral: 1 })
  })
})
