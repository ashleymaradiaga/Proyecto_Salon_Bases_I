using LoasStudio.Api.Auth;
using LoasStudio.Api.Data;
using LoasStudio.Api.Models;

namespace LoasStudio.Api.Endpoints;

/// <summary>
/// Portal del cliente. TODO sale del token: el idCliente nunca se recibe del front,
/// asi un cliente no puede ver ni tocar datos de otro.
/// </summary>
public static class MiEndpoints
{
    public static void MapMi(this WebApplication app)
    {
        var g = app.MapGroup("/api/mi").WithTags("Portal cliente").RequireAuthorization("Cliente");

        g.MapGet("/perfil", async (HttpContext ctx, Db db) =>
        {
            var id = ctx.User.IdCliente();
            if (id is null) return Results.Forbid();
            var rows = await db.QueryAsync(Shared.ClienteDetalleSql, new { id });
            return rows.Count == 0 ? Results.NotFound() : Results.Ok(rows[0]);
        });

        // sp_ActualizarCliente (solo nombre, telefono y correo)
        g.MapPut("/perfil", async (ClienteUpdate d, HttpContext ctx, Db db) =>
        {
            var id = ctx.User.IdCliente();
            if (id is null) return Results.Forbid();
            await db.ExecAsync("dbo.sp_ActualizarCliente", Shared.ActualizarCliente(id.Value, d));
            return Results.NoContent();
        });

        // sp_HistorialCliente: ficha + facturas
        g.MapGet("/historial", async (HttpContext ctx, Db db) =>
        {
            var id = ctx.User.IdCliente();
            if (id is null) return Results.Forbid();
            var sets = await db.ProcMultiAsync("dbo.sp_HistorialCliente", new { idCliente = id.Value }, 2);
            return Results.Ok(new { cliente = sets[0].FirstOrDefault(), facturas = sets[1] });
        });

        // Mis citas (vw_AgendaCitasConCliente filtrada por mi cliente)
        g.MapGet("/citas", async (HttpContext ctx, Db db) =>
        {
            var id = ctx.User.IdCliente();
            if (id is null) return Results.Forbid();
            return Results.Ok(await db.QueryAsync(
                @"SELECT * FROM dbo.vw_AgendaCitasConCliente WHERE IdCliente = @id ORDER BY FechaHoraInicio DESC",
                new { id = id.Value }));
        });

        // sp_AgendarCitaCliente con MI cliente
        g.MapPost("/citas", async (CitaClienteCreate d, HttpContext ctx, Db db) =>
        {
            var id = ctx.User.IdCliente();
            if (id is null) return Results.Forbid();
            var p = Shared.AgendarCita(id.Value, d.FechaHoraInicio, d.DuracionMinutos, d.IdEmpleado,
                d.Servicios, d.Observaciones);
            await db.ExecAsync("dbo.sp_AgendarCitaCliente", p);
            return Results.Created("/api/mi/citas", new { idCita = p.Get<int>("@idCita") });
        });

        // sp_CancelarCitaCliente: valida en la base que la cita sea mia
        g.MapPost("/citas/{idCita:int}/cancelar", async (int idCita, CitaCancelar? d, HttpContext ctx, Db db) =>
        {
            var id = ctx.User.IdCliente();
            if (id is null) return Results.Forbid();
            await db.ProcAsync("dbo.sp_CancelarCitaCliente",
                new { idCita, idCliente = id.Value, Motivo = d?.Motivo });
            return Results.NoContent();
        });

        // fn_NotificacionesCliente (derivadas de mis citas, facturas y promociones)
        g.MapGet("/notificaciones", async (HttpContext ctx, Db db) =>
        {
            var id = ctx.User.IdCliente();
            if (id is null) return Results.Forbid();
            return Results.Ok(await db.QueryAsync(
                "SELECT * FROM dbo.fn_NotificacionesCliente(@id) ORDER BY Fecha DESC", new { id = id.Value }));
        });
    }
}
