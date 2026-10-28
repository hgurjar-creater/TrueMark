'use client'

import { useEffect, useRef } from 'react'

export function PolygonSpotlight() {
  const spotlightRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const spotlight = spotlightRef.current
    if (!spotlight) return

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!finePointer.matches || reducedMotion.matches) return

    let frame = 0
    const moveSpotlight = (event: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        spotlight.style.setProperty('--pointer-x', `${event.clientX}px`)
        spotlight.style.setProperty('--pointer-y', `${event.clientY}px`)
        spotlight.dataset.active = 'true'
      })
    }
    const hideSpotlight = () => {
      spotlight.dataset.active = 'false'
    }

    window.addEventListener('pointermove', moveSpotlight)
    window.addEventListener('pointerleave', hideSpotlight)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', moveSpotlight)
      window.removeEventListener('pointerleave', hideSpotlight)
    }
  }, [])

  return <div ref={spotlightRef} className="polygon-spotlight" aria-hidden="true" />
}
