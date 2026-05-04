export const revalidate = 60

import Hero from '@/components/landing/Hero'
import StatsStrip from '@/components/landing/StatsStrip'
import ThreatScene from '@/components/landing/ThreatScene'
import HowItWorks from '@/components/landing/HowItWorks'
import IntelSources from '@/components/landing/IntelSources'
import FeatureTiles from '@/components/landing/FeatureTiles'
import SdkBlock from '@/components/landing/SdkBlock'
import CtaBanner from '@/components/landing/CtaBanner'
import { fetchStats } from '@/lib/queries'

export default async function HomePage() {
  const stats = await fetchStats()
  return (
    <main>
      <Hero threatsIndexed={stats.threatsTracked} />
      <StatsStrip
        threats={stats.threatsTracked}
        drainsBlocked={stats.drainsBlocked}
        solSaved={stats.solSaved}
      />
      <ThreatScene />
      <HowItWorks />
      <IntelSources />
      <FeatureTiles />
      <SdkBlock />
      <CtaBanner />
    </main>
  )
}
