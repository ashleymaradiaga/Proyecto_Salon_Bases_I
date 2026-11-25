import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileBarChart,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import logo from "./imports/loa-logo.png"
import {
  api,
  clearAuth,
  errMsg,
  loadAuth,
  saveAuth,
  setUnauthorizedHandler,
  type ClienteDetalle,
  type EspecialistaRow,
  type HorarioRow,
  type Notificacion,
  type CitaRow,
  type ClienteRow,
  type EmpleadoRow,
  type FacturaRow,
  type FormaPagoRow,
  type HistorialCliente,
  type IngresoMesRow,
  type InventarioRow,
  type MasVendidoRow,
  type ProductoRow,
  type PromocionRow,
  type ProveedorRow,
  type ReporteVentas,
  type ServicioRow,
  type Session,
  type VencimientoRow,
} from "./api"

type Page = "dashboard" | "agenda" | "clientes" | "catalogo" | "inventario" | "facturacion" | "reportes"
type ModalName =
  | "appointment"
  | "client"
  | "restock"
  | "sale"
  | "charge"
  | "history"
  | "cancel"
  | "employee"
  | "editClient"
  | "deleteClient"
  | "profile"
  | null

type NavItem = {
  id: string
  label: string
  icon: LucideIcon
}

type FieldProps = {
  label: string
  children: ReactNode
}

type AvatarProps = {
  name: string
  large?: boolean
}

type EmptyStateProps = {
  title: string
  text: string
}


const navItems: NavItem[] = [
  { id: "dashboard", label: "Resumen", icon: LayoutDashboard },
  { id: "agenda", label: "Agenda de citas", icon: CalendarDays },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "catalogo", label: "Equipo y servicios", icon: Sparkles },
  { id: "inventario", label: "Productos e inventario", icon: Package },
  { id: "facturacion", label: "Facturación", icon: ReceiptText },
  { id: "reportes", label: "Reportes", icon: FileBarChart },
]

const pageMeta: Record<Page, {
  eyebrow: string
  title: string
  description: string
}> = {
  dashboard: {
    eyebrow: "Hoy",
    title: "Hola",
    description: "Aquí tienes el pulso de Loa Beauty Studio para hoy.",
  },
  agenda: {
    eyebrow: "Operación diaria",
    title: "Agenda de citas",
    description:
      "Consulta disponibilidad, agenda servicios y da seguimiento a cada cita.",
  },
  clientes: {
    eyebrow: "Relaciones",
    title: "Gestión de clientes",
    description: "Directorio, consumo acumulado e historial de visitas.",
  },
  catalogo: {
    eyebrow: "Catálogo operativo",
    title: "Equipo y servicios",
    description:
      "Consulta el equipo activo, especialidades y servicios disponibles.",
  },
  inventario: {
    eyebrow: "Abastecimiento",
    title: "Productos e inventario",
    description: "Controla lotes, existencias mínimas y próximos vencimientos.",
  },
  facturacion: {
    eyebrow: "Caja",
    title: "Facturación y ventas",
    description: "Cobra citas completadas y registra ventas de productos.",
  },
  reportes: {
    eyebrow: "Inteligencia del negocio",
    title: "Reportes",
    description:
      "Indicadores construidos a partir de las vistas y consultas disponibles.",
  },
}


const money = (value: number | null | undefined) =>
  `L ${(value ?? 0).toLocaleString("es-HN", { minimumFractionDigits: 2 })}`


