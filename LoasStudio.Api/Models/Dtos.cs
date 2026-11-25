namespace LoasStudio.Api.Models;

public record LoginRequest(string Usuario, string Contrasena);

public record ClienteCreate(
    string PrimerNombre, string? SegundoNombre, string PrimerApellido, string? SegundoApellido,
    string Dni, DateTime FechaNacimiento, string Usuario, string Contrasena,
    string Telefono, string? Correo);

public record ClienteUpdate(
    string PrimerNombre, string? SegundoNombre, string PrimerApellido, string? SegundoApellido,
    string Telefono, string? Correo);

public record EmpleadoCreate(
    string PrimerNombre, string? SegundoNombre, string PrimerApellido, string? SegundoApellido,
    string Dni, DateTime FechaNacimiento, string Usuario, string Contrasena,
    string Telefono, string? Correo, decimal Salario, int[]? Servicios, int? IdHorario);

/// <param name="FechaHoraInicio">Ej: "2026-12-07T10:00:00" (hora local, sin zona).</param>
/// <param name="IdCliente">Opcional: cliente al que pertenece la cita (lo usa el personal).</param>
public record CitaCreate(
    DateTime FechaHoraInicio, int DuracionMinutos, int IdEmpleado, int[] Servicios,
    string? Observaciones, int? IdCliente = null);

/// <summary>Cita que agenda un cliente: el cliente sale del token, nunca del cuerpo.</summary>
public record CitaClienteCreate(
    DateTime FechaHoraInicio, int DuracionMinutos, int IdEmpleado, int[] Servicios, string? Observaciones);

public record CitaCancelar(string? Motivo);

public record CitaPromocion(int IdPromocion);

public record CitaFacturar(int IdCliente, int IdEmpleadoCajero, int IdFormaPago, int? IdPromocion);

public record ReponerRequest(
    int IdProducto, int IdProveedor, int Cantidad, decimal PrecioCompra, DateTime? FechaVencimiento);

public record VentaProductoRequest(int IdCliente, int IdEmpleado, int IdProducto, int Cantidad, int IdFormaPago);
