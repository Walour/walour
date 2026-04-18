/// <reference types="chrome" />

interface WalourSettings {
  enabled: boolean
  checks: {
    url: boolean
    token: boolean
    tx: boolean
  }
}

function setText(id: string, value: string): void {
  const el = document.getElementById(id)
  if (el) el.textContent = value
}

function setHref(id: string, href: string): void {
  const el = document.getElementById(id) as HTMLAnchorElement | null
  if (el) el.href = href
}

document.addEventListener('DOMContentLoaded', () => {
  // Display version from manifest
  const manifest = chrome.runtime.getManifest()
  setText('walour-name', manifest.name)
  setText('walour-version', `v${manifest.version}`)

  // Stats link
  setHref('stats-link', 'https://walour.xyz/stats')
  const statsLink = document.getElementById('stats-link')
  if (statsLink) {
    statsLink.addEventListener('click', (e) => {
      e.preventDefault()
      chrome.tabs.create({ url: 'https://walour.xyz/stats' })
    })
  }

  // Load settings and display status
  chrome.storage.sync.get(['enabled', 'checks'], (result) => {
    const settings = result as Partial<WalourSettings>
    const enabled = settings.enabled !== false

    const statusDot = document.getElementById('status-dot')
    const statusText = document.getElementById('status-text')

    if (statusDot) {
      statusDot.style.background = enabled ? '#22C55E' : '#EF4444'
    }
    if (statusText) {
      statusText.textContent = enabled ? 'Protection active' : 'Protection disabled'
    }

    // Display check states
    const checks = settings.checks ?? { url: true, token: true, tx: true }
    updateCheckBadge('badge-url', checks.url)
    updateCheckBadge('badge-token', checks.token)
    updateCheckBadge('badge-tx', checks.tx)
  })
})

function updateCheckBadge(id: string, active: boolean): void {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = active ? 'On' : 'Off'
  el.style.color = active ? '#22C55E' : '#8B949E'
}
