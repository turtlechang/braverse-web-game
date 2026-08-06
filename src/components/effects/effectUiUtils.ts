import type { CardEffect, CardSkill } from '../../game'

export const getSkillLabels = (skill: CardSkill) => [
  skill.trigger === 'activate'
    ? 'Activate 啟動'
    : skill.trigger === 'on-play'
      ? 'OnPlay 登場'
      : 'Skill',
  ...(skill.oncePerTurn ? ['每回合一次'] : []),
  ...(skill.yourTurn ? ['你的回合'] : []),
]

const targetText = (
  effect: Extract<CardEffect, { target: unknown }>,
): { target: string; count: string } => ({
  target:
    effect.target.side === 'self'
      ? '我方餅乾'
      : effect.target.side === 'opponent'
        ? '對手餅乾'
        : '雙方餅乾',
  count:
    effect.target.min === effect.target.max
      ? `${effect.target.max} 張`
      : `最多 ${effect.target.max} 張`,
})

export const describeEffect = (effect: CardEffect) => {
  if (effect.kind === 'draw') return `抽 ${effect.amount} 張牌。`
  if (effect.kind === 'draw-up-to') return `最多抽 ${effect.max} 張牌。`
  if (effect.kind === 'draw-until-hand-equals-opponent') {
    return '抽牌直到手牌數與對手相同。'
  }
  if (effect.kind === 'hand-to-deck-and-draw') return '將手牌洗回牌庫後抽同樣張數。'
  if (effect.kind === 'deck-to-support') {
    return `從牌庫頂放 ${effect.amount} 張到支援區。`
  }
  if (effect.kind === 'modify-attack-cost') {
    return '選擇符合條件的餅乾，令其本回合攻擊費用改為任意能量。'
  }
  if (effect.kind === 'multiply-attack-damage') {
    return `符合條件時攻擊傷害乘以 ${effect.multiplier}。`
  }
  if (effect.kind === 'break-to-trash') {
    return `從 break 區選最多 ${effect.max} 張 LV.${effect.exactLevel} 放入棄牌區。`
  }
  if (effect.kind === 'gain-hp') return `獲得 ${effect.amount} HP。`
  if (effect.kind === 'support-to-trash') {
    return `將 ${effect.amount} 張支援區卡放入棄牌區。`
  }
  if (effect.kind === 'support-to-hand') {
    return `將 ${effect.amount} 張支援區卡返回手牌。`
  }
  if (effect.kind === 'trash-to-battle') {
    return `從棄牌區選 ${effect.amount} 張餅乾登場。`
  }
  if (effect.kind === 'modify-all-attack') {
    return `全體${effect.side === 'self' ? '我方' : '對手'}餅乾攻擊傷害 ${effect.amount >= 0 ? '+' : ''}${effect.amount}。`
  }
  if (effect.kind === 'damage-all') {
    if (effect.sequential) {
      return `依點選順序，逐一對所有${effect.side === 'self' ? '我方' : '對手'}餅乾造成 ${effect.amount} 點傷害；每次傷害先處理 FLIP 與昏厥。`
    }
    return `所有${effect.side === 'self' ? '我方' : '對手'}餅乾受到 ${effect.amount} 傷害。`
  }
  if (effect.kind === 'discard-hand') return `棄掉 ${effect.count} 張手牌。`
  if (effect.kind === 'discard-hand-all') return '將整手牌放入棄牌區。'
  if (effect.kind === 'opponent-discard-hand') {
    return `對手棄掉 ${effect.count} 張手牌。`
  }
  if (effect.kind === 'opponent-random-discard') {
    return `對手隨機棄掉 ${effect.count} 張手牌。`
  }
  if (effect.kind === 'opponent-battle-to-trash') {
    return effect.destination === 'break'
      ? '將符合條件的對手餅乾放入休息區。'
      : '將符合條件的對手餅乾放入棄牌區。'
  }
  if (effect.kind === 'make-faint') {
    return '選擇目標餅乾使其昏厥。'
  }
  if (effect.kind === 'place-source-to-support') {
    return '將這張卡放入支援區。'
  }
  if (effect.kind === 'set-active') {
    return `將最多 ${effect.supportCount} 張支援區卡設為活躍。`
  }
  if (effect.kind === 'inspect-deck') {
    return `查看牌庫頂 ${effect.lookCount} 張，選 ${effect.pickCount} 張。`
  }
  if (effect.kind === 'optional-cost-attack') return effect.effectText
  if (effect.kind === 'trash-to-support') {
    return `從棄牌區選擇 ${effect.amount} 張餅乾放入支援區。`
  }
  if (effect.kind === 'disable-block') {
    return '本回合對手不能發動 {bl}。'
  }
  if (effect.kind === 'hp-to-trash') {
    return `選擇 ${effect.amount} 張 HP 卡放入棄牌區。`
  }
  if (effect.kind === 'draw-up-to-then-discard') {
    return `最多抽 ${effect.max} 張牌，然後棄 ${effect.discardCount} 張。`
  }
  if (effect.kind === 'draw-up-to-opponent-fainted-this-turn') {
    return `依對手本回合昏厥餅乾數，最多各抽 ${effect.amountPerFainted} 張。`
  }
  if (effect.kind === 'prevent-effect-damage') {
    return '此餅乾不受效果傷害。'
  }
  if (effect.kind === 'field-to-trash-all') {
    return '雙方符合條件的餅乾放入棄牌區。'
  }
  if (effect.kind === 'field-to-deck-bottom-all') {
    return '將雙方符合條件的餅乾放到各自牌庫底。'
  }
  if (effect.kind === 'trash-to-hand') {
    return `從棄牌區選最多 ${effect.max} 張卡返回手牌。`
  }
  if (effect.kind === 'trash-to-deck') {
    return effect.destination === 'bottom'
      ? `從棄牌區選最多 ${effect.max} 張卡，依選取順序放到牌庫底。`
      : `從棄牌區選最多 ${effect.max} 張卡洗回牌庫。`
  }
  if (effect.kind === 'trash-to-deck-all') {
    return '將棄牌區所有卡牌洗回牌庫。'
  }
  if (effect.kind === 'draw-up-to-battle-cookie-count') {
    return `雙方戰鬥區每有 1 隻 LV.${effect.level} 餅乾，最多抽 ${effect.amountPerCookie} 張牌。`
  }
  if (effect.kind === 'choose-one') {
    return `選擇一項：${effect.modes.map((mode) => mode.label).join('／')}。`
  }
  if (effect.kind === 'reveal-bottom-deck') {
    return '揭示牌庫底 1 張，餅乾放到牌庫頂，其他卡加入手牌。'
  }
  if (effect.kind === 'reveal-top-deck') {
    const matchDesc = effect.match
      ? [
          effect.match.type && `類型:${effect.match.type}`,
          effect.match.energyColor && `顏色:${effect.match.energyColor}`,
          effect.match.level && `LV.${effect.match.level}`,
        ]
          .filter(Boolean)
          .join(', ')
      : '無條件'
    return `翻開牌庫頂 1 張，若為 ${matchDesc}，則發動後續效果。`
  }
  if (effect.kind === 'hand-to-battle') {
    return `從手牌選最多 ${effect.amount} 張餅乾登場${
      effect.gainHp ? `，並額外獲得 ${effect.gainHp} HP` : ''
    }。`
  }
  if (effect.kind === 'opponent-trash-to-break') {
    return `從對手棄牌區選最多 ${effect.max} 張餅乾放入對手休息區。`
  }
  if (effect.kind === 'break-to-battle') {
    return `從 break 區選最多 ${effect.amount} 張餅乾登場。`
  }
  if (effect.kind === 'support-to-battle') {
    return `從支援區選最多 ${effect.amount} 張餅乾登場。`
  }
  if (effect.kind === 'break-to-hand-by-level-sum') {
    return `從 break 區選擇餅乾，等級總和需為 ${effect.targetSum}，返回手牌。`
  }
  if (effect.kind === 'hand-to-break-by-level-sum') {
    return `從手牌選擇餅乾，等級總和需恰好為 ${effect.targetSum}，放入休息區。`
  }
  if (effect.kind === 'set-cookie-active') return '將餅乾設為活躍。'
  if (effect.kind === 'deck-to-trash') {
    const owner = effect.side === 'self' ? '我方' : '對手'
    return `強制：將${owner}牌庫頂 ${effect.amount} 張牌放入棄牌區。`
  }
  if (effect.kind === 'rest-support') return `休息 ${effect.amount} 張支援區卡。`
  if (effect.kind === 'rest-support-and-damage') {
    return `休息最多 ${effect.supportAmount} 張支援區卡，並依休息張數造成傷害。`
  }
  if (effect.kind === 'stage-source-to-deck') return '場景卡已放回牌庫。'
  if (effect.kind === 'stage-source-to-trash') return '場景卡已放入棄牌區。'
  if (effect.kind === 'break-source-to-battle') return '從休息區登場。'
  if (effect.kind === 'hand-to-break') return '手牌餅乾已放入休息區。'
  if (effect.kind === 'flip-to-support') return 'FLIP 卡已放入支援區。'
  if (effect.kind === 'flip-to-break') return '將這張 FLIP 卡放入休息區。'
  if (effect.kind === 'trash-to-break') return '棄牌區卡已放入休息區。'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = (effect as any).target != null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? targetText(effect as any)
    : null
  if (effect.kind === 'damage' && t) {
    return `選擇 ${t.count}${t.target}，造成 ${effect.amount} 傷害。`
  }
  if (effect.kind === 'split-damage' && t) {
    return `選擇 ${t.count}${t.target}，第一個目標造成 ${effect.primaryAmount} 傷害，第二個目標造成 ${effect.secondaryAmount} 傷害。`
  }
  if (effect.kind === 'damage-by-break-level-difference' && t) {
    return `選擇 ${t.count}${t.target}，依雙方休息區等級差造成傷害。`
  }
  if (effect.kind === 'damage-by-break-count' && t) {
    return `選擇 ${t.count}${t.target}，依 break 區條件造成傷害。`
  }
  if (effect.kind === 'modify-attack-by-break-count' && t) {
    return `選擇 ${t.count}${t.target}，依 break 區條件調整攻擊傷害。`
  }
  if (effect.kind === 'redirect-attack' && t) {
    return `選擇 ${t.count}${t.target}，將本次攻擊改向該餅乾。`
  }
  if (effect.kind === 'prevent-knockout' && t) {
    return `選擇 ${t.count}${t.target}，本次戰鬥 HP 不會降到 0。`
  }
  if (effect.kind === 'field-to-trash' && t) {
    return `選擇 ${t.count}${t.target}或場景，放入棄牌區。`
  }
  if (effect.kind === 'return-to-hand' && t) {
    return `選擇 ${t.count}${t.target}返回手牌。`
  }
  if (effect.kind === 'field-to-deck-bottom' && t) {
    return `選擇 ${t.count}${t.target} 放到持有者牌庫底。`
  }
  if (effect.kind === 'return-to-deck-bottom' && t) {
    return `選擇 ${t.count}${t.target}返回牌庫底。`
  }
  if (effect.kind === 'disable-flip' && t) {
    return `選擇 ${t.count}${t.target}，本回合不能發動 FLIP。`
  }
  if (effect.kind === 'view-hp' && t) return `查看 ${t.count}${t.target}的 HP。`
  if (effect.kind === 'battle-to-support' && t) {
    return `選擇 ${t.count}${t.target}放入支援區。`
  }
  if (effect.kind === 'battle-to-break' && t) {
    return `選擇 ${t.count}${t.target}放入 break 區。`
  }
  if (effect.kind === 'disable-attack' && t) {
    return `選擇 ${t.count}${t.target}，下回合不能攻擊。`
  }
  if (effect.kind === 'hand-to-support' && t) {
    return `選擇 ${t.count}${t.target}，將手牌卡放入支援區。`
  }
  if (effect.kind === 'break-to-hand' && t) {
    return `選擇 ${t.count}${t.target}從休息區返回手牌。`
  }
  if (effect.kind === 'hp-to-support' && t) {
    return `選擇 ${t.count}${t.target}，將其 1 張 HP 卡放入支援區。`
  }
  if (effect.kind === 'cycle-hp' && t) {
    return `選擇 ${t.count}${t.target}，取回最上方 HP 後可放回 1 張手牌。`
  }
  if (effect.kind === 'hand-to-hp' && t) {
    return `選擇 ${t.count}${t.target}，將 1 張手牌當作 HP 卡。`
  }
  if (effect.kind === 'hp-to-hand' && t) {
    return `選擇 ${t.count}${t.target}，將 1 張 HP 卡加入手牌。`
  }
  if (effect.kind === 'support-to-hp' && t) {
    return `選擇 ${t.count}${t.target}，支援區卡成為 HP。`
  }
  if (effect.kind === 'equip-source' && t) {
    return `選擇 ${t.count}${t.target}，裝載這張卡。`
  }
  if (effect.kind === 'battle-to-deck-top' && t) {
    return `選擇 ${t.count}${t.target}放回牌庫頂。`
  }
  if (effect.kind === 'transfer-hp' && t) {
    return effect.direction === 'to-source'
      ? `選擇 ${t.count}${t.target}，將其 ${effect.amount} 張 HP 卡移到這張餅乾上。`
      : `選擇 ${t.count}${t.target}，將這張餅乾的 ${effect.amount} 張 HP 卡移過去。`
  }
  if ((effect.kind === 'modify-attack' || effect.kind === 'modify-damage-received') && t) {
    const amount = effect.amount
    return effect.kind === 'modify-attack'
      ? `選擇 ${t.count}${t.target}，攻擊傷害 ${amount >= 0 ? '+' : ''}${amount}。`
      : `選擇 ${t.count}${t.target}，受到的攻擊傷害 ${amount >= 0 ? '+' : ''}${amount}。`
  }

  return `效果已處理。`
}
export const describeEffectResult = (
  effect: CardEffect,
  targetNames: string[],
) => {
  const names = targetNames.length > 0 ? targetNames.join('、') : '效果'

  if (effect.kind === 'draw') return `抽了 ${effect.amount} 張牌。`
  if (effect.kind === 'draw-up-to') return `最多可抽 ${effect.max} 張牌。`
  if (effect.kind === 'hand-to-deck-and-draw') return '已重抽手牌。'
  if (effect.kind === 'deck-to-support') return `放了 ${effect.amount} 張到支援區。`
  if (effect.kind === 'deck-to-trash') {
    const owner = effect.side === 'self' ? '我方' : '對手'
    return `${owner}牌庫頂 ${effect.amount} 張牌已放入棄牌區。`
  }
  if (effect.kind === 'modify-attack-cost') return `${names} 本回合攻擊費用已改變。`
  if (effect.kind === 'multiply-attack-damage') return `攻擊傷害乘以 ${effect.multiplier}。`
  if (effect.kind === 'break-to-trash') {
    if (targetNames.length === 0) return '沒有選擇休息區目標。'
    return 'break 區卡已放入棄牌區。'
  }
  if (effect.kind === 'gain-hp') return `${names} 獲得 ${effect.amount} HP。`
  if (effect.kind === 'support-to-trash') return '支援區卡已放入棄牌區。'
  if (effect.kind === 'support-to-hand') return '支援區卡已返回手牌。'
  if (effect.kind === 'trash-to-battle') return '棄牌區餅乾已登場。'
  if (effect.kind === 'damage-all') return '全體傷害已結算。'
  if (effect.kind === 'modify-all-attack') return '全體攻擊修正已套用。'
  if (effect.kind === 'discard-hand') return '已建立棄手牌決策。'
  if (effect.kind === 'opponent-discard-hand') return '已要求對手棄手牌。'
  if (effect.kind === 'opponent-random-discard') return '對手已隨機棄手牌。'
  if (effect.kind === 'opponent-battle-to-trash') return effect.destination === 'break' ? '對手餅乾已放入休息區。' : '對手餅乾已放入棄牌區。'
  if (effect.kind === 'make-faint') return `${names} 已昏厥。`
  if (effect.kind === 'place-source-to-support') return '已放入支援區。'
  if (effect.kind === 'set-active') return '支援區卡已設為活躍。'
  if (effect.kind === 'inspect-deck') return '已查看牌庫。'
  if (effect.kind === 'optional-cost-attack') return '攻擊後續效果已處理。'
  if (effect.kind === 'damage') return `${names} 受到 ${effect.amount} 傷害。`
  if (effect.kind === 'damage-by-break-count') return `${names} 受到 break 計算傷害。`
  if (effect.kind === 'modify-attack-by-break-count') {
    return `${names} 依 break 區條件調整攻擊傷害。`
  }
  if (effect.kind === 'redirect-attack') return `本次攻擊已改向 ${names}。`
  if (effect.kind === 'prevent-knockout') return `${names} 已受到保護。`
  if (effect.kind === 'field-to-trash') return `${names} 已放入棄牌區。`
  if (effect.kind === 'return-to-hand') return `${names} 已返回手牌。`
  if (effect.kind === 'return-to-deck-bottom') return `${names} 已返回牌庫底。`
  if (effect.kind === 'disable-flip') return `${names} 本回合不能發動 FLIP。`
  if (effect.kind === 'view-hp') return `已查看 ${names} 的 HP。`
  if (effect.kind === 'battle-to-support') return `${names} 已放入支援區。`
  if (effect.kind === 'disable-block') return '對手本回合不能發動 {bl}。'
  if (effect.kind === 'field-to-trash-all') return '雙方符合條件的餅乾已放入棄牌區。'
  if (effect.kind === 'trash-to-hand') return '棄牌區卡牌已返回手牌。'
  if (effect.kind === 'trash-to-deck') {
    return effect.destination === 'bottom'
      ? '棄牌區卡牌已依選取順序放到牌庫底。'
      : '棄牌區卡牌已洗回牌庫。'
  }
  if (effect.kind === 'trash-to-deck-all') return '棄牌區已全部洗回牌庫。'
  if (effect.kind === 'draw-up-to-battle-cookie-count') {
    return '已依戰鬥區餅乾數量建立抽牌決策。'
  }
  if (effect.kind === 'choose-one') return '已選擇要執行的項目。'
  if (effect.kind === 'reveal-bottom-deck') return '已揭示牌庫底卡牌。'
  if (effect.kind === 'hand-to-battle') return '手牌餅乾已登場。'
  if (effect.kind === 'opponent-trash-to-break') {
    return '對手棄牌區餅乾已放入對手休息區。'
  }
  if (effect.kind === 'break-to-battle') return 'break 區餅乾已登場。'
  if (effect.kind === 'support-to-battle') return '支援區餅乾已登場。'
  if (effect.kind === 'break-to-hand-by-level-sum') return 'break 區餅乾已返回手牌。'
  if (effect.kind === 'hand-to-break-by-level-sum') return '手牌餅乾已放入休息區。'
  if (effect.kind === 'battle-to-break') return `${names} 已放入 break 區。`
  if (effect.kind === 'disable-attack') return `${names} 下回合不能攻擊。`
  if (effect.kind === 'hp-to-support') return `${names} 的 HP 卡已放入支援區。`
  if (effect.kind === 'transfer-hp') {
    return effect.direction === 'to-source'
      ? `已從 ${names} 移走 ${effect.amount} 張 HP 卡。`
      : `已將 ${effect.amount} 張 HP 卡移給 ${names}。`
  }
  if (effect.kind === 'set-cookie-active') return `${names} 已設為活躍。`

  if (effect.kind === 'modify-attack' || effect.kind === 'modify-damage-received') {
    const amount = effect.amount
    return effect.kind === 'modify-attack'
      ? `${names} 攻擊傷害 ${amount >= 0 ? '+' : ''}${amount}。`
      : `${names} 受到的攻擊傷害 ${amount >= 0 ? '+' : ''}${amount}。`
  }

  return `效果已處理。`
}
