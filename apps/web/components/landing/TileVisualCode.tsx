'use client'
import { useEffect, useState } from 'react'

const FULL_TEXT = `const walour = new Walour()
const result = await walour
  .scan(tx) // HIGH RISK`

export default function TileVisualCode() {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    let i = 0
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const type = () => {
      if (cancelled) return
      if (i <= FULL_TEXT.length) {
        setDisplayed(FULL_TEXT.slice(0, i))
        i++
        timer = setTimeout(type, 38)
      } else {
        timer = setTimeout(() => {
          i = 0
          type()
        }, 2400)
      }
    }
    type()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  return (
    <div className="tile-code-area">
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {displayed}
        <span className="caret" />
      </pre>
    </div>
  )
}
