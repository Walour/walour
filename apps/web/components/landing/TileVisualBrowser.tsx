'use client'
import { useEffect, useState } from 'react'

export default function TileVisualBrowser() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setInterval(() => setVisible(v => !v), 2800)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="mini-browser">
      <div className="mini-browser-bar">
        <div className="mini-browser-dot" />
        <div className="mini-browser-dot" />
        <div className="mini-browser-dot" />
      </div>
      <div className="mini-browser-body">
        <div className={`mini-ext-popup ${visible ? 'visible' : ''}`}>
          <div className="mini-risk">⚠ HIGH RISK</div>
          <div className="mini-sub">Don&apos;t sign</div>
        </div>
      </div>
    </div>
  )
}
