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
  breakArea: string
  supportCount: number
}

const createEmptySide = (): SideFormState => ({
  battle: Array.from({ length: SCENARIO_MAX_BATTLE_SLOTS }, () => ({
    cardNumber: '',
    hp: undefined,
  })),
  breakArea: '',
  supportCount: 4,
})

const parseBreakArea = (raw: string): string[] =>
  raw
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean)

function SideEditor({
  title,
  side,
  onChange,
}: {
  title: string
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
          </div>
        ))}
      </div>

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
        <span className="scenario-field-label">支援區能量張數（萬用能量，測試用）</span>
        <input
          type="number"
          min={0}
          max={10}
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
        breakArea: parseBreakArea(player.breakArea),
        supportCount: player.supportCount,
      },
      ai: {
        battle: ai.battle,
        breakArea: parseBreakArea(ai.breakArea),
        supportCount: ai.supportCount,
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
          直接指定雙方戰鬥區、破損區與支援能量，略過抽牌與猜拳流程，快速驗證卡牌技能與攻擊後效果。
        </p>

        <datalist id="scenario-card-options">
          {cardOptions.map((entry) => (
            <option key={entry.cardNumber} value={entry.cardNumber}>
              {entry.name}
            </option>
          ))}
        </datalist>

        <div className="scenario-layout">
          <SideEditor title="玩家" side={player} onChange={setPlayer} />
          <SideEditor title="AI 對手" side={ai} onChange={setAi} />
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
          <button type="button" className="scenario-start-btn" onClick={handleStart}>
            開始測試對局
          </button>
        </div>
      </section>
    </div>
  )
}
