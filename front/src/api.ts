// Cliente HTTP para LoasStudio.Api. Cambia la URL con VITE_API_URL (ver .env.example).
const BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:5080"

export class ApiError extends Error {}

// ---------- Sesión (token) ----------
const TOKEN_KEY = "loa-token"
const SESSION_KEY = "loa-session"
let currentToken: string | null = null
let onUnauthorized: (() => void) | null = null

export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn
}

/** Guarda la sesión. "Recordarme" = localStorage; si no, solo mientras la pestaña esté abierta. */
export function saveAuth(session: Session, token: string, remember: boolean) {
  clearAuth()
  currentToken = token
  const store = remember ? localStorage : sessionStorage
  try {
    store.setItem(TOKEN_KEY, token)
    store.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* sin almacenamiento disponible */
  }
}

export function loadAuth(): { session: Session; token: string } | null {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const token = store.getItem(TOKEN_KEY)
      const raw = store.getItem(SESSION_KEY)
      if (token && raw) {
        currentToken = token
        return { token, session: JSON.parse(raw) as Session }
      }
    } catch {
      /* ignorar */
    }
  }
  return null
}

export function clearAuth() {
  currentToken = null
  for (const store of [sessionStorage, localStorage]) {
    try {
      store.removeItem(TOKEN_KEY)
      store.removeItem(SESSION_KEY)
    } catch {
      /* ignorar */
    }
  }
}

export const errMsg = (e: unknown) =>
  e instanceof Error ? e.message : "Ocurrió un error inesperado."

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(`No se pudo conectar con la API (${BASE}). Verifica que esté corriendo.`)
  }
  if (res.status === 401 && currentToken) {
    onUnauthorized?.()
    throw new ApiError("Tu sesión expiró. Inicia sesión de nuevo.")
  }
  if (res.status === 403) throw new ApiError("No tienes permiso para realizar esta acción.")
  if (res.status === 204) return undefined as T
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error
    throw new ApiError(msg ?? `Error ${res.status} al llamar a la API.`)
  }
  return data as T
}

const qs = (p: Record<string, string | number | boolean | null | undefined>) => {
  const e = Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== "")
  return e.length
    ? "?" + e.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")
    : ""
}

