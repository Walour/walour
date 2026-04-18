/// <reference types="chrome" />

interface CheckSettings {
  url: boolean
  token: boolean
  tx: boolean
}

interface WalourOptions {
  enabled: boolean
  checks: CheckSettings
}

const DEFAULT_OPTIONS: WalourOptions = {
  enabled: true,
  checks: {
    url: true,
    token: true,
    tx: true,
  },
}

function getCheckbox(id: string): HTMLInputElement | null {
  return document.getElementById(id) as HTMLInputElement | null
}

function saveOptions(): void {
  const enabled = getCheckbox('toggle-enabled')?.checked ?? true
  const urlCheck = getCheckbox('toggle-url')?.checked ?? true
  const tokenCheck = getCheckbox('toggle-token')?.checked ?? true
  const txCheck = getCheckbox('toggle-tx')?.checked ?? true

  const options: WalourOptions = {
    enabled,
    checks: {
      url: urlCheck,
      token: tokenCheck,
      tx: txCheck,
    },
  }

  chrome.storage.sync.set(options, () => {
    showSaveIndicator()
  })
}

function showSaveIndicator(): void {
  const indicator = document.getElementById('save-indicator')
  if (!indicator) return
  indicator.style.opacity = '1'
  setTimeout(() => {
    indicator.style.opacity = '0'
  }, 1500)
}

function loadOptions(): void {
  chrome.storage.sync.get(['enabled', 'checks'], (result) => {
    const partial = result as Partial<WalourOptions>
    const enabled = partial.enabled ?? DEFAULT_OPTIONS.enabled
    const checks: CheckSettings = {
      url: partial.checks?.url ?? DEFAULT_OPTIONS.checks.url,
      token: partial.checks?.token ?? DEFAULT_OPTIONS.checks.token,
      tx: partial.checks?.tx ?? DEFAULT_OPTIONS.checks.tx,
    }

    const enabledToggle = getCheckbox('toggle-enabled')
    if (enabledToggle) enabledToggle.checked = enabled

    const urlToggle = getCheckbox('toggle-url')
    if (urlToggle) urlToggle.checked = checks.url

    const tokenToggle = getCheckbox('toggle-token')
    if (tokenToggle) tokenToggle.checked = checks.token

    const txToggle = getCheckbox('toggle-tx')
    if (txToggle) txToggle.checked = checks.tx
  })
}

document.addEventListener('DOMContentLoaded', () => {
  loadOptions()

  const toggleIds = ['toggle-enabled', 'toggle-url', 'toggle-token', 'toggle-tx']
  for (const id of toggleIds) {
    const el = getCheckbox(id)
    if (el) {
      el.addEventListener('change', saveOptions)
    }
  }
})
