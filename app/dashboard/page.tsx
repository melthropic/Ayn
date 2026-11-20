import type { Metadata } from 'next'
import { Dashboard } from '@/components/ayn/dashboard'

export const metadata: Metadata = {
  title: 'Ayn | Dashboard',
}

export default function DashboardPage() {
  return <Dashboard />
}
