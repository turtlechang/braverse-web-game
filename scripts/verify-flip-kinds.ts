/* 引擎層 FLIP 效果 kind 驗證：每種 kind 以真實轉換卡跑 resolveFlip。 */
import { resolveFlip } from '../src/game'
import { cookie, createBattleState } from '../src/game/test-helpers/battle-helpers'
import { convertOfficialCardToGameCard } from '../src/cards/official-card-adapter'
import { normalizeKnownOfficialCardRecord } from '../src/cards/official-card-normalization'
import { officialCardDatasets } from '../src/game/generated-card-pool'
import type { OfficialCardRecord } from '../src/cards/types'
import type { CookieCard, GameCard, GameState, PendingBattle } from '../src/game/types'

const load = (cardNumber: string): OfficialCardRecord | undefined => {
  const all = (officialCardDatasets as unknown as { cards: OfficialCardRecord[] }[])
    .flatMap((s) => s.cards)
    .map(normalizeKnownOfficialCardRecord)
  return all.find((c) => (c.baseCardNumber || c.cardNumber) === cardNumber)
}

type FlipStateOptions = {
  deck?: GameCard[]
  hand?: GameCard[]
  breakArea?: CookieCard[]
  supportArea?: { card: GameCard; rested: boolean }[]
  targetHp?: GameCard[]
}

const flipState = (revealed: GameCard, opts: FlipStateOptions = {}): GameState => {
  const base = createBattleState()
  const p1 = base.players['player-one']
  const defenderCookie = p1.battleArea[0]
  const players: GameState['players'] = {
    ...base.players,
    'player-one': {
      ...p1,
      ...(opts.deck ? { deck: opts.deck } : {}),
      ...(opts.hand ? { hand: opts.hand } : {}),
      ...(opts.breakArea ? { breakArea: opts.breakArea } : {}),
      ...(opts.supportArea ? { supportArea: opts.supportArea } : {}),
      battleArea: [
        {
          ...defenderCookie,
          hpCards: opts.targetHp ?? defenderCookie.hpCards,
        },
      ],
    },
  }
  const pendingBattle: PendingBattle = {
    attackerPlayerId: 'player-two',
    defenderPlayerId: 'player-one',
    attackerInstanceId: 'attacker',
    targetInstanceId: 'defender',
    damageTargetInstanceId: 'defender',
    declaredDamage: 1,
    remainingDamage: 1,
    stage: 'flip',
    trapUsed: false,
    revealedHpCard: revealed,
    preventKnockoutTargetIds: [],
    faintedColors: [],
    attackEffects: [],
    attackEffectIndex: 0,
  }
  return {
    ...base,
    players,
    pendingBattle,
  }
}

let failed = 0
const check = (label: string, cond: boolean, detail: string): void => {
  console.log((cond ? 'PASS ' : 'FAIL ') + label + ' | ' + detail)
  if (!cond) failed += 1
}

const xCard = (cardNumber: string): GameCard => {
  const rec = load(cardNumber)
  if (!rec) throw new Error('missing record ' + cardNumber)
  const conv = convertOfficialCardToGameCard(rec)
  if (conv.status !== 'converted') throw new Error(cardNumber + ' unconverted: ' + conv.status)
  return conv.gameCard
}

{
  const card = xCard('BS3-004')
  const st = flipState(card)
  const before = st.players['player-one'].hand.length
  const next = resolveFlip(st, 'player-one', { activate: true })
  check('BS3-004 draw-up-to 抽 1 張', next.players['player-one'].hand.length === before + 1, 'hand ' + before + '->' + next.players['player-one'].hand.length)
  check('BS3-004 翻開卡進棄牌', next.players['player-one'].discardPile.some((c) => c.id === 'BS3-004'), 'discard')
}

{
  const card = xCard('BS3-012')
  const st = flipState(card, { targetHp: [] })
  const hpBefore = st.players['player-one'].battleArea[0].hpCards.length
  const deckBefore = st.players['player-one'].deck.length
  const next = resolveFlip(st, 'player-one', { activate: true, discardHandIds: ['p1-hand-a'] })
  check('BS3-012 棄 1 後補 1 HP 卡', next.players['player-one'].battleArea[0].hpCards.length === hpBefore + 1, 'hp ' + hpBefore + '->' + next.players['player-one'].battleArea[0].hpCards.length)
  check('BS3-012 牌庫 -1', next.players['player-one'].deck.length === deckBefore - 1, 'deck ' + deckBefore + '->' + next.players['player-one'].deck.length)
  check('BS3-012 棄手牌', next.players['player-one'].discardPile.some((c) => c.instanceId === 'p1-hand-a'), 'hand-a')
}

{
  const card = xCard('BS6-069')
  const st = flipState(card, { targetHp: [] })
  const next = resolveFlip(st, 'player-one', { activate: true, discardHandIds: ['p1-hand-a'] })
  check('BS6-069 attachedHpBonus 補 1 HP 卡', next.players['player-one'].battleArea[0].hpCards.length === 1, 'hpCards=1')
}

{
  const card = xCard('BS1-002')
  const st = flipState(card)
  const next = resolveFlip(st, 'player-one', { activate: true, discardHandIds: ['p1-hand-a'], targetIds: ['attacker'] })
  check('BS1-002 damage 未停滯在 flip', next.pendingBattle ? next.pendingBattle.stage !== 'flip' : true, 'stage=' + (next.pendingBattle ? next.pendingBattle.stage : 'finished'))
}

{
  const card = xCard('BS4-031')
  const ghost: CookieCard = { ...cookie('g1'), level: 5 } as CookieCard
  const st = flipState(card, { breakArea: [ghost] })
  const next = resolveFlip(st, 'player-one', { activate: true })
  check('BS4-031 翻開卡進休息區', next.players['player-one'].breakArea.some((c) => c.id === 'BS4-031'), 'break')
}

{
  const card = xCard('BS1-067')
  const supCard: GameCard = { id: 'sup1', instanceId: 'sup1', name: 'sup1', type: 'item' }
  const rest = { card: supCard, rested: false }
  const st = flipState(card, { supportArea: [rest, rest, rest, rest] })
  const next = resolveFlip(st, 'player-one', { activate: true, discardHandIds: ['p1-hand-a'] })
  const inSupport = next.players['player-one'].supportArea.some((c) => c.card.id === 'BS1-067' && c.rested === true)
  check('BS1-067 翻開卡進支援區（休息）', inSupport, 'support')
}

{
  const card = xCard('BS4-102')
  const st = flipState(card)
  const beforeSelf = st.players['player-one'].deck.length
  const next = resolveFlip(st, 'player-one', { activate: true, chooseOneModeIndex: 0 })
  const afterSelf = next.players['player-one'].deck.length
  check('BS4-102 choose-one 磨光牌庫', afterSelf === 0, 'deck ' + beforeSelf + '->' + afterSelf)
}

console.log(failed === 0 ? 'ALL KINDS PASS' : failed + ' FAILURES')