'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  delta?: string
  icon?: React.ReactNode
  tickInterval?: number
  tickMax?: number
}

/** Generate a simple random sparkline path once from a seed value */
function generateSparkline(seed: number | string): string {
  const seedNum = typeof seed === 'number' ? seed : seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const points = 8
  const width = 200
  const height = 60
  const step = width / (points - 1)

  // Seeded pseudo-random using LCG
  let s = seedNum % 65536
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }

  const ys: number[] = []
  for (let i = 0; i < points; i++) {
    ys.push(rand())
  }

  // Normalize to fit within [8, height - 8]
  const min = Math.min(...ys)
  const max = Math.max(...ys)
  const range = max - min || 1

  const coords = ys.map((y, i) => {
    const x = i * step
    const ny = height - 8 - ((y - min) / range) * (height - 16)
    return `${x.toFixed(1)},${ny.toFixed(1)}`
  })

  return coords.join(' ')
}

export default function StatCard({
  label,
  value,
  delta,
  icon,
  tickInterval,
  tickMax,
}: StatCardProps) {
  const [displayed, setDisplayed] = useState<string | number>(value)
  const [flashing, setFlashing] = useState(false)
  const valueRef = useRef<string | number>(value)
  const sparkPoints = useMemo(() => generateSparkline(value), [value])

  useEffect(() => {
    setDisplayed(value)
    valueRef.current = value
  }, [value])

  useEffect(() => {
    if (!tickInterval || tickMax === undefined) return

    const id = setInterval(() => {
      const increment = Math.floor(Math.random() * (tickMax + 1))
      if (increment === 0) return

      setDisplayed(prev => {
        const num = typeof prev === 'number' ? prev : parseFloat(String(prev).replace(/,/g, ''))
        return isNaN(num) ? prev : num + increment
      })

      setFlashing(true)
      const flashTimer = setTimeout(() => setFlashing(false), 300)
      return () => clearTimeout(flashTimer)
    }, tickInterval)

    return () => clearInterval(id)
  }, [tickInterval, tickMax])

  const formattedValue =
    typeof displayed === 'number'
      ? displayed.toLocaleString()
      : displayed

  return (
    <div
      className="stat-card glass"
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      <div className="stat-card-label">
        {icon}
        {label}
      </div>

      <div className={`stat-card-value${flashing ? ' flash' : ''}`}>
        {formattedValue}
      </div>

      {delta && (
        <div className="stat-card-delta">
          {delta}
        </div>
      )}

      {/* Inline SVG sparkline */}
      <svg
        className="stat-sparkline"
        viewBox="0 0 200 60"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline
          points={sparkPoints}
          fill="none"
          stroke="#00C9A7"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