const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00`)
  d.setDate(d.getDate() + n)
  return toYmd(d)
}

const timeOf = (iso: string) => iso.slice(11, 16)

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("es-HN", { day: "2-digit", month: "short", year: "numeric" })
    : "—"

const invoiceCode = (id: number) => `F-${String(id).padStart(4, "0")}`

const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")
  const link = document.createElement("a")
  link.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }))
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

type AppData = {
  citas: CitaRow[]
  clientes: ClienteRow[]
  empleados: EmpleadoRow[]
  servicios: ServicioRow[]
  masVendidos: MasVendidoRow[]
  promociones: PromocionRow[]
  formasPago: FormaPagoRow[]
  proveedores: ProveedorRow[]
  productos: ProductoRow[]
  inventario: InventarioRow[]
  vencimientos: VencimientoRow[]
  facturas: FacturaRow[]
  ingresos: IngresoMesRow[]
  notificaciones: Notificacion[]
}

const emptyData: AppData = {
  citas: [],
  clientes: [],
  empleados: [],
  servicios: [],
  masVendidos: [],
  promociones: [],
  formasPago: [],
  proveedores: [],
  productos: [],
  inventario: [],
  vencimientos: [],
  facturas: [],
  ingresos: [],
  notificaciones: [],
}

async function safe<T>(promise: Promise<T>, fallback: T, errors: Set<string>): Promise<T> {
  try {
    return await promise
  } catch (e) {
    errors.add(errMsg(e))
    return fallback
  }
}

function getPageMeta(page: Page, userName: string) {
  if (page !== "dashboard") return pageMeta[page]
  const d = new Date().toLocaleDateString("es-HN", { weekday: "long", day: "numeric", month: "long" })
  return {
    ...pageMeta.dashboard,
    eyebrow: d.charAt(0).toUpperCase() + d.slice(1),
    title: `Hola, ${userName.split(" ")[0] ?? ""}`,
  }
}


type AuthMode = "cliente" | "empleado"

function Login({
  onLogin,
}: {
  onLogin: (session: Session, token: string, remember: boolean) => void
}) {
  const [mode, setMode] = useState<AuthMode>("cliente")
  const [view, setView] = useState<"login" | "registro">("login")
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const signIn = async (usuario: string, contrasena: string) => {
    const r = await api.login(usuario, contrasena)
    const expected = mode === "empleado" ? "Empleado" : "Cliente"
    if (r.rol !== expected) {
      throw new Error(
        r.rol === "Empleado"
          ? "Esta cuenta es de empleado. Usa la pestaña «Soy empleado»."
          : "Esta cuenta es de cliente. Usa la pestaña «Soy cliente».",
      )
    }
    onLogin(
      {
        idPersona: r.idPersona,
        nombreCompleto: r.nombreCompleto,
        rol: r.rol,
        idEmpleado: r.idEmpleado,
        idCliente: r.idCliente,
      },
      r.token,
      remember,
    )
  }

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setLoading(true)
    setError("")
    try {
      await signIn(String(form.get("usuario") ?? "").trim(), String(form.get("contrasena") ?? ""))
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }

  const submitRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const f = new FormData(event.currentTarget)
    const s = (key: string) => String(f.get(key) ?? "").trim()
    if (String(f.get("contrasena")) !== String(f.get("repetir"))) {
      setError("Las contraseñas no coinciden.")
      return
    }
    setLoading(true)
    setError("")
    try {
      await api.registroCliente({
        primerNombre: s("primerNombre"),
        segundoNombre: s("segundoNombre") || null,
        primerApellido: s("primerApellido"),
        segundoApellido: s("segundoApellido") || null,
        dni: s("dni"),
        fechaNacimiento: s("fechaNacimiento"),
        usuario: s("usuario"),
        contrasena: String(f.get("contrasena") ?? ""),
        telefono: s("telefono"),
        correo: s("correo") || null,
      })
    } catch (e) {
      setError(errMsg(e))
      setLoading(false)
      return
    }
    // Cuenta creada: se inicia sesión automáticamente
    try {
      await signIn(s("usuario"), String(f.get("contrasena") ?? ""))
    } catch {
      setView("login")
      setError("Tu cuenta fue creada. Ahora inicia sesión.")
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setView("login")
    setError("")
  }

  return (
    <div className="grid min-h-screen bg-[#f8f4f0] lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden overflow-hidden bg-[#221f1d] p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-32 h-[500px] w-[500px] rounded-full border border-[#d99aa3]/20" />
        <div className="absolute -right-4 -top-12 h-[320px] w-[320px] rounded-full border border-[#d99aa3]/15" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-14 w-14 overflow-hidden rounded-full bg-black">
            <img
              src={logo}
              alt="Loa Beauty Studio"
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <p className="font-display text-2xl text-[#f5d5d8]">Loa</p>
            <p className="text-[10px] uppercase tracking-[.32em] text-white/45">
              Beauty Studio
            </p>
          </div>
        </div>
        <div className="relative z-10 max-w-xl">
          <div className="mb-8 h-px w-16 bg-[#d99aa3]" />
          <h1 className="font-display text-6xl leading-[1.03] text-[#fffaf7] xl:text-7xl">
            Belleza en cada detalle. Orden en cada decisión.
          </h1>
          <p className="mt-7 max-w-md text-base leading-7 text-white/55">
            Agenda tus citas, conoce nuestros servicios y mantén tu perfil
            al día. Un solo lugar para clientes y para el equipo del estudio.
          </p>
        </div>
        <p className="relative z-10 text-xs text-white/30">
          Loa Beauty Studio
        </p>
      </section>
      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[460px]">
          <div className="mb-8 flex justify-center lg:hidden">
            <img src={logo} alt="Loa Beauty Studio" className="h-24 w-24 rounded-full object-cover" />
          </div>
          <div className="mb-8 grid grid-cols-2 gap-1 rounded-xl bg-[#f0e8e4] p-1">
            {(["cliente", "empleado"] as AuthMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                  mode === m ? "bg-white text-[#5c4646] shadow-sm" : "text-[#918680] hover:text-[#544b47]"
                }`}
              >
                {m === "cliente" ? "Soy cliente" : "Soy empleado"}
              </button>
            ))}
          </div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[.22em] text-[#b87580]">
            {view === "registro"
              ? "Crear cuenta de cliente"
              : mode === "empleado"
                ? "Acceso del personal"
                : "Acceso de clientes"}
          </p>
          <h2 className="font-display text-5xl text-[#292321]">
            {view === "registro" ? "Únete a Loa" : "Bienvenida de nuevo"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#7d7470]">
            {view === "registro"
              ? "Completa tus datos para crear tu cuenta y agendar tus citas."
              : mode === "empleado"
                ? "Ingresa tus credenciales para continuar al panel de gestión."
                : "Ingresa para agendar y consultar tus citas."}
          </p>

          {view === "login" ? (
            <form onSubmit={submitLogin} className="mt-9 space-y-5">
              <Field label="Usuario">
                <input required name="usuario" autoComplete="username" className="input" placeholder="Tu usuario" />
              </Field>
              <Field label="Contraseña">
                <div className="relative">
                  <input
                    required
                    name="contrasena"
                    autoComplete="current-password"
                    type={showPassword ? "text" : "password"}
                    className="input pr-12"
                    placeholder="Tu contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#8b817c] hover:bg-[#f3ece8]"
                    aria-label="Mostrar contraseña"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </Field>
              <label className="flex items-center gap-2 text-sm text-[#6e6662]">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="accent-[#b87580]"
                />
                Recordarme en este equipo
              </label>
              <button className="btn-primary w-full" disabled={loading}>
                {loading ? "Validando…" : "Iniciar sesión"}
              </button>
            </form>
          ) : (
            <form onSubmit={submitRegister} className="mt-8 grid gap-4 sm:grid-cols-2">
              <Field label="Primer nombre">
                <input name="primerNombre" className="input" required />
              </Field>
              <Field label="Segundo nombre">
                <input name="segundoNombre" className="input" />
              </Field>
              <Field label="Primer apellido">
                <input name="primerApellido" className="input" required />
              </Field>
              <Field label="Segundo apellido">
                <input name="segundoApellido" className="input" />
              </Field>
              <Field label="DNI">
                <input name="dni" className="input" required />
              </Field>
              <Field label="Fecha de nacimiento">
                <input name="fechaNacimiento" type="date" className="input" required />
              </Field>
              <Field label="Teléfono">
                <input name="telefono" type="tel" className="input" required />
              </Field>
              <Field label="Correo (opcional)">
                <input name="correo" type="email" className="input" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Usuario">
                  <input name="usuario" autoComplete="username" className="input" required />
                </Field>
              </div>
              <Field label="Contraseña">
                <input name="contrasena" type="password" minLength={6} autoComplete="new-password" className="input" required />
              </Field>
              <Field label="Repite la contraseña">
                <input name="repetir" type="password" minLength={6} autoComplete="new-password" className="input" required />
              </Field>
              <button className="btn-primary sm:col-span-2" disabled={loading}>
                {loading ? "Creando cuenta…" : "Crear cuenta"}
              </button>
            </form>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-[#ecc9c8] bg-[#f8e8e7] p-4 text-xs leading-5 text-[#8f4a4a]">
              {error}
            </div>
          )}

          {mode === "cliente" && (
            <p className="mt-6 text-center text-sm text-[#7d7470]">
              {view === "login" ? "¿Aún no tienes cuenta? " : "¿Ya tienes cuenta? "}
              <button
                type="button"
                onClick={() => {
                  setView(view === "login" ? "registro" : "login")
                  setError("")
                }}
                className="font-semibold text-[#a9636e]"
              >
                {view === "login" ? "Crear cuenta" : "Iniciar sesión"}
              </button>
            </p>
          )}
          {mode === "empleado" && (
            <p className="mt-6 flex items-start gap-3 rounded-xl border border-[#eaded8] bg-white/70 p-4 text-xs leading-5 text-[#817772]">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#b87580]" />
              Las cuentas de empleado las crea otro empleado desde el panel administrativo.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

const PAGE_SIZE = 10

function usePaged<T>(items: T[], resetKey: string) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  useEffect(() => {
    setPage(1)
  }, [resetKey])
  const current = Math.min(page, pages)
  return {
    rows: items.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    page: current,
    pages,
    setPage,
  }
}

function Pagination({
  count,
  page,
  pages,
  onPage,
}: {
  count: number
  page: number
  pages: number
  onPage: (page: number) => void
}) {
  const from = count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(count, page * PAGE_SIZE)
  return (
    <div className="mt-5 flex items-center justify-between border-t border-[#eee5e0] pt-4 text-[11px] text-[#928883]">
      <span>
        Mostrando {from}–{to} de {count} registros
      </span>
      <div className="flex items-center gap-1">
        <button
          className="icon-button h-8 w-8 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#2d2825] px-2 font-bold text-white">
          {page}/{pages}
        </span>
        <button
          className="icon-button h-8 w-8 disabled:opacity-40"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

type DescribedNotification = {
  id: string
  title: string
  text: string
  tone: "warn" | "info" | "ok"
  page?: Page
  unread: boolean
}

function describeNotification(n: Notificacion): Omit<DescribedNotification, "id" | "unread"> {
  const what = n.detalle ?? ""
  const when = `${fmtDate(n.fecha)} a las ${timeOf(n.fecha)}`
  switch (n.tipo) {
    // Personal
    case "stock_agotado":
      return { title: "Producto agotado", text: `${what} no tiene unidades disponibles.`, tone: "warn", page: "inventario" }
    case "stock_bajo":
      return {
        title: "Stock bajo",
        text: `${what}: ${n.cantidad ?? 0} unidades (mínimo ${n.minimo ?? 0}).`,
        tone: "warn",
        page: "inventario",
      }
    case "lote_vencido":
      return {
        title: "Lote vencido",
        text: `${what} · ${n.cantidad ?? 0} unidades · venció el ${fmtDate(n.fecha)}.`,
        tone: "warn",
        page: "inventario",
      }
    case "lote_por_vencer":
      return {
        title: "Lote por vencer",
        text: `${what} vence en ${n.dias ?? 0} días (${n.cantidad ?? 0} unidades).`,
        tone: "warn",
        page: "inventario",
      }
    case "cita_hoy":
      return { title: "Cita pendiente hoy", text: `${timeOf(n.fecha)} · ${what}`, tone: "info", page: "agenda" }
    case "cobro_pendiente":
      return {
        title: "Cita pendiente de cobro",
        text: `${when} · ${what}${n.monto != null ? ` · ${money(n.monto)}` : ""}`,
        tone: "warn",
        page: "facturacion",
      }
    case "promo_vence":
      return { title: "Promoción por terminar", text: `${what} termina el ${fmtDate(n.fechaFin)}.`, tone: "info", page: "catalogo" }
    // Cliente
    case "cita_programada":
      return { title: "Cita programada", text: `${when} · ${what}`, tone: "ok" }
    case "cita_recordatorio":
      return { title: "Recordatorio: tu cita es pronto", text: `${when} · ${what}`, tone: "info" }
    case "cita_completada":
      return {
        title: "Cita completada",
        text: `${when} · ${what}${n.idFactura ? ` · Factura ${invoiceCode(n.idFactura)} por ${money(n.monto)}` : ""}`,
        tone: "ok",
      }
    case "cita_cancelada":
      return { title: "Cita cancelada", text: `${when} · ${what}`, tone: "warn" }
    case "cita_sin_cerrar":
      return { title: "Cita pendiente de cierre", text: `${when} · ${what}. Consulta en recepción.`, tone: "info" }
    case "promocion_vigente":
      return {
        title: "Promoción vigente",
        text: `${what}${n.fechaFin ? ` hasta el ${fmtDate(n.fechaFin)}` : ""}.`,
        tone: "info",
      }
    default:
      return { title: n.tipo, text: what, tone: "info" }
  }
}

/** Las notificaciones se calculan en la base; "leído" se recuerda solo en este navegador. */
function useNotifications(raw: Notificacion[], userKey: number) {
  const storageKey = `loa-seen-${userKey}`
  const [seen, setSeen] = useState<Set<string>>(() => {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[])
    } catch {
      return new Set<string>()
    }
  })
  const items: DescribedNotification[] = raw
    .map((n) => ({ id: n.id, ...describeNotification(n), unread: !seen.has(n.id) }))
    .sort((a, b) => Number(b.unread) - Number(a.unread))
  const markAllRead = () => {
    const next = new Set(raw.map((n) => n.id))
    setSeen(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]))
    } catch {
      /* sin almacenamiento disponible */
    }
  }
  return { items, markAllRead }
}

function Topbar({
  onMenu,
  user,
  notifications,
  onMarkRead,
  onSelectNotification,
  onSearch,
  onProfile,
  onLogout,
}: {
  onMenu: () => void
  user: Session
  notifications: DescribedNotification[]
  onMarkRead: () => void
  onSelectNotification: (item: DescribedNotification) => void
  onSearch?: (query: string) => void
  onProfile: () => void
  onLogout: () => void
}) {
  const [open, setOpen] = useState<"notif" | "user" | null>(null)
  const [query, setQuery] = useState("")
  const unread = notifications.filter((n) => n.unread).length
  const dot = { warn: "bg-[#c98080]", info: "bg-[#d99aa3]", ok: "bg-[#6f9a80]" }
  return (
    <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between border-b border-[#e8ded8] bg-[#f8f5f2]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenu}
          className="rounded-xl border border-[#e8ded8] bg-white p-2.5 text-[#534a46] lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        {onSearch && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const q = query.trim()
              if (q) {
                onSearch(q)
                setQuery("")
              }
            }}
            className="hidden items-center gap-2 rounded-xl border border-[#e8ded8] bg-white px-3.5 py-2.5 sm:flex"
          >
            <Search className="h-4 w-4 text-[#a79d98]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-48 bg-transparent text-sm outline-none placeholder:text-[#aaa09b]"
              placeholder="Buscar cliente y Enter…"
            />
          </form>
        )}
      </div>
      {open && (
        <button
          className="fixed inset-0 z-40 cursor-default"
          onClick={() => setOpen(null)}
          aria-label="Cerrar"
        />
      )}
      <div className="relative z-50 flex items-center gap-3">
        <button
          onClick={() => setOpen(open === "notif" ? null : "notif")}
          className="relative rounded-xl border border-[#e8ded8] bg-white p-2.5 text-[#625955]"
          aria-label="Notificaciones"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#bf6f7b] px-1 text-[9px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
        <button
          onClick={() => setOpen(open === "user" ? null : "user")}
          className="flex items-center gap-2.5 border-l border-[#e5dad4] pl-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dfb0b6] text-xs font-bold text-[#493334]">
            {initialsOf(user.nombreCompleto)}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-xs font-bold text-[#342e2b]">{user.nombreCompleto}</p>
            <p className="text-[10px] text-[#958b86]">
              {user.rol === "Empleado" ? "Personal del estudio" : "Cliente"}
            </p>
          </div>
          <ChevronDown className="hidden h-4 w-4 text-[#a09691] sm:block" />
        </button>

        {open === "notif" && (
          <div className="absolute right-0 top-[52px] w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-[#e9dfda] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#eee5e0] px-4 py-3">
              <p className="font-display text-xl">Notificaciones</p>
              <button
                onClick={onMarkRead}
                disabled={unread === 0}
                className="text-[11px] font-bold text-[#a9636e] disabled:opacity-40"
              >
                Marcar como leídas
              </button>
            </div>
            <div className="max-h-[60vh] divide-y divide-[#f0e8e4] overflow-y-auto">
              {notifications.length === 0 && (
                <p className="px-4 py-10 text-center text-xs text-[#968c87]">No tienes notificaciones.</p>
              )}
              {notifications.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setOpen(null)
                    onSelectNotification(item)
                  }}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[#faf6f3] ${
                    item.unread ? "bg-[#fcf7f5]" : ""
                  }`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[item.tone]}`} />
                  <span className="min-w-0">
                    <span className={`block text-xs text-[#332c29] ${item.unread ? "font-bold" : "font-semibold"}`}>
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-[#8a807b]">{item.text}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {open === "user" && (
          <div className="absolute right-0 top-[52px] w-56 overflow-hidden rounded-2xl border border-[#e9dfda] bg-white p-1.5 shadow-2xl">
            <button
              onClick={() => {
                setOpen(null)
                onProfile()
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#4b423f] hover:bg-[#f6efeb]"
            >
              <UserRound className="h-4 w-4" /> Mi perfil
            </button>
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#4b423f] hover:bg-[#f6efeb]"
            >
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[#1f1b19]/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[24px] bg-[#fbf9f7] shadow-2xl sm:max-w-2xl sm:rounded-[24px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#eadfd9] bg-[#fbf9f7]/95 px-6 py-5 backdrop-blur">
          <h2 className="font-display text-3xl">{title}</h2>
          <button onClick={onClose} className="icon-button" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormFooter({
  saving,
  error,
  onClose,
  label = "Guardar",
  danger = false,
}: {
  saving: boolean
  error: string
  onClose: () => void
  label?: string
  danger?: boolean
}) {
  return (
    <>
      {error && (
        <p className="mx-6 mb-4 rounded-xl border border-[#ecc9c8] bg-[#f8e8e7] px-4 py-3 text-xs font-semibold text-[#8f4a4a]">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3 border-t border-[#eadfd9] px-6 py-4">
        <button type="button" onClick={onClose} className="btn-secondary">
          Volver
        </button>
        <button className={danger ? "btn-danger" : "btn-primary"} disabled={saving}>
          {saving ? "Guardando…" : label}
        </button>
      </div>
    </>
  )
}


type BasicModal = "appointment" | "client" | "restock" | "sale" | "charge" | "history" | "cancel"

const isBasicModal = (m: ModalName): m is BasicModal =>
  m !== null && m !== "employee" && m !== "editClient" && m !== "deleteClient" && m !== "profile"

function StaffApp({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [page, setPage] = useState<Page>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modal, setModal] = useState<ModalName>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [toast, setToast] = useState("")
  const [data, setData] = useState<AppData>(emptyData)
  const [loadError, setLoadError] = useState("")
  const [loadingData, setLoadingData] = useState(false)
  const [version, setVersion] = useState(0)
  const [clientQuery, setClientQuery] = useState("")
  const notifications = useNotifications(data.notificaciones, session.idPersona)

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 3500)
  }

  const openModal = (name: ModalName, id?: number) => {
    setSelectedId(id ?? null)
    setModal(name)
  }

  const reload = useCallback(async () => {
    setLoadingData(true)
    const errors = new Set<string>()
    const [
      citas,
      clientes,
      empleados,
      servicios,
      masVendidos,
      promociones,
      formasPago,
      proveedores,
      productos,
      inventario,
      vencimientos,
      facturas,
      ingresos,
      notificaciones,
    ] = await Promise.all([
      safe(api.citas(), [], errors),
      safe(api.clientes(), [], errors),
      safe(api.empleados(), [], errors),
      safe(api.servicios(), [], errors),
      safe(api.masVendidos(), [], errors),
      safe(api.promociones(), [], errors),
      safe(api.formasPago(), [], errors),
      safe(api.proveedores(), [], errors),
      safe(api.productos(), [], errors),
      safe(api.inventario(), [], errors),
      safe(api.vencimientos(), [], errors),
      safe(api.facturas(), [], errors),
      safe(api.ingresosPorMes(), [], errors),
      safe(api.notificacionesEmpleado(), [], errors),
    ])
    setData({
      citas,
      clientes,
      empleados,
      servicios,
      masVendidos,
      promociones,
      formasPago,
      proveedores,
      productos,
      inventario,
      vencimientos,
      facturas,
      ingresos,
      notificaciones,
    })
    setLoadError([...errors].slice(0, 2).join(" · "))
    setVersion((v) => v + 1)
    setLoadingData(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const primary: ModalName =
    page === "agenda"
      ? "appointment"
      : page === "clientes"
        ? "client"
        : page === "inventario"
          ? "restock"
          : page === "facturacion"
            ? "sale"
            : page === "catalogo"
              ? "employee"
              : null

  return (
    <div className="min-h-screen bg-[#f8f5f2] text-[#292523]">
      <Sidebar
        items={navItems}
        page={page}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigate={(next) => {
          setPage(next as Page)
          setSidebarOpen(false)
        }}
        onProfile={() => openModal("profile")}
        onLogout={onLogout}
      />
      <main className="min-h-screen lg:pl-[264px]">
        <Topbar
          onMenu={() => setSidebarOpen(true)}
          user={session}
          notifications={notifications.items}
          onMarkRead={notifications.markAllRead}
          onSelectNotification={(item) => item.page && setPage(item.page)}
          onSearch={(q) => {
            setClientQuery(q)
            setPage("clientes")
          }}
          onProfile={() => openModal("profile")}
          onLogout={onLogout}
        />
        <div className="mx-auto max-w-[1600px] px-4 pb-10 pt-5 sm:px-6 lg:px-8 lg:pt-8">
          <PageHeading
            page={page}
            userName={session.nombreCompleto}
            onPrimary={() => openModal(primary)}
          />
          {loadError && (
            <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-[#ecc9c8] bg-[#f8e8e7] p-4 text-xs leading-5 text-[#8f4a4a]">
              <span>{loadError}</span>
              <button onClick={() => void reload()} className="shrink-0 font-bold underline">
                Reintentar
              </button>
            </div>
          )}
          {loadingData && data.clientes.length === 0 && !loadError && (
            <p className="mb-4 text-xs text-[#958b86]">Cargando datos…</p>
          )}
          {page === "dashboard" && <Dashboard data={data} onNavigate={setPage} onModal={openModal} />}
          {page === "agenda" && <Agenda citas={data.citas} onModal={openModal} />}
          {page === "clientes" && (
            <Clients key={clientQuery} initialQuery={clientQuery} clientes={data.clientes} onModal={openModal} />
          )}
          {page === "catalogo" && (
            <Catalog
              empleados={data.empleados}
              servicios={data.servicios}
              promociones={data.promociones}
              masVendidos={data.masVendidos}
            />
          )}
          {page === "inventario" && (
            <Inventory
              inventario={data.inventario}
              vencimientos={data.vencimientos}
              onRestock={(idProducto) => openModal("restock", idProducto)}
            />
          )}
          {page === "facturacion" && (
            <Billing citas={data.citas} facturas={data.facturas} onModal={openModal} />
          )}
          {page === "reportes" && <Reports ingresos={data.ingresos} version={version} notify={notify} />}
        </div>
      </main>
      {isBasicModal(modal) && (
        <Modal
          name={modal}
          selectedId={selectedId}
          data={data}
          session={session}
          onClose={() => setModal(null)}
          onDone={(message) => {
            setModal(null)
            notify(message)
            void reload()
          }}
        />
      )}
      {modal === "employee" && (
        <EmployeeModal
          servicios={data.servicios}
          onClose={() => setModal(null)}
          onDone={(message) => {
            setModal(null)
            notify(message)
            void reload()
          }}
        />
      )}
      {modal === "editClient" && selectedId && (
        <ClientEditModal
          idCliente={selectedId}
          onClose={() => setModal(null)}
          onDone={(message) => {
            setModal(null)
            notify(message)
            void reload()
          }}
        />
      )}
      {modal === "deleteClient" && selectedId && (
        <ClientDeleteModal
          cliente={data.clientes.find((c) => c.idCliente === selectedId)}
          onClose={() => setModal(null)}
          onDone={(message) => {
            setModal(null)
            notify(message)
            void reload()
          }}
        />
      )}
      {modal === "profile" && (
        <StaffProfileModal
          session={session}
          empleado={data.empleados.find((e) => e.idEmpleado === session.idEmpleado)}
          onClose={() => setModal(null)}
        />
      )}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-[#292321] px-4 py-3 text-sm font-semibold text-white shadow-2xl">
          <Check className="h-4 w-4 text-[#e8b7bd]" />
          {toast}
        </div>
      )}
    </div>
  )
}

function PageHeading({
  page,
  userName,
  onPrimary,
}: {
  page: Page
  userName: string
  onPrimary: () => void
}) {
  const meta = getPageMeta(page, userName)
  const buttonLabel =
    page === "agenda"
      ? "Nueva cita"
      : page === "clientes"
        ? "Nuevo cliente"
        : page === "inventario"
          ? "Reponer inventario"
          : page === "facturacion"
            ? "Nueva venta"
            : page === "catalogo"
              ? "Nuevo empleado"
              : ""
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[.22em] text-[#b87580]">
          {meta.eyebrow}
        </p>
        <h1 className="font-display text-4xl leading-none text-[#2d2724] sm:text-[44px]">{meta.title}</h1>
        <p className="mt-3 text-sm text-[#817772]">{meta.description}</p>
      </div>
      {buttonLabel && (
        <button onClick={onPrimary} className="btn-primary shrink-0">
          <Plus className="h-4 w-4" /> {buttonLabel}
        </button>
      )}
    </div>
  )
}

function Agenda({
  citas,
  onModal,
}: {
  citas: CitaRow[]
  onModal: (name: ModalName, id?: number) => void
}) {
  const [filter, setFilter] = useState("Todas")
  const [date, setDate] = useState(toYmd(new Date()))
  const ofDay = citas.filter((c) => c.fechaHoraInicio.slice(0, 10) === date)
  const filtered = ofDay.filter((c) => filter === "Todas" || c.estadoCita === filter)
  const paged = usePaged(filtered, `${date}|${filter}`)
  const label = new Date(`${date}T00:00:00`).toLocaleDateString("es-HN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  return (
    <Panel>
      <div className="mb-5 flex flex-col justify-between gap-4 border-b border-[#eee5e0] pb-5 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <button className="icon-button" onClick={() => setDate(addDays(date, -1))} aria-label="Día anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDate(toYmd(new Date()))}
            className="rounded-xl border border-[#e8ded8] bg-white px-4 py-2 text-sm font-bold"
          >
            Hoy
          </button>
          <button className="icon-button" onClick={() => setDate(addDays(date, 1))} aria-label="Día siguiente">
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="ml-2">
            <p className="font-display text-xl">{label}</p>
            <p className="text-xs text-[#958b86]">{ofDay.length} citas programadas</p>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="input ml-2 w-auto"
          />
        </div>
        <FilterTabs
          options={["Todas", "Pendiente", "Completada", "Cancelada"]}
          value={filter}
          onChange={setFilter}
        />
      </div>
      <DataTable headers={["Hora", "Cliente", "Servicios", "Especialista", "Total", "Estado", ""]}>
        {paged.rows.map((item) => (
          <tr key={item.idCita}>
            <td>
              <p className="font-bold">{timeOf(item.fechaHoraInicio)}</p>
              <p className="text-[10px] text-[#9a908b]">{item.duracionMinutos} min</p>
            </td>
            <td>
              <p className="font-semibold">{item.cliente ?? "Sin cliente asignado"}</p>
              <p className="max-w-[180px] truncate text-[10px] text-[#9c928d]">
                Cita #{item.idCita}
                {item.observaciones ? ` · ${item.observaciones}` : ""}
              </p>
            </td>
            <td>{item.servicios ?? "—"}</td>
            <td>{item.empleados ?? "—"}</td>
            <td className="font-semibold">{money(item.totalServicios)}</td>
            <td>
              <Status value={item.estadoCita} />
            </td>
            <td>
              <div className="flex justify-end gap-1">
                {item.estadoCita === "Pendiente" && (
                  <button
                    onClick={() => onModal("charge", item.idCita)}
                    className="table-action text-[#8f5962]"
                    title="Cobrar cita"
                  >
                    <WalletCards className="h-4 w-4" />
                  </button>
                )}
                {item.estadoCita === "Pendiente" && (
                  <button onClick={() => onModal("cancel", item.idCita)} className="table-action" title="Cancelar">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
      {filtered.length === 0 && (
        <EmptyState title="Sin citas para este día" text="Prueba con otra fecha o agenda una nueva cita." />
      )}
      <Pagination count={filtered.length} page={paged.page} pages={paged.pages} onPage={paged.setPage} />
    </Panel>
  )
}

function Clients({
  initialQuery,
  clientes,
  onModal,
}: {
  initialQuery: string
  clientes: ClienteRow[]
  onModal: (name: ModalName, id?: number) => void
}) {
  const [query, setQuery] = useState(initialQuery)
  const filtered = clientes.filter((c) =>
    `${c.nombreCompleto} ${c.telefono ?? ""} ${c.correo ?? ""} ${c.dni}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  const paged = usePaged(filtered, query)
  return (
    <Panel>
      <TableToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Buscar por nombre, DNI, teléfono o correo…"
      />
      <DataTable
        headers={["Cliente", "Contacto", "Fecha de registro", "Facturas", "Total gastado", ""]}
      >
        {paged.rows.map((c) => (
          <tr key={c.idCliente}>
            <td>
              <div className="flex items-center gap-3">
                <Avatar name={c.nombreCompleto} />
                <div>
                  <p className="font-semibold">{c.nombreCompleto}</p>
                  <p className="text-[10px] text-[#9c928d]">
                    Cliente #{c.idCliente} · DNI {c.dni}
                  </p>
                  {c.estado === "Inactivo" && <Status value="Inactivo" />}
                </div>
              </div>
            </td>
            <td>
              <p>{c.telefono ?? "—"}</p>
              <p className="text-[11px] text-[#998f8a]">{c.correo ?? "—"}</p>
            </td>
            <td>{fmtDate(c.fechaRegistro)}</td>
            <td>
              <span className="rounded-lg bg-[#f4ece8] px-2.5 py-1 text-xs font-bold">{c.cantidadFacturas}</span>
            </td>
            <td className="font-semibold">{money(c.totalGastado)}</td>
            <td>
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => onModal("history", c.idCliente)} className="link-button">
                  <History className="h-4 w-4" /> Historial
                </button>
                {c.estado !== "Inactivo" && (
                  <>
                    <button onClick={() => onModal("editClient", c.idCliente)} className="table-action" title="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => onModal("deleteClient", c.idCliente)} className="table-action" title="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
      {filtered.length === 0 && (
        <EmptyState title="No encontramos clientes" text="Prueba con otro nombre, DNI, teléfono o correo." />
      )}
      <Pagination count={filtered.length} page={paged.page} pages={paged.pages} onPage={paged.setPage} />
    </Panel>
  )
}

function Inventory({
  inventario,
  vencimientos,
  onRestock,
}: {
  inventario: InventarioRow[]
  vencimientos: VencimientoRow[]
  onRestock: (idProducto: number) => void
}) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("Todos")
  const filtered = inventario.filter(
    (item) =>
      (filter === "Todos" || item.estadoInventario === filter) &&
      `${item.producto} ${item.marca} ${item.numeroLote ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  )
  const paged = usePaged(filtered, `${query}|${filter}`)
  const units = inventario.reduce((sum, i) => sum + i.cantidadDisponible, 0)
  const low = inventario.filter(
    (i) => i.estadoInventario === "Stock bajo" || i.estadoInventario === "Agotado",
  ).length
  const expiring = vencimientos.filter((v) => v.situacion !== "Vigente").length
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MiniMetric label="Unidades disponibles" value={String(units)} note="En todos los lotes" />
        <MiniMetric label="Bajo mínimo" value={String(low)} note="Requieren reposición" tone="warning" />
        <MiniMetric label="Por vencer o vencidos" value={String(expiring)} note="Dentro de 90 días" tone="rose" />
      </div>
      <Panel>
        <TableToolbar query={query} onQuery={setQuery} placeholder="Buscar producto, marca o lote…">
          <FilterTabs
            options={["Todos", "Stock bajo", "Agotado", "Normal"]}
            value={filter}
            onChange={setFilter}
          />
        </TableToolbar>
        <DataTable
          headers={["Producto", "Lote", "Existencias", "Vencimiento", "Proveedor", "Estado", ""]}
        >
          {paged.rows.map((item) => (
            <tr key={item.idInventario}>
              <td>
                <p className="font-semibold">{item.producto}</p>
                <p className="text-[11px] text-[#9a908b]">{item.marca}</p>
              </td>
              <td>{item.numeroLote ?? "—"}</td>
              <td>
                <p className="font-semibold">{item.cantidadDisponible} unidades</p>
                <p className="text-[10px] text-[#9a908b]">Mínimo: {item.existenciaMinima}</p>
              </td>
              <td>{fmtDate(item.fechaVencimiento)}</td>
              <td>{item.proveedor ?? "—"}</td>
              <td>
                <Status value={item.estadoInventario} />
              </td>
              <td>
                <button onClick={() => onRestock(item.idProducto)} className="link-button ml-auto">
                  <PackagePlus className="h-4 w-4" /> Reponer
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
        {filtered.length === 0 && (
          <EmptyState title="Sin resultados" text="No hay lotes que coincidan con el filtro." />
        )}
        <Pagination count={filtered.length} page={paged.page} pages={paged.pages} onPage={paged.setPage} />
      </Panel>
    </div>
  )
}

function AppointmentFields({
  empleados,
  clientes,
}: {
  empleados: EmpleadoRow[]
  clientes: ClienteRow[]
}) {
  const [empleado, setEmpleado] = useState<number>(empleados[0]?.idEmpleado ?? 0)
  const [fecha, setFecha] = useState(toYmd(new Date()))
  const [servicios, setServicios] = useState<ServicioRow[]>([])
  const [servicioId, setServicioId] = useState<number>(0)
  const [duracion, setDuracion] = useState(60)
  const [horas, setHoras] = useState<string[]>([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!empleado) return
    let active = true
    api
      .serviciosDeEmpleado(empleado)
      .then((r) => {
        if (!active) return
        setServicios(r)
        setServicioId(r[0]?.idServicio ?? 0)
        if (r[0]) setDuracion(r[0].duracionMinutos)
      })
      .catch(() => {
        if (active) setServicios([])
      })
    return () => {
      active = false
    }
  }, [empleado])

  useEffect(() => {
    if (!empleado || !fecha || duracion <= 0) return
    let active = true
    setCargando(true)
    api
      .horarios(empleado, fecha, duracion)
      .then((r) => {
        if (!active) return
        const now = new Date()
        const isToday = fecha === toYmd(now)
        const nowText = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
        setHoras(r.map((h) => timeOf(h.horaInicio)).filter((h) => !isToday || h > nowText))
      })
      .catch(() => {
        if (active) setHoras([])
      })
      .finally(() => {
        if (active) setCargando(false)
      })
    return () => {
      active = false
    }
  }, [empleado, fecha, duracion])

  const changeServicio = (id: number) => {
    setServicioId(id)
    const s = servicios.find((x) => x.idServicio === id)
    if (s) setDuracion(s.duracionMinutos)
  }

  return (
    <>
      <Field label="Especialista">
        <select
          name="employee"
          className="input"
          required
          value={empleado}
          onChange={(e) => setEmpleado(Number(e.target.value))}
        >
          {empleados.map((e) => (
            <option key={e.idEmpleado} value={e.idEmpleado}>
              {e.nombreCompleto}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Servicio">
        <select
          name="service"
          className="input"
          required
          value={servicioId || ""}
          onChange={(e) => changeServicio(Number(e.target.value))}
        >
          {servicios.length === 0 && <option value="">Este especialista no tiene servicios</option>}
          {servicios.map((s) => (
            <option key={s.idServicio} value={s.idServicio}>
              {s.nombreServicio} · {money(s.precio)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Fecha">
        <input
          name="date"
          type="date"
          className="input"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          required
        />
      </Field>
      <Field label="Duración (minutos)">
        <input
          name="duration"
          type="number"
          min="5"
          max="480"
          step="5"
          className="input"
          value={duracion}
          onChange={(e) => setDuracion(Number(e.target.value))}
          required
        />
      </Field>
      <Field label="Hora disponible">
        <select name="time" className="input" required>
          {horas.length === 0 && (
            <option value="">{cargando ? "Buscando horarios…" : "Sin horarios disponibles"}</option>
          )}
          {horas.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Cliente (opcional)">
        <select name="client" className="input" defaultValue="">
          <option value="">Sin cliente asignado</option>
          {clientes.map((c) => (
            <option key={c.idCliente} value={c.idCliente}>
              {c.nombreCompleto}
            </option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Observaciones">
          <textarea
            name="observations"
            className="input min-h-24 resize-none"
            maxLength={45}
            placeholder="Máximo 45 caracteres"
          />
        </Field>
      </div>
    </>
  )
}

function EmployeeModal({
  servicios,
  onClose,
  onDone,
}: {
  servicios: ServicioRow[]
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [horarios, setHorarios] = useState<HorarioRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    api
      .listaHorarios()
      .then((r) => {
        if (active) setHorarios(r)
      })
      .catch(() => {
        if (active) setHorarios([])
      })
    return () => {
      active = false
    }
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const f = new FormData(event.currentTarget)
    const s = (key: string) => String(f.get(key) ?? "").trim()
    setSaving(true)
    setError("")
    try {
      const r = await api.crearEmpleado({
        primerNombre: s("primerNombre"),
        segundoNombre: s("segundoNombre") || null,
        primerApellido: s("primerApellido"),
        segundoApellido: s("segundoApellido") || null,
        dni: s("dni"),
        fechaNacimiento: s("fechaNacimiento"),
        usuario: s("usuario"),
        contrasena: String(f.get("contrasena") ?? ""),
        telefono: s("telefono"),
        correo: s("correo") || null,
        salario: Number(f.get("salario")),
        servicios: f.getAll("svc").map((v) => Number(v)),
        idHorario: s("horario") ? Number(f.get("horario")) : null,
      })
      onDone(`Empleado #${r.idEmpleado} creado.`)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Nuevo empleado" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <p className="rounded-xl bg-[#f1e7e3] p-4 text-xs leading-5 text-[#817671] sm:col-span-2">
            Solo un empleado activo puede crear cuentas de empleado. La persona iniciará sesión con el usuario y la
            contraseña que definas aquí.
          </p>
          <Field label="Primer nombre">
            <input name="primerNombre" className="input" required />
          </Field>
          <Field label="Segundo nombre">
            <input name="segundoNombre" className="input" />
          </Field>
          <Field label="Primer apellido">
            <input name="primerApellido" className="input" required />
          </Field>
          <Field label="Segundo apellido">
            <input name="segundoApellido" className="input" />
          </Field>
          <Field label="DNI">
            <input name="dni" className="input" required />
          </Field>
          <Field label="Fecha de nacimiento">
            <input name="fechaNacimiento" type="date" className="input" required />
          </Field>
          <Field label="Teléfono">
            <input name="telefono" type="tel" className="input" required />
          </Field>
          <Field label="Correo">
            <input name="correo" type="email" className="input" />
          </Field>
          <Field label="Usuario">
            <input name="usuario" className="input" autoComplete="off" required />
          </Field>
          <Field label="Contraseña">
            <input name="contrasena" type="password" minLength={6} autoComplete="new-password" className="input" required />
          </Field>
          <Field label="Salario (L)">
            <input name="salario" type="number" min="0.01" step=".01" className="input" required />
          </Field>
          <Field label="Horario (opcional)">
            <select name="horario" className="input" defaultValue="">
              <option value="">Sin horario asignado</option>
              {horarios.map((h) => (
                <option key={h.idHorario} value={h.idHorario}>
                  {h.diaSemana} · {h.horaInicio}–{h.horaFin}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#847a75]">
              Servicios que realiza (opcional)
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {servicios.map((sv) => (
                <label key={sv.idServicio} className="flex items-center gap-2 text-sm text-[#5d5551]">
                  <input type="checkbox" name="svc" value={sv.idServicio} className="accent-[#b87580]" />
                  {sv.nombreServicio}
                </label>
              ))}
            </div>
          </div>
        </div>
        <FormFooter saving={saving} error={error} onClose={onClose} label="Crear empleado" />
      </form>
    </ModalShell>
  )
}

function ClientEditModal({
  idCliente,
  onClose,
  onDone,
}: {
  idCliente: number
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [detalle, setDetalle] = useState<ClienteDetalle | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    api
      .clienteDetalle(idCliente)
      .then((r) => {
        if (active) setDetalle(r)
      })
      .catch((e) => {
        if (active) setError(errMsg(e))
      })
    return () => {
      active = false
    }
  }, [idCliente])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const f = new FormData(event.currentTarget)
    const s = (key: string) => String(f.get(key) ?? "").trim()
    setSaving(true)
    setError("")
    try {
      await api.actualizarCliente(idCliente, {
        primerNombre: s("primerNombre"),
        segundoNombre: s("segundoNombre") || null,
        primerApellido: s("primerApellido"),
        segundoApellido: s("segundoApellido") || null,
        telefono: s("telefono"),
        correo: s("correo") || null,
      })
      onDone("Cliente actualizado.")
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Editar cliente" onClose={onClose}>
      {!detalle ? (
        <p className="p-6 text-sm text-[#968c87]">{error || "Cargando datos…"}</p>
      ) : (
        <form onSubmit={submit}>
          <PersonFields detalle={detalle} />
          <FormFooter saving={saving} error={error} onClose={onClose} />
        </form>
      )}
    </ModalShell>
  )
}

/** Campos de nombre y contacto con los valores actuales (los usan staff y cliente). */
function PersonFields({ detalle }: { detalle: ClienteDetalle }) {
  return (
    <div className="grid gap-5 p-6 sm:grid-cols-2">
      <Field label="Primer nombre">
        <input name="primerNombre" defaultValue={detalle.primerNombre} className="input" required />
      </Field>
      <Field label="Segundo nombre">
        <input name="segundoNombre" defaultValue={detalle.segundoNombre ?? ""} className="input" />
      </Field>
      <Field label="Primer apellido">
        <input name="primerApellido" defaultValue={detalle.primerApellido} className="input" required />
      </Field>
      <Field label="Segundo apellido">
        <input name="segundoApellido" defaultValue={detalle.segundoApellido ?? ""} className="input" />
      </Field>
      <Field label="Teléfono">
        <input name="telefono" type="tel" defaultValue={detalle.telefono ?? ""} className="input" required />
      </Field>
      <Field label="Correo">
        <input name="correo" type="email" defaultValue={detalle.correo ?? ""} className="input" />
      </Field>
      <p className="text-xs text-[#968c87] sm:col-span-2">
        El DNI ({detalle.dni}) y el usuario no se pueden modificar desde aquí.
      </p>
    </div>
  )
}

function ClientDeleteModal({
  cliente,
  onClose,
  onDone,
}: {
  cliente: ClienteRow | undefined
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  if (!cliente) return null

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError("")
    try {
      const r = await api.eliminarCliente(cliente.idCliente)
      onDone(r.resultado)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Eliminar cliente" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="p-6">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#f5e2e1] text-[#a95e66]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <p className="text-sm leading-6 text-[#675d58]">
            ¿Deseas eliminar a <strong>{cliente.nombreCompleto}</strong>? Si el cliente tiene facturas, no se borra: se da
            de baja para conservar el historial de ventas. Si no tiene facturas, se elimina definitivamente.
          </p>
        </div>
        <FormFooter saving={saving} error={error} onClose={onClose} label="Confirmar eliminación" danger />
      </form>
    </ModalShell>
  )
}

function StaffProfileModal({
  session,
  empleado,
  onClose,
}: {
  session: Session
  empleado: EmpleadoRow | undefined
  onClose: () => void
}) {
  const rows: [string, string][] = empleado
    ? [
        ["DNI", empleado.dni],
        ["Contratación", fmtDate(empleado.fechaContratacion)],
        ["Antigüedad", `${empleado.aniosAntiguedad} años`],
        ["Especialidades", empleado.especialidades],
        ["Estado", empleado.estadoEmpleado],
      ]
    : []
  return (
    <ModalShell title="Mi perfil" onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center gap-4 rounded-2xl bg-[#f2e8e4] p-5">
          <Avatar name={session.nombreCompleto} large />
          <div>
            <h3 className="font-display text-2xl">{session.nombreCompleto}</h3>
            <p className="text-sm text-[#817772]">Personal del estudio · Empleado #{session.idEmpleado}</p>
          </div>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] font-bold uppercase tracking-[.14em] text-[#847a75]">{k}</dt>
              <dd className="mt-1 text-sm text-[#4b423f]">{v}</dd>
            </div>
          ))}
        </dl>
        {!empleado && <p className="mt-5 text-xs text-[#968c87]">Cargando datos del empleado…</p>}
      </div>
    </ModalShell>
  )
}


type ClientPage = "inicio" | "servicios" | "citas" | "perfil"

const clientNav: NavItem[] = [
  { id: "inicio", label: "Inicio", icon: LayoutDashboard },
  { id: "servicios", label: "Servicios", icon: Sparkles },
  { id: "citas", label: "Mis citas", icon: CalendarDays },
  { id: "perfil", label: "Mi perfil", icon: UserRound },
]

type ClientData = {
  servicios: ServicioRow[]
  citas: CitaRow[]
  perfil: ClienteDetalle | null
  historial: HistorialCliente | null
  notificaciones: Notificacion[]
}

type ClientModal =
  | { kind: "book"; servicioId?: number }
  | { kind: "cancel"; cita: CitaRow }
  | { kind: "editProfile" }
  | null

const isUpcoming = (c: CitaRow) =>
  c.estadoCita === "Pendiente" && new Date(c.fechaHoraInicio).getTime() > Date.now()

function ClientApp({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [page, setPage] = useState<ClientPage>("inicio")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modal, setModal] = useState<ClientModal>(null)
  const [toast, setToast] = useState("")
  const [data, setData] = useState<ClientData>({
    servicios: [],
    citas: [],
    perfil: null,
    historial: null,
    notificaciones: [],
  })
  const [loadError, setLoadError] = useState("")
  const notifications = useNotifications(data.notificaciones, session.idPersona)

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 3500)
  }

  const reload = useCallback(async () => {
    const errors = new Set<string>()
    const [servicios, citas, perfil, historial, notificaciones] = await Promise.all([
      safe(api.servicios(), [], errors),
      safe(api.misCitas(), [], errors),
      safe<ClienteDetalle | null>(api.miPerfil(), null, errors),
      safe<HistorialCliente | null>(api.miHistorial(), null, errors),
      safe(api.misNotificaciones(), [], errors),
    ])
    setData({ servicios, citas, perfil, historial, notificaciones })
    setLoadError([...errors].slice(0, 2).join(" · "))
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const done = (message: string) => {
    setModal(null)
    notify(message)
    void reload()
  }

  const first = session.nombreCompleto.split(" ")[0] ?? ""
  const today = new Date().toLocaleDateString("es-HN", { weekday: "long", day: "numeric", month: "long" })
  const meta: Record<ClientPage, { eyebrow: string; title: string; description: string }> = {
    inicio: {
      eyebrow: today.charAt(0).toUpperCase() + today.slice(1),
      title: `Hola, ${first}`,
      description: "Estas son tus próximas citas y las novedades del estudio.",
    },
    servicios: {
      eyebrow: "Catálogo",
      title: "Nuestros servicios",
      description: "Consulta precios y duración, y agenda el que prefieras.",
    },
    citas: {
      eyebrow: "Tu agenda",
      title: "Mis citas",
      description: "Consulta, agenda o cancela tus citas.",
    },
    perfil: {
      eyebrow: "Tu cuenta",
      title: "Mi perfil",
      description: "Tus datos personales y tu historial de facturas.",
    },
  }

  return (
    <div className="min-h-screen bg-[#f8f5f2] text-[#292523]">
      <Sidebar
        items={clientNav}
        label="Mi cuenta"
        page={page}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigate={(next) => {
          setPage(next as ClientPage)
          setSidebarOpen(false)
        }}
        onProfile={() => setPage("perfil")}
        onLogout={onLogout}
      />
      <main className="min-h-screen lg:pl-[264px]">
        <Topbar
          onMenu={() => setSidebarOpen(true)}
          user={session}
          notifications={notifications.items}
          onMarkRead={notifications.markAllRead}
          onSelectNotification={() => setPage("citas")}
          onProfile={() => setPage("perfil")}
          onLogout={onLogout}
        />
        <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8 lg:pt-8">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[.22em] text-[#b87580]">
                {meta[page].eyebrow}
              </p>
              <h1 className="font-display text-4xl leading-none text-[#2d2724] sm:text-[44px]">
                {meta[page].title}
              </h1>
              <p className="mt-3 text-sm text-[#817772]">{meta[page].description}</p>
            </div>
            {(page === "inicio" || page === "citas") && (
              <button onClick={() => setModal({ kind: "book" })} className="btn-primary shrink-0">
                <Plus className="h-4 w-4" /> Agendar cita
              </button>
            )}
          </div>
          {loadError && (
            <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-[#ecc9c8] bg-[#f8e8e7] p-4 text-xs leading-5 text-[#8f4a4a]">
              <span>{loadError}</span>
              <button onClick={() => void reload()} className="shrink-0 font-bold underline">
                Reintentar
              </button>
            </div>
          )}
          {page === "inicio" && (
            <ClientHome
              data={data}
              notifications={notifications.items}
              onNavigate={setPage}
              onBook={() => setModal({ kind: "book" })}
            />
          )}
          {page === "servicios" && (
            <ClientServices
              servicios={data.servicios}
              onBook={(servicioId) => setModal({ kind: "book", servicioId })}
            />
          )}
          {page === "citas" && (
            <ClientAppointments
              citas={data.citas}
              onBook={() => setModal({ kind: "book" })}
              onCancel={(cita) => setModal({ kind: "cancel", cita })}
            />
          )}
          {page === "perfil" && (
            <ClientProfile
              perfil={data.perfil}
              historial={data.historial}
              onEdit={() => setModal({ kind: "editProfile" })}
            />
          )}
        </div>
      </main>
      {modal?.kind === "book" && (
        <BookingModal
          servicios={data.servicios}
          preselected={modal.servicioId}
          onClose={() => setModal(null)}
          onDone={done}
        />
      )}
      {modal?.kind === "cancel" && (
        <CancelMineModal cita={modal.cita} onClose={() => setModal(null)} onDone={done} />
      )}
      {modal?.kind === "editProfile" && data.perfil && (
        <ProfileEditModal perfil={data.perfil} onClose={() => setModal(null)} onDone={done} />
      )}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-[#292321] px-4 py-3 text-sm font-semibold text-white shadow-2xl">
          <Check className="h-4 w-4 text-[#e8b7bd]" />
          {toast}
        </div>
      )}
    </div>
  )
}

function ClientHome({
  data,
  notifications,
  onNavigate,
  onBook,
}: {
  data: ClientData
  notifications: DescribedNotification[]
  onNavigate: (page: ClientPage) => void
  onBook: () => void
}) {
  const upcoming = data.citas
    .filter(isUpcoming)
    .sort((a, b) => a.fechaHoraInicio.localeCompare(b.fechaHoraInicio))
  const completed = data.citas.filter((c) => c.estadoCita === "Completada").length
  const h = data.historial?.cliente
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Próximas citas" value={String(upcoming.length)} detail="Pendientes por atender" icon={CalendarDays} accent="rose" trend="Agenda" />
        <StatCard title="Citas completadas" value={String(completed)} detail="Servicios recibidos" icon={Check} accent="cream" trend="Historial" />
        <StatCard title="Facturas" value={String(h?.cantidadFacturas ?? 0)} detail="Emitidas a tu nombre" icon={ReceiptText} accent="sand" trend="Total" />
        <StatCard title="Total gastado" value={money(h?.totalGastado ?? 0)} detail="Acumulado" icon={WalletCards} accent="dark" trend="Total" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_.9fr]">
        <Panel>
          <PanelHeader
            title="Próximas citas"
            subtitle="Tus citas pendientes, de la más cercana a la más lejana"
            action={
              <button onClick={() => onNavigate("citas")} className="link-button">
                Ver todas <ChevronRight className="h-4 w-4" />
              </button>
            }
          />
          {upcoming.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-xs text-[#968c87]">No tienes citas próximas.</p>
              <button onClick={onBook} className="link-button mx-auto mt-3">
                <Plus className="h-4 w-4" /> Agendar una cita
              </button>
            </div>
          )}
          <div className="divide-y divide-[#eee5e0]">
            {upcoming.slice(0, 4).map((c) => (
              <div key={c.idCita} className="grid grid-cols-[96px_1fr_auto] items-center gap-4 py-3.5">
                <div>
                  <p className="text-sm font-bold text-[#332c29]">{timeOf(c.fechaHoraInicio)}</p>
                  <p className="text-[10px] text-[#a09792]">{fmtDate(c.fechaHoraInicio)}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#403835]">{c.servicios ?? "—"}</p>
                  <p className="truncate text-xs text-[#918782]">{c.empleados ?? "—"} · {c.duracionMinutos} min</p>
                </div>
                <Status value={c.estadoCita} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Novedades" subtitle="Avisos sobre tus citas y promociones" />
          {notifications.length === 0 && (
            <p className="py-6 text-center text-xs text-[#968c87]">No hay novedades por ahora.</p>
          )}
          <div className="space-y-3">
            {notifications.slice(0, 4).map((n) => (
              <div key={n.id} className="rounded-xl border border-[#eee4df] p-3.5">
                <p className="text-xs font-bold text-[#332c29]">{n.title}</p>
                <p className="mt-1 text-[11px] leading-4 text-[#8a807b]">{n.text}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function ClientServices({
  servicios,
  onBook,
}: {
  servicios: ServicioRow[]
  onBook: (servicioId: number) => void
}) {
  const [query, setQuery] = useState("")
  const filtered = servicios.filter((s) =>
    `${s.nombreServicio} ${s.descripcion ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <div className="space-y-6">
      <div className="flex max-w-md items-center gap-2 rounded-xl border border-[#e8ded8] bg-white px-3.5 py-2.5">
        <Search className="h-4 w-4 text-[#a79d98]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-sm outline-none placeholder:text-[#aaa09b]"
          placeholder="Buscar un servicio…"
        />
      </div>
      {filtered.length === 0 && (
        <EmptyState title="No encontramos servicios" text="Prueba con otra búsqueda." />
      )}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((s) => (
          <Panel key={s.idServicio}>
            <div className="mb-4 flex h-28 items-center justify-center rounded-xl bg-[#f2e7e3]">
              <Sparkles className="h-7 w-7 text-[#b87580]" />
            </div>
            <h3 className="font-display text-2xl">{s.nombreServicio}</h3>
            <p className="mt-2 min-h-10 text-sm leading-5 text-[#817772]">{s.descripcion ?? "Sin descripción."}</p>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-lg font-bold">{money(s.precio)}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-[#958b86]">
                  <Clock className="h-3.5 w-3.5" /> {s.duracionMinutos} min
                </p>
              </div>
              <button onClick={() => onBook(s.idServicio)} className="btn-primary">
                Agendar
              </button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  )
}

function ClientAppointments({
  citas,
  onBook,
  onCancel,
}: {
  citas: CitaRow[]
  onBook: () => void
  onCancel: (cita: CitaRow) => void
}) {
  const [filter, setFilter] = useState("Próximas")
  const filtered = citas.filter((c) =>
    filter === "Todas" ? true : filter === "Próximas" ? isUpcoming(c) : c.estadoCita === filter,
  )
  const paged = usePaged(filtered, filter)
  return (
    <Panel>
      <div className="mb-5 flex flex-col justify-between gap-4 border-b border-[#eee5e0] pb-5 md:flex-row md:items-center">
        <FilterTabs
          options={["Próximas", "Todas", "Pendiente", "Completada", "Cancelada"]}
          value={filter}
          onChange={setFilter}
        />
        <button onClick={onBook} className="link-button">
          <Plus className="h-4 w-4" /> Agendar cita
        </button>
      </div>
      <DataTable headers={["Fecha y hora", "Servicios", "Especialista", "Total", "Estado", ""]}>
        {paged.rows.map((c) => (
          <tr key={c.idCita}>
            <td>
              <p className="font-bold">{timeOf(c.fechaHoraInicio)}</p>
              <p className="text-[10px] text-[#9a908b]">{fmtDate(c.fechaHoraInicio)} · {c.duracionMinutos} min</p>
            </td>
            <td>{c.servicios ?? "—"}</td>
            <td>{c.empleados ?? "—"}</td>
            <td className="font-semibold">{money(c.totalServicios)}</td>
            <td>
              <Status value={c.estadoCita} />
            </td>
            <td>
              {isUpcoming(c) && (
                <button onClick={() => onCancel(c)} className="link-button ml-auto">
                  <X className="h-4 w-4" /> Cancelar
                </button>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      {filtered.length === 0 && (
        <EmptyState title="Sin citas en esta vista" text="Cuando agendes una cita aparecerá aquí." />
      )}
      <Pagination count={filtered.length} page={paged.page} pages={paged.pages} onPage={paged.setPage} />
    </Panel>
  )
}

function ClientProfile({
  perfil,
  historial,
  onEdit,
}: {
  perfil: ClienteDetalle | null
  historial: HistorialCliente | null
  onEdit: () => void
}) {
  if (!perfil) return <p className="text-sm text-[#968c87]">Cargando tu perfil…</p>
  const fullName = [perfil.primerNombre, perfil.segundoNombre, perfil.primerApellido, perfil.segundoApellido]
    .filter(Boolean)
    .join(" ")
  const rows: [string, string][] = [
    ["DNI", perfil.dni],
    ["Fecha de nacimiento", fmtDate(perfil.fechaNacimiento)],
    ["Teléfono", perfil.telefono ?? "—"],
    ["Correo", perfil.correo ?? "—"],
    ["Cliente desde", fmtDate(perfil.fechaRegistro)],
  ]
  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Avatar name={fullName} large />
            <div>
              <h3 className="font-display text-2xl">{fullName}</h3>
              <p className="text-sm text-[#817772]">Cliente #{perfil.idCliente}</p>
            </div>
          </div>
          <button onClick={onEdit} className="btn-secondary">
            <Pencil className="h-4 w-4" /> Editar perfil
          </button>
        </div>
        <dl className="mt-6 grid gap-5 border-t border-[#eee5e0] pt-5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] font-bold uppercase tracking-[.14em] text-[#847a75]">{k}</dt>
              <dd className="mt-1 text-sm text-[#4b423f]">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel>
        <PanelHeader title="Historial de facturas" subtitle="Servicios y compras a tu nombre" />
        <DataTable headers={["Factura", "Tipo", "Fecha", "Total"]}>
          {(historial?.facturas ?? []).map((f) => (
            <tr key={f.idFactura}>
              <td className="font-semibold">{invoiceCode(f.idFactura)}</td>
              <td>{f.tipoVenta}</td>
              <td>{fmtDate(f.fechaCita)}</td>
              <td className="font-semibold">{money(f.total)}</td>
            </tr>
          ))}
        </DataTable>
        {(historial?.facturas.length ?? 0) === 0 && (
          <EmptyState title="Aún no tienes facturas" text="Aparecerán cuando completes un servicio." />
        )}
      </Panel>
    </div>
  )
}

function BookingModal({
  servicios,
  preselected,
  onClose,
  onDone,
}: {
  servicios: ServicioRow[]
  preselected?: number
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [servicioId, setServicioId] = useState<number>(preselected ?? servicios[0]?.idServicio ?? 0)
  const [especialistas, setEspecialistas] = useState<EspecialistaRow[]>([])
  const [empleadoId, setEmpleadoId] = useState(0)
  const [fecha, setFecha] = useState(toYmd(new Date()))
  const [horas, setHoras] = useState<string[]>([])
  const [cargando, setCargando] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const servicio = servicios.find((s) => s.idServicio === servicioId)

  useEffect(() => {
    if (!servicioId) return
    let active = true
    api
      .especialistasDeServicio(servicioId)
      .then((r) => {
        if (!active) return
        setEspecialistas(r)
        setEmpleadoId(r[0]?.idEmpleado ?? 0)
      })
      .catch(() => {
        if (active) setEspecialistas([])
      })
    return () => {
      active = false
    }
  }, [servicioId])

  useEffect(() => {
    if (!empleadoId || !fecha || !servicio) return
    let active = true
    setCargando(true)
    api
      .horarios(empleadoId, fecha, servicio.duracionMinutos)
      .then((r) => {
        if (!active) return
        const now = new Date()
        const isToday = fecha === toYmd(now)
        const nowText = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
        setHoras(r.map((h) => timeOf(h.horaInicio)).filter((h) => !isToday || h > nowText))
      })
      .catch(() => {
        if (active) setHoras([])
      })
      .finally(() => {
        if (active) setCargando(false)
      })
    return () => {
      active = false
    }
  }, [empleadoId, fecha, servicio])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!servicio) return
    const f = new FormData(event.currentTarget)
    setSaving(true)
    setError("")
    try {
      const r = await api.agendarMiCita({
        fechaHoraInicio: `${fecha}T${String(f.get("time"))}:00`,
        duracionMinutos: servicio.duracionMinutos,
        idEmpleado: empleadoId,
        servicios: [servicio.idServicio],
        observaciones: String(f.get("observations") ?? "").trim() || null,
      })
      onDone(`Cita #${r.idCita} agendada.`)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Agendar cita" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Servicio">
              <select
                className="input"
                required
                value={servicioId || ""}
                onChange={(e) => setServicioId(Number(e.target.value))}
              >
                {servicios.map((s) => (
                  <option key={s.idServicio} value={s.idServicio}>
                    {s.nombreServicio} · {money(s.precio)} · {s.duracionMinutos} min
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Especialista">
            <select
              className="input"
              required
              value={empleadoId || ""}
              onChange={(e) => setEmpleadoId(Number(e.target.value))}
            >
              {especialistas.length === 0 && <option value="">Sin especialistas disponibles</option>}
              {especialistas.map((e) => (
                <option key={e.idEmpleado} value={e.idEmpleado}>
                  {e.nombreCompleto}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha">
            <input
              type="date"
              className="input"
              min={toYmd(new Date())}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Hora disponible">
              <select name="time" className="input" required>
                {horas.length === 0 && (
                  <option value="">{cargando ? "Buscando horarios…" : "Sin horarios disponibles para este día"}</option>
                )}
                {horas.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Observaciones (opcional)">
              <textarea
                name="observations"
                className="input min-h-20 resize-none"
                maxLength={45}
                placeholder="Máximo 45 caracteres"
              />
            </Field>
          </div>
          {servicio && (
            <p className="rounded-xl bg-[#f1e7e3] p-4 text-xs text-[#817671] sm:col-span-2">
              {servicio.nombreServicio} · {servicio.duracionMinutos} min · <strong>{money(servicio.precio)}</strong>. El
              pago se realiza en el estudio.
            </p>
          )}
        </div>
        <FormFooter saving={saving} error={error} onClose={onClose} label="Confirmar cita" />
      </form>
    </ModalShell>
  )
}

function CancelMineModal({
  cita,
  onClose,
  onDone,
}: {
  cita: CitaRow
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const f = new FormData(event.currentTarget)
    setSaving(true)
    setError("")
    try {
      await api.cancelarMiCita(cita.idCita, String(f.get("motivo") ?? "").trim() || null)
      onDone("Tu cita fue cancelada.")
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Cancelar cita" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="p-6">
          <p className="text-sm leading-6 text-[#675d58]">
            ¿Deseas cancelar tu cita de <strong>{cita.servicios ?? "—"}</strong> el{" "}
            <strong>{fmtDate(cita.fechaHoraInicio)}</strong> a las <strong>{timeOf(cita.fechaHoraInicio)}</strong>?
          </p>
          <div className="mt-5">
            <Field label="Motivo (opcional)">
              <input name="motivo" className="input" maxLength={30} placeholder="Máximo 30 caracteres" />
            </Field>
          </div>
        </div>
        <FormFooter saving={saving} error={error} onClose={onClose} label="Confirmar cancelación" danger />
      </form>
    </ModalShell>
  )
}

function ProfileEditModal({
  perfil,
  onClose,
  onDone,
}: {
  perfil: ClienteDetalle
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const f = new FormData(event.currentTarget)
    const s = (key: string) => String(f.get(key) ?? "").trim()
    setSaving(true)
    setError("")
    try {
      await api.actualizarMiPerfil({
        primerNombre: s("primerNombre"),
        segundoNombre: s("segundoNombre") || null,
        primerApellido: s("primerApellido"),
        segundoApellido: s("segundoApellido") || null,
        telefono: s("telefono"),
        correo: s("correo") || null,
      })
      onDone("Perfil actualizado.")
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Editar perfil" onClose={onClose}>
      <form onSubmit={submit}>
        <PersonFields detalle={perfil} />
        <FormFooter saving={saving} error={error} onClose={onClose} />
      </form>
    </ModalShell>
  )
}


function App() {
  const [auth, setAuth] = useState<{ session: Session; token: string } | null>(() => loadAuth())

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearAuth()
      setAuth(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  const logout = () => {
    clearAuth()
    setAuth(null)
  }

  if (!auth) {
    return (
      <Login
        onLogin={(session, token, remember) => {
          saveAuth(session, token, remember)
          setAuth({ session, token })
        }}
      />
    )
  }

  return auth.session.rol === "Empleado" ? (
    <StaffApp key={auth.session.idPersona} session={auth.session} onLogout={logout} />
  ) : (
    <ClientApp key={auth.session.idPersona} session={auth.session} onLogout={logout} />
  )
}


function Sidebar({
  items,
  label = "Administración",
  page,
  open,
  onClose,
  onNavigate,
  onProfile,
  onLogout,
}: {
  items: NavItem[]
  label?: string
  page: string
  open: boolean
  onClose: () => void
  onNavigate: (id: string) => void
  onProfile: () => void
  onLogout: () => void
}) {
  return (
    <>
      {open && (
        <button
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-label="Cerrar menú"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-[#24201e] transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[86px] items-center justify-between border-b border-white/7 px-5">
          <button
            onClick={() => onNavigate(items[0].id)}
            className="flex items-center gap-3 text-left"
          >
            <div className="h-11 w-11 overflow-hidden rounded-full bg-black">
              <img
                src={logo}
                alt="Loa Beauty Studio"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <p className="font-display text-xl leading-none text-[#f4cbd0]">
                Loa
              </p>
              <p className="mt-1 text-[8px] uppercase tracking-[.25em] text-white/40">
                Beauty Studio
              </p>
            </div>
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white/50 hover:bg-white/5 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-6">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-white/25">
            {label}
          </p>
          <div className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon
              const active = page === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                    active
                      ? "bg-[#d99aa3] text-[#2b2322]"
                      : "text-white/55 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon
                    className="h-[18px] w-[18px]"
                    strokeWidth={active ? 2.2 : 1.7}
                  />
                  <span className="font-semibold">{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
        <div className="border-t border-white/7 p-3">
          <button
            onClick={onProfile}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-white/45 hover:bg-white/5 hover:text-white"
          >
            <UserRound className="h-[18px] w-[18px]" /> Mi perfil
          </button>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-white/45 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px]" /> Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}


function Dashboard({
  data,
  onNavigate,
  onModal,
}: {
  data: AppData
  onNavigate: (page: Page) => void
  onModal: (name: ModalName) => void
}) {
  const now = new Date()
  const today = toYmd(now)
  const todays = data.citas.filter((c) => c.fechaHoraInicio.slice(0, 10) === today)
  const pendingToday = todays.filter((c) => c.estadoCita === "Pendiente").length
  const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const month = data.ingresos.find((i) => i.periodo === periodo)
  const newClients = data.clientes.filter((c) => c.fechaRegistro.slice(0, 7) === periodo).length
  const lowStock = new Set(
    data.inventario.filter((i) => i.estadoInventario !== "Normal").map((i) => i.idProducto),
  ).size
  const upcoming = [...todays].sort((a, b) => a.fechaHoraInicio.localeCompare(b.fechaHoraInicio))

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Citas de hoy"
          value={String(todays.length)}
          detail={`${pendingToday} aún pendientes`}
          icon={CalendarDays}
          accent="rose"
          trend="Hoy"
        />
        <StatCard
          title="Ingresos del mes"
          value={money(month?.totalIngresos ?? 0)}
          detail={`${month?.cantidadFacturas ?? 0} facturas con cita`}
          icon={TrendingUp}
          accent="dark"
          trend={periodo}
        />
        <StatCard
          title="Clientes registrados"
          value={String(data.clientes.length)}
          detail={`${newClients} nuevos este mes`}
          icon={Users}
          accent="cream"
          trend="Total"
        />
        <StatCard
          title="Stock bajo"
          value={String(lowStock)}
          detail="Productos por reponer"
          icon={AlertTriangle}
          accent="sand"
          trend="Revisar"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.45fr_.75fr]">
        <Panel>
          <PanelHeader
            title="Ingresos por mes"
            subtitle="Vista vw_IngresosPorMes · Solo facturas asociadas a citas"
            action={
              <button onClick={() => onNavigate("reportes")} className="link-button">
                Ver reporte <ChevronRight className="h-4 w-4" />
              </button>
            }
          />
          <RevenueChart rows={data.ingresos.slice(-6)} />
        </Panel>
        <Panel className="overflow-hidden bg-[#2b2623] text-white">
          <div className="relative">
            <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-[#dca4ab]/15" />
            <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#e2aeb5]">
              Mes en curso
            </p>
            <p className="mt-4 font-display text-4xl">{money(month?.totalIngresos ?? 0)}</p>
            <p className="mt-1 text-xs text-white/40">
              {month?.cantidadFacturas ?? 0} facturas · ticket promedio{" "}
              {money(month?.ticketPromedio ?? 0)}
            </p>
            <button
              onClick={() => onNavigate("reportes")}
              className="mt-8 flex items-center gap-2 text-xs font-bold text-white"
            >
              Revisar desempeño <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </Panel>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
        <Panel>
          <PanelHeader
            title="Próximas citas"
            subtitle="Agenda de hoy, ordenada por hora"
            action={
              <button onClick={() => onNavigate("agenda")} className="link-button">
                Ver agenda <ChevronRight className="h-4 w-4" />
              </button>
            }
          />
          {upcoming.length === 0 && (
            <p className="py-6 text-center text-xs text-[#968c87]">No hay citas para hoy.</p>
          )}
          <div className="divide-y divide-[#eee5e0]">
            {upcoming.slice(0, 4).map((item) => (
              <div
                key={item.idCita}
                className="grid grid-cols-[58px_1fr_auto] items-center gap-4 py-3.5"
              >
                <div>
                  <p className="text-sm font-bold text-[#332c29]">{timeOf(item.fechaHoraInicio)}</p>
                  <p className="text-[10px] text-[#a09792]">{item.duracionMinutos} min</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#403835]">
                    {item.cliente ?? `Cita #${item.idCita}`}
                  </p>
                  <p className="truncate text-xs text-[#918782]">
                    {item.servicios ?? "—"} · {item.empleados ?? "—"}
                  </p>
                </div>
                <Status value={item.estadoCita} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Accesos rápidos" subtitle="Operaciones habilitadas por procedimientos" />
          <div className="grid grid-cols-2 gap-3">
            <QuickAction icon={CalendarDays} label="Agendar cita" onClick={() => onModal("appointment")} />
            <QuickAction icon={UserRound} label="Nuevo cliente" onClick={() => onModal("client")} />
            <QuickAction icon={ShoppingBag} label="Venta producto" onClick={() => onModal("sale")} />
            <QuickAction icon={PackagePlus} label="Reponer stock" onClick={() => onModal("restock")} />
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Catalog({
  empleados,
  servicios,
  promociones,
  masVendidos,
}: {
  empleados: EmpleadoRow[]
  servicios: ServicioRow[]
  promociones: PromocionRow[]
  masVendidos: MasVendidoRow[]
}) {
  const [tab, setTab] = useState("Equipo")
  const activos = empleados.filter((e) => e.estadoEmpleado === "Activo").length
  const vigentes = promociones.filter((p) => p.situacion === "Vigente" && p.activa === "Si").length
  const programadas = promociones.filter((p) => p.situacion === "Programada").length
  const timesOf = (id: number) => masVendidos.find((m) => m.idServicio === id)?.vecesRealizado ?? 0
  const maxTimes = Math.max(1, ...servicios.map((s) => timesOf(s.idServicio)))
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MiniMetric
          label="Empleados activos"
          value={String(activos)}
          note={`de ${empleados.length} registrados`}
        />
        <MiniMetric label="Servicios activos" value={String(servicios.length)} note="En catálogo" />
        <MiniMetric
          label="Promociones vigentes"
          value={String(vigentes)}
          note={`${programadas} programadas`}
        />
      </div>
      <Panel>
        <div className="mb-6 flex items-center justify-between">
          <FilterTabs options={["Equipo", "Servicios", "Promociones"]} value={tab} onChange={setTab} />
          <span className="text-xs text-[#968c87]">
            Modo consulta · No hay procedimientos de edición definidos
          </span>
        </div>
        {tab === "Equipo" && (
          <DataTable headers={["Empleado", "Especialidades", "Antigüedad", "Estado"]}>
            {empleados.map((e) => (
              <tr key={e.idEmpleado}>
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar name={e.nombreCompleto} />
                    <span className="font-semibold">{e.nombreCompleto}</span>
                  </div>
                </td>
                <td>{e.especialidades}</td>
                <td>{e.aniosAntiguedad} años</td>
                <td>
                  <Status value={e.estadoEmpleado} />
                </td>
              </tr>
            ))}
          </DataTable>
        )}
        {tab === "Servicios" && (
          <DataTable headers={["Servicio", "Precio", "Duración", "Descripción", "Veces realizado"]}>
            {servicios.map((s) => (
              <tr key={s.idServicio}>
                <td className="font-semibold">{s.nombreServicio}</td>
                <td>{money(s.precio)}</td>
                <td>{s.duracionMinutos} min</td>
                <td>{s.descripcion ?? "—"}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-24 rounded-full bg-[#eee6e1]">
                      <div
                        className="h-full rounded-full bg-[#c98791]"
                        style={{ width: `${(timesOf(s.idServicio) / maxTimes) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs">{timesOf(s.idServicio)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
        {tab === "Promociones" && (
          <DataTable headers={["Promoción", "Tipo", "Vigencia", "Aplica a", "Situación"]}>
            {promociones.map((p) => (
              <tr key={p.idPromocion}>
                <td className="font-semibold">{p.nombrePromocion}</td>
                <td>{p.tipoDescuento}</td>
                <td>
                  {fmtDate(p.fechaInicio)} — {fmtDate(p.fechaFin)}
                </td>
                <td>
                  {p.serviciosIncluidos !== "Ninguno" ? p.serviciosIncluidos : p.productosIncluidos}
                </td>
                <td>
                  <Status value={p.situacion} />
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  )
}


function Billing({
  citas,
  facturas,
  onModal,
}: {
  citas: CitaRow[]
  facturas: FacturaRow[]
  onModal: (name: ModalName, id?: number) => void
}) {
  const services = facturas.filter((f) => f.tipoVenta === "Servicio")
  const products = facturas.filter((f) => f.tipoVenta !== "Servicio")
  const sum = (rows: FacturaRow[]) => rows.reduce((total, f) => total + f.totalFactura, 0)
  const units = products.reduce((total, f) => total + f.unidadesProductos, 0)
  const pending = citas.filter((c) => c.estadoCita === "Pendiente").slice(0, 6)
  const exportInvoices = () =>
    downloadCsv("facturas-loa.csv", [
      ["Factura", "Cliente", "Atendido por", "Tipo", "Forma de pago", "Total"],
      ...facturas.map((f) => [
        invoiceCode(f.idFactura),
        f.cliente,
        f.atendidoPor,
        f.tipoVenta,
        f.formaPago ?? "",
        f.totalFactura,
      ]),
    ])
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MiniMetric label="Total facturado" value={money(sum(facturas))} note={`${facturas.length} facturas`} />
        <MiniMetric label="Servicios" value={money(sum(services))} note={`${services.length} facturas`} />
        <MiniMetric label="Productos" value={money(sum(products))} note={`${units} unidades`} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <Panel>
          <PanelHeader title="Pendientes de cobro" subtitle="Citas pendientes con total calculado" />
          {pending.length === 0 && (
            <p className="py-6 text-center text-xs text-[#968c87]">No hay citas pendientes de cobro.</p>
          )}
          <div className="space-y-3">
            {pending.map((item) => (
              <div key={item.idCita} className="rounded-xl border border-[#eee4df] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">{item.cliente ?? `Cita #${item.idCita}`}</p>
                    <p className="mt-1 text-xs text-[#918782]">
                      {item.servicios ?? "—"} · {fmtDate(item.fechaHoraInicio)} {timeOf(item.fechaHoraInicio)}
                    </p>
                  </div>
                  <p className="text-sm font-bold">{money(item.totalServicios)}</p>
                </div>
                <button
                  onClick={() => onModal("charge", item.idCita)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#2c2724] py-2.5 text-xs font-bold text-white"
                >
                  <WalletCards className="h-4 w-4" /> Cobrar cita
                </button>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHeader
            title="Facturas recientes"
            subtitle="Resumen basado en vw_FacturasDetalle"
            action={
              <button onClick={exportInvoices} className="link-button">
                <Download className="h-4 w-4" /> Exportar
              </button>
            }
          />
          <DataTable headers={["Factura", "Cliente", "Tipo", "Forma de pago", "Total"]}>
            {facturas.slice(0, 12).map((f) => (
              <tr key={f.idFactura}>
                <td className="font-semibold">{invoiceCode(f.idFactura)}</td>
                <td>{f.cliente}</td>
                <td>{f.tipoVenta}</td>
                <td>{f.formaPago ?? "—"}</td>
                <td className="font-semibold">{money(f.totalFactura)}</td>
              </tr>
            ))}
          </DataTable>
          {facturas.length === 0 && (
            <EmptyState title="Aún no hay facturas" text="Cobra una cita o registra una venta de producto." />
          )}
        </Panel>
      </div>
    </div>
  )
}

function Reports({
  ingresos,
  version,
  notify,
}: {
  ingresos: IngresoMesRow[]
  version: number
  notify: (message: string) => void
}) {
  const [desde, setDesde] = useState(`${new Date().getFullYear()}-01-01`)
  const [hasta, setHasta] = useState(toYmd(new Date()))
  const [reporte, setReporte] = useState<ReporteVentas | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!desde || !hasta) return
    let active = true
    setError("")
    api
      .reporteVentas(desde, hasta)
      .then((r) => {
        if (active) setReporte(r)
      })
      .catch((e) => {
        if (active) setError(errMsg(e))
      })
    return () => {
      active = false
    }
  }, [desde, hasta, version])

  const rows = ingresos.filter(
    (r) => r.periodo >= desde.slice(0, 7) && r.periodo <= hasta.slice(0, 7),
  )
  const monthly = rows
    .map((r, i) => ({
      ...r,
      variacion:
        i > 0 && rows[i - 1].totalIngresos > 0
          ? ((r.totalIngresos - rows[i - 1].totalIngresos) / rows[i - 1].totalIngresos) * 100
          : null,
    }))
    .reverse()
  const topServices = (reporte?.ingresosPorServicio ?? []).slice(0, 5)
  const maxTimes = Math.max(1, ...topServices.map((s) => s.vecesRealizado))
  const resumen = reporte?.resumen

  const exportReport = () => {
    downloadCsv("reporte-ingresos-loa.csv", [
      ["Periodo", "Facturas", "Ingresos", "Ticket promedio"],
      ...rows.map((r) => [r.periodo, r.cantidadFacturas, r.totalIngresos, r.ticketPromedio]),
    ])
    notify("Reporte CSV generado.")
  }

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <Field label="Desde">
              <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </Field>
            <Field label="Hasta">
              <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </Field>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="btn-secondary">
              <Printer className="h-4 w-4" /> Imprimir
            </button>
            <button onClick={exportReport} className="btn-primary">
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
          </div>
        </div>
        {error && <p className="mt-4 text-xs font-semibold text-[#a65858]">{error}</p>}
      </Panel>
      <div className="grid gap-4 sm:grid-cols-3">
        <MiniMetric
          label="Ingresos del período"
          value={money(resumen?.totalIngresos ?? 0)}
          note="Por fecha de cita"
        />
        <MiniMetric
          label="Facturas emitidas"
          value={String(resumen?.cantidadFacturas ?? 0)}
          note="Solo facturas con cita"
        />
        <MiniMetric
          label="Ticket promedio"
          value={money(resumen?.ticketPromedio ?? 0)}
          note="Por factura"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
        <Panel>
          <PanelHeader title="Evolución de ingresos" subtitle="vw_IngresosPorMes · período seleccionado" />
          <RevenueChart rows={rows.slice(-12)} detailed />
        </Panel>
        <Panel>
          <PanelHeader title="Servicios más vendidos" subtitle="sp_ReporteVentas · período seleccionado" />
          {topServices.length === 0 && (
            <p className="py-6 text-center text-xs text-[#968c87]">Sin servicios completados en el período.</p>
          )}
          <div className="space-y-5">
            {topServices.map((service, index) => (
              <div key={service.idServicio}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f1e6e3] text-[10px] font-bold text-[#9f606a]">
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold">{service.nombreServicio}</span>
                  </div>
                  <span className="text-xs font-bold">{service.vecesRealizado}</span>
                </div>
                <div className="ml-9 h-1.5 rounded-full bg-[#eee7e3]">
                  <div
                    className="h-full rounded-full bg-[#c98590]"
                    style={{ width: `${(service.vecesRealizado / maxTimes) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel>
        <PanelHeader title="Resumen mensual" subtitle="Reporte gerencial por fecha de cita" />
        <DataTable headers={["Período", "Facturas", "Ingresos", "Ticket promedio", "Variación"]}>
          {monthly.map((r) => (
            <tr key={r.periodo}>
              <td className="font-semibold">
                {MONTHS[r.mes - 1]} {r.anio}
              </td>
              <td>{r.cantidadFacturas}</td>
              <td className="font-semibold">{money(r.totalIngresos)}</td>
              <td>{money(r.ticketPromedio)}</td>
              <td>
                {r.variacion === null ? (
                  "—"
                ) : (
                  <span
                    className={`flex items-center gap-1 font-bold ${
                      r.variacion >= 0 ? "text-[#56806b]" : "text-[#a65858]"
                    }`}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    {r.variacion.toFixed(1)}%
                  </span>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
        {monthly.length === 0 && (
          <EmptyState title="Sin datos en el período" text="Ajusta el rango de fechas." />
        )}
      </Panel>
    </div>
  )
}


function HistoryBody({ idCliente }: { idCliente: number }) {
  const [info, setInfo] = useState<HistorialCliente | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    api
      .historial(idCliente)
      .then((r) => {
        if (active) setInfo(r)
      })
      .catch((e) => {
        if (active) setError(errMsg(e))
      })
    return () => {
      active = false
    }
  }, [idCliente])

  if (error) return <p className="p-6 text-sm text-[#a65858]">{error}</p>
  if (!info?.cliente) return <p className="p-6 text-sm text-[#968c87]">Cargando historial…</p>
  const c = info.cliente
  return (
    <div className="p-6">
      <div className="flex items-center gap-4 rounded-2xl bg-[#f2e8e4] p-5">
        <Avatar name={c.nombreCompleto} large />
        <div>
          <h3 className="font-display text-2xl">{c.nombreCompleto}</h3>
          <p className="text-sm text-[#817772]">
            {c.telefono ?? "Sin teléfono"} · {c.correo ?? "Sin correo"}
          </p>
        </div>
      </div>
      <div className="my-5 grid grid-cols-3 gap-3">
        <MiniMetric label="Facturas" value={String(c.cantidadFacturas)} note="Históricas" />
        <MiniMetric label="Total gastado" value={money(c.totalGastado)} note="Acumulado" />
        <MiniMetric label="Desde" value={fmtDate(c.fechaRegistro)} note="Registro" />
      </div>
      <DataTable headers={["Factura", "Tipo", "Fecha", "Total"]}>
        {info.facturas.map((f) => (
          <tr key={f.idFactura}>
            <td>{invoiceCode(f.idFactura)}</td>
            <td>{f.tipoVenta}</td>
            <td>{fmtDate(f.fechaCita)}</td>
            <td className="font-semibold">{money(f.total)}</td>
          </tr>
        ))}
      </DataTable>
      {info.facturas.length === 0 && (
        <p className="py-6 text-center text-xs text-[#968c87]">Este cliente aún no tiene facturas.</p>
      )}
    </div>
  )
}

function Modal({
  name,
  selectedId,
  data,
  session,
  onClose,
  onDone,
}: {
  name: BasicModal
  selectedId: number | null
  data: AppData
  session: Session
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const cita = data.citas.find((item) => item.idCita === selectedId)
  const activos = data.empleados.filter((e) => e.estadoEmpleado === "Activo")
  const cajeroDefault = activos.some((e) => e.idEmpleado === session.idEmpleado)
    ? String(session.idEmpleado)
    : ""
  const promosVigentes = data.promociones.filter((p) => p.situacion === "Vigente" && p.activa === "Si")
  const titles: Record<BasicModal, string> = {
    appointment: "Agendar nueva cita",
    client: "Registrar cliente",
    restock: "Reponer inventario",
    sale: "Registrar venta de producto",
    charge: "Completar cita y facturar",
    history: "Historial del cliente",
    cancel: "Cancelar cita",
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const f = new FormData(event.currentTarget)
    const s = (key: string) => String(f.get(key) ?? "").trim()
    const n = (key: string) => Number(f.get(key))
    setSaving(true)
    setError("")
    try {
      let message = ""
      if (name === "appointment") {
        const r = await api.agendar({
          fechaHoraInicio: `${s("date")}T${s("time")}:00`,
          duracionMinutos: n("duration"),
          idEmpleado: n("employee"),
          servicios: [n("service")],
          observaciones: s("observations") || null,
          idCliente: s("client") ? n("client") : null,
        })
        message = `Cita #${r.idCita} agendada.`
      } else if (name === "client") {
        const r = await api.crearCliente({
          primerNombre: s("firstName"),
          segundoNombre: s("middleName") || null,
          primerApellido: s("lastName"),
          segundoApellido: s("secondLastName") || null,
          dni: s("dni"),
          fechaNacimiento: s("birthDate"),
          usuario: s("username"),
          contrasena: s("password"),
          telefono: s("phone"),
          correo: s("email") || null,
        })
        message = `Cliente #${r.idCliente} registrado.`
      } else if (name === "cancel" && selectedId) {
        await api.cancelar(selectedId, s("motivo") || null)
        message = "Cita cancelada."
      } else if (name === "charge" && selectedId) {
        const r = await api.facturar(selectedId, {
          idCliente: n("client"),
          idEmpleadoCajero: n("cashier"),
          idFormaPago: n("payment"),
          idPromocion: s("promo") ? n("promo") : null,
        })
        message = `Cita completada. Factura ${invoiceCode(r.idFactura)} emitida.`
      } else if (name === "sale") {
        const r = await api.ventaProducto({
          idCliente: n("client"),
          idEmpleado: n("employee"),
          idProducto: n("product"),
          cantidad: n("quantity"),
          idFormaPago: n("payment"),
        })
        message = `Venta registrada. Factura ${invoiceCode(r.idFactura)}.`
      } else if (name === "restock") {
        const r = await api.reponer({
          idProducto: n("product"),
          idProveedor: n("supplier"),
          cantidad: n("quantity"),
          precioCompra: n("price"),
          fechaVencimiento: s("expires") || null,
        })
        message = `Inventario repuesto (lote #${r.idLote}).`
      }
      onDone(message)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  const activeClients = data.clientes.filter((c) => c.estado !== "Inactivo")
  const clientOptions = activeClients.map((c) => (
    <option key={c.idCliente} value={c.idCliente}>
      {c.nombreCompleto}
    </option>
  ))
  const paymentOptions = data.formasPago.map((p) => (
    <option key={p.idFormaPago} value={p.idFormaPago}>
      {p.nombreFormaPago}
    </option>
  ))
  const employeeOptions = (list: EmpleadoRow[]) =>
    list.map((e) => (
      <option key={e.idEmpleado} value={e.idEmpleado}>
        {e.nombreCompleto}
      </option>
    ))

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[#1f1b19]/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[24px] bg-[#fbf9f7] shadow-2xl sm:max-w-2xl sm:rounded-[24px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#eadfd9] bg-[#fbf9f7]/95 px-6 py-5 backdrop-blur">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#b87580]">
              Panel administrativo
            </p>
            <h2 className="mt-1 font-display text-3xl">{titles[name]}</h2>
          </div>
          <button onClick={onClose} className="icon-button">
            <X className="h-5 w-5" />
          </button>
        </div>
        {name === "history" && selectedId ? (
          <HistoryBody idCliente={selectedId} />
        ) : (
          <form onSubmit={submit}>
            <div className="grid gap-5 p-6 sm:grid-cols-2">
              {name === "appointment" && <AppointmentFields empleados={activos} clientes={activeClients} />}
              {name === "client" && (
                <>
                  <Field label="Primer nombre">
                    <input name="firstName" className="input" required />
                  </Field>
                  <Field label="Segundo nombre">
                    <input name="middleName" className="input" />
                  </Field>
                  <Field label="Primer apellido">
                    <input name="lastName" className="input" required />
                  </Field>
                  <Field label="Segundo apellido">
                    <input name="secondLastName" className="input" />
                  </Field>
                  <Field label="DNI">
                    <input name="dni" className="input" required />
                  </Field>
                  <Field label="Fecha de nacimiento">
                    <input name="birthDate" type="date" className="input" required />
                  </Field>
                  <Field label="Usuario">
                    <input name="username" className="input" required />
                  </Field>
                  <Field label="Contraseña">
                    <input name="password" type="password" minLength={6} className="input" required />
                  </Field>
                  <Field label="Teléfono">
                    <input name="phone" type="tel" className="input" required />
                  </Field>
                  <Field label="Correo">
                    <input name="email" type="email" className="input" />
                  </Field>
                </>
              )}
              {name === "restock" && (
                <>
                  <Field label="Producto">
                    <select name="product" className="input" required defaultValue={selectedId ?? ""}>
                      {data.productos.map((p) => (
                        <option key={p.idProducto} value={p.idProducto}>
                          {p.nombre} — {p.marca}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Proveedor">
                    <select name="supplier" className="input" required>
                      {data.proveedores.map((p) => (
                        <option key={p.idProveedor} value={p.idProveedor}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Cantidad">
                    <input name="quantity" type="number" min="1" className="input" required />
                  </Field>
                  <Field label="Precio de compra">
                    <input name="price" type="number" min="0.01" step=".01" className="input" required />
                  </Field>
                  <Field label="Fecha de vencimiento">
                    <input name="expires" type="date" className="input" />
                  </Field>
                </>
              )}
              {name === "sale" && (
                <>
                  <Field label="Cliente">
                    <select name="client" className="input" required defaultValue="">
                      <option value="" disabled>
                        Selecciona un cliente
                      </option>
                      {clientOptions}
                    </select>
                  </Field>
                  <Field label="Empleado">
                    <select name="employee" className="input" required defaultValue={cajeroDefault}>
                      <option value="" disabled>
                        Selecciona un empleado
                      </option>
                      {employeeOptions(activos)}
                    </select>
                  </Field>
                  <Field label="Producto">
                    <select name="product" className="input" required>
                      {data.productos
                        .filter((p) => p.stock > 0)
                        .map((p) => (
                          <option key={p.idProducto} value={p.idProducto}>
                            {p.nombre} · {p.stock} disponibles
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Cantidad">
                    <input name="quantity" type="number" min="1" defaultValue="1" className="input" required />
                  </Field>
                  <Field label="Forma de pago">
                    <select name="payment" className="input" required>
                      {paymentOptions}
                    </select>
                  </Field>
                </>
              )}
              {name === "charge" && cita && (
                <>
                  <div className="rounded-xl bg-[#f1e7e3] p-4 sm:col-span-2">
                    <p className="text-sm font-bold">Cita #{cita.idCita}</p>
                    <p className="mt-1 text-xs text-[#817671]">
                      {cita.servicios ?? "—"} · {cita.empleados ?? "—"}
                    </p>
                    <p className="mt-3 font-display text-3xl">{money(cita.totalServicios)}</p>
                    <p className="mt-1 text-[10px] text-[#9a8f8a]">
                      Antes de promociones. El total final se calcula al facturar.
                    </p>
                  </div>
                  <Field label="Cliente">
                    <select name="client" className="input" required defaultValue={cita.idCliente ?? ""}>
                      <option value="" disabled>
                        Selecciona un cliente
                      </option>
                      {clientOptions}
                    </select>
                  </Field>
                  <Field label="Empleado cajero">
                    <select name="cashier" className="input" required defaultValue={cajeroDefault}>
                      <option value="" disabled>
                        Selecciona un empleado
                      </option>
                      {employeeOptions(activos)}
                    </select>
                  </Field>
                  <Field label="Forma de pago">
                    <select name="payment" className="input" required>
                      {paymentOptions}
                    </select>
                  </Field>
                  <Field label="Promoción (opcional)">
                    <select name="promo" className="input">
                      <option value="">Sin promoción</option>
                      {promosVigentes.map((p) => (
                        <option key={p.idPromocion} value={p.idPromocion}>
                          {p.nombrePromocion}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
              {name === "cancel" && cita && (
                <div className="sm:col-span-2">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#f5e2e1] text-[#a95e66]">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <p className="text-sm leading-6 text-[#675d58]">
                    ¿Deseas cancelar la <strong>cita #{cita.idCita}</strong> de las{" "}
                    <strong>{timeOf(cita.fechaHoraInicio)}</strong>? Esta acción cambia su estado a
                    Cancelada.
                  </p>
                  <div className="mt-5">
                    <Field label="Motivo (opcional)">
                      <input name="motivo" className="input" maxLength={30} placeholder="Máximo 30 caracteres" />
                    </Field>
                  </div>
                </div>
              )}
            </div>
            {error && (
              <p className="mx-6 mb-4 rounded-xl border border-[#ecc9c8] bg-[#f8e8e7] px-4 py-3 text-xs font-semibold text-[#8f4a4a]">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3 border-t border-[#eadfd9] px-6 py-4">
              <button type="button" onClick={onClose} className="btn-secondary">
                Volver
              </button>
              <button className={name === "cancel" ? "btn-danger" : "btn-primary"} disabled={saving}>
                {saving ? (
                  "Guardando…"
                ) : name === "cancel" ? (
                  <>
                    <Trash2 className="h-4 w-4" /> Confirmar cancelación
                  </>
                ) : name === "charge" ? (
                  <>
                    <ReceiptText className="h-4 w-4" /> Completar y facturar
                  </>
                ) : (
                  "Guardar"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}


function StatCard({
  title,
  value,
  detail,
  icon: Icon,
  accent,
  trend,
}: {
  title: string
  value: string
  detail: string
  icon: LucideIcon
  accent: string
  trend: string
}) {
  const styles =
    accent === "dark"
      ? "bg-[#2c2724] text-white"
      : accent === "rose"
        ? "bg-[#ecd0d2]"
        : accent === "cream"
          ? "bg-white"
          : "bg-[#eee5dc]"
  return (
    <div
      className={`rounded-2xl border border-black/[.04] p-5 shadow-[0_8px_25px_rgba(65,48,43,.04)] ${styles}`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            accent === "dark"
              ? "bg-white/10 text-[#f0b9c0]"
              : "bg-white/60 text-[#9e5e67]"
          }`}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
            accent === "dark"
              ? "bg-white/10 text-white/70"
              : "bg-white/60 text-[#765b59]"
          }`}
        >
          {trend}
        </span>
      </div>
      <p
        className={`mt-5 text-xs font-semibold ${
          accent === "dark" ? "text-white/45" : "text-[#887d78]"
        }`}
      >
        {title}
      </p>
      <p className="mt-1 font-display text-[32px] leading-none">{value}</p>
      <p
        className={`mt-3 text-[11px] ${
          accent === "dark" ? "text-white/35" : "text-[#9a908a]"
        }`}
      >
        {detail}
      </p>
    </div>
  )
}


function RevenueChart({ rows, detailed = false }: { rows: IngresoMesRow[]; detailed?: boolean }) {
  if (rows.length === 0) {
    return (
      <EmptyState title="Sin ingresos registrados" text="Aún no hay facturas asociadas a citas." />
    )
  }
  const max = Math.max(...rows.map((r) => r.totalIngresos), 1)
  const last = rows[rows.length - 1]
  const prev = rows[rows.length - 2]
  const change =
    prev && prev.totalIngresos > 0
      ? ((last.totalIngresos - prev.totalIngresos) / prev.totalIngresos) * 100
      : null
  return (
    <div className="pt-3">
      <div className={`flex items-end gap-3 ${detailed ? "h-64" : "h-48"}`}>
        {rows.map((row) => (
          <div
            key={row.periodo}
            className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
          >
            <div className="relative flex w-full flex-1 items-end justify-center">
              <div className="absolute bottom-0 h-full w-px bg-[#eee6e1]" />
              <div
                className="relative w-full max-w-10 rounded-t-lg bg-[#d99aa3] transition hover:bg-[#b96f7a]"
                style={{ height: `${(row.totalIngresos / max) * 86}%` }}
              >
                <span className="absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#292321] px-2 py-1 text-[9px] text-white group-hover:block">
                  {money(row.totalIngresos)}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-[#958b86]">{MONTHS[row.mes - 1]}</span>
          </div>
        ))}
      </div>
      {change !== null && (
        <div className="mt-4 flex items-center gap-2 text-xs text-[#786e69]">
          <span
            className={`flex items-center gap-1 font-bold ${
              change >= 0 ? "text-[#56806b]" : "text-[#a65858]"
            }`}
          >
            <ArrowUpRight className="h-3.5 w-3.5" /> {change.toFixed(1)}%
          </span>{" "}
          respecto al mes anterior
        </div>
      )}
    </div>
  )
}


function Panel({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl border border-[#e9dfda] bg-white p-5 shadow-[0_8px_30px_rgba(64,46,41,.035)] sm:p-6 ${className}`}
    >
      {children}
    </section>
  )
}

function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="font-display text-[25px] leading-none">{title}</h2>
        <p className="mt-2 text-[11px] text-[#988e89]">{subtitle}</p>
      </div>
      {action}
    </div>
  )
}

function MiniMetric({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string
  value: string
  note: string
  tone?: string
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        tone === "warning"
          ? "border-[#ead9bd] bg-[#f4eee3]"
          : tone === "rose"
            ? "border-[#ead2d2] bg-[#f4e6e5]"
            : "border-[#e8ded8] bg-white"
      }`}
    >
      <p className="text-xs font-semibold text-[#887e79]">{label}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
      <p className="mt-2 text-[11px] text-[#9b918c]">{note}</p>
    </div>
  )
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group flex min-h-28 flex-col items-start justify-between rounded-xl border border-[#eadfd9] bg-[#fcfaf8] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#d7adb2] hover:shadow-md"
    >
      <Icon className="h-5 w-5 text-[#b36e78]" />
      <span className="text-xs font-bold text-[#49413d]">{label}</span>
    </button>
  )
}

function TableToolbar({
  query,
  onQuery,
  placeholder,
  children,
}: {
  query: string
  onQuery: (value: string) => void
  placeholder: string
  children?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-[#e7ddd7] bg-[#fcfaf8] px-3.5 py-2.5">
        <Search className="h-4 w-4 text-[#a39994]" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          className="w-full bg-transparent text-sm outline-none placeholder:text-[#aaa09b]"
          placeholder={placeholder}
        />
      </div>
      {children}
    </div>
  )
}

function DataTable({
  headers,
  children,
}: {
  headers: string[]
  children: ReactNode
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead>
          <tr className="border-y border-[#eee5e0]">
            {headers.map((header, index) => (
              <th
                key={`${header}-${index}`}
                className="px-3 py-3 text-[9px] font-bold uppercase tracking-[.13em] text-[#9d938e] first:pl-0 last:pr-0"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f0e8e4] text-xs text-[#5d5551]">
          {children}
        </tbody>
      </table>
    </div>
  )
}

function FilterTabs({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-[#f3ece8] p-1">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-bold transition ${
            value === option
              ? "bg-white text-[#5c4646] shadow-sm"
              : "text-[#918680] hover:text-[#544b47]"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

function Status({ value }: { value: string }) {
  const green = ["Completada", "Activo", "Normal", "Vigente"].includes(value)
  const rose = ["Pendiente", "Programada", "Stock bajo"].includes(value)
  const red = ["Cancelada", "Agotado", "Suspendido", "Vencido", "Finalizada", "Retirado"].includes(value)
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-bold ${
        green
          ? "bg-[#e4eee8] text-[#4d725d]"
          : rose
            ? "bg-[#f3e3e4] text-[#9b5e67]"
            : red
              ? "bg-[#f3dfdd] text-[#a65858]"
              : "bg-[#eee9e5] text-[#756b66]"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {value}
    </span>
  )
}

function Field({ label, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[.14em] text-[#847a75]">
        {label}
      </span>
      {children}
    </label>
  )
}

function Avatar({ name, large = false }: AvatarProps) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-[#ead1d3] font-bold text-[#7e5157] ${
        large ? "h-14 w-14 text-sm" : "h-9 w-9 text-[10px]"
      }`}
    >
      {initials}
    </span>
  )
}

function EmptyState({ title, text }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f2e7e3]">
        <Search className="h-5 w-5 text-[#aa6a73]" />
      </div>
      <p className="font-display text-xl">{title}</p>
      <p className="mt-1 text-xs text-[#968c87]">{text}</p>
    </div>
  )
}

export default App