// ---------- Tipos (las claves llegan en camelCase desde la API) ----------
export interface Session {
  idPersona: number
  nombreCompleto: string
  rol: string
  idEmpleado: number | null
  idCliente: number | null
}
export interface LoginResult extends Session {
  token: string
}
export interface ClienteRow {
  idCliente: number
  nombreCompleto: string
  dni: string
  fechaRegistro: string
  telefono: string | null
  correo: string | null
  cantidadFacturas: number
  totalGastado: number
  estado?: string
}
export interface ClienteDetalle {
  idCliente: number
  primerNombre: string
  segundoNombre: string | null
  primerApellido: string
  segundoApellido: string | null
  dni: string
  fechaNacimiento: string
  fechaRegistro: string
  telefono: string | null
  correo: string | null
}
export interface Notificacion {
  id: string
  tipo: string
  idRef: number
  fecha: string
  fechaFin: string | null
  detalle: string | null
  monto: number | null
  idFactura: number | null
  cantidad: number | null
  minimo: number | null
  dias: number | null
}
export interface HorarioRow {
  idHorario: number
  diaSemana: string
  horaInicio: string
  horaFin: string
}
export interface EspecialistaRow {
  idEmpleado: number
  nombreCompleto: string
}
export interface CitaRow {
  idCita: number
  fechaHoraInicio: string
  fechaHoraFin: string
  duracionMinutos: number
  estadoCita: string
  servicios: string | null
  empleados: string | null
  paquete: string | null
  totalServicios: number | null
  observaciones: string | null
  idCliente: number | null
  cliente: string | null
}
export interface EmpleadoRow {
  idEmpleado: number
  nombreCompleto: string
  dni: string
  fechaContratacion: string
  aniosAntiguedad: number
  salario: number
  estadoEmpleado: string
  especialidades: string
}
export interface ServicioRow {
  idServicio: number
  nombreServicio: string
  descripcion: string | null
  precio: number
  duracionMinutos: number
}
export interface PromocionRow {
  idPromocion: number
  nombrePromocion: string
  tipoDescuento: string
  fechaInicio: string
  fechaFin: string
  situacion: string
  activa: string
  serviciosIncluidos: string
  productosIncluidos: string
  vecesAplicada: number
}
export interface FormaPagoRow {
  idFormaPago: number
  nombreFormaPago: string
}
export interface ProveedorRow {
  idProveedor: number
  nombre: string | null
  rtn: string
}
export interface ProductoRow {
  idProducto: number
  nombre: string
  marca: string
  precioVenta: number
  stock: number
}
export interface InventarioRow {
  idInventario: number
  idProducto: number
  producto: string
  marca: string
  numeroLote: string | null
  cantidadDisponible: number
  existenciaMinima: number
  estadoInventario: string
  fechaVencimiento: string | null
  proveedor: string | null
}
export interface VencimientoRow {
  idLote: number
  numeroLote: string | null
  producto: string
  fechaVencimiento: string
  diasParaVencer: number
  situacion: string
  cantidadDisponible: number | null
}
export interface FacturaRow {
  idFactura: number
  cliente: string
  atendidoPor: string
  tipoVenta: string
  fechaCita: string | null
  formaPago: string | null
  unidadesProductos: number
  descuentoPromocion: number
  totalFactura: number
}
export interface IngresoMesRow {
  anio: number
  mes: number
  periodo: string
  cantidadFacturas: number
  totalIngresos: number
  ticketPromedio: number
}
export interface MasVendidoRow {
  posicion: number
  idServicio: number
  nombreServicio: string
  vecesRealizado: number
  ingresosGenerados: number
  precioPromedioAplicado: number
}
export interface ReporteVentas {
  ingresosPorServicio: {
    idServicio: number
    nombreServicio: string
    vecesRealizado: number
    ingresos: number
  }[]
  porFormaPago: { formaPago: string; cantidadFacturas: number; totalFacturado: number }[]
  resumen: { cantidadFacturas: number; totalIngresos: number; ticketPromedio: number } | null
}
export interface HistorialCliente {
  cliente: ClienteRow | null
  facturas: { idFactura: number; tipoVenta: string; fechaCita: string | null; total: number }[]
}

