'use client'
import { Fragment, useEffect, useState } from 'react'

export default function TileVisualChain() {
  const [lit, setLit] = useState(-1)

  useEffect(() => {
    let i = 0
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const go = () => {
      if (cancelled) return
      setLit(i % 5)
      i++
      timer = setTimeout(go, i % 5 === 4 ? 800 : 350)
    }
    timer = setTimeout(go, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  return (
    <div className="chain-visual">
      {[0, 1, 2, 3, 4].map(i => (
        <Fragment key={i}>
          <div className={`chain-block ${lit === i ? 'lit' : ''}`} />
          {i < 4 && <div className="chain-connector-line" />}
        </Fragment>
      ))}
    </div>
  )
}
