using System.Data;
using Dapper;
using LoasStudio.Api.Auth;
using LoasStudio.Api.Data;
using LoasStudio.Api.Models;

namespace LoasStudio.Api.Endpoints;

public static class CatalogoEndpoints
{
    public static void MapCatalogo(this WebApplication app)
    {
        // ---- Visibles para cualquier sesion (clientes y personal): solo datos publicos ----
        var abierto = app.MapGroup("/api").WithTags("Catalogo").RequireAuthorization();

        abierto.MapGet("/servicios", (Db db) => db.QueryAsync(
            @"SELECT idServicios AS IdServicio, NombreServicio, Descripcion, Precio, DuracionMinutos
              FROM dbo.Servicios WHERE Estado = 1 ORDER BY NombreServicio"));

        // Especialistas activos que realizan un servicio (solo nombre, sin salario ni DNI)
        abierto.MapGet("/servicios/{id:int}/empleados", (int id, Db db) => db.QueryAsync(
            @"SELECT e.idEmpleado AS IdEmpleado,
                     p.PrimerNombre + ' ' + p.PrimerApellido AS NombreCompleto
              FROM dbo.Servicios_has_Empleado AS se
              INNER JOIN dbo.Empleado AS e ON e.idEmpleado = se.Empleado_idEmpleado AND e.Estado = 'A'
              INNER JOIN dbo.Persona AS p ON p.idPersona = e.Persona_idPersona
              WHERE se.Servicios_idServicios = @id
              ORDER BY p.PrimerNombre", new { id }));

        // ---- Solo personal ----
        var g = app.MapGroup("/api").WithTags("Catalogo").RequireAuthorization("Empleado");

        // vw_EmpleadosDetalle (incluye salario y DNI: por eso es solo personal)
        g.MapGet("/empleados", (Db db, bool? soloActivos) => db.QueryAsync(
            @"SELECT * FROM dbo.vw_EmpleadosDetalle
              WHERE ISNULL(@soloActivos, 0) = 0 OR EstadoEmpleado = 'Activo'
              ORDER BY NombreCompleto", new { soloActivos }));

        // sp_RegistrarEmpleado: solo un empleado activo (el del token) puede crear otro
        g.MapPost("/empleados", async (EmpleadoCreate d, Db db, HttpContext ctx) =>
        {
            var solicitante = ctx.User.IdEmpleado();
            if (solicitante is null) return Results.Forbid();

            var p = new DynamicParameters();
            p.Add("@idEmpleadoSolicitante", solicitante.Value);
            p.Add("@PrimerNombre", d.PrimerNombre);
            p.Add("@SegundoNombre", d.SegundoNombre);
            p.Add("@PrimerApellido", d.PrimerApellido);
            p.Add("@SegundoApellido", d.SegundoApellido);
            p.Add("@DNI", d.Dni);
            p.Add("@FechaNacimiento", d.FechaNacimiento, DbType.Date);
            p.Add("@Usuario", d.Usuario);
            p.Add("@Contrasena", d.Contrasena);
            p.Add("@Telefono", d.Telefono);
            p.Add("@Correo", d.Correo);
            p.Add("@Salario", d.Salario, DbType.Decimal, precision: 10, scale: 2);
            p.Add("@ListaServicios", string.Join(",", d.Servicios ?? Array.Empty<int>()));
            p.Add("@idHorario", d.IdHorario);
            p.Add("@idEmpleado", dbType: DbType.Int32, direction: ParameterDirection.Output);
            await db.ExecAsync("dbo.sp_RegistrarEmpleado", p);
            return Results.Created("/api/empleados", new { idEmpleado = p.Get<int>("@idEmpleado") });
        });

        // Horarios disponibles para asignar a un empleado nuevo
        g.MapGet("/horarios", (Db db) => db.QueryAsync(
            @"SELECT idHorarios AS IdHorario, DiaSemana, CONVERT(VARCHAR(5), HoraInicio, 108) AS HoraInicio,
                     CONVERT(VARCHAR(5), HoraFin, 108) AS HoraFin
              FROM dbo.Horarios WHERE Estado = 1 ORDER BY idHorarios"));

        // Servicios que realiza un empleado
        g.MapGet("/empleados/{id:int}/servicios", (int id, Db db) => db.QueryAsync(
            @"SELECT s.idServicios AS IdServicio, s.NombreServicio, s.Descripcion, s.Precio, s.DuracionMinutos
              FROM dbo.Servicios_has_Empleado AS se
              INNER JOIN dbo.Servicios AS s ON s.idServicios = se.Servicios_idServicios
              WHERE se.Empleado_idEmpleado = @id AND s.Estado = 1
              ORDER BY s.NombreServicio", new { id }));

        // vw_ServiciosMasVendidos
        g.MapGet("/servicios/mas-vendidos", (Db db) => db.QueryAsync(
            "SELECT * FROM dbo.vw_ServiciosMasVendidos ORDER BY Posicion"));

        // vw_PaquetesDetalle
        g.MapGet("/paquetes", (Db db) => db.QueryAsync(
            "SELECT * FROM dbo.vw_PaquetesDetalle ORDER BY Ahorro DESC"));

        // vw_PromocionesVigentes
        g.MapGet("/promociones", (Db db, bool? soloVigentes) => db.QueryAsync(
            @"SELECT * FROM dbo.vw_PromocionesVigentes
              WHERE ISNULL(@soloVigentes, 0) = 0 OR (Situacion = 'Vigente' AND Activa = 'Si')
              ORDER BY FechaInicio DESC", new { soloVigentes }));

        g.MapGet("/formas-pago", (Db db) => db.QueryAsync(
            @"SELECT idFormaDePago AS IdFormaPago, NombreFormaPago
              FROM dbo.FormaDePago WHERE Estado = 1 ORDER BY NombreFormaPago"));

        g.MapGet("/proveedores", (Db db) => db.QueryAsync(
            @"SELECT pv.idProveedor AS IdProveedor,
                     COALESCE(em.NombreEmpresa, pp.PrimerNombre + ' ' + pp.PrimerApellido) AS Nombre,
                     pv.RTN AS RTN
              FROM dbo.Proveedor AS pv
              LEFT JOIN dbo.Empresa AS em ON em.idEmpresa = pv.Empresa_idEmpresa
              LEFT JOIN dbo.Persona AS pp ON pp.idPersona = pv.Persona_idPersona
              WHERE pv.Estado = 1 OR pv.Estado IS NULL
              ORDER BY Nombre"));

        // Notificaciones del personal (derivadas de las tablas, vw_NotificacionesEmpleado)
        g.MapGet("/notificaciones", (Db db) => db.QueryAsync(
            "SELECT * FROM dbo.vw_NotificacionesEmpleado ORDER BY Fecha DESC"));
    }
}
