using LoasStudio.Api.Data;

namespace LoasStudio.Api.Endpoints;

public static class ReportesEndpoints
{
    public static void MapReportes(this WebApplication app)
    {
        var g = app.MapGroup("/api/reportes").WithTags("Reportes").RequireAuthorization("Empleado");

        // sp_ReporteVentas (3 tablas)  ->  /api/reportes/ventas?desde=2026-11-01&hasta=2026-11-30
        g.MapGet("/ventas", async (Db db, DateTime desde, DateTime hasta) =>
        {
            var s = await db.ProcMultiAsync("dbo.sp_ReporteVentas",
                new { Desde = desde.Date, Hasta = hasta.Date }, 3);
            return Results.Ok(new
            {
                ingresosPorServicio = s[0],
                porFormaPago = s[1],
                resumen = s[2].FirstOrDefault()
            });
        });

        // vw_IngresosPorMes
        g.MapGet("/ingresos-por-mes", (Db db) => db.QueryAsync(
            "SELECT * FROM dbo.vw_IngresosPorMes ORDER BY Periodo"));
    }
}
