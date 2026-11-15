import { useEffect, useState } from 'react'
import { UtensilsCrossed } from 'lucide-react'
import { useBagAnimationStore } from '@/stores/bagAnimationStore'
import { cn } from '@/lib/utils'

const DURATION_MS = 720

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getVisibleBagTarget(): DOMRect | null {
  const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-bag-target]'))
  for (const el of targets) {
    const rect = el.getBoundingClientRect()
    const style = window.getComputedStyle(el)
    if (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none'
    ) {
      return rect
    }
  }
  return null
}

export function FlyToBagOverlay() {
  const flight = useBagAnimationStore((s) => s.flight)
  const clearFlight = useBagAnimationStore((s) => s.clearFlight)
  const bumpPulse = useBagAnimationStore((s) => s.bumpPulse)
  const [phase, setPhase] = useState<'idle' | 'start' | 'end'>('idle')
  const [to, setTo] = useState<{ x: number; y: number; size: number } | null>(null)

  useEffect(() => {
    if (!flight) {
      setPhase('idle')
      setTo(null)
      return
    }

    if (prefersReducedMotion()) {
      bumpPulse()
      clearFlight()
      return
    }

    const target = getVisibleBagTarget()
    if (!target) {
      bumpPulse()
      clearFlight()
      return
    }

    const size = Math.min(44, Math.max(28, target.height * 0.55))
    setTo({
      x: target.left + target.width / 2 - size / 2,
      y: target.top + target.height / 2 - size / 2,
      size,
    })
    setPhase('start')

    const startTimer = window.setTimeout(() => setPhase('end'), 24)
    const doneTimer = window.setTimeout(() => {
      bumpPulse()
      clearFlight()
      setPhase('idle')
      setTo(null)
    }, DURATION_MS + 40)

    return () => {
      window.clearTimeout(startTimer)
      window.clearTimeout(doneTimer)
    }
  }, [flight, bumpPulse, clearFlight])

  if (!flight || !to || phase === 'idle') return null

  const from = flight.from
  const active = phase === 'end'
  const left = active ? to.x : from.x
  const top = active ? to.y : from.y
  const width = active ? to.size : from.width
  const height = active ? to.size : from.height
  const scale = active ? 0.35 : 1
  const rotate = active ? -18 : 0
  const opacity = active ? 0.35 : 1
  const radius = active ? '999px' : '14px'

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[80]"
      style={{
        left,
        top,
        width,
        height,
        opacity,
        borderRadius: radius,
        transform: `scale(${scale}) rotate(${rotate}deg)`,
        transition: active
          ? `left ${DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), top ${DURATION_MS}ms cubic-bezier(0.45, 0, 0.2, 1), width ${DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), height ${DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), transform ${DURATION_MS}ms cubic-bezier(0.2, 0.75, 0.25, 1), opacity ${DURATION_MS}ms ease, border-radius ${DURATION_MS}ms ease`
          : 'none',
        overflow: 'hidden',
        boxShadow: '0 12px 28px rgba(0,0,0,0.28)',
      }}
    >
      {flight.imageUrl ? (
        <img src={flight.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className={cn(
            'flex h-full w-full items-center justify-center',
            'bg-[color-mix(in_srgb,var(--sf-primary)_18%,white)] text-[var(--sf-primary)]',
          )}
        >
          <UtensilsCrossed className="h-1/3 w-1/3" />
        </div>
      )}
    </div>
  )
}
