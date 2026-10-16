import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { createDeckAdditionDemoState } from './bs12-deck-addition-demo'
import type { DeckAdditionScenario } from './bs12-deck-addition-demo'
import { createSt8008PreviewState } from './st8-008-demo'
import { createSt8008AiPreviewState } from './st8-008-ai-demo'
import { applyGameCommand } from './commands'
import { commandFromLogEntry } from './replay'

describe('ST8-008 original physical test routes', () => {
  it.each(['positive','negative'] as const)('replays the actual AI %s route from prepared original resources', scenario => {
    const final=createSt8008AiPreviewState(scenario)
    let replay=createSt8008AiPreviewState(scenario,true)
    for(const entry of final.commandLog??[])replay=applyGameCommand(replay,commandFromLogEntry(entry))
    expect(replay).toEqual(final)
    expect(createDeckAdditionDemoState('ST8-008',scenario==='positive'?'ai-positive':'ai-negative')).toEqual(final)
    expect(parseTestStateConfig(`?test-state=deck-addition:ST8-008:ai-${scenario}`,'localhost'))
      .toEqual({kind:'deck-addition',cardNumber:'ST8-008',scenario:`ai-${scenario}`})
  })
  it.each(['ST8-008', 'st8-008'])('normalizes %s in the public card URL', number => {
    expect(parseTestStateConfig(`?test-state=card:${number}`, 'localhost'))
      .toEqual({ kind: 'card-check', cardNumber: 'ST8-008' })
  })
  it('opens the actual own faint and preserves the unsupported-condition negative parent', () => {
    expect(createCardCheckDemoState('ST8-008')).toEqual(createSt8008PreviewState('positive'))
    expect(createCardNegativeDemoState('ST8-008')).toEqual(createSt8008PreviewState('negative'))
  })
  it.each(['faint-equal', 'faint-less', 'faint-more', 'faint-rested', 'faint-source-rested',
    'faint-last-deck', 'faint-top-item', 'faint-top-stage', 'faint-top-blue', 'attack-paid-wind',
    'attack-rested-wind', 'attack-no-wind', 'attack-wind-battle', 'attack-wind-hand',
    'attack-wind-deck', 'attack-wind-opponent', 'attack-no-hand', 'attack-last-deck',
    'source-faint', 'play'])('dispatches the effect-specific %s route without a neutral fallback', scenario => {
    const config = parseTestStateConfig(`?test-state=deck-addition:ST8-008:${scenario}`, 'localhost')
    expect(config).toEqual({ kind: 'deck-addition', cardNumber: 'ST8-008', scenario })
    expect(createDeckAdditionDemoState('ST8-008', scenario as DeckAdditionScenario))
      .toEqual(createSt8008PreviewState(scenario))
  })
})
