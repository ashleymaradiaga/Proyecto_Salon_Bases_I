using System.Text.Json;
using LoasStudio.Api.Auth;
using LoasStudio.Api.Data;
using LoasStudio.Api.Endpoints;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<Db>();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// JSON en camelCase (idCliente, nombreCompleto...) tambien para las filas que vienen de SQL
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    o.SerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
});

// Sesion con JWT. El rol viaja firmado dentro del token y se valida en CADA peticion.
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = TokenService.KeyFrom(builder.Configuration),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            RoleClaimType = "role",
            NameClaimType = "name"
        };
    });

builder.Services.AddAuthorization(o =>
{
    o.AddPolicy("Empleado", p => p.RequireRole("Empleado"));
    o.AddPolicy("Cliente", p => p.RequireRole("Cliente"));
});

// CORS: permite al front (Vite en localhost / 127.0.0.1, cualquier puerto)
builder.Services.AddCors(o => o.AddPolicy("front", p => p
    .SetIsOriginAllowed(origin => new Uri(origin).IsLoopback)
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors("front");

// Errores de SQL -> JSON. Los THROW 50001+ de tus procedimientos llegan al front como 400 con su mensaje.
app.Use(async (ctx, next) =>
{
    try
    {
        await next();
    }
    catch (SqlException ex) when (ex.Number is >= 50000 and < 60000)
    {
        ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
        await ctx.Response.WriteAsJsonAsync(new { error = ex.Message, codigo = ex.Number });
    }
    catch (SqlException ex)
    {
        app.Logger.LogError(ex, "Error de SQL Server");
        ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await ctx.Response.WriteAsJsonAsync(new
        {
            error = app.Environment.IsDevelopment() ? ex.Message : "Error de base de datos.",
            codigo = ex.Number
        });
    }
});

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();

app.MapAuth();
app.MapClientes();
app.MapCitas();
app.MapInventario();
app.MapCatalogo();
app.MapMi();
app.MapReportes();

app.Run();
