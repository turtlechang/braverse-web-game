import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { getAllCardPoolEntries } from '../../game/card-pool'
import {
  SCENARIO_MAX_BATTLE_SLOTS,
  buildScenarioState,
  getBreakAreaLevelPreview,
  type ScenarioCookieSlot,
} from '../../game/scenario'
import type { GameState } from '../../game'
import './GameModals.css'

export interface TestScenarioModalProps {
  onClose: () => void
  onStart: (state: GameState) => void
}

interface SideFormState {
  battle: ScenarioCookieSlot[]
  hand: string
  deck: string
  breakArea: string
  supportCount: number
  supportCards: string
  supportColors: string
  stageCard: string
  discardPile: string
}

const createEmptySide = (): SideFormState => ({
  battle: Array.from({ length: SCENARIO_MAX_BATTLE_SLOTS }, () => ({
    cardNumber: '',
    hp: undefined,
  })),
  hand: '',
  deck: '',
  breakArea: '',
  supportCount: 4,
  supportCards: '',
  supportColors: '',
  stageCard: '',
  discardPile: '',
})

const parseBreakArea = (raw: string): string[] =>
  raw
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean)

const parseOptionalCardList = (raw: string): string[] | undefined => {
  const cards = parseBreakArea(raw)
  return cards.length > 0 ? cards : undefined
}

const createPresetSide = (
  overrides: Partial<SideFormState>,
): SideFormState => {
  const empty = createEmptySide()
  return {
    ...empty,
    ...overrides,
    battle: empty.battle.map((slot, index) => ({
      ...slot,
      ...(overrides.battle?.[index] ?? {}),
    })),
  }
}

interface ScenarioPreset {
  id: string
  label: string
  description: string
  player: SideFormState
  ai: SideFormState
}

const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'bs3-018-blocker',
    label: 'BS3-018：禁用 Blocker',
    description: '手牌放入 BS3-018，對手放入 BS1-009 Blocker。',
    player: createPresetSide({
      battle: [{ cardNumber: 'BS3-017', hp: 5 }],
      hand: 'BS3-018',
      supportCount: 2,
      supportCards: 'BS3-020,BS3-020',
    }),
    ai: createPresetSide({
      battle: [{ cardNumber: 'BS1-009', hp: 3 }],
      supportCount: 0,
    }),
  },
  {
    id: 'bs3-018-damage',
    label: 'BS3-018：造成 1 傷害',
    description: '對手沒有 Blocker，直接選擇對手餅乾造成傷害。',
    player: createPresetSide({
      battle: [{ cardNumber: 'BS3-017', hp: 5 }],
      hand: 'BS3-018',
      supportCount: 2,
      supportCards: 'BS3-020,BS3-020',
    }),
    ai: createPresetSide({
      battle: [{ cardNumber: 'BS3-017', hp: 5 }],
      supportCount: 0,
    }),
  },
  {
    id: 'bs3-020-hp-to-hand',
    label: 'BS3-020：HP 卡回手',
    description: '玩家紅色餅乾帶 4 張 HP 卡，使用 BS3-020 回收 3 張。',
    player: createPresetSide({
      battle: [{ cardNumber: 'BS3-017', hp: 4 }],
      hand: 'BS3-020',
      supportCount: 2,
      supportCards: 'BS3-018',
      supportColors: 'R',
    }),
    ai: createPresetSide({
      battle: [{ cardNumber: 'BS3-017', hp: 5 }],
      supportCount: 0,
    }),
  },
]

