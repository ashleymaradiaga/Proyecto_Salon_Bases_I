using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace LoasStudio.Api.Auth;

/// <summary>Crea los tokens de sesion (JWT) despues de validar el login con sp_ValidarLogin.</summary>
public class TokenService
{
    private readonly IConfiguration _cfg;

    public TokenService(IConfiguration cfg) => _cfg = cfg;

    public static SymmetricSecurityKey KeyFrom(IConfiguration cfg)
    {
        var key = cfg["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(key) || key.Length < 32)
            throw new InvalidOperationException("Jwt:Key en appsettings.json debe tener al menos 32 caracteres.");
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
    }

    public string Create(int idPersona, string nombre, string rol, int? idEmpleado, int? idCliente)
    {
        var claims = new Dictionary<string, object>
        {
            ["sub"] = idPersona.ToString(),
            ["name"] = nombre,
            ["role"] = rol
        };
        if (idEmpleado is not null) claims["idEmpleado"] = idEmpleado.Value.ToString();
        if (idCliente is not null) claims["idCliente"] = idCliente.Value.ToString();

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _cfg["Jwt:Issuer"],
            Audience = _cfg["Jwt:Audience"],
            Claims = claims,
            Expires = DateTime.UtcNow.AddHours(_cfg.GetValue("Jwt:HorasValidez", 8)),
            SigningCredentials = new SigningCredentials(KeyFrom(_cfg), SecurityAlgorithms.HmacSha256)
        };
        return new JsonWebTokenHandler().CreateToken(descriptor);
    }
}

public static class UserExtensions
{
    public static int? IdCliente(this ClaimsPrincipal u)
        => int.TryParse(u.FindFirst("idCliente")?.Value, out var v) ? v : null;

    public static int? IdEmpleado(this ClaimsPrincipal u)
        => int.TryParse(u.FindFirst("idEmpleado")?.Value, out var v) ? v : null;
}
