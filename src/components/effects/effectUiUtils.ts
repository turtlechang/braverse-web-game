import type { CardEffect, CardSkill } from '../../game'

export const getSkillLabels = (skill: CardSkill) => [
  skill.trigger === 'activate'
    ? 'Activate 啟動'
    : skill.trigger === 'on-play'
      ? 'OnPlay 登場'
      : 'Skill 技能',
  ...(skill.oncePerTurn ? ['Once per turn 一回合一次'] : []),
  ...(skill.yourTurn ? ['Your Turn 自己的回合'] : []),
]

export const describeEffect = (effect: CardEffect) => {
  if (effect.kind === 'draw') {
    return `從牌庫抽 ${effect.amount} 張牌。`
  }

  if (effect.kind === 'deck-to-support') {
    return `從牌庫頂取 ${effect.amount} 張卡，直立放入支援區。`
  }

  if (effect.kind === 'break-to-trash') {
    return `從休息區選擇最多 ${effect.max} 張 LV.${effect.exactLevel} 卡，移至棄牌區。`
  }

  if (effect.kind === 'gain-hp') {
    return `該餅乾增加 ${effect.amount} HP。`
  }

  if (effect.kind === 'support-to-trash') {
    return `將 ${effect.amount} 張支援卡送入棄牌區。`
  }

  if (effect.kind === 'support-to-hand') {
    return `選擇 ${effect.amount} 張支援卡返回手牌。`
  }

  if (effect.kind === 'trash-to-battle') {
    return `從棄牌區選擇 ${effect.amount} 張餅乾登場。`
  }

  if (effect.kind === 'modify-all-attack') {
    return `目前戰鬥區所有己方餅乾攻擊傷害 +${effect.amount}。`
  }

  if (effect.kind === 'disable-flip') {
    return '選擇最多 1 張對手餅乾，本回合不能發動其 HP FLIP。'
  }

  if (effect.kind === 'view-hp') {
    return '選擇最多 1 張己方餅乾，查看其所有 HP 卡。'
  }

  if (effect.kind === 'battle-to-support') {
    return '選擇 1 張符合等級的己方餅乾，直立放入支援區。'
  }

  if (effect.kind === 'opponent-discard-hand') {
    return `對手必須棄置 ${effect.count} 張手牌。`
  }

  if (effect.kind === 'opponent-battle-to-trash') {
    const conds: string[] = []
    if (effect.maxLevel) conds.push(`LV.${effect.maxLevel} 以下`)
    if (effect.minLevel) conds.push(`LV.${effect.minLevel}`)
    if (effect.remainingHp) conds.push(`剩餘 HP ${effect.remainingHp} 以下`)
    const cond = conds.length > 0 ? `（${conds.join('、')}）` : ''
    return `選擇 1 張對手${cond}餅乾，送入棄牌區。`
  }

  if (effect.kind === 'return-to-hand') {
    const side = effect.side === 'self' ? '己方' : '對手'
    const conds: string[] = []
    if (effect.minLevel) conds.push(`LV.${effect.minLevel}`)
    if (effect.remainingHp) conds.push(`剩餘 HP ${effect.remainingHp} 以上`)
    const cond = conds.length > 0 ? `（${conds.join('、')}）` : ''
    return `選擇 1 張${side}${cond}餅乾，返回手牌。`
  }

  if (effect.kind === 'opponent-random-discard') {
    return `隨機棄置對手 ${effect.count} 張手牌。`
  }

  if (effect.kind === 'set-active') {
    return `將此餅乾與 ${effect.supportCount} 張支援卡設為直立狀態。`
  }

  if (effect.kind === 'inspect-deck') {
    return `查看牌庫頂 ${effect.lookCount} 張，選擇 ${effect.pickCount} 張加入手牌，其餘放回牌庫底。`
  }

  if (effect.kind === 'optional-cost-attack') {
    return effect.effectText
  }

  const target =
    effect.target.side === 'self' ? '我方餅乾' : '對手餅乾'
  const count =
    effect.target.min === effect.target.max
      ? `${effect.target.max} 個`
      : `最多 ${effect.target.max} 個`

  if (effect.kind === 'damage') {
    return `選擇${count}${target}，造成 ${effect.amount} 點效果傷害。`
  }

  if (effect.kind === 'prevent-knockout') {
    return `選擇${count}${target}，該次戰鬥中 HP 不會降到 0。`
  }

  const value = effect.amount > 0 ? `+${effect.amount}` : effect.amount
  return effect.kind === 'modify-attack'
    ? `選擇${count}${target}，攻擊傷害 ${value}。`
    : `選擇${count}${target}，受到的攻擊傷害 ${value}。`
}

