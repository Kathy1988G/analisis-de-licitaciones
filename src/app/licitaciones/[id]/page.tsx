import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LicitacionDetalle from '@/components/LicitacionDetalle'

interface Props {
  params: Promise<{ id: string }>
}

export default async function LicitacionPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: licitacion } = await supabase
    .from('licitaciones')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!licitacion) notFound()

  const { data: documentos } = await supabase
    .from('documentos')
    .select('*')
    .eq('licitacion_id', id)
    .order('created_at', { ascending: true })

  const { data: analisis } = await supabase
    .from('analisis')
    .select('*')
    .eq('licitacion_id', id)
    .single()

  return (
    <LicitacionDetalle
      licitacion={licitacion}
      documentos={documentos ?? []}
      analisis={analisis ?? null}
    />
  )
}
