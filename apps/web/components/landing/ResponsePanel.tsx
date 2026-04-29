'use client'

interface ResponsePanelProps {
  visible: boolean
}

export default function ResponsePanel({ visible }: ResponsePanelProps) {
  return (
    <div>
      <div className="response-tab-row">
        <span className="response-tab">
          <span className="response-tab-dot" />
          response.json
        </span>
      </div>
      <div className={`response-panel${visible ? ' in' : ''}`}>
        <div className="response-body">
          <div>
            <span className="json-muted">{'{'}</span>
          </div>
          <div style={{ paddingLeft: 18 }}>
            <span className="json-key">&quot;risk&quot;</span>
            <span className="json-muted">: </span>
            <span className="json-danger">&quot;HIGH&quot;</span>
            <span className="json-muted">,</span>
          </div>
          <div style={{ paddingLeft: 18 }}>
            <span className="json-key">&quot;confidence&quot;</span>
            <span className="json-muted">: </span>
            <span className="json-danger">0.97</span>
            <span className="json-muted">,</span>
          </div>
          <div style={{ paddingLeft: 18 }}>
            <span className="json-key">&quot;latencyMs&quot;</span>
            <span className="json-muted">: </span>
            <span className="json-num">312</span>
            <span className="json-muted">,</span>
          </div>
          <div style={{ paddingLeft: 18 }}>
            <span className="json-key">&quot;threats&quot;</span>
            <span className="json-muted">: [</span>
            <span className="json-str">&quot;drainer-contract&quot;</span>
            <span className="json-muted">, </span>
            <span className="json-str">&quot;unlimited-approval&quot;</span>
            <span className="json-muted">],</span>
          </div>
          <div style={{ paddingLeft: 18 }}>
            <span className="json-key">&quot;advice&quot;</span>
            <span className="json-muted">: </span>
            <span className="json-str">&quot;Reject this transaction&quot;</span>
          </div>
          <div>
            <span className="json-muted">{'}'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
