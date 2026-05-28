export interface Licitacion {
  id: string
  nombre: string
  entidad: string
  created_at: string
  updated_at: string
  user_id: string
}

export interface Documento {
  id: string
  licitacion_id: string
  nombre: string
  tipo: string
  url: string
  created_at: string
}

export interface Analisis {
  id: string
  licitacion_id: string
  tiempos_entrega: string | null
  garantia: string | null
  alcance_servicio: string | null
  especificaciones_tecnicas: string | null
  logistica: string | null
  condicion_pago: string | null
  campos_adicionales: Record<string, string> | null
  created_at: string
  updated_at: string
}
