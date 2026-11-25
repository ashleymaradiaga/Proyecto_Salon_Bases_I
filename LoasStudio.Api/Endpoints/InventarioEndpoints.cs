using System.Data;
using Dapper;
using LoasStudio.Api.Data;
using LoasStudio.Api.Models;

namespace LoasStudio.Api.Endpoints;

public static class InventarioEndpoints
{
    public static void MapInventario(this WebApplication app)
    {
        // Productos con stock real (fn_StockProducto)
        app.MapGet("/api/productos", (Db db) => db.QueryAsync(
            @"SELECT p.idProducto AS IdProducto, p.Nombre, p.Marca, p.PrecioVenta,
                     dbo.fn_StockProducto(p.idProducto) AS Stock
              FROM dbo.Producto AS p ORDER BY p.Nombre")).WithTags("Inventario").RequireAuthorization("Empleado");

        var g = app.MapGroup("/api/inventario").WithTags("Inventario").RequireAuthorization("Empleado");

        // Inventario completo (todos los lotes), con estado y un proveedor por producto
        g.MapGet("/", (Db db) => db.QueryAsync(
            @"SELECT i.idInventario AS IdInventario, pr.idProducto AS IdProducto, pr.Nombre AS Producto,
                     pr.Marca AS Marca, l.NumeroLote AS NumeroLote, i.CantidadDisponible AS CantidadDisponible,
                     i.ExistenciaMinima AS ExistenciaMinima,
                     CASE i.Estado WHEN 1 THEN 'Normal' WHEN 2 THEN 'Stock bajo' WHEN 3 THEN 'Agotado'
                                   WHEN 4 THEN 'Vencido' ELSE 'Desconocido' END AS EstadoInventario,
                     l.FechaVencimiento AS FechaVencimiento,
                     prov.Nombre AS Proveedor
              FROM dbo.Inventario AS i
              INNER JOIN dbo.Lote AS l ON l.idLote = i.Lote_idLote
              INNER JOIN dbo.Producto AS pr ON pr.idProducto = l.Producto_idProducto
              OUTER APPLY (SELECT TOP (1) COALESCE(em.NombreEmpresa, pp.PrimerNombre + ' ' + pp.PrimerApellido) AS Nombre
                           FROM dbo.Proveedor_has_Producto AS php
                           INNER JOIN dbo.Proveedor AS pv ON pv.idProveedor = php.Proveedor_idProveedor
                           LEFT JOIN dbo.Empresa AS em ON em.idEmpresa = pv.Empresa_idEmpresa
                           LEFT JOIN dbo.Persona AS pp ON pp.idPersona = pv.Persona_idPersona
                           WHERE php.Producto_idProducto = pr.idProducto
                           ORDER BY php.FechaEntrega DESC) AS prov
              ORDER BY pr.Nombre, l.idLote"));

        // vw_ProductosStockBajo
        g.MapGet("/stock-bajo", (Db db) => db.QueryAsync(
            "SELECT * FROM dbo.vw_ProductosStockBajo ORDER BY UnidadesFaltantes DESC"));

        // vw_ProductosVencimiento. situacion: "Vencido" | "Por vencer (90 dias)" | "Vigente"
        g.MapGet("/vencimientos", (Db db, string? situacion) => db.QueryAsync(
            @"SELECT * FROM dbo.vw_ProductosVencimiento
              WHERE @situacion IS NULL OR Situacion = @situacion
              ORDER BY DiasParaVencer", new { situacion }));

        // vw_ProveedoresProductos
        g.MapGet("/proveedores-productos", (Db db) => db.QueryAsync(
            "SELECT * FROM dbo.vw_ProveedoresProductos ORDER BY NombreProveedor, Producto"));

        // sp_ReponerInventario
        g.MapPost("/reponer", async (ReponerRequest d, Db db) =>
        {
            var p = new DynamicParameters();
            p.Add("@idProducto", d.IdProducto);
            p.Add("@idProveedor", d.IdProveedor);
            p.Add("@Cantidad", d.Cantidad);
            p.Add("@PrecioCompra", d.PrecioCompra, DbType.Decimal, precision: 10, scale: 2);
            p.Add("@FechaVencimiento", d.FechaVencimiento, DbType.Date);
            p.Add("@idLote", dbType: DbType.Int32, direction: ParameterDirection.Output);
            await db.ExecAsync("dbo.sp_ReponerInventario", p);
            return Results.Ok(new { idLote = p.Get<int>("@idLote") });
        });

        // sp_RegistrarVentaProducto
        app.MapPost("/api/ventas/productos", async (VentaProductoRequest d, Db db) =>
        {
            var p = new DynamicParameters();
            p.Add("@idCliente", d.IdCliente);
            p.Add("@idEmpleado", d.IdEmpleado);
            p.Add("@idProducto", d.IdProducto);
            p.Add("@Cantidad", d.Cantidad);
            p.Add("@idFormaPago", d.IdFormaPago);
            p.Add("@idFactura", dbType: DbType.Int32, direction: ParameterDirection.Output);
            await db.ExecAsync("dbo.sp_RegistrarVentaProducto", p);
            return Results.Ok(new { idFactura = p.Get<int>("@idFactura") });
        }).WithTags("Facturacion").RequireAuthorization("Empleado");

        // vw_FacturasDetalle. tipoVenta: "Servicio" | "Venta de productos"
        app.MapGet("/api/facturas", (Db db, string? tipoVenta) => db.QueryAsync(
            @"SELECT * FROM dbo.vw_FacturasDetalle
              WHERE @tipoVenta IS NULL OR TipoVenta = @tipoVenta
              ORDER BY IdFactura DESC", new { tipoVenta })).WithTags("Facturacion").RequireAuthorization("Empleado");
    }
}
