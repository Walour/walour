'use client'

import { useState } from 'react'

interface CodeLine {
  type: 'comment' | 'prompt' | 'keyword' | 'string' | 'plain'
  text: string
}

interface CodeBoxProps {
  lines: CodeLine[]
  copyText: string
}

export default function CodeBox({ lines, copyText }: CodeBoxProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }

  return (
    <div className="codebox">
      <div className="codebox-chrome">
        <div className="codebox-dots">
          <span className="codebox-dot" />
          <span className="codebox-dot" />
          <span className="codebox-dot" />
        </div>
        <button
          className={`codebox-copy${copied ? ' copied' : ''}`}
          onClick={handleCopy}
          aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="codebox-body">
        {lines.map((line, i) => (
          <div key={i}>
            <span className={`c-${line.type}`}>{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
