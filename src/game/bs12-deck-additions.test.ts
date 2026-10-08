import { describe, expect, it } from 'vitest'
import { createDeckAdditionDemoState as fixture, DECK_ADDITION_CARD_NUMBERS } from './bs12-deck-addition-demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { isEffectConditionMet } from './effects'
import { analyzeOfficialCardBehavior } from '../cards/contracts'
import { normalizeOfficialCardRecord } from '../cards/official-card-adapter'
import records from '../../data/cards/official-bs12-deck-additions.en.json'
import type { OfficialCardRecord } from '../cards/types'
import type { CookieCard, GameState } from './types'

const playerId = 'player-one' as const
const foeId = 'player-two' as const
const settle = (initial: GameState): GameState => {
  let state = initial
  for (let i = 0; i < 20 && state.pendingBattle?.stage === 'damage'; i++) {
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: state.pendingBattle.defenderPlayerId })
  }
  return state
}

describe('BS12 牌組九張新增實體卡', () => {
  const attack = (number: string, scenario: 'attack' | 'attack-negative' = 'attack') => {
    let state = fixture(number, scenario)
    state = applyGameCommand(state, {kind:'declare-attack', playerId,
      attackerInstanceId: state.players[playerId].battleArea[0].card.instanceId,
      targetInstanceId: state.players[foeId].battleArea[0].card.instanceId,
      supportPaymentIds: state.players[playerId].supportArea.slice(0,3).map(s=>s.card.instanceId)})
    state = applyGameCommand(state,{kind:'skip-trap',playerId:foeId})
    state = settle(state)
    if(state.pendingBattle?.stage==='attack-effect')state=applyGameCommand(state,{kind:'resolve-attack-effect',playerId,
      targetIds:number==='P-175'?[state.pendingBattle.targetInstanceId]:[]})
    return state
  }

  it.each(['ST10-002','ST10-008'])('%s 攻擊Then必須真正棄置紫色材料與全部HP，錯色不得支付', number => {
    const state = attack(number)
    expect(state.pendingOptionalCostAttack).toBeTruthy()
    const material = state.players[playerId].battleArea[1]
    const paid = applyGameCommand(state,{kind:'resolve-optional-cost-attack',playerId,action:'pay',targetIds:[material.card.instanceId]})
    expect(paid.commandLog?.at(-1)?.steps?.some(step=>step.text.includes('攻擊後代價：將「Cream Puff Cookie」'))).toBe(true)
    expect(paid.players[playerId].battleArea).toHaveLength(1)
    for(const card of [material.card,...material.hpCards])expect(paid.players[playerId].discardPile.some(c=>c.instanceId===card.instanceId)).toBe(true)
    if(number==='ST10-002')expect(paid.pendingDrawUpTo?.max).toBe(2)
    else expect(settle(paid).players[foeId].battleArea.some(c=>c.card.id==='BS12-059')).toBe(false)
    const blocked = attack(number,'attack-negative')
    expect(()=>applyGameCommand(blocked,{kind:'resolve-optional-cost-attack',playerId,action:'pay',targetIds:[blocked.players[playerId].battleArea[1].card.instanceId]})).toThrow()
  })

  it.each(['P-175','P-176'])('%s 真正普通攻擊後依門檻追加傷害或補HP',number=>{
    for(const scenario of ['attack','attack-negative'] as const){
      const state = settle(attack(number,scenario))
      if(number==='P-175')expect(state.players[foeId].battleArea.some(c=>c.card.id==='BS12-059')).toBe(scenario==='attack-negative')
      else expect(state.players[playerId].battleArea[0].hpCards).toHaveLength(scenario==='attack'?5:4)
    }
  })
  it('ST10-002 支付後抽2再棄1，不能取消已完成代價',()=>{
    const state=attack('ST10-002')
    const material=state.players[playerId].battleArea[1].card.instanceId
    const paid=applyGameCommand(state,{kind:'resolve-optional-cost-attack',playerId,action:'pay',targetIds:[material]})
    const drawn=applyGameCommand(paid,{kind:'resolve-draw-up-to',playerId,drawCount:2})
    expect(drawn.players[playerId].hand).toHaveLength(2)
    const discarded=drawn.players[playerId].hand[1].instanceId
    const result=applyGameCommand(drawn,{kind:'resolve-opponent-hand-discard',playerId,cardIds:[discarded]})
    expect(result.players[playerId].hand).toHaveLength(1)
    expect(result.players[playerId].discardPile.some(c=>c.instanceId===discarded)).toBe(true)
    expect(result.pendingOptionalCostAttack).toBeFalsy()
  })
  it.each(DECK_ADDITION_CARD_NUMBERS)('%s 來源契約與原始文字皆保留', (number) => {
    const raw = records.cards.find((card) => card.cardNumber === number) as OfficialCardRecord
    const audit = analyzeOfficialCardBehavior(raw)
    expect(audit.errors).toEqual([])
    expect(audit.contract.status).toBe('verified')
    if (number.startsWith('P-17')) {
      expect(raw.attackText).toContain('Card Name :')
      expect(normalizeOfficialCardRecord(raw).attackText).not.toContain('Card Name :')
    }
  })

  it.each(DECK_ADDITION_CARD_NUMBERS.flatMap((number) => ['positive', 'negative', 'low', 'attack', 'attack-negative'].map(
    (scenario) => ({ number, scenario: scenario as 'positive' | 'negative' | 'low' | 'attack' | 'attack-negative' }),
  )))('$number $scenario 每區保留實體身分、唯一ID與四張上限', ({ number, scenario }) => {
    const state = fixture(number, scenario)
    for (const player of Object.values(state.players)) {
      const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea, ...player.supportArea.map((s) => s.card),
        ...player.battleArea.flatMap((c) => [c.card, ...c.hpCards])]
      expect(new Set(cards.map((c) => c.instanceId)).size).toBe(cards.length)
      const counts = cards.reduce<Record<string, number>>((result, c) => ({ ...result, [c.id]: (result[c.id] ?? 0) + 1 }), {})
      expect(Object.values(counts).every((count) => count <= 4)).toBe(true)
      expect(cards.every((c) => c.imageUrl?.startsWith('https://cookierunbraverse.com/'))).toBe(true)
    }
  })

  it.each(['ST8-018', 'ST10-019'])('%s 基本減攻、門檻追加與選零使用同一目標', (number) => {
    for (const scenario of ['positive', 'low'] as const) {
      const state = fixture(number, scenario)
      const result = applyGameCommand(state, { kind: 'play-trap', playerId, trapInstanceId: state.players[playerId].hand[0].instanceId,
        paymentIds: [state.players[playerId].supportArea[0].card.instanceId],
        targetIds: [state.players[foeId].battleArea[0].card.instanceId] })
      expect(result.attackModifiers.filter((m) => m.targetInstanceId === state.players[foeId].battleArea[0].card.instanceId)
        .reduce((sum, m) => sum + m.amount, 0)).toBe(scenario === 'positive' ? -2 : -1)
      expect(result.players[playerId].supportArea[0].rested).toBe(true)
      expect(result.players[playerId].discardPile.some((c) => c.id === number)).toBe(true)
    }
    const state = fixture(number)
    const zero = applyGameCommand(state, { kind: 'play-trap', playerId, trapInstanceId: state.players[playerId].hand[0].instanceId,
      paymentIds: [state.players[playerId].supportArea[0].card.instanceId], targetIds: [] })
    expect(zero.attackModifiers).toEqual([])
  })

  it('ST9-016 必付兩藍與恰好三手牌後對選中對手造成3；代價不足拒絕', () => {
    const state = fixture('ST9-016')
    const result = settle(applyGameCommand(state, { kind: 'play-item', playerId, instanceId: state.players[playerId].hand[0].instanceId,
      paymentIds: state.players[playerId].supportArea.slice(0, 2).map((s) => s.card.instanceId),
      discardHandIds: state.players[playerId].hand.slice(1).map((c) => c.instanceId),
      effectTargets: [[state.players[foeId].battleArea[0].card.instanceId]] }))
    expect(result.players[foeId].battleArea[0].hpCards).toHaveLength(1)
    expect(result.players[foeId].battleArea[1].hpCards).toHaveLength(state.players[foeId].battleArea[1].hpCards.length)
    expect(result.players[playerId].discardPile).toHaveLength(4)
    const blocked = fixture('ST9-016', 'negative')
    expect(() => applyGameCommand(blocked, { kind: 'play-item', playerId, instanceId: blocked.players[playerId].hand[0].instanceId,
      paymentIds: [], discardHandIds: blocked.players[playerId].hand.slice(1).map((c) => c.instanceId), effectTargets: [[]] })).toThrow()
  })

  it('ST10-013 必棄己方紫色LV1並付P，對手LV2以下移棄牌，異色代價拒絕', () => {
    const state = fixture('ST10-013')
    const target = state.players[foeId].battleArea[1].card.instanceId
    const result = applyGameCommand(state, { kind: 'play-item', playerId, instanceId: state.players[playerId].hand[0].instanceId,
      paymentIds: [state.players[playerId].supportArea[0].card.instanceId],
      trashBattleCookieIds: [state.players[playerId].battleArea[1].card.instanceId], effectTargets: [[target]] })
    expect(result.players[foeId].battleArea.some((c) => c.card.instanceId === target)).toBe(false)
    expect(result.players[foeId].discardPile.some((c) => c.instanceId === target)).toBe(true)
    expect(result.players[playerId].battleArea).toHaveLength(1)
    const blocked = fixture('ST10-013', 'negative')
    expect(() => applyGameCommand(blocked, { kind: 'play-item', playerId, instanceId: blocked.players[playerId].hand[0].instanceId,
      paymentIds: [blocked.players[playerId].supportArea[4].card.instanceId],
      trashBattleCookieIds: [blocked.players[playerId].battleArea[1].card.instanceId], effectTargets: [[]] })).toThrow()
  })

  it('P-175 真正由效果活躍後抽1與追加1；自然活躍拒絕', () => {
    const state = fixture('P-175')
    const source = state.players[playerId].battleArea[0].card.instanceId
    expect(state.commandLog?.some((entry) => entry.commandKind === 'activate-skill')).toBe(true)
    const result = settle(applyGameCommand(state, { kind: 'activate-skill', playerId, sourceInstanceId: source,
      trigger: 'activate', paymentIds: [], effectTargets: [[], [state.players[foeId].battleArea[0].card.instanceId]] }))
    expect(result.players[playerId].hand).toHaveLength(state.players[playerId].hand.length + 1)
    expect(result.players[foeId].battleArea[0].hpCards).toHaveLength(3)
    expect(canActivateCookieSkill(result, playerId, source, 'activate')).toBe(false)
    const blocked = fixture('P-175', 'negative')
    expect(canActivateCookieSkill(blocked, playerId, blocked.players[playerId].battleArea[0].card.instanceId, 'activate')).toBe(false)
    const active = fixture('P-175', 'attack-negative')
    const effect = active.players[playerId].battleArea[0].card.attackEffects![0]
    expect(isEffectConditionMet(active, { sourcePlayerId: playerId, sourceInstanceId: active.players[playerId].battleArea[0].card.instanceId }, effect)).toBe(false)
    const rested = fixture('P-175', 'attack')
    expect(isEffectConditionMet(rested, { sourcePlayerId: playerId, sourceInstanceId: rested.players[playerId].battleArea[0].card.instanceId }, effect)).toBe(true)
  })

  it('P-176 OnPlay以四張Arena為門檻，LV1可非Arena；三張不移牌', () => {
    for (const scenario of ['positive', 'low'] as const) {
      const state = fixture('P-176', scenario)
      const source = state.players[playerId].battleArea.at(-1)!.card.instanceId
      const target = state.players[playerId].breakArea[0].instanceId
      expect(canActivateCookieSkill(state, playerId, source, 'on-play')).toBe(scenario === 'positive')
      const result = scenario === 'positive'
        ? applyGameCommand(state, { kind: 'activate-skill', playerId, sourceInstanceId: source,
          trigger: 'on-play', paymentIds: [], effectTargets: [[target]] })
        : applyGameCommand(state, { kind: 'skip-on-play', playerId, sourceInstanceId: source })
      expect(result.players[playerId].breakArea).toHaveLength(3)
      expect(result.players[playerId].discardPile.some((c) => c.instanceId === target)).toBe(scenario === 'positive')
    }
    const state = fixture('P-176')
    const nonArena = state.players[playerId].deck.find(c=>c.type==='cookie'&&c.level===1&&!c.keywords?.includes('arena'))!
    const prepared = {...state, players:{...state.players,[playerId]:{...state.players[playerId],
      deck:state.players[playerId].deck.filter(c=>c.instanceId!==nonArena.instanceId),
      breakArea:[...state.players[playerId].breakArea,nonArena as CookieCard]}}}
    const result = applyGameCommand(prepared,{kind:'activate-skill',playerId,
      sourceInstanceId:prepared.players[playerId].battleArea.at(-1)!.card.instanceId, trigger:'on-play',paymentIds:[],effectTargets:[[nonArena.instanceId]]})
    expect(result.players[playerId].discardPile.some(c=>c.instanceId===nonArena.instanceId)).toBe(true)
  })

  it('ST10-002 OnPlay只登場紫色LV2以下；免費選零可略過', () => {
    const state = fixture('ST10-002')
    const source = state.players[playerId].battleArea.at(-1)!.card.instanceId
    const target = state.players[playerId].discardPile[0].instanceId
    const result = applyGameCommand(state, { kind: 'activate-skill', playerId, sourceInstanceId: source,
      trigger: 'on-play', paymentIds: [], effectTargets: [[target]] })
    expect(result.players[playerId].battleArea.some((entry) => entry.card.instanceId === target)).toBe(true)
    expect(result.players[playerId].battleArea.find((entry) => entry.card.instanceId === target)?.hpCards).toHaveLength(3)
    const blocked = fixture('ST10-002', 'negative')
    expect(() => applyGameCommand(blocked, { kind: 'activate-skill', playerId,
      sourceInstanceId: blocked.players[playerId].battleArea.at(-1)!.card.instanceId,
      trigger: 'on-play', paymentIds: [], effectTargets: [[blocked.players[playerId].discardPile[0].instanceId]] })).toThrow()
  })

  it('ST10-008 棄牌15張才全體追加1，14張不能啟動OnPlay', () => {
    const state = fixture('ST10-008')
    const source = state.players[playerId].battleArea.at(-1)!.card.instanceId
    const result = settle(applyGameCommand(state, { kind: 'activate-skill', playerId, sourceInstanceId: source,
      trigger: 'on-play', paymentIds: [], effectTargets: [state.players[foeId].battleArea.map((c) => c.card.instanceId)] }))
    expect(result.players[foeId].battleArea[0].hpCards).toHaveLength(3)
    expect(result.players[foeId].breakArea.some((card) => card.id === 'BS7-062')).toBe(true)
    const blocked = fixture('ST10-008', 'low')
    expect(canActivateCookieSkill(blocked, playerId, blocked.players[playerId].battleArea.at(-1)!.card.instanceId, 'on-play')).toBe(false)
  })

  it('ST10-007 實際受傷揭示FLIP後棄一手牌補原持有者1HP；不足時拒絕', () => {
    const state = fixture('ST10-007')
    const before = state.players[playerId].battleArea[0].hpCards.length
    const result = applyGameCommand(state, { kind: 'resolve-flip', playerId, activate: true,
      discardHandIds: [state.players[playerId].hand[0].instanceId] })
    expect(result.players[playerId].battleArea[0].hpCards).toHaveLength(before + 1)
    expect(result.players[playerId].hand).toHaveLength(0)
    const blocked = fixture('ST10-007', 'negative')
    expect(() => applyGameCommand(blocked, { kind: 'resolve-flip', playerId, activate: true, discardHandIds: [] })).toThrow()
  })
})
