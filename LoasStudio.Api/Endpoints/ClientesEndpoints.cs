using System.Data;
using Dapper;
using LoasStudio.Api.Data;
using LoasStudio.Api.Models;

namespace LoasStudio.Api.Endpoints;

public static class ClientesEndpoints
{
    public static void MapClientes(this WebApplication app)
    {
        // Solo personal (rol Empleado)
        var g = app.MapGroup("/api/clientes").WithTags("Clientes").RequireAuthorization("Empleado");

        // vw_ClientesContacto + estado de la cuenta (las bajas logicas aparecen como Inactivo)
        g.MapGet("/", (Db db, string? buscar) => db.QueryAsync(
            @"SELECT v.*, CASE p.Estado WHEN 'A' THEN 'Activo' ELSE 'Inactivo' END AS Estado
              FROM dbo.vw_ClientesContacto AS v
              INNER JOIN dbo.Cliente AS c ON c.idCliente = v.IdCliente
              INNER JOIN dbo.Persona AS p ON p.idPersona = c.Persona_idPersona
              WHERE @buscar IS NULL OR v.NombreCompleto LIKE '%' + @buscar + '%' OR v.DNI LIKE '%' + @buscar + '%'
              ORDER BY v.NombreCompleto", new { buscar }));

        // Datos separados (nombres, apellidos, telefono, correo) para el formulario de edicion
        g.MapGet("/{id:int}/detalle", async (int id, Db db) =>
        {
            var rows = await db.QueryAsync(Shared.ClienteDetalleSql, new { id });
            return rows.Count == 0 ? Results.NotFound(new { error = "El cliente no existe." }) : Results.Ok(rows[0]);
        });

        // sp_HistorialCliente (2 tablas: ficha + facturas)
        g.MapGet("/{id:int}/historial", async (int id, Db db) =>
        {
            var sets = await db.ProcMultiAsync("dbo.sp_HistorialCliente", new { idCliente = id }, 2);
            return Results.Ok(new { cliente = sets[0].FirstOrDefault(), facturas = sets[1] });
        });

        // sp_RegistrarCliente (alta hecha por el personal)
        g.MapPost("/", async (ClienteCreate d, Db db) =>
        {
            var p = Shared.RegistroCliente(d);
            await db.ExecAsync("dbo.sp_RegistrarCliente", p);
            var id = p.Get<int>("@idCliente");
            return Results.Created($"/api/clientes/{id}/historial", new { idCliente = id });
        });

        // sp_ActualizarCliente
        g.MapPut("/{id:int}", async (int id, ClienteUpdate d, Db db) =>
        {
            await db.ExecAsync("dbo.sp_ActualizarCliente", Shared.ActualizarCliente(id, d));
            return Results.NoContent();
        });

        // sp_EliminarCliente  ->  DELETE /api/clientes/5?confirmar=true
        g.MapDelete("/{id:int}", async (int id, bool? confirmar, Db db) =>
        {
            var p = new DynamicParameters();
            p.Add("@idCliente", id);
            p.Add("@Confirmar", confirmar ?? false);
            p.Add("@Resultado", dbType: DbType.AnsiString, size: 200, direction: ParameterDirection.Output);
            await db.ExecAsync("dbo.sp_EliminarCliente", p);
            return Results.Ok(new { resultado = p.Get<string>("@Resultado") });
        });
    }
}
