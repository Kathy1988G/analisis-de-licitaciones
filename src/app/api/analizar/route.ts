import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'
import { PDFParse } from 'pdf-parse'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { licitacionId, documentoIds, instrucciones } = await req.json()

  const { data: documentos } = await supabase
    .from('documentos')
    .select('*')
    .in('id', documentoIds)

  if (!documentos || documentos.length === 0) {
    return NextResponse.json({ error: 'No hay documentos' }, { status: 400 })
  }

  const contenidos: string[] = []
  const advertencias: string[] = []

  for (const doc of documentos) {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documentos')
      .download(doc.url)

    if (downloadError || !fileData) {
      advertencias.push(`No se pudo descargar "${doc.nombre}"${downloadError ? `: ${downloadError.message}` : ''}`)
      continue
    }

    if (doc.tipo === 'pdf') {
      try {
        const data = new Uint8Array(await fileData.arrayBuffer())
        const parser = new PDFParse({ data })
        const parsed = await parser.getText()
        const texto = parsed.text?.trim() ?? ''
        if (!texto) {
          advertencias.push(`"${doc.nombre}" no contiene texto extraíble (puede ser un PDF escaneado)`)
        } else {
          contenidos.push(`--- Documento: ${doc.nombre} ---\n${texto}`)
        }
      } catch (e: any) {
        advertencias.push(`Error al procesar "${doc.nombre}": ${e?.message ?? 'desconocido'}`)
      }
    } else {
      try {
        const XLSX = await import('xlsx')
        const buffer = await fileData.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })
        let texto = `--- Documento: ${doc.nombre} ---\n`
        wb.SheetNames.forEach(sheetName => {
          const ws = wb.Sheets[sheetName]
          texto += `Hoja: ${sheetName}\n${XLSX.utils.sheet_to_csv(ws)}\n`
        })
        contenidos.push(texto)
      } catch (e: any) {
        advertencias.push(`Error al procesar "${doc.nombre}": ${e?.message ?? 'desconocido'}`)
      }
    }
  }

  if (contenidos.length === 0) {
    return NextResponse.json({
      error: 'No se pudo extraer texto de los documentos',
      detalles: advertencias,
    }, { status: 400 })
  }

  const textoDocumentos = contenidos.join('\n\n')

  const prompt = `Sos un experto en licitaciones empresariales. Analizá el siguiente pliego de condiciones y extraé la información clave.

DOCUMENTOS:
${textoDocumentos}

Respondé ÚNICAMENTE con un JSON válido con esta estructura (sin texto adicional, sin markdown):
{
  "tiempos_entrega": "descripción detallada de los tiempos de entrega requeridos",
  "garantia": "descripción de las garantías exigidas (de seriedad, cumplimiento, etc.)",
  "alcance_servicio": "descripción del alcance completo del servicio o suministro requerido",
  "especificaciones_tecnicas": "especificaciones técnicas detalladas de los equipos o servicios",
  "logistica": "descripción de la logística requerida: si incluye flete, entrega punto a punto, instalación, etc.",
  "condicion_pago": "condiciones y plazos de pago especificados",
  "campos_adicionales": {
    "nombre_campo": "valor si encontrás información relevante adicional no cubierta por los campos anteriores"
  }
}

Si un campo no tiene información disponible en los documentos, dejá el valor como cadena vacía "".${
    instrucciones?.trim()
      ? `\n\nINSTRUCCIONES ADICIONALES DEL ANALISTA:\n${instrucciones.trim()}\n\nTené especialmente en cuenta estas instrucciones al completar el JSON. Si alguna pregunta genera información que no encaja en los campos fijos, incorporala en "campos_adicionales" con un nombre descriptivo.`
      : ''
  }`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const respuesta = message.content[0].type === 'text' ? message.content[0].text : ''

  let resultado
  try {
    const limpio = respuesta.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    resultado = JSON.parse(limpio)
  } catch {
    return NextResponse.json({ error: 'Error parseando respuesta de IA' }, { status: 500 })
  }

  if (advertencias.length > 0) {
    resultado._advertencias = advertencias
  }

  return NextResponse.json(resultado)
}
