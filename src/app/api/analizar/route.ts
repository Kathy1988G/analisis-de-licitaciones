import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'
import { DOMMatrix } from '@napi-rs/canvas/geometry.js'

// pdf-parse usa pdfjs-dist, que referencia DOMMatrix/ImageData/Path2D al cargar.
// En el runtime serverless de Vercel esas APIs de navegador no existen y el
// módulo falla con "DOMMatrix is not defined". Definimos los globals aquí (con
// el DOMMatrix puro-JS de @napi-rs/canvas, sin binario nativo); como solo
// extraemos texto y no renderizamos, basta con stubs para ImageData/Path2D.
const g = globalThis as unknown as Record<string, unknown>
g.DOMMatrix ??= DOMMatrix
g.ImageData ??= class ImageData {}
g.Path2D ??= class Path2D {}

// El análisis llama a Claude con pliegos largos: necesita más que el timeout
// por defecto. Forzamos runtime Node (pdf-parse/xlsx no corren en edge).
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    return await analizar(req)
  } catch (e: any) {
    // Cualquier excepción no controlada (p. ej. fallo de la llamada a Claude)
    // se devuelve como JSON para que el cliente muestre el motivo real en vez
    // de un 500 con HTML opaco ("Error en el análisis").
    console.error('Error no controlado en /api/analizar:', e)
    return NextResponse.json(
      { error: `Error en el análisis: ${e?.message ?? 'desconocido'}` },
      { status: 500 },
    )
  }
}

async function analizar(req: NextRequest) {
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
        const { PDFParse } = await import('pdf-parse')
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

  let message
  try {
    message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: 'Sos un analista de licitaciones. Respondé EXCLUSIVAMENTE con un objeto JSON válido, sin markdown, sin explicaciones ni texto antes o después.',
      messages: [{ role: 'user', content: prompt }],
    })
  } catch (e: any) {
    console.error('Fallo la llamada a Claude:', e?.status, e?.message)
    return NextResponse.json(
      { error: `La IA no pudo procesar el análisis: ${e?.message ?? 'error de conexión'}` },
      { status: 502 },
    )
  }

  const primerBloque = message.content[0]
  const respuesta = primerBloque?.type === 'text' ? primerBloque.text : ''
  // Extraemos el objeto JSON entre la primera "{" y la última "}", descartando
  // cualquier texto o markdown que el modelo haya añadido alrededor.
  const ini = respuesta.indexOf('{')
  const fin = respuesta.lastIndexOf('}')
  const jsonStr = ini !== -1 && fin !== -1 ? respuesta.slice(ini, fin + 1) : respuesta

  let resultado
  try {
    resultado = JSON.parse(jsonStr)
  } catch {
    console.error('No se pudo parsear la respuesta de IA. stop_reason:', message.stop_reason, '| respuesta:', respuesta.slice(0, 500))
    return NextResponse.json({
      error: message.stop_reason === 'max_tokens'
        ? 'El análisis fue demasiado largo y se cortó. Probá con menos documentos o instrucciones más acotadas.'
        : 'Error parseando respuesta de IA',
    }, { status: 500 })
  }

  if (advertencias.length > 0) {
    resultado._advertencias = advertencias
  }

  return NextResponse.json(resultado)
}
