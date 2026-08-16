import type { AiLevel } from './types'

// ============================================================================
// 規則 ID 定義
// ============================================================================

export type RuleId =
  | 'R1'
  | 'R2'
  | 'R3'
  | 'R4'
  | 'R5'
  | 'R6a'
  | 'R6b'
  | 'R6c'
  | 'R7'
  | 'R8'
  | 'R9'
  | 'R10'
  | 'R11'
  | 'R12'
  | 'R13'
  | 'R14'
  | 'R15'
  | 'R16'

// ============================================================================
// 規則描述
// ============================================================================

export interface RuleDefinition {
  id: RuleId
  name: string
  description: string
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  module: string
}

export const RULE_DEFINITIONS: Record<RuleId, RuleDefinition> = {
  R1: {
    id: 'R1',
    name: 'Break Level 意識',
    description: '追蹤對手破壞區等級，優先攻擊能推進到 10 的目標',
    priority: 'CRITICAL',
    module: 'bs2MatchupProfiles.ts',
  },
  R2: {
    id: 'R2',
    name: '集中火力',
    description: '將攻擊集中在最弱目標直到擊倒，不分散傷害',
    priority: 'HIGH',
    module: 'turn-handler.ts',
  },
  R3: {
    id: 'R3',
    name: '早期侵略部署',
    description: '1-8 回合立即部署最高等級餅乾，每回合嘗試攻擊',
    priority: 'MEDIUM',
    module: 'turn-handler.ts',
  },
  R4: {
    id: 'R4',
    name: '支援卡及早部署',
    description: '支援階段先部署攻擊提升物品，不囤積支援卡',
    priority: 'MEDIUM',
    module: 'turn-handler.ts',
  },
  R5: {
    id: 'R5',
    name: '技能主動使用',
    description: '主動發動傷害/移除/抽牌技能，不保留到完美時機',
    priority: 'MEDIUM',
    module: 'evaluated-turn-handler.ts',
  },
  R6a: {
    id: 'R6a',
    name: '替補基礎品質篩選',
    description: '使用 (Level × 3) + (HP × 2) 公式評分，避免只看最低 HP',
    priority: 'HIGH',
    module: 'ai.ts',
  },
  R6b: {
    id: 'R6b',
    name: '替補進階效果評分',
    description: '在基礎分上疊加 Effect_Value、場面需求、後續風險',
    priority: 'MEDIUM',
    module: 'bs2MatchupProfiles.ts',
  },
  R6c: {
    id: 'R6c',
    name: '替補風險前瞻',
    description: '模擬替補後對手下一回合可能的行動與反殺風險',
    priority: 'MEDIUM',
    module: 'evaluated-turn-handler.ts',
  },
  R7: {
    id: 'R7',
    name: '陷阱防護高價值目標',
    description: '評估陷阱代價與保護目標價值，優先保護高 Level/HP/效果餅乾，避免浪費在低價值目標',
    priority: 'LOW',
    module: 'battle-handler.ts',
  },
  R8: {
    id: 'R8',
    name: '手牌數量管理',
    description: '手牌過低時扣分低價值出牌、加分抽牌；手牌充足時不因消耗手牌過度扣分',
    priority: 'LOW',
    module: 'evaluated-turn-handler.ts',
  },
  R9: {
    id: 'R9',
    name: '致命傷害偵測',
    description: '偵測明顯致命攻擊：直接致勝加分、break 高壓時收尾加分、多攻擊者聯合致命偵測',
    priority: 'CRITICAL',
    module: 'evaluated-turn-handler.ts',
  },
  R10: {
    id: 'R10',
    name: '對手回應風險評估',
    description: '我方 break area 偏高時，行動導致 break 惡化則扣分',
    priority: 'HIGH',
    module: 'evaluated-turn-handler.ts',
  },
  R11: {
    id: 'R11',
    name: '攻擊節奏維持',
    description: '主階段仍有合法攻擊時，不會為了保留資源而無故結束回合。',
    priority: 'HIGH',
    module: 'evaluated-turn-handler.ts',
  },
  R12: {
    id: 'R12',
    name: '結構化能力辨識',
    description: '依結構化 CardEffect、cost、timing 與 target 評估來源能力，不解析顯示卡文。',
    priority: 'HIGH',
    module: 'strategy/capability-extractor.ts',
  },
  R13: {
    id: 'R13',
    name: '動態牌組策略推導',
    description: '依可合法得知的己方能力分布推導連續策略權重，不使用牌組或彈數 profile。',
    priority: 'MEDIUM',
    module: 'strategy/deck-profile.ts',
  },
  R14: {
    id: 'R14',
    name: '已知資訊安全記憶',
    description: '只使用 PlayerView 與合法 KnowledgeState，未知牌序、對手手牌與未翻 HP 不參與評分。',
    priority: 'CRITICAL',
    module: 'strategy/knowledge-state.ts',
  },
  R15: {
    id: 'R15',
    name: 'Setup／Payoff 計畫評分',
    description: '以結構化 setup/payoff、可見條件與未知資訊扣分排序單步行動。',
    priority: 'HIGH',
    module: 'strategy/tactical-plans.ts',
  },
  R16: {
    id: 'R16',
    name: '指令順序與資源預留',
    description: '在有限多步 command 搜尋中保留後續攻擊付款，並比較 setup、payoff 與收尾順序。',
    priority: 'HIGH',
    module: 'strategy/lv4-search.ts',
  },
}

// ============================================================================
// 等級規則設定（Rule Profile）
// ============================================================================

export interface RuleProfile {
  level: AiLevel
  name: string
  description: string
  rules: RuleId[]
}

export const LV1_PROFILE: RuleProfile = {
  level: 1,
  name: '隨機出招',
  description: '從合法動作中隨機挑選，不使用訓練規則',
  rules: [],
}

export const LV2_PROFILE: RuleProfile = {
  level: 2,
  name: '基礎戰術',
  description: '啟發式 AI，使用 5 條核心規則，只看當下局面',
  rules: ['R1', 'R2', 'R3', 'R4', 'R6a'],
}

export const LV3_PROFILE: RuleProfile = {
  level: 3,
  name: '評估式',
  description: '評估式 AI，評估一步結果並使用結構化能力、策略 profile、已知資訊與 setup/payoff。',
  rules: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6a', 'R6b', 'R7', 'R8', 'R12', 'R13', 'R14', 'R15'],
}

export const LV4_PROFILE: RuleProfile = {
  level: 4,
  name: '兩層前瞻',
  description: '兩層前瞻 AI，含通用策略、風險與攻擊節奏管理',
  rules: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6a', 'R6b', 'R6c', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15', 'R16'],
}

// ============================================================================
// 工具函式
// ============================================================================

const ALL_PROFILES: RuleProfile[] = [LV1_PROFILE, LV2_PROFILE, LV3_PROFILE, LV4_PROFILE]

/** 根據等級取得對應的規則設定 */
export const getRuleProfile = (level: AiLevel): RuleProfile =>
  ALL_PROFILES.find((p) => p.level === level) ?? LV2_PROFILE

/** 檢查特定等級是否啟用某條規則 */
export const isRuleEnabled = (level: AiLevel, ruleId: RuleId): boolean =>
  getRuleProfile(level).rules.includes(ruleId)

/** 取得特定等級的所有啟用規則 */
export const getEnabledRules = (level: AiLevel): RuleDefinition[] =>
  getRuleProfile(level).rules.map((id) => RULE_DEFINITIONS[id])
