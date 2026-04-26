/**
 * Manual Jest mock for @cloak.dev/sdk
 * Mirrors the real CloakSDK class constructor + instance methods used in private-report-cloak.ts
 */
const MOCK_TX_SIG = 'CloakMockSig11111111111111111111111111111111111111111111111'
const MOCK_NOTE = { version: '1', commitment: 'abc123', amount: 10000000, network: 'devnet' }

class CloakSDK {
  constructor(_config) {}
  deposit(_connection, _amount, _opts) {
    return Promise.resolve({ note: MOCK_NOTE, signature: MOCK_TX_SIG, depositSignature: MOCK_TX_SIG })
  }
  send(_connection, _note, _recipients, _opts) {
    return Promise.resolve({ signature: MOCK_TX_SIG })
  }
  withdraw(_connection, _note, _recipient, _opts) {
    return Promise.resolve({ signature: MOCK_TX_SIG })
  }
}

module.exports = {
  CloakSDK,
  serializeNote: jest.fn(note => JSON.stringify(note)),
  MIN_DEPOSIT_LAMPORTS: 10000000,
  CLOAK_PROGRAM_ID: { toBase58: () => 'CLOAKprogramId11111111111111111111111111111' },
}
