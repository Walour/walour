import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | Walour',
  description: 'Privacy policy for the Walour Chrome extension and associated services.',
}

export default function PrivacyPage() {
  return (
    <main>
      <div className="container" style={{ paddingTop: 60, paddingBottom: 80, maxWidth: 740 }}>

        <h1 className="section-title" style={{ marginBottom: 6 }}>Privacy Policy</h1>
        <p className="section-sub" style={{ marginBottom: 48 }}>
          Effective: May 6, 2026 &middot; Applies to: walour.io, the Walour Chrome extension,
          the @walour/sdk npm package, the Walour worker API, and the Walour on-chain oracle program.
        </p>

        <Section title="1. Who we are">
          <p>
            Walour is a real-time security oracle for Solana. References to &ldquo;we&rdquo;,
            &ldquo;us&rdquo;, and &ldquo;our&rdquo; mean Walour. To contact us:{' '}
            <a href="mailto:walour786@gmail.com">walour786@gmail.com</a> or on X:{' '}
            <a href="https://x.com/walourApp" target="_blank" rel="noopener noreferrer">@walourApp</a>.
          </p>
        </Section>

        <Section title="2. What we collect and why">
          <p style={{ marginBottom: 16 }}>
            Walour consists of several components. The table below lists every data point
            collected across all of them.
          </p>
          <Table
            headers={['Data', 'Source', 'Purpose', 'Stored?']}
            rows={[
              ['Unsigned transaction bytes', 'Chrome extension', 'AI-powered risk analysis', 'No, discarded after response'],
              ['dApp hostname', 'Chrome extension', 'Domain phishing check', 'Cache, 24-hour TTL'],
              ['Token / program addresses', 'Chrome extension', 'Token risk check', 'Cache, 24-hour TTL'],
              ['Wallet public key', 'Chrome extension', 'Blocked-transaction audit log', 'Database, 12 months'],
              ['Block reason + timestamp', 'Chrome extension', 'Blocked-transaction audit log', 'Database, 12 months'],
              ['App version', 'Chrome extension', 'Version telemetry', 'Database, 12 months'],
              ['IP address', 'All HTTP requests', 'Standard infrastructure logging', 'Not stored by Walour'],
              ['Threat addresses (on-chain)', 'Community reports / oracle', 'Public threat registry', 'Permanent (see Section 7)'],
              ['Aggregate threat stats', 'walour.io stats page', 'Public dashboard', 'No personal data shown'],
              ['SDK API requests', '@walour/sdk', 'Risk lookups by third-party developers', 'Rate-limited (see Section 9)'],
            ]}
          />
          <p style={{ marginTop: 16 }}>
            Walour does not collect browser history, keystrokes, private keys, seed phrases,
            passwords, payment information, or any data unrelated to transaction security analysis.
          </p>
          <p style={{ marginTop: 16 }}>
            <strong>Automated risk scoring.</strong> Transaction data is analysed by an AI model
            (Anthropic Claude) which produces a risk recommendation: GREEN, AMBER, or RED. This
            constitutes automated processing of transaction data. It is <strong>not</strong> an
            automated decision with legal effect. You retain sole authority to approve or reject
            the transaction at all times. The AI output is advisory only.
          </p>
        </Section>

        <Section title="3. No user accounts">
          <p>
            Walour has no registration, login, password, or user profile system anywhere across
            the product. No persistent user identity is created. Wallet public keys are
            pseudonymous on-chain identifiers. Walour does not attempt to link them to
            real-world identities and does not store them alongside any personally identifying
            information.
          </p>
        </Section>

        <Section title="4. Third-party processors">
          <p style={{ marginBottom: 16 }}>
            The following processors receive data as part of the transaction analysis pipeline.
          </p>
          <Table
            headers={['Processor', 'Data shared', 'Notes']}
            rows={[
              ['Anthropic', 'Unsigned transaction bytes, token addresses, dApp hostname', 'AI transaction decoding (Claude). Anthropic does not use API request data to train models by default. Data transmitted over HTTPS. anthropic.com/legal'],
              ['Security intelligence provider', 'Token / contract addresses', 'Risk scoring for tokens and programs.'],
              ['Blockchain RPC provider', 'On-chain addresses', 'On-chain lookups for program and token data.'],
              ['Database provider', 'Blocked-transaction events', 'Postgres-compatible database, SOC 2 compliant.'],
              ['Cache provider', 'Risk scores (TTL-bounded)', 'No personally identifiable information in cache keys.'],
              ['Hosting provider', 'Edge function execution', '30-day infrastructure log retention.'],
            ]}
          />
          <p style={{ marginTop: 16 }}>
            We do not sell, rent, or transfer your data to any party not listed above. Data
            is never shared with advertisers, data brokers, or analytics platforms.
          </p>
        </Section>

        <Section title="5. Cookies and tracking">
          <p>
            walour.io does not use cookies, pixel trackers, fingerprinting scripts, or
            third-party analytics. No tracking of any kind occurs when you visit the website.
            The Chrome extension does not set cookies on pages you visit.
          </p>
        </Section>

        <Section title="6. Data retention">
          <ul>
            <li><strong>Transaction bytes:</strong> deleted immediately after analysis. Never written to disk or logs.</li>
            <li><strong>Domain and token risk cache:</strong> 24-hour TTL.</li>
            <li><strong>Blocked-transaction telemetry:</strong> retained for 12 months, then permanently deleted.</li>
            <li><strong>On-chain oracle records:</strong> permanent (see Section 7).</li>
            <li><strong>Infrastructure logs:</strong> retained per each provider&apos;s policy (typically 30 days).</li>
          </ul>
        </Section>

        <Section title="7. On-chain data and blockchain immutability">
          <p>
            Threat addresses submitted to the Walour oracle are written to the Solana
            blockchain. By the immutable nature of public blockchains, this data cannot be
            deleted or modified after submission.
          </p>
          <p style={{ marginTop: 12 }}>
            We apply a confidence threshold before any on-chain write. If you believe a record
            is erroneous, contact us at{' '}
            <a href="mailto:walour786@gmail.com">walour786@gmail.com</a> or via{' '}
            <a href="https://x.com/walourApp" target="_blank" rel="noopener noreferrer">@walourApp</a>{' '}
            on X. We will add a retraction record on-chain and suppress the address from all
            Walour interfaces and API responses. However, we cannot erase the underlying chain state.
          </p>
          <p style={{ marginTop: 12 }}>
            For users in GDPR/UK GDPR jurisdictions: on-chain oracle writes are processed under
            the legitimate interests basis (Article 6(1)(f), fraud prevention infrastructure).
            Where an erasure request cannot be fulfilled due to blockchain immutability, we rely
            on Article 17(3)(e) (retention necessary for the establishment, exercise, or defence
            of legal claims relating to fraud prevention) as well as the technical impossibility
            of erasure inherent to the blockchain medium.
          </p>
        </Section>

        <Section title="8. Legal bases for processing (GDPR)">
          <ul>
            <li><strong>Legitimate interests (Article 6(1)(f)):</strong> real-time fraud prevention on behalf of wallet users; blocked-transaction telemetry for aggregate security metrics; on-chain oracle writes.</li>
            <li><strong>Contract performance (Article 6(1)(b)):</strong> worker API calls initiated by SDK developers.</li>
            <li>No marketing, profiling, or consent-based processing takes place.</li>
          </ul>
        </Section>

        <Section title="9. SDK developers and API consumers">
          <p>
            Developers who install <code>@walour/sdk</code> or query the Walour worker API
            directly are <strong>independent data controllers</strong> for their own users.
            Walour is not a processor for downstream developer applications.
          </p>
          <p style={{ marginTop: 12 }}>
            Acceptable use of the API and SDK is limited to on-chain security analysis. Use
            for scraping, building phishing tools, denial-of-service attacks, or any unlawful
            purpose is prohibited and may result in access termination.
          </p>
        </Section>

        <Section title="10. Dialect Blinks / Solana Actions">
          <p>
            Transactions initiated via Walour Blinks (Solana Actions) flow through the same
            worker API pipeline described in Section 2. No additional data is collected beyond
            what a direct extension call would send.
          </p>
        </Section>

        <Section title="11. International data transfers">
          <p>
            Our processors, including Anthropic, may process data in the United States.
            Transfers from the EU/EEA are covered by Standard Contractual Clauses (SCCs) or
            adequacy decisions maintained by each processor, as described in their respective
            privacy policies. Transfers from the UK are covered by the UK International Data
            Transfer Agreement (IDTA) or equivalent safeguards.
          </p>
        </Section>

        <Section title="12. Children">
          <p>
            Walour is not directed at children under 13 (COPPA) or under 16 (GDPR). We do
            not knowingly collect data from minors. If you believe a minor has submitted data,
            contact us and we will delete it from our systems to the extent technically possible.
          </p>
        </Section>

        <Section title="13. Your rights">
          <p>
            Depending on your jurisdiction you may have the right to access, rectify, restrict,
            port, or erase data we hold about you. To exercise any right, contact us at{' '}
            <a href="mailto:walour786@gmail.com">walour786@gmail.com</a> with the subject
            &ldquo;Privacy Request&rdquo; and, where applicable, the wallet public key associated
            with your request.
          </p>
          <p style={{ marginTop: 12 }}>
            <strong>Erasure of on-chain data:</strong> Subject to the limitations described
            in Section 7, we will honor erasure requests for database telemetry records and
            suppress the address from all Walour-controlled interfaces.
          </p>
          <p style={{ marginTop: 12 }}>
            <strong>No automated decisions with legal effect:</strong> Threat scores produced
            by Walour are advisory. You can always override a verdict and sign a transaction
            regardless of the risk rating. No automated decision produces a legal or similarly
            significant effect on you.
          </p>
          <p style={{ marginTop: 12 }}>
            <strong>Right to complain:</strong> If you are in the UK, you have the right to
            lodge a complaint with the Information Commissioner&apos;s Office (ICO) at{' '}
            <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer">ico.org.uk</a>.
            If you are in the EU, you may lodge a complaint with your local data protection authority.
          </p>
          <p style={{ marginTop: 12 }}>
            <strong>CCPA (California):</strong> We do not sell or share personal information
            for cross-context behavioral advertising. No &ldquo;Do Not Sell&rdquo; opt-out is required.
          </p>
        </Section>

        <Section title="14. Security">
          <p>
            All data is transmitted over HTTPS/TLS. Transaction bytes are never written to
            persistent storage. All server-side credentials are held in environment variables
            and are never included in the Chrome extension package or exposed to the browser.
          </p>
        </Section>

        <Section title="15. Limited Use (Chrome Web Store)">
          <p>
            The use of information received from Google APIs will adhere to the Chrome Web
            Store User Data Policy, including the Limited Use requirements. Data collected
            through the Walour Chrome extension is used exclusively for transaction risk
            analysis and is not used for personalised advertising, credit scoring, or any
            purpose unrelated to on-chain security.
          </p>
        </Section>

        <Section title="16. Changes to this policy">
          <p>
            Material changes will be communicated via a notice on walour.io. The effective
            date at the top of this page will be updated. Continued use of any Walour product
            after the effective date constitutes acceptance of the revised policy.
          </p>
        </Section>

        <Section title="17. Contact">
          <p>Privacy questions or data subject requests:</p>
          <ul style={{ marginTop: 8 }}>
            <li>Email: <a href="mailto:walour786@gmail.com">walour786@gmail.com</a></li>
            <li>X: <a href="https://x.com/walourApp" target="_blank" rel="noopener noreferrer">@walourApp</a></li>
            <li>X (founder): <a href="https://x.com/Sahir__S" target="_blank" rel="noopener noreferrer">@Sahir__S</a></li>
          </ul>
          <p style={{ marginTop: 12 }}>
            Response time: within 30 days for GDPR/CCPA requests, within 7 days for general
            enquiries.
          </p>
        </Section>

      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 44 }}>
      <h2 style={{
        fontSize: 17,
        fontWeight: 600,
        color: 'var(--text)',
        marginBottom: 14,
        paddingBottom: 8,
        borderBottom: '1px solid var(--border)',
      }}>
        {title}
      </h2>
      <div style={{
        fontSize: 15,
        lineHeight: 1.75,
        color: 'var(--text-muted)',
      }}>
        {children}
      </div>
    </section>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
        color: 'var(--text-muted)',
      }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{
                textAlign: 'left',
                padding: '8px 12px',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontWeight: 600,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                borderBottom: '1px solid var(--border)',
                whiteSpace: 'nowrap',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: '10px 12px',
                  color: j === 0 ? 'var(--text)' : undefined,
                  fontWeight: j === 0 ? 500 : undefined,
                  verticalAlign: 'top',
                }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
