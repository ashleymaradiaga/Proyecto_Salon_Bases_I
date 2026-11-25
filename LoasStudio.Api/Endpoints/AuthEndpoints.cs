using Dapper;
using LoasStudio.Api.Auth;
using LoasStudio.Api.Data;
using LoasStudio.Api.Models;

namespace LoasStudio.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuth(this WebApplication app)
    {
        var g = app.MapGroup("/api/auth").WithTags("Auth");

        // sp_ValidarLogin  ->  devuelve el token con el rol (Empleado o Cliente)
        g.MapPost("/login", async (LoginRequest req, Db db, TokenService tokens) =>
        {
            var row = await db.ProcFirstAsync("dbo.sp_ValidarLogin",
                new { Usuario = req.Usuario, Contrasena = req.Contrasena });

            if (row is null || row["Autenticado"] is not true)
                return Results.Json(new { error = "Usuario o contraseña incorrectos." }, statusCode: 401);

            var rol = Convert.ToString(row["Rol"]) ?? "";
            if (rol != "Empleado" && rol != "Cliente")
                return Results.Json(new { error = "Esta cuenta no tiene acceso al sistema." }, statusCode: 403);

            var idPersona = Convert.ToInt32(row["IdPersona"]);
            var nombre = Convert.ToString(row["NombreCompleto"]) ?? "";
            int? idEmpleado = row["IdEmpleado"] is null ? null : Convert.ToInt32(row["IdEmpleado"]);
            int? idCliente = row["IdCliente"] is null ? null : Convert.ToInt32(row["IdCliente"]);

            // El rol sale de la base, nunca del cliente. Cada rol debe tener su id.
            if ((rol == "Empleado" && idEmpleado is null) || (rol == "Cliente" && idCliente is null))
                return Results.Json(new { error = "La cuenta no está completa. Contacta al estudio." }, statusCode: 403);

            var token = tokens.Create(idPersona, nombre, rol, idEmpleado, idCliente);
            return Results.Ok(new { token, idPersona, nombreCompleto = nombre, rol, idEmpleado, idCliente });
        });

        // Registro PUBLICO: siempre crea un CLIENTE (sp_RegistrarCliente fija TipoUsuario = 'C').
        // Aqui no existe forma de pedir otro rol.
        g.MapPost("/registro", async (ClienteCreate d, Db db) =>
        {
            var p = Shared.RegistroCliente(d);
            await db.ExecAsync("dbo.sp_RegistrarCliente", p);
            return Results.Created("/api/mi/perfil", new { idCliente = p.Get<int>("@idCliente") });
        });
    }
}
