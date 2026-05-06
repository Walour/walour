import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service | Walour',
  description:
    'Terms of Service for Walour, real-time scam protection for Solana. Covers the Chrome extension, public API, @walour/sdk, and on-chain oracle.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 44 }}>
      <h2
        style={{
          fontSize: 17,
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 14,
          paddingBottom: 8,
          borderBottom: '1px solid var(--border)',
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text-muted)' }}>
        {children}
      </div>
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ marginBottom: 12 }}>{children}</p>
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul style={{ paddingLeft: 20, marginBottom: 12, listStyleType: 'disc' }}>
      {children}
    </ul>
  )
}

function LI({ children }: { children: React.ReactNode }) {
  return <li style={{ marginBottom: 6 }}>{children}</li>
}

export default function TermsPage() {
  return (
    <main>
      <div className="container" style={{ paddingTop: 60, paddingBottom: 80, maxWidth: 740 }}>
        <h1 className="section-title" style={{ marginBottom: 6 }}>
          Terms of Service
        </h1>
        <p className="section-sub" style={{ marginBottom: 48 }}>
          Effective: May 6, 2026
        </p>

        {/* 1 */}
        <Section title="1. Acceptance of Terms">
          <P>
            By installing the Walour Chrome extension, accessing or calling the Walour API
            (available at <strong>walour.vercel.app</strong>), installing the{' '}
            <strong>@walour/sdk</strong> npm package, or otherwise using any Walour service
            (collectively, the &ldquo;Services&rdquo;), you (&ldquo;you&rdquo; or
            &ldquo;User&rdquo;) agree to be bound by these Terms of Service
            (&ldquo;Terms&rdquo;). If you do not agree, do not use the Services.
          </P>
          <P>
            These Terms form a legally binding agreement between you and Walour
            (&ldquo;Walour&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;).
            Use of the Services is also subject to our{' '}
            <a href="/privacy" style={{ color: 'var(--accent)' }}>
              Privacy Policy
            </a>
            , which is incorporated into these Terms by reference.
          </P>
          <P>
            If you are using the Services on behalf of an organisation, you represent that you
            have authority to bind that organisation to these Terms.
          </P>
        </Section>

        {/* 2 */}
        <Section title="2. Description of Services">
          <P>Walour provides the following Services:</P>
          <UL>
            <LI>
              <strong>Chrome Extension.</strong> A Manifest v3 browser extension for Chrome and
              Brave that intercepts and analyses Solana transaction signing requests in real time,
              displaying a threat score and decoded summary before you confirm or reject the
              transaction.
            </LI>
            <LI>
              <strong>Public API.</strong> An HTTP API hosted on Vercel Edge Functions that
              accepts a Solana transaction payload or address and returns a threat assessment,
              including a confidence-weighted risk score, detected threat categories, and an
              AI-generated plain-language summary.
            </LI>
            <LI>
              <strong>@walour/sdk.</strong> An open-source TypeScript npm package that wraps the
              Walour API and on-chain oracle with a typed interface, caching layer, and circuit
              breakers. Distributed under the MIT licence.
            </LI>
            <LI>
              <strong>On-chain Oracle.</strong> A Solana program that stores verified threat
              entries on the Solana blockchain. On-chain data is public and immutable.
            </LI>
            <LI>
              <strong>Web Application.</strong> The website at <strong>walour.io</strong>,
              including the public threat registry, live oracle statistics, and documentation.
            </LI>
          </UL>
          <P>
            All Services are currently provided free of charge. Walour reserves the right to
            introduce paid tiers or modify the feature set at any time, with advance notice.
          </P>
        </Section>

        {/* 3 */}
        <Section title="3. Threat Scores Are Advisory Only">
          <P>
            Walour threat scores, risk ratings, confidence values, and AI-generated summaries
            (collectively, &ldquo;Threat Assessments&rdquo;) are provided for informational
            purposes only. They are <strong>not a guarantee</strong> that a transaction or
            address is safe or malicious.
          </P>
          <P>
            Threat Assessments are derived from heuristic analysis, third-party threat
            intelligence feeds, community reports, and machine-learning models, each of which may
            be incomplete, stale, or incorrect. In particular:
          </P>
          <UL>
            <LI>A score of &ldquo;safe&rdquo; or low risk does not mean the transaction cannot drain your wallet.</LI>
            <LI>A score of &ldquo;high risk&rdquo; does not guarantee the transaction is malicious.</LI>
            <LI>New attack vectors may not yet be reflected in the oracle or threat database.</LI>
            <LI>On-chain oracle entries submitted by third parties have not been independently verified by Walour unless explicitly stated.</LI>
          </UL>
          <P>
            <strong>
              You bear sole responsibility for any decision to sign, reject, or otherwise act
              upon a transaction.
            </strong>{' '}
            Walour is a decision-support tool, not a security guarantee. Never sign a transaction
            you do not understand, regardless of its Walour score.
          </P>
        </Section>

        {/* 4 */}
        <Section title="4. Acceptable Use">
          <P>
            You may use the Services only for lawful purposes and in accordance with these Terms.
            The following are prohibited:
          </P>
          <UL>
            <LI>
              Using the API or SDK to build, operate, or improve any wallet drainer,
              phishing kit, social engineering tool, or any product designed to deceive users
              into signing malicious transactions.
            </LI>
            <LI>
              Scraping, bulk-harvesting, or systematically downloading threat intelligence data
              from the API, web application, or on-chain oracle for redistribution or resale
              without prior written consent.
            </LI>
            <LI>
              Reverse-engineering, decompiling, or otherwise extracting proprietary scoring
              logic, model weights, or detection rules from the Services for malicious purposes or
              to create a competing service without attribution.
            </LI>
            <LI>
              Circumventing or attempting to circumvent rate limits, authentication controls, or
              access restrictions imposed on the API.
            </LI>
            <LI>
              Submitting false, misleading, or malicious threat reports to the oracle with the
              intent to smear legitimate addresses or manipulate confidence scores.
            </LI>
            <LI>
              Deploying automated scripts or bots that generate excessive load on the API beyond
              what is reasonably necessary for your application&apos;s stated purpose.
            </LI>
            <LI>
              Using the Services in any way that violates applicable law, including export control
              laws, sanctions programmes, anti-money-laundering regulations, or data protection
              law.
            </LI>
            <LI>
              Impersonating Walour, misrepresenting the source or accuracy of Threat Assessments,
              or using Walour branding without prior written permission.
            </LI>
          </UL>
          <P>
            These restrictions apply to all access methods: direct API calls, use of the SDK,
            use of the extension, and automated or programmatic access via any third-party
            interface.
          </P>
        </Section>

        {/* 5 */}
        <Section title="5. Intellectual Property">
          <P>
            The Walour name, logo, brand marks, website design, extension code, API code, SDK
            source code (where not separately MIT-licensed), scoring algorithms, and
            documentation are owned by or exclusively licensed to Walour and are protected by
            copyright, trade mark, and other intellectual property laws. Nothing in these Terms
            transfers ownership of any Walour intellectual property to you.
          </P>
          <P>
            The <strong>@walour/sdk</strong> npm package is distributed under the MIT Licence.
            Your rights with respect to that package are governed by the MIT Licence, not these
            Terms. These Terms continue to apply to your use of the API endpoints the SDK calls.
          </P>
          <P>
            <strong>On-chain oracle data</strong> stored on the Solana blockchain is public by
            nature and is not owned by Walour. You may read and reference on-chain oracle entries
            freely, subject to the acceptable use restrictions in Section 4.
          </P>
          <P>
            Subject to these Terms, Walour grants you a limited, non-exclusive, non-transferable,
            revocable licence to access and use the Services for their intended purpose.
          </P>
        </Section>

        {/* 6 */}
        <Section title="6. Disclaimer of Warranties">
          <P
            style={{
              textTransform: 'uppercase',
              fontSize: 13,
              letterSpacing: '0.02em',
              color: 'var(--text)',
            }}
          >
            THE SERVICES ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
            WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
          </P>
          <P>
            To the fullest extent permitted by applicable law, Walour expressly disclaims all
            warranties, including but not limited to:
          </P>
          <UL>
            <LI>implied warranties of merchantability, fitness for a particular purpose, and non-infringement;</LI>
            <LI>any warranty that the Services will be uninterrupted, error-free, or free from viruses or malicious code;</LI>
            <LI>any warranty that Threat Assessments will be accurate, complete, current, or reliable;</LI>
            <LI>any warranty that the Services will detect all known or unknown wallet drainers, phishing attacks, or scam transactions;</LI>
            <LI>any warranty as to the continued availability, accuracy, or completeness of threat data sourced from third parties (GoPlus Security, Helius, and others).</LI>
          </UL>
          <P>
            Some jurisdictions do not allow the exclusion of implied warranties. In such
            jurisdictions, the above exclusions apply to the maximum extent permitted by law.
          </P>
        </Section>

        {/* 7 */}
        <Section title="7. Limitation of Liability">
          <P
            style={{
              textTransform: 'uppercase',
              fontSize: 13,
              letterSpacing: '0.02em',
              color: 'var(--text)',
            }}
          >
            TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL WALOUR, ITS
            CONTRIBUTORS, LICENSORS, OR SERVICE PROVIDERS BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES WHATSOEVER,
            INCLUDING BUT NOT LIMITED TO LOSS OF FUNDS, LOSS OF CRYPTOCURRENCY ASSETS, LOSS OF
            DATA, LOSS OF PROFITS, LOSS OF BUSINESS, OR LOSS OF GOODWILL, ARISING OUT OF OR IN
            CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICES, EVEN IF ADVISED OF
            THE POSSIBILITY OF SUCH DAMAGES.
          </P>
          <P>
            Because the Services are provided free of charge, and to the maximum extent
            permitted by applicable law, Walour&apos;s total aggregate liability to you for any
            claim arising out of or relating to these Terms or the Services shall not exceed{' '}
            <strong>zero pounds sterling (£0)</strong>. This zero-liability cap reflects the
            fact that no fee is charged for the Services and that Threat Assessments are
            explicitly advisory in nature.
          </P>
          <P>
            The essential basis of the bargain between you and Walour is that Walour provides
            the Services at no charge in reliance on these liability limitations. You acknowledge
            that this allocation of risk is reasonable and that Walour would not provide the
            Services without these limitations.
          </P>
          <P>
            Nothing in these Terms limits or excludes liability for fraud, fraudulent
            misrepresentation, death or personal injury caused by negligence, or any other
            liability that cannot be excluded or limited under applicable law.
          </P>
        </Section>

        {/* 8 */}
        <Section title="8. On-Chain Data and Immutability">
          <P>
            Threat entries submitted to the Walour on-chain oracle are written to the Solana
            blockchain and are <strong>immutable once confirmed</strong>. Walour cannot delete,
            modify, or suppress on-chain entries after they have been finalised, nor can any
            other party. Do not submit data to the oracle that you do not wish to be permanently
            and publicly recorded.
          </P>
          <P>
            Walour does not guarantee the accuracy of community-submitted oracle entries and
            expressly disclaims liability for any loss arising from reliance on such entries.
            Confidence scores attached to oracle entries reflect the degree of corroboration
            from multiple sources; a high confidence score is not a guarantee of accuracy.
          </P>
          <P>
            If you believe an on-chain entry is factually incorrect or was submitted in bad
            faith, please contact us at{' '}
            <a href="mailto:walour786@gmail.com" style={{ color: 'var(--accent)' }}>
              walour786@gmail.com
            </a>
            . While we cannot alter the blockchain record, we may flag the entry in the
            off-chain registry with a dispute notice.
          </P>
        </Section>

        {/* 9 */}
        <Section title="9. Third-Party Services">
          <P>
            The Services integrate with or depend on the following third-party providers:
          </P>
          <UL>
            <LI><strong>Anthropic:</strong> AI inference (Claude models) for transaction decoding and threat summaries.</LI>
            <LI><strong>GoPlus Security:</strong> External threat intelligence feeds.</LI>
            <LI><strong>Helius / Triton:</strong> Solana RPC node infrastructure.</LI>
            <LI><strong>Supabase:</strong> Database and backend services.</LI>
            <LI><strong>Upstash:</strong> Redis caching layer.</LI>
            <LI><strong>Vercel:</strong> API hosting and edge function runtime.</LI>
          </UL>
          <P>
            Walour is not responsible for the availability, accuracy, content, policies, or
            conduct of any third-party provider. Outages or changes in any third-party service
            may degrade or interrupt the Services without notice. Your use of third-party
            services accessed through or alongside Walour is subject to those providers&apos;
            own terms and policies.
          </P>
          <P>
            Walour implements circuit breakers to limit the impact of third-party failures, but
            does not guarantee uninterrupted service when upstream dependencies are unavailable.
          </P>
        </Section>

        {/* 10 */}
        <Section title="10. Termination and Suspension of API Access">
          <P>
            Walour may, in its sole discretion and without prior notice, suspend or permanently
            revoke your access to the API and SDK if:
          </P>
          <UL>
            <LI>you breach any provision of these Terms, including the acceptable use restrictions in Section 4;</LI>
            <LI>your usage patterns suggest automated abuse, excessive load generation, or scraping in violation of these Terms;</LI>
            <LI>you use the Services in a manner that causes or is likely to cause harm to Walour, other users, or third parties;</LI>
            <LI>Walour is required to do so by applicable law, regulation, or court order; or</LI>
            <LI>Walour discontinues the relevant Service.</LI>
          </UL>
          <P>
            Where Walour suspects a breach but it is capable of remedy, Walour may at its
            discretion provide you with written notice (including by email) and a period of not
            less than 7 days to remedy the breach before suspension takes effect. Walour is under
            no obligation to provide such a cure period where the breach is serious, deliberate,
            or incapable of remedy.
          </P>
          <P>
            Upon suspension or termination: (a) all licences granted under these Terms cease
            immediately; (b) you must stop using the API and delete any cached API responses or
            SDK artefacts that rely on Walour&apos;s proprietary data; and (c) Sections 3, 5, 6,
            7, 8, 11, and 12 survive termination indefinitely.
          </P>
          <P>
            You may stop using the Services at any time. Uninstalling the Chrome extension and
            ceasing API calls constitutes termination by you.
          </P>
        </Section>

        {/* 11 */}
        <Section title="11. Governing Law and Dispute Resolution">
          <P>
            These Terms and any dispute or claim arising out of or in connection with them or
            their subject matter or formation (including non-contractual disputes or claims)
            shall be governed by and construed in accordance with the laws of{' '}
            <strong>England and Wales</strong>.
          </P>
          <P>
            Each party irrevocably agrees that the courts of England and Wales shall have
            exclusive jurisdiction to settle any dispute or claim arising out of or in
            connection with these Terms or their subject matter or formation.
          </P>
          <P>
            Notwithstanding the above, Walour reserves the right to seek injunctive or other
            equitable relief in any jurisdiction to prevent or restrain infringement of
            intellectual property rights or breach of the acceptable use restrictions in
            Section 4.
          </P>
        </Section>

        {/* 12 */}
        <Section title="12. GDPR and Data Protection">
          <P>
            Walour processes limited personal data in connection with the Services. Our full data
            processing practices, legal bases, and your rights as a data subject are described in
            our{' '}
            <a href="/privacy" style={{ color: 'var(--accent)' }}>
              Privacy Policy
            </a>
            , which constitutes the primary data protection notice for purposes of Articles 13
            and 14 of the UK GDPR and EU GDPR.
          </P>
          <P>
            The Chrome extension operates principally on-device. Solana transaction data
            submitted to the API for scoring is processed transiently and is not stored in
            association with identifying information about the user making the request, except
            as described in the Privacy Policy.
          </P>
          <P>
            If you are located in the European Economic Area, the United Kingdom, or another
            jurisdiction with data protection legislation, you may exercise your rights
            (including rights of access, rectification, erasure, restriction, portability, and
            objection) by contacting us at the address in Section 14. Note that on-chain data
            written to the Solana blockchain is subject to Section 8 and cannot be erased.
          </P>
        </Section>

        {/* 13 */}
        <Section title="13. Changes to These Terms">
          <P>
            Walour reserves the right to modify these Terms at any time. When we make material
            changes, we will update the &ldquo;Effective&rdquo; date at the top of this page and,
            where reasonably practicable, provide notice via the website or extension update
            notes.
          </P>
          <P>
            Your continued use of the Services after the updated Terms take effect constitutes
            your acceptance of the revised Terms. If you do not agree to the revised Terms, you
            must stop using the Services and uninstall the Chrome extension.
          </P>
          <P>
            We encourage you to review these Terms periodically. The current version is always
            available at <strong>walour.io/terms</strong>.
          </P>
        </Section>

        {/* 14 */}
        <Section title="14. Contact">
          <P>If you have any questions about these Terms, please contact us at:</P>
          <P>
            <strong>Walour</strong>
            <br />
            <a href="mailto:walour786@gmail.com" style={{ color: 'var(--accent)' }}>
              walour786@gmail.com
            </a>
            <br />
            <a href="https://walour.io" style={{ color: 'var(--accent)' }}>
              walour.io
            </a>
          </P>
          <P
            style={{
              marginTop: 24,
              padding: '12px 16px',
              background: 'var(--surface)',
              borderLeft: '3px solid var(--border)',
              borderRadius: 4,
              fontSize: 13,
              color: 'var(--text-muted)',
            }}
          >
            These Terms do not constitute legal advice. If you are building a commercial product
            on top of the Walour API or SDK, you should obtain independent legal counsel
            appropriate to your jurisdiction and use case.
          </P>
        </Section>
      </div>
    </main>
  )
}
