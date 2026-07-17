import { useEffect, useRef, useState } from 'react'
import './AttackPreviewArrow.css'

interface ArrowGeometry {
  width: number
  height: number
  x1: number
  y1: number
  x2: number
  y2: number
  labelX: number
  labelY: number
}

export interface AttackPreviewArrowProps {
  sourceInstanceId: string | null
  targetInstanceIds?: string[]
  label?: string
}

const findCardElement = (
  container: Element,
  instanceId: string,
): HTMLElement | null =>
  Array.from(
    container.querySelectorAll<HTMLElement>('[data-card-instance-id]'),
  ).find((element) => element.dataset.cardInstanceId === instanceId) ?? null

const geometryFor = (
  container: HTMLElement,
  sourceInstanceId: string,
  targetInstanceIds: string[],
): ArrowGeometry | null => {
  const source = findCardElement(container, sourceInstanceId)
  if (!source) return null

  const sourceRect = source.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const target = targetInstanceIds
    .map((instanceId) => findCardElement(container, instanceId))
    .find((element) => element && element !== source)
  const targetRect = target?.getBoundingClientRect()
  const sourceCenter = {
    x: sourceRect.left + sourceRect.width / 2 - containerRect.left,
    y: sourceRect.top + sourceRect.height / 2 - containerRect.top,
  }
  const targetCenter = targetRect
    ? {
        x: targetRect.left + targetRect.width / 2 - containerRect.left,
        y: targetRect.top + targetRect.height / 2 - containerRect.top,
      }
    : {
        x: containerRect.width / 2,
        y: containerRect.height / 2,
      }

  return {
    width: containerRect.width,
    height: containerRect.height,
    x1: sourceCenter.x,
    y1: sourceCenter.y,
    x2: targetCenter.x,
    y2: targetCenter.y,
    labelX: (sourceCenter.x + targetCenter.x) / 2,
    labelY: (sourceCenter.y + targetCenter.y) / 2,
  }
}

export function AttackPreviewArrow({
  sourceInstanceId,
  targetInstanceIds = [],
  label = '攻擊宣告',
}: AttackPreviewArrowProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [geometry, setGeometry] = useState<ArrowGeometry | null>(null)

  useEffect(() => {
    const overlay = overlayRef.current
    const container = overlay?.closest<HTMLElement>('.table-area')
    if (!overlay || !container || !sourceInstanceId) {
      setGeometry(null)
      return
    }

    const update = () => {
      setGeometry(geometryFor(container, sourceInstanceId, targetInstanceIds))
    }
    update()
    window.addEventListener('resize', update)
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(update)
      : null
    observer?.observe(container)
    return () => {
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [sourceInstanceId, targetInstanceIds])

  if (!sourceInstanceId) return null

  return (
    <div
      ref={overlayRef}
      className="attack-preview-overlay"
      data-testid="attack-preview-arrow"
      role="status"
      aria-label={label}
    >
      {geometry && (
        <>
          <svg
            className="attack-preview-svg"
            width={geometry.width}
            height={geometry.height}
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            aria-hidden="true"
          >
            <defs>
              <marker
                id="attack-preview-arrowhead"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8 Z" />
              </marker>
            </defs>
            <line
              x1={geometry.x1}
              y1={geometry.y1}
              x2={geometry.x2}
              y2={geometry.y2}
              markerEnd="url(#attack-preview-arrowhead)"
            />
          </svg>
          <span
            className="attack-preview-label"
            style={{ left: geometry.labelX, top: geometry.labelY }}
          >
            {label}
          </span>
        </>
      )}
    </div>
  )
}
