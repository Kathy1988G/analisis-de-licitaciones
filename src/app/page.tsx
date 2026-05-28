import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Dashboard from '@/components/Dashboard'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: licitaciones } = await supabase
    .from('licitaciones')
    .select('*')
    .order('created_at', { ascending: false })

  return <Dashboard licitaciones={licitaciones ?? []} />
}