function SideEditor({
  title,
  sideId,
  side,
  onChange,
}: {
  title: string
  sideId: 'player' | 'ai'
  side: SideFormState
  onChange: (next: SideFormState) => void
}) {
  const breakAreaCards = useMemo(
    () => parseBreakArea(side.breakArea),
    [side.breakArea],
  )
  const breakPreview = useMemo(
    () => getBreakAreaLevelPreview(breakAreaCards),
    [breakAreaCards],
  )

  return (
    <div className="scenario-side">
      <h3 className="scenario-side-title">{title}</h3>

      <div className="scenario-field-group">
        <span className="scenario-field-label">戰鬥區餅乾卡（卡號）</span>
        {side.battle.map((slot, index) => (
          <div className="scenario-battle-slot" key={index}>
            <input
              type="text"
              list="scenario-card-options"
              aria-label={`${title}戰鬥區第 ${index + 1} 張餅乾卡`}
              data-testid={`scenario-${sideId}-battle-card-${index}`}
              placeholder={`卡號，如 ST2-010`}
              value={slot.cardNumber}
              onChange={(event) => {
                const nextBattle = [...side.battle]
                nextBattle[index] = {
                  ...nextBattle[index],
                  cardNumber: event.target.value,
                }
                onChange({ ...side, battle: nextBattle })
              }}
            />
            <input
              type="number"
              min={0}
              aria-label={`${title}戰鬥區第 ${index + 1} 張餅乾目前 HP`}
              placeholder="HP（留空=滿血）"
              value={slot.hp ?? ''}
              onChange={(event) => {
                const nextBattle = [...side.battle]
                nextBattle[index] = {
                  ...nextBattle[index],
                  hp:
                    event.target.value === ''
                      ? undefined
                      : Math.max(0, Number(event.target.value)),
                }
                onChange({ ...side, battle: nextBattle })
              }}
            />
            <input
              className="scenario-hp-cards-input"
              type="text"
              list="scenario-card-options"
              aria-label={`${title}戰鬥區第 ${index + 1} 張精確 HP 卡`}
              data-testid={`scenario-${sideId}-hp-cards-${index}`}
              placeholder="精確 HP 卡，如 BS3-018,BS3-020（留空=依 HP 填充）"
              value={slot.hpCards?.join(',') ?? ''}
              onChange={(event) => {
                const nextBattle = [...side.battle]
                nextBattle[index] = {
                  ...nextBattle[index],
                  hpCards: parseOptionalCardList(event.target.value),
                }
                onChange({ ...side, battle: nextBattle })
              }}
            />
          </div>
        ))}
      </div>

      <label className="scenario-field-group">
        <span className="scenario-field-label">
          起始手牌（逗號分隔卡號，使用正式卡池）
        </span>
        <input
          type="text"
          list="scenario-card-options"
          aria-label={`${title}起始手牌`}
          data-testid={`scenario-${sideId}-hand`}
          placeholder="如 BS3-018,BS3-020"
          value={side.hand}
          onChange={(event) => onChange({ ...side, hand: event.target.value })}
        />
      </label>

      <label className="scenario-field-group">
        <span className="scenario-field-label">
          牌庫（由上到下，逗號分隔卡號；未指定尾端以測試卡補足）
        </span>
        <input
          type="text"
          list="scenario-card-options"
          aria-label={`${title}牌庫`}
          data-testid={`scenario-${sideId}-deck`}
          placeholder="如 BS3-019,BS3-096"
          value={side.deck}
          onChange={(event) => onChange({ ...side, deck: event.target.value })}
        />
      </label>

      <label className="scenario-field-group">
        <span className="scenario-field-label">場景卡（卡號，留空=不放置）</span>
        <input
          type="text"
          list="scenario-card-options"
          aria-label={`${title}場景卡`}
          data-testid={`scenario-${sideId}-stage`}
          placeholder="如 BS3-096"
          value={side.stageCard}
          onChange={(event) =>
            onChange({ ...side, stageCard: event.target.value })
          }
        />
      </label>

      <label className="scenario-field-group">
        <span className="scenario-field-label">
          破損區卡片（逗號分隔卡號，決定破損等級）
        </span>
        <input
          type="text"
          placeholder="如 ST2-003,ST2-004"
          value={side.breakArea}
          onChange={(event) =>
            onChange({ ...side, breakArea: event.target.value })
          }
        />
        <span className="scenario-break-preview">
          目前破損等級：LV.{breakPreview.level}
          {breakPreview.unknown.length > 0 &&
            `（無法辨識：${breakPreview.unknown.join('、')}）`}
        </span>
      </label>

      <label className="scenario-field-group">
        <span className="scenario-field-label">
          支援區總張數（指定卡＋補足能量）
        </span>
        <input
          type="number"
          min={0}
          max={10}
          aria-label={`${title}支援區總張數`}
          data-testid={`scenario-${sideId}-support-count`}
          value={side.supportCount}
          onChange={(event) =>
            onChange({
              ...side,
              supportCount: Math.max(
                0,
                Math.min(10, Number(event.target.value)),
              ),
            })
          }
        />
      </label>

      <label className="scenario-field-group">
        <span className="scenario-field-label">
          指定支援區卡（逗號分隔卡號，需有能量顏色）
        </span>
        <input
          type="text"
          list="scenario-card-options"
          aria-label={`${title}指定支援區卡`}
          data-testid={`scenario-${sideId}-support-cards`}
          placeholder="如 BS3-020,BS3-020"
          value={side.supportCards}
          onChange={(event) =>
            onChange({ ...side, supportCards: event.target.value })
          }
        />
      </label>

      <label className="scenario-field-group">
        <span className="scenario-field-label">
          補足能量顏色（逗號分隔：R/Y/G/B/P/K/N；不足時以萬用能量補足）
        </span>
        <input
          type="text"
          aria-label={`${title}補足能量顏色`}
          data-testid={`scenario-${sideId}-support-colors`}
          placeholder="如 R,N 或 red,blue"
          value={side.supportColors}
          onChange={(event) =>
            onChange({ ...side, supportColors: event.target.value })
          }
        />
      </label>

      <label className="scenario-field-group">
        <span className="scenario-field-label">
          棄牌區卡片（逗號分隔卡號，使用正式卡池）
        </span>
        <input
          type="text"
          list="scenario-card-options"
          aria-label={`${title}棄牌區卡片`}
          data-testid={`scenario-${sideId}-discard-pile`}
          placeholder="如 BS3-019"
          value={side.discardPile}
          onChange={(event) =>
            onChange({ ...side, discardPile: event.target.value })
          }
        />
      </label>
    </div>
  )
}

