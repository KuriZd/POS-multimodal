// src/renderer/src/components/FiltersDropdown/FiltersDropdown.tsx
import { useEffect, useMemo, useRef, useState, type JSX, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { FiClock, FiBox, FiType } from 'react-icons/fi'
import styles from './FiltersDropdown.module.css'

export type FilterKey = 'age' | 'stock' | 'alpha'

export type FilterOption = {
  key: FilterKey
  label: string
  icon: JSX.Element
}

const DEFAULT_OPTIONS: FilterOption[] = [
  { key: 'age', label: 'Antigüedad', icon: <FiClock /> },
  { key: 'stock', label: 'Stock', icon: <FiBox /> },
  { key: 'alpha', label: 'Alfabético', icon: <FiType /> }
]

type Props = {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  selected: FilterKey
  onSelect: (key: FilterKey) => void
  onClose: () => void
  options?: FilterOption[]
}

type Position = { top: number; left: number; width: number }

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export default function FiltersDropdown({
  open,
  anchorRef,
  selected,
  onSelect,
  onClose,
  options
}: Props): JSX.Element | null {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Position | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const opts = useMemo(() => options ?? DEFAULT_OPTIONS, [options])

  useEffect(() => {
    if (!open) return

    function computePosition(): void {
      const anchor = anchorRef.current
      if (!anchor) return

      const mobile = window.innerWidth <= 520
      setIsMobile(mobile)

      if (mobile) {
        setPos({ top: 0, left: 0, width: 0 })
        return
      }

      const r = anchor.getBoundingClientRect()
      const margin = 10
      const maxWidth = 225
      const minWidth = 200
      const available = window.innerWidth - margin * 2
      const menuWidth = Math.max(minWidth, Math.min(maxWidth, available))
      const desiredLeft = r.right - menuWidth
      const left = clamp(desiredLeft, margin, window.innerWidth - menuWidth - margin)
      const top = r.bottom + 8

      setPos({ top, left, width: menuWidth })
    }

    computePosition()

    function onResizeOrScroll(): void {
      computePosition()
    }

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResizeOrScroll)
    window.addEventListener('scroll', onResizeOrScroll, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResizeOrScroll)
      window.removeEventListener('scroll', onResizeOrScroll, true)
    }
  }, [open, anchorRef, onClose])

  useEffect(() => {
    if (!open) return

    function onPointerDown(e: PointerEvent): void {
      const target = e.target as Node | null
      if (!target) return

      const anchor = anchorRef.current
      const menu = menuRef.current
      const clickedInsideMenu = !!menu && menu.contains(target)
      const clickedAnchor = !!anchor && anchor.contains(target)

      if (!clickedInsideMenu && !clickedAnchor) onClose()
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, anchorRef, onClose])

  if (!open) return null
  if (!isMobile && !pos) return null

  return createPortal(
    <div className={styles.layer} aria-hidden="true">
      <div
        ref={menuRef}
        className={styles.menu}
        style={!isMobile && pos ? { top: pos.top, left: pos.left, width: pos.width } : undefined}
        role="menu"
        aria-label="Filtros"
      >
        {opts.map((opt) => {
          const isActive = opt.key === selected

          return (
            <button
              key={opt.key}
              type="button"
              className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
              onClick={() => {
                onSelect(opt.key)
                onClose()
              }}
              role="menuitemradio"
              aria-checked={isActive}
            >
              <span className={styles.icon} aria-hidden="true">
                {opt.icon}
              </span>
              <span className={styles.label}>{opt.label}</span>
            </button>
          )
        })}
      </div>
    </div>,
    document.body
  )
}