// ---------- Llamadas ----------
export const api = {
  login: (usuario: string, contrasena: string) =>
    request<LoginResult>("POST", "/api/auth/login", { usuario, contrasena }),

  registroCliente: (b: NuevoCliente) => request<{ idCliente: number }>("POST", "/api/auth/registro", b),

  clientes: () => request<ClienteRow[]>("GET", "/api/clientes"),
  clienteDetalle: (id: number) => request<ClienteDetalle>("GET", `/api/clientes/${id}/detalle`),
  actualizarCliente: (id: number, b: ClienteEdicion) => request<void>("PUT", `/api/clientes/${id}`, b),
  eliminarCliente: (id: number) =>
    request<{ resultado: string }>("DELETE", `/api/clientes/${id}?confirmar=true`),
  historial: (id: number) => request<HistorialCliente>("GET", `/api/clientes/${id}/historial`),
  crearCliente: (b: NuevoCliente) => request<{ idCliente: number }>("POST", "/api/clientes", b),

  citas: () => request<CitaRow[]>("GET", "/api/citas"),
  horarios: (idEmpleado: number, fecha: string, duracionMinutos: number) =>
    request<{ horaInicio: string; horaFin: string }[]>(
      "GET",
      `/api/citas/horarios-disponibles${qs({ idEmpleado, fecha, duracionMinutos })}`,
    ),
  agendar: (b: {
    fechaHoraInicio: string
    duracionMinutos: number
    idEmpleado: number
    servicios: number[]
    observaciones: string | null
    idCliente?: number | null
  }) => request<{ idCita: number }>("POST", "/api/citas", b),
  cancelar: (id: number, motivo: string | null) =>
    request<void>("POST", `/api/citas/${id}/cancelar`, { motivo }),
  facturar: (
    id: number,
    b: { idCliente: number; idEmpleadoCajero: number; idFormaPago: number; idPromocion: number | null },
  ) => request<{ idFactura: number }>("POST", `/api/citas/${id}/facturar`, b),

  empleados: () => request<EmpleadoRow[]>("GET", "/api/empleados"),
  serviciosDeEmpleado: (id: number) =>
    request<ServicioRow[]>("GET", `/api/empleados/${id}/servicios`),
  servicios: () => request<ServicioRow[]>("GET", "/api/servicios"),
  especialistasDeServicio: (id: number) =>
    request<EspecialistaRow[]>("GET", `/api/servicios/${id}/empleados`),
  listaHorarios: () => request<HorarioRow[]>("GET", "/api/horarios"),
  crearEmpleado: (b: NuevoEmpleado) => request<{ idEmpleado: number }>("POST", "/api/empleados", b),
  notificacionesEmpleado: () => request<Notificacion[]>("GET", "/api/notificaciones"),
  masVendidos: () => request<MasVendidoRow[]>("GET", "/api/servicios/mas-vendidos"),
  promociones: () => request<PromocionRow[]>("GET", "/api/promociones"),
  formasPago: () => request<FormaPagoRow[]>("GET", "/api/formas-pago"),
  proveedores: () => request<ProveedorRow[]>("GET", "/api/proveedores"),

  productos: () => request<ProductoRow[]>("GET", "/api/productos"),
  inventario: () => request<InventarioRow[]>("GET", "/api/inventario"),
  vencimientos: () => request<VencimientoRow[]>("GET", "/api/inventario/vencimientos"),
  reponer: (b: {
    idProducto: number
    idProveedor: number
    cantidad: number
    precioCompra: number
    fechaVencimiento: string | null
  }) => request<{ idLote: number }>("POST", "/api/inventario/reponer", b),
  ventaProducto: (b: {
    idCliente: number
    idEmpleado: number
    idProducto: number
    cantidad: number
    idFormaPago: number
  }) => request<{ idFactura: number }>("POST", "/api/ventas/productos", b),

  facturas: () => request<FacturaRow[]>("GET", "/api/facturas"),
  ingresosPorMes: () => request<IngresoMesRow[]>("GET", "/api/reportes/ingresos-por-mes"),
  reporteVentas: (desde: string, hasta: string) =>
    request<ReporteVentas>("GET", `/api/reportes/ventas${qs({ desde, hasta })}`),

  // ----- Portal del cliente (todo sale del token) -----
  miPerfil: () => request<ClienteDetalle>("GET", "/api/mi/perfil"),
  actualizarMiPerfil: (b: ClienteEdicion) => request<void>("PUT", "/api/mi/perfil", b),
  miHistorial: () => request<HistorialCliente>("GET", "/api/mi/historial"),
  misCitas: () => request<CitaRow[]>("GET", "/api/mi/citas"),
  agendarMiCita: (b: {
    fechaHoraInicio: string
    duracionMinutos: number
    idEmpleado: number
    servicios: number[]
    observaciones: string | null
  }) => request<{ idCita: number }>("POST", "/api/mi/citas", b),
  cancelarMiCita: (id: number, motivo: string | null) =>
    request<void>("POST", `/api/mi/citas/${id}/cancelar`, { motivo }),
  misNotificaciones: () => request<Notificacion[]>("GET", "/api/mi/notificaciones"),
}

export interface NuevoCliente {
  primerNombre: string
  segundoNombre: string | null
  primerApellido: string
  segundoApellido: string | null
  dni: string
  fechaNacimiento: string
  usuario: string
  contrasena: string
  telefono: string
  correo: string | null
}
export interface ClienteEdicion {
  primerNombre: string
  segundoNombre: string | null
  primerApellido: string
  segundoApellido: string | null
  telefono: string
  correo: string | null
}
export interface NuevoEmpleado extends NuevoCliente {
  salario: number
  servicios: number[]
  idHorario: number | null
}