export function TestScenarioModal({ onClose, onStart }: TestScenarioModalProps) {
  const [player, setPlayer] = useState<SideFormState>(createEmptySide)
  const [ai, setAi] = useState<SideFormState>(createEmptySide)
  const [errors, setErrors] = useState<string[]>([])

  const cardOptions = useMemo(() => getAllCardPoolEntries(), [])

  const handleStart = () => {
    const result = buildScenarioState({
      player: {
        battle: player.battle,
        hand: parseBreakArea(player.hand),
        deck: parseBreakArea(player.deck),
        breakArea: parseBreakArea(player.breakArea),
        supportCount: player.supportCount,
        supportCards: parseBreakArea(player.supportCards),
        supportColors: parseBreakArea(player.supportColors),
        stageCard: player.stageCard,
        discardPile: parseBreakArea(player.discardPile),
      },
      ai: {
        battle: ai.battle,
        hand: parseBreakArea(ai.hand),
        deck: parseBreakArea(ai.deck),
        breakArea: parseBreakArea(ai.breakArea),
        supportCount: ai.supportCount,
        supportCards: parseBreakArea(ai.supportCards),
        supportColors: parseBreakArea(ai.supportColors),
        stageCard: ai.stageCard,
        discardPile: parseBreakArea(ai.discardPile),
      },
    })

    if (!result.state) {
      setErrors(result.errors)
      return
    }

    setErrors([])
    onStart(result.state)
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="test-scenario-modal" role="dialog">
        <button className="close-modal" type="button" title="關閉" onClick={onClose}>
          <X aria-hidden="true" />
        </button>

        <h2>測試對局設定</h2>
        <p className="scenario-intro">
          以正式卡池卡號直接指定雙方戰鬥區、精確 HP 卡、手牌、支援區、場景與棄牌區，略過抽牌與猜拳流程，快速重現卡牌效果與攻擊後效果。
        </p>

        <section className="scenario-presets" aria-label="單卡測試案例">
          <h3>快速案例（正式卡池）</h3>
          <p>
            先套用案例，再依要驗證的分支調整欄位；未指定的支援區張數會補成萬用能量。
          </p>
          <div className="scenario-preset-grid">
            {SCENARIO_PRESETS.map((preset) => (
              <button
                className="scenario-preset-btn"
                data-testid={`scenario-preset-${preset.id}`}
                key={preset.id}
                type="button"
                onClick={() => {
                  setPlayer(createPresetSide(preset.player))
                  setAi(createPresetSide(preset.ai))
                  setErrors([])
                }}
              >
                <span>{preset.label}</span>
                <small>{preset.description}</small>
              </button>
            ))}
          </div>
        </section>

        <datalist id="scenario-card-options">
          {cardOptions.map((entry) => (
            <option key={entry.cardNumber} value={entry.cardNumber}>
              {entry.name}
            </option>
          ))}
        </datalist>

        <div className="scenario-layout">
          <SideEditor
            title="玩家"
            sideId="player"
            side={player}
            onChange={setPlayer}
          />
          <SideEditor
            title="AI 對手"
            sideId="ai"
            side={ai}
            onChange={setAi}
          />
        </div>

        {errors.length > 0 && (
          <ul className="scenario-errors">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}

        <div className="scenario-actions">
          <button type="button" className="scenario-cancel-btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="scenario-start-btn"
            data-testid="scenario-start-button"
            onClick={handleStart}
          >
            開始測試對局
          </button>
        </div>
      </section>
    </div>
  )
}
