using System.Data;
using Dapper;
using LoasStudio.Api.Models;

namespace LoasStudio.Api.Endpoints;

/// <summary>Consultas y parametros que usan varios endpoints.</summary>
public static class Shared
{
    public const string ClienteDetalleSql = @"
        SELECT c.idCliente AS IdCliente, p.PrimerNombre, p.SegundoNombre, p.PrimerApellido, p.SegundoApellido,
               p.DNI, p.FechaNacimiento, c.FechaRegistro,
               (SELECT TOP (1) ct.NumeroCelular FROM dbo.Contacto AS ct
                WHERE ct.Persona_idPersona = p.idPersona AND ct.TipoContacto = 'T' AND ct.Estado = 1
                ORDER BY ct.idContacto) AS Telefono,
               (SELECT TOP (1) ct.Correo FROM dbo.Contacto AS ct
                WHERE ct.Persona_idPersona = p.idPersona AND ct.TipoContacto = 'C' AND ct.Estado = 1
                ORDER BY ct.idContacto) AS Correo
        FROM dbo.Cliente AS c
        INNER JOIN dbo.Persona AS p ON p.idPersona = c.Persona_idPersona
        WHERE c.idCliente = @id";

    public static DynamicParameters RegistroCliente(ClienteCreate d)
    {
        var p = new DynamicParameters();
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
        p.Add("@idCliente", dbType: DbType.Int32, direction: ParameterDirection.Output);
        return p;
    }

    public static DynamicParameters ActualizarCliente(int id, ClienteUpdate d)
    {
        var p = new DynamicParameters();
        p.Add("@idCliente", id);
        p.Add("@PrimerNombre", d.PrimerNombre);
        p.Add("@SegundoNombre", d.SegundoNombre);
        p.Add("@PrimerApellido", d.PrimerApellido);
        p.Add("@SegundoApellido", d.SegundoApellido);
        p.Add("@Telefono", d.Telefono);
        p.Add("@Correo", d.Correo);
        return p;
    }

    public static DynamicParameters AgendarCita(
        int? idCliente, DateTime inicio, int duracion, int idEmpleado, int[]? servicios, string? observaciones)
    {
        var p = new DynamicParameters();
        p.Add("@idCliente", idCliente);
        p.Add("@FechaHoraInicio", inicio, DbType.DateTime);
        p.Add("@DuracionMinutos", duracion);
        p.Add("@idEmpleado", idEmpleado);
        p.Add("@ListaServicios", string.Join(",", servicios ?? Array.Empty<int>()));
        p.Add("@Observaciones", observaciones);
        p.Add("@idCita", dbType: DbType.Int32, direction: ParameterDirection.Output);
        return p;
    }
}
