using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;

namespace LoasStudio.Api.Data;

using Row = IDictionary<string, object?>;

/// <summary>Acceso a SQL Server. Ejecuta vistas, funciones y procedimientos almacenados con Dapper.</summary>
public class Db
{
    private readonly string _cs;

    public Db(IConfiguration config)
    {
        _cs = config.GetConnectionString("Salon")
              ?? throw new InvalidOperationException("Falta ConnectionStrings:Salon en appsettings.json");
    }

    private SqlConnection Create() => new(_cs);

    /// <summary>SELECT normal (vistas, tablas, funciones).</summary>
    public async Task<List<Row>> QueryAsync(string sql, object? param = null)
    {
        await using var c = Create();
        return ToList(await c.QueryAsync(sql, param));
    }

    /// <summary>Procedimiento que devuelve filas.</summary>
    public async Task<List<Row>> ProcAsync(string proc, object? param = null)
    {
        await using var c = Create();
        return ToList(await c.QueryAsync(proc, param, commandType: CommandType.StoredProcedure));
    }

    public async Task<Row?> ProcFirstAsync(string proc, object? param = null)
        => (await ProcAsync(proc, param)).FirstOrDefault();

    /// <summary>Procedimiento que devuelve varias tablas (ej. sp_ReporteVentas devuelve 3).</summary>
    public async Task<List<List<Row>>> ProcMultiAsync(string proc, object? param, int sets)
    {
        await using var c = Create();
        using var grid = await c.QueryMultipleAsync(proc, param, commandType: CommandType.StoredProcedure);
        var result = new List<List<Row>>();
        for (var i = 0; i < sets; i++) result.Add(ToList(await grid.ReadAsync()));
        return result;
    }

    /// <summary>Procedimiento con parametros OUTPUT. Lee los valores con p.Get&lt;T&gt;("@nombre").</summary>
    public async Task ExecAsync(string proc, DynamicParameters p)
    {
        await using var c = Create();
        await c.ExecuteAsync(proc, p, commandType: CommandType.StoredProcedure);
    }

    private static List<Row> ToList(IEnumerable<dynamic> rows)
    {
        var list = new List<Row>();
        foreach (Row r in rows) list.Add(r);
        return list;
    }
}
