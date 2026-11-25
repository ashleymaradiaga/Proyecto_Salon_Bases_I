# LoasStudio.Api

API ASP.NET Core (.NET 10) + Dapper para la base **Salon** (SQL Server `JAVIER`, autenticacion de Windows).

## Orden para ponerla a andar
1. En SSMS, con la base **Salon**, ejecuta `Scripts/04_portal_cliente.sql` (una vez; es repetible).
2. SDK de .NET 10 instalado.
3. En esta carpeta:
       dotnet restore
       dotnet run
4. Swagger: http://localhost:5080/swagger (los endpoints protegidos se prueban con `LoasStudio.Api.http`
   y la extension REST Client, porque necesitan el token del login).

## Seguridad
- Login: `POST /api/auth/login` devuelve un token (JWT, 8 h). El rol (Empleado/Cliente) sale de la base.
- **Cambia `Jwt:Key` en appsettings.json** por una clave larga y secreta antes de usarla fuera de tu PC.
- Registro publico: `POST /api/auth/registro` SIEMPRE crea un cliente.
- Crear empleados: `POST /api/empleados`, solo con sesion de empleado activo (lo valida tambien el SP).
- Portal del cliente: `/api/mi/*`. El id del cliente sale del token, nunca del cuerpo de la peticion.
- Todo lo demas (clientes, agenda completa, inventario, facturas, reportes, empleados) exige rol Empleado.