export const describeEffectResult = (
  effect: CardEffect,
  targetNames: string[],
) => {
  if (effect.kind === 'draw') {
    return `從牌庫抽了 ${effect.amount} 張牌。`
  }

  if (effect.kind === 'deck-to-support') {
    return `從牌庫頂取了 ${effect.amount} 張卡，直立放入支援區。`
  }

  if (effect.kind === 'break-to-trash') {
    if (targetNames.length === 0) {
      return '效果已確認，本次沒有選擇休息區目標。'
    }
    const names = targetNames.join('、')
    return `${names}已從休息區移至棄牌區。`
  }

  if (effect.kind === 'gain-hp') {
    return `餅乾增加了 ${effect.amount} HP。`
  }

  if (effect.kind === 'support-to-trash') {
    return `${effect.amount} 張支援卡已移至棄牌區。`
  }

  if (effect.kind === 'support-to-hand') {
    return `${effect.amount} 張支援卡已返回手牌。`
  }

  if (effect.kind === 'trash-to-battle') {
    return `${targetNames.join('、')}已從棄牌區登場。`
  }

  if (effect.kind === 'modify-all-attack') {
    return `目前戰鬥區所有己方餅乾攻擊傷害 +${effect.amount}。`
  }

  if (effect.kind === 'disable-flip') {
    return targetNames.length > 0
      ? `${targetNames.join('、')}本回合不能發動 HP FLIP。`
      : '未選擇 FLIP 封鎖目標。'
  }

  if (effect.kind === 'view-hp') {
    return targetNames.length > 0
      ? `已查看${targetNames.join('、')}的 HP 卡。`
      : '未選擇查看 HP。'
  }

  if (effect.kind === 'battle-to-support') {
    return `${targetNames.join('、')}已移至支援區。`
  }

  if (effect.kind === 'opponent-discard-hand') {
    return `對手已棄置 ${effect.count} 張手牌。`
  }

  if (effect.kind === 'opponent-battle-to-trash') {
    if (targetNames.length === 0) return '未選擇送入棄牌區的目標。'
    return `${targetNames.join('、')}已從戰鬥區送入棄牌區。`
  }

  if (effect.kind === 'return-to-hand') {
    if (targetNames.length === 0) return '未選擇返回手牌的目標。'
    return `${targetNames.join('、')}已返回手牌。`
  }

  if (effect.kind === 'opponent-random-discard') {
    return `對手已隨機棄置 ${effect.count} 張手牌。`
  }

  if (effect.kind === 'set-active') {
    return `此餅乾與 ${effect.supportCount} 張支援卡已設為直立狀態。`
  }

  if (targetNames.length === 0) {
    return '效果已確認，本次沒有選擇目標。'
  }

  const names = targetNames.join('、')
  if (effect.kind === 'damage') {
    return `${names}受到 ${effect.amount} 點效果傷害。`
  }

  if (effect.kind === 'prevent-knockout') {
    return `${names}在本次戰鬥中受到 HP 下限保護。`
  }

  if (effect.kind === 'inspect-deck' || effect.kind === 'optional-cost-attack') {
    return '效果已處理。'
  }

  const value = effect.amount > 0 ? `+${effect.amount}` : effect.amount
  return effect.kind === 'modify-attack'
    ? `${names}獲得攻擊傷害 ${value} 修正。`
    : `${names}獲得受到攻擊傷害 ${value} 修正。`
}
