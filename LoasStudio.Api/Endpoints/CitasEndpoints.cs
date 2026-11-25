using System.Data;
using Dapper;
using LoasStudio.Api.Data;
using LoasStudio.Api.Models;

namespace LoasStudio.Api.Endpoints;

public static class CitasEndpoints
{
    public static void MapCitas(this WebApplication app)
    {
        // Horarios libres: lo usan el personal y los clientes (cualquier sesion valida)
        app.MapGet("/api/citas/horarios-disponibles", (Db db, int idEmpleado, DateTime fecha, int duracionMinutos) =>
                db.ProcAsync("dbo.sp_HorariosDisponibles",
                    new { idEmpleado, Fecha = fecha.Date, DuracionMinutos = duracionMinutos }))
            .WithTags("Citas")
            .RequireAuthorization();

        // El resto de la agenda: solo personal
        var g = app.MapGroup("/api/citas").WithTags("Citas").RequireAuthorization("Empleado");

        // vw_AgendaCitasConCliente. estado: Pendiente | Completada | Cancelada. fecha: yyyy-MM-dd
        g.MapGet("/", (Db db, string? estado, DateTime? fecha) => db.QueryAsync(
            @"SELECT * FROM dbo.vw_AgendaCitasConCliente
              WHERE (@estado IS NULL OR EstadoCita = @estado)
                AND (@fecha IS NULL OR CAST(FechaHoraInicio AS DATE) = CAST(@fecha AS DATE))
              ORDER BY FechaHoraInicio", new { estado, fecha }));

        // sp_AgendarCitaCliente (cliente opcional)
        g.MapPost("/", async (CitaCreate d, Db db) =>
        {
            var p = Shared.AgendarCita(d.IdCliente, d.FechaHoraInicio, d.DuracionMinutos, d.IdEmpleado,
                d.Servicios, d.Observaciones);
            await db.ExecAsync("dbo.sp_AgendarCitaCliente", p);
            return Results.Created("/api/citas", new { idCita = p.Get<int>("@idCita") });
        });

        // sp_CancelarCita
        g.MapPost("/{id:int}/cancelar", async (int id, CitaCancelar? d, Db db) =>
        {
            var p = new DynamicParameters();
            p.Add("@idCita", id);
            p.Add("@Motivo", d?.Motivo);
            await db.ExecAsync("dbo.sp_CancelarCita", p);
            return Results.NoContent();
        });

        // sp_AplicarPromocionACita
        g.MapPost("/{id:int}/promocion", async (int id, CitaPromocion d, Db db) =>
        {
            var p = new DynamicParameters();
            p.Add("@idCita", id);
            p.Add("@idPromocion", d.IdPromocion);
            p.Add("@Descuento", dbType: DbType.Decimal, direction: ParameterDirection.Output, precision: 10, scale: 2);
            await db.ExecAsync("dbo.sp_AplicarPromocionACita", p);
            return Results.Ok(new { descuento = p.Get<decimal>("@Descuento") });
        });

        // sp_CompletarCitaYFacturar
        g.MapPost("/{id:int}/facturar", async (int id, CitaFacturar d, Db db) =>
        {
            var p = new DynamicParameters();
            p.Add("@idCita", id);
            p.Add("@idCliente", d.IdCliente);
            p.Add("@idEmpleadoCajero", d.IdEmpleadoCajero);
            p.Add("@idFormaPago", d.IdFormaPago);
            p.Add("@idPromocion", d.IdPromocion);
            p.Add("@idFactura", dbType: DbType.Int32, direction: ParameterDirection.Output);
            await db.ExecAsync("dbo.sp_CompletarCitaYFacturar", p);
            return Results.Ok(new { idFactura = p.Get<int>("@idFactura") });
        });
    }
}
