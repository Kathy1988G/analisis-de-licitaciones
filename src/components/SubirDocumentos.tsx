'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Trash2, Sparkles, File } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Documento } from '@/types'

interface Props {
  licitacionId: string
  documentos: Documento[]
  onDocumentosChange: (docs: Documento[]) => void
  onIniciarAnalisis: () => void
  analisisExiste: boolean
}

export default function SubirDocumentos({
  licitacionId,
  documentos,
  onDocumentosChange,
  onIniciarAnalisis,
  analisisExiste,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const onDrop = useCallback(async (files: File[]) => {
    setUploading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('No autenticado'); setUploading(false); return }

    const nuevos: Documento[] = []

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!['pdf', 'xlsx', 'xls'].includes(ext)) {
        setError(`Formato no soportado: ${file.name}`)
        continue
      }

      const safeName = file.name
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${user.id}/${licitacionId}/${Date.now()}_${safeName}`
      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(path, file)

      if (uploadError) {
        setError(`Error subiendo ${file.name}: ${uploadError.message}`)
        continue
      }

      const { data: { publicUrl } } = supabase.storage
        .from('documentos')
        .getPublicUrl(path)

      const { data: doc } = await supabase
        .from('documentos')
        .insert({
          licitacion_id: licitacionId,
          nombre: file.name,
          tipo: ext,
          url: path,
        })
        .select()
        .single()

      if (doc) nuevos.push(doc as Documento)
    }

    onDocumentosChange([...documentos, ...nuevos])
    setUploading(false)
  }, [documentos, licitacionId, onDocumentosChange, supabase])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: true,
  })

  async function eliminar(doc: Documento) {
    await supabase.storage.from('documentos').remove([doc.url])
    await supabase.from('documentos').delete().eq('id', doc.id)
    onDocumentosChange(documentos.filter(d => d.id !== doc.id))
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload size={28} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500">
          {isDragActive
            ? 'Soltá los archivos aquí'
            : 'Arrastrá archivos PDF o Excel, o hacé clic para seleccionar'}
        </p>
        <p className="text-xs text-gray-400 mt-1">Formatos: .pdf, .xlsx, .xls</p>
      </div>

      {uploading && (
        <p className="text-sm text-blue-500 text-center">Subiendo archivos...</p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {documentos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          {documentos.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
              <File size={16} className="text-blue-400 shrink-0" />
              <span className="text-sm text-gray-700 flex-1 truncate">{doc.nombre}</span>
              <span className="text-xs text-gray-400 uppercase">{doc.tipo}</span>
              <button
                onClick={() => eliminar(doc)}
                className="text-gray-300 hover:text-red-400 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {documentos.length > 0 && (
        <button
          onClick={onIniciarAnalisis}
          className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Sparkles size={16} />
          {analisisExiste ? 'Ver análisis' : 'Analizar con IA'}
        </button>
      )}
    </div>
  )
}
