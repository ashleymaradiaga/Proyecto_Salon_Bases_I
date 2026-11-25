/* =====================================================================
   CAMBIOS PARA EL PORTAL DE CLIENTES Y LA CREACION DE EMPLEADOS
   Base: Salon (SQL Server 2017 o superior)

   EJECUTAR: SSMS > File > Open > File..., elegir este archivo, F5.
   Es repetible (se puede correr varias veces).

   QUE HACE
   1) Cita.Cliente_idCliente (nullable)   -> permite saber de quien es cada cita
   2) Servicios.DuracionMinutos (def. 60)  -> duracion de cada servicio.
      AJUSTA los valores reales con:  UPDATE dbo.Servicios SET DuracionMinutos = 45 WHERE idServicios = 3;
   3) vw_AgendaCitasConCliente             -> vw_AgendaCitas + cliente
   4) fn_NotificacionesCliente / vw_NotificacionesEmpleado
                                           -> notificaciones DERIVADAS de las tablas existentes (no hay tabla nueva)
   5) sp_AgendarCitaCliente                -> agenda (con cliente opcional) usando sp_AgendarCita
   6) sp_CancelarCitaCliente               -> el cliente cancela SOLO sus citas pendientes y futuras
   7) sp_RegistrarEmpleado                 -> solo un empleado activo puede crear otro empleado

   ERRORES NUEVOS: 50200-50203, 50210-50213, 50300-50309
   ===================================================================== */
USE Salon;
GO

/* ---------- 1) Cita.Cliente_idCliente ---------- */
IF COL_LENGTH('dbo.Cita', 'Cliente_idCliente') IS NULL
BEGIN
    ALTER TABLE dbo.Cita ADD Cliente_idCliente INT NULL;
    EXEC('ALTER TABLE dbo.Cita ADD CONSTRAINT fk_Cita_Cliente FOREIGN KEY (Cliente_idCliente) REFERENCES dbo.Cliente (idCliente)');
    EXEC('CREATE INDEX fk_Cita_Cliente_idx ON dbo.Cita (Cliente_idCliente)');
END;
GO

/* ---------- 2) Servicios.DuracionMinutos ---------- */
IF COL_LENGTH('dbo.Servicios', 'DuracionMinutos') IS NULL
    ALTER TABLE dbo.Servicios ADD DuracionMinutos INT NOT NULL CONSTRAINT DF_Servicios_DuracionMinutos DEFAULT (60);
GO

/* ---------- 3) vw_AgendaCitasConCliente ---------- */
IF OBJECT_ID('dbo.vw_AgendaCitasConCliente', 'V') IS NOT NULL DROP VIEW dbo.vw_AgendaCitasConCliente;
GO
CREATE VIEW dbo.vw_AgendaCitasConCliente
AS
SELECT
    a.*,
    ci.Cliente_idCliente AS IdCliente,
    p.PrimerNombre + ' ' + p.PrimerApellido AS Cliente
FROM dbo.vw_AgendaCitas AS a
INNER JOIN dbo.Cita AS ci ON ci.idCita = a.IdCita
LEFT JOIN dbo.Cliente AS cl ON cl.idCliente = ci.Cliente_idCliente
LEFT JOIN dbo.Persona AS p ON p.idPersona = cl.Persona_idPersona;
GO

/* ---------- 4a) fn_NotificacionesCliente ----------
   Notificaciones de un cliente, calculadas de sus citas, sus facturas y las
   promociones vigentes. No guarda nada: se calcula cada vez que se consulta.
   Los textos en espanol los arma el front a partir de Tipo y los datos.
   Tipos: cita_programada, cita_recordatorio (24 h), cita_completada,
          cita_cancelada, cita_sin_cerrar, promocion_vigente              */
IF OBJECT_ID('dbo.fn_NotificacionesCliente') IS NOT NULL DROP FUNCTION dbo.fn_NotificacionesCliente;
GO
CREATE FUNCTION dbo.fn_NotificacionesCliente (@idCliente INT)
RETURNS TABLE
AS
RETURN
(
    SELECT
        CAST('cita-' + CAST(ci.idCita AS VARCHAR(10)) + '-' + ci.EstadoCita
             + CASE WHEN f.idFactura IS NOT NULL THEN '-f' ELSE '' END AS VARCHAR(80)) AS Id,
        CAST(CASE
                WHEN ci.EstadoCita = 'X' THEN 'cita_cancelada'
                WHEN ci.EstadoCita = 'C' THEN 'cita_completada'
                WHEN ci.FechaHoraInicio < GETDATE() THEN 'cita_sin_cerrar'
                WHEN ci.FechaHoraInicio < DATEADD(HOUR, 24, GETDATE()) THEN 'cita_recordatorio'
                ELSE 'cita_programada'
             END AS VARCHAR(30)) AS Tipo,
        ci.idCita AS IdRef,
        ci.FechaHoraInicio AS Fecha,
        CAST(NULL AS DATETIME) AS FechaFin,
        CAST((SELECT STRING_AGG(s.NombreServicio, ', ')
              FROM dbo.Cita_has_Servicios AS cs
              INNER JOIN dbo.Servicios AS s ON s.idServicios = cs.Servicios_idServicios
              WHERE cs.Cita_idCita = ci.idCita) AS VARCHAR(300)) AS Detalle,
        CAST(f.Total AS DECIMAL(10,2)) AS Monto,
        f.idFactura AS IdFactura,
        CAST(NULL AS INT) AS Cantidad,
        CAST(NULL AS INT) AS Minimo,
        CAST(NULL AS INT) AS Dias
    FROM dbo.Cita AS ci
    LEFT JOIN dbo.Factura AS f ON f.Cita_idCita = ci.idCita
    WHERE ci.Cliente_idCliente = @idCliente

    UNION ALL

    SELECT
        CAST('promo-' + CAST(pm.idPromociones AS VARCHAR(10)) AS VARCHAR(80)),
        CAST('promocion_vigente' AS VARCHAR(30)),
        pm.idPromociones,
        pm.FechaInicio,
        pm.FechaFin,
        CAST(pm.NombrePromocion AS VARCHAR(300)),
        CAST(NULL AS DECIMAL(10,2)),
        CAST(NULL AS INT),
        CAST(NULL AS INT),
        CAST(NULL AS INT),
        CAST(NULL AS INT)
    FROM dbo.Promociones AS pm
    WHERE pm.Estado = 1 AND GETDATE() >= pm.FechaInicio AND GETDATE() <= pm.FechaFin
);
GO

/* ---------- 4b) vw_NotificacionesEmpleado ----------
   Avisos para el personal: stock bajo/agotado, lotes vencidos o por vencer,
   citas pendientes de hoy, citas pasadas sin cobrar y promociones que terminan en 7 dias.
   Tipos: stock_agotado, stock_bajo, lote_vencido, lote_por_vencer, cita_hoy,
          cobro_pendiente, promo_vence                                        */
IF OBJECT_ID('dbo.vw_NotificacionesEmpleado', 'V') IS NOT NULL DROP VIEW dbo.vw_NotificacionesEmpleado;
GO
CREATE VIEW dbo.vw_NotificacionesEmpleado
AS
SELECT
    CAST('stock-' + CAST(i.idInventario AS VARCHAR(10)) + '-' + CAST(i.Estado AS VARCHAR(3)) AS VARCHAR(80)) AS Id,
    CAST(CASE WHEN i.CantidadDisponible = 0 THEN 'stock_agotado' ELSE 'stock_bajo' END AS VARCHAR(30)) AS Tipo,
    pr.idProducto AS IdRef,
    CAST(i.FechaActualizacion AS DATETIME) AS Fecha,
    CAST(NULL AS DATETIME) AS FechaFin,
    CAST(pr.Nombre AS VARCHAR(300)) AS Detalle,
    CAST(NULL AS DECIMAL(10,2)) AS Monto,
    CAST(NULL AS INT) AS IdFactura,
    i.CantidadDisponible AS Cantidad,
    i.ExistenciaMinima AS Minimo,
    CAST(NULL AS INT) AS Dias
FROM dbo.Inventario AS i
INNER JOIN dbo.Lote AS l ON l.idLote = i.Lote_idLote
INNER JOIN dbo.Producto AS pr ON pr.idProducto = l.Producto_idProducto
WHERE i.CantidadDisponible <= i.ExistenciaMinima

UNION ALL

SELECT
    CAST('venc-' + CAST(v.IdLote AS VARCHAR(10)) + '-' + LEFT(v.Situacion, 1) AS VARCHAR(80)),
    CAST(CASE WHEN v.Situacion = 'Vencido' THEN 'lote_vencido' ELSE 'lote_por_vencer' END AS VARCHAR(30)),
    v.IdLote,
    CAST(v.FechaVencimiento AS DATETIME),
    CAST(NULL AS DATETIME),
    CAST(v.Producto AS VARCHAR(300)),
    CAST(NULL AS DECIMAL(10,2)),
    CAST(NULL AS INT),
    v.CantidadDisponible,
    CAST(NULL AS INT),
    v.DiasParaVencer
FROM dbo.vw_ProductosVencimiento AS v
WHERE v.Situacion <> 'Vigente' AND ISNULL(v.CantidadDisponible, 0) > 0

UNION ALL

SELECT
    CAST('hoy-' + CAST(ci.idCita AS VARCHAR(10)) AS VARCHAR(80)),
    CAST('cita_hoy' AS VARCHAR(30)),
    ci.idCita,
    ci.FechaHoraInicio,
    CAST(NULL AS DATETIME),
    CAST((SELECT STRING_AGG(s.NombreServicio, ', ')
          FROM dbo.Cita_has_Servicios AS cs
          INNER JOIN dbo.Servicios AS s ON s.idServicios = cs.Servicios_idServicios
          WHERE cs.Cita_idCita = ci.idCita) AS VARCHAR(300)),
    CAST(NULL AS DECIMAL(10,2)),
    CAST(NULL AS INT),
    CAST(NULL AS INT),
    CAST(NULL AS INT),
    CAST(NULL AS INT)
FROM dbo.Cita AS ci
WHERE ci.EstadoCita = 'P'
  AND CAST(ci.FechaHoraInicio AS DATE) = CAST(GETDATE() AS DATE)
  AND ci.FechaHoraInicio >= GETDATE()

UNION ALL

SELECT
    CAST('cobro-' + CAST(ci.idCita AS VARCHAR(10)) AS VARCHAR(80)),
    CAST('cobro_pendiente' AS VARCHAR(30)),
    ci.idCita,
    ci.FechaHoraInicio,
    CAST(NULL AS DATETIME),
    CAST((SELECT STRING_AGG(s.NombreServicio, ', ')
          FROM dbo.Cita_has_Servicios AS cs
          INNER JOIN dbo.Servicios AS s ON s.idServicios = cs.Servicios_idServicios
          WHERE cs.Cita_idCita = ci.idCita) AS VARCHAR(300)),
    dbo.fn_TotalCita(ci.idCita),
    CAST(NULL AS INT),
    CAST(NULL AS INT),
    CAST(NULL AS INT),
    CAST(NULL AS INT)
FROM dbo.Cita AS ci
WHERE ci.EstadoCita = 'P' AND ci.FechaHoraInicio < GETDATE()

UNION ALL

SELECT
    CAST('promo-fin-' + CAST(pm.idPromociones AS VARCHAR(10)) AS VARCHAR(80)),
    CAST('promo_vence' AS VARCHAR(30)),
    pm.idPromociones,
    pm.FechaInicio,
    pm.FechaFin,
    CAST(pm.NombrePromocion AS VARCHAR(300)),
    CAST(NULL AS DECIMAL(10,2)),
    CAST(NULL AS INT),
    CAST(NULL AS INT),
    CAST(NULL AS INT),
    DATEDIFF(DAY, CAST(GETDATE() AS DATE), pm.FechaFin)
FROM dbo.Promociones AS pm
WHERE pm.Estado = 1 AND GETDATE() >= pm.FechaInicio AND pm.FechaFin >= GETDATE()
  AND pm.FechaFin < DATEADD(DAY, 7, GETDATE());
GO

/* ---------- 5) sp_AgendarCitaCliente ----------
   Igual que sp_AgendarCita, pero guarda de quien es la cita.
   @idCliente = NULL permite agendar sin cliente (como antes).
   ERRORES: 50200 + los de sp_AgendarCita (50030-50035)                      */
IF OBJECT_ID('dbo.sp_AgendarCitaCliente', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_AgendarCitaCliente;
GO
CREATE PROCEDURE dbo.sp_AgendarCitaCliente
    @idCliente       INT = NULL,
    @FechaHoraInicio DATETIME,
    @DuracionMinutos INT,
    @idEmpleado      INT,
    @ListaServicios  VARCHAR(200),
    @Observaciones   VARCHAR(45) = NULL,
    @idCita          INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @tran BIT = 0;

    BEGIN TRY
        IF @idCliente IS NOT NULL AND NOT EXISTS (SELECT 1
                                                  FROM dbo.Cliente AS c
                                                  INNER JOIN dbo.Persona AS p ON p.idPersona = c.Persona_idPersona
                                                  WHERE c.idCliente = @idCliente AND p.Estado = 'A')
            THROW 50200, 'El cliente no existe o esta inactivo.', 1;

        IF @@TRANCOUNT = 0 BEGIN BEGIN TRANSACTION; SET @tran = 1; END;

        EXEC dbo.sp_AgendarCita
             @FechaHoraInicio = @FechaHoraInicio,
             @DuracionMinutos = @DuracionMinutos,
             @idEmpleado      = @idEmpleado,
             @ListaServicios  = @ListaServicios,
             @Observaciones   = @Observaciones,
             @idCita          = @idCita OUTPUT;

        UPDATE dbo.Cita SET Cliente_idCliente = @idCliente WHERE idCita = @idCita;

        IF @tran = 1 COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @tran = 1 AND @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* ---------- 6) sp_CancelarCitaCliente ----------
   El cliente solo cancela SUS citas, pendientes (lo exige sp_CancelarCita) y que aun no han empezado.
   ERRORES: 50210-50212 + los de sp_CancelarCita (50040, 50041)               */
IF OBJECT_ID('dbo.sp_CancelarCitaCliente', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_CancelarCitaCliente;
GO
CREATE PROCEDURE dbo.sp_CancelarCitaCliente
    @idCita    INT,
    @idCliente INT,
    @Motivo    VARCHAR(30) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @dueno  INT;
    DECLARE @inicio DATETIME;

    SELECT @dueno = c.Cliente_idCliente, @inicio = c.FechaHoraInicio FROM dbo.Cita AS c WHERE c.idCita = @idCita;
    IF @inicio IS NULL
        THROW 50210, 'La cita no existe.', 1;
    IF @dueno IS NULL OR @dueno <> @idCliente
        THROW 50211, 'La cita no pertenece a este cliente.', 1;
    IF @inicio <= GETDATE()
        THROW 50212, 'La cita ya comenzo o ya paso; comunicate con el estudio.', 1;

    EXEC dbo.sp_CancelarCita @idCita = @idCita, @Motivo = @Motivo;
END;
GO

/* ---------- 7) sp_RegistrarEmpleado ----------
   Crea Persona (TipoUsuario 'E') + contactos + Empleado (Estado 'A', contratado hoy),
   y opcionalmente asigna servicios y un horario.
   Solo lo puede ejecutar un empleado ACTIVO (@idEmpleadoSolicitante).
   Contrasena: SHA-256 de (Usuario + Contrasena), igual que sp_RegistrarCliente.
   ERRORES: 50300 a 50309                                                     */
IF OBJECT_ID('dbo.sp_RegistrarEmpleado', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_RegistrarEmpleado;
GO
CREATE PROCEDURE dbo.sp_RegistrarEmpleado
    @idEmpleadoSolicitante INT,
    @PrimerNombre    VARCHAR(45),
    @SegundoNombre   VARCHAR(45) = NULL,
    @PrimerApellido  VARCHAR(45),
    @SegundoApellido VARCHAR(45) = NULL,
    @DNI             VARCHAR(45),
    @FechaNacimiento DATE,
    @Usuario         VARCHAR(100),
    @Contrasena      VARCHAR(100),
    @Telefono        VARCHAR(45),
    @Correo          VARCHAR(45) = NULL,
    @Salario         DECIMAL(10,2),
    @ListaServicios  VARCHAR(200) = NULL,
    @idHorario       INT = NULL,
    @idEmpleado      INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @tran BIT = 0;
    DECLARE @idPersona INT;
    DECLARE @idContacto INT;
    DECLARE @servicios TABLE (idServicio INT PRIMARY KEY);

    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.Empleado AS e WHERE e.idEmpleado = @idEmpleadoSolicitante AND e.Estado = 'A')
            THROW 50300, 'Solo un empleado activo puede crear cuentas de empleado.', 1;
        IF LTRIM(RTRIM(ISNULL(@PrimerNombre, ''))) = '' OR LTRIM(RTRIM(ISNULL(@PrimerApellido, ''))) = ''
            THROW 50301, 'El primer nombre y el primer apellido son obligatorios.', 1;
        IF @FechaNacimiento IS NULL OR @FechaNacimiento >= CAST(GETDATE() AS DATE)
            THROW 50302, 'La fecha de nacimiento no es valida.', 1;
        IF LEN(ISNULL(@Contrasena, '')) < 6
            THROW 50303, 'La contrasena debe tener al menos 6 caracteres.', 1;
        IF LTRIM(RTRIM(ISNULL(@Telefono, ''))) = ''
            THROW 50304, 'El telefono es obligatorio.', 1;
        IF ISNULL(@Salario, 0) <= 0
            THROW 50305, 'El salario debe ser mayor que cero.', 1;
        IF EXISTS (SELECT 1 FROM dbo.Persona AS p WHERE p.DNI = @DNI)
            THROW 50306, 'Ya existe una persona registrada con ese DNI.', 1;
        IF EXISTS (SELECT 1 FROM dbo.Persona AS p WHERE p.Usuario = @Usuario)
            THROW 50307, 'El nombre de usuario ya esta en uso.', 1;

        INSERT INTO @servicios (idServicio)
        SELECT DISTINCT TRY_CAST(LTRIM(RTRIM(value)) AS INT)
        FROM STRING_SPLIT(ISNULL(@ListaServicios, ''), ',')
        WHERE TRY_CAST(LTRIM(RTRIM(value)) AS INT) IS NOT NULL;

        IF EXISTS (SELECT 1
                   FROM @servicios AS sv
                   LEFT JOIN dbo.Servicios AS s ON s.idServicios = sv.idServicio AND s.Estado = 1
                   WHERE s.idServicios IS NULL)
            THROW 50308, 'Uno o mas servicios no existen o estan inactivos.', 1;
        IF @idHorario IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Horarios AS h WHERE h.idHorarios = @idHorario AND h.Estado = 1)
            THROW 50309, 'El horario indicado no existe o esta inactivo.', 1;

        IF @@TRANCOUNT = 0 BEGIN BEGIN TRANSACTION; SET @tran = 1; END;

        SELECT @idPersona = ISNULL(MAX(idPersona), 0) + 1 FROM dbo.Persona WITH (UPDLOCK, HOLDLOCK);
        INSERT INTO dbo.Persona (idPersona, PrimerNombre, SegundoNombre, PrimerApellido, SegundoApellido, DNI,
                                 Estado, FechaNacimiento, Usuario, [Contraseña], TipoUsuario)
        VALUES (@idPersona, @PrimerNombre, @SegundoNombre, @PrimerApellido, @SegundoApellido, @DNI,
                'A', @FechaNacimiento, @Usuario,
                LOWER(CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', @Usuario + @Contrasena), 2)), 'E');

        SELECT @idContacto = ISNULL(MAX(idContacto), 0) + 1 FROM dbo.Contacto WITH (UPDLOCK, HOLDLOCK);
        INSERT INTO dbo.Contacto (idContacto, TipoContacto, NumeroCelular, Correo, Persona_idPersona, Estado)
        VALUES (@idContacto, 'T', @Telefono, NULL, @idPersona, 1);
        IF @Correo IS NOT NULL AND LTRIM(RTRIM(@Correo)) <> ''
            INSERT INTO dbo.Contacto (idContacto, TipoContacto, NumeroCelular, Correo, Persona_idPersona, Estado)
            VALUES (@idContacto + 1, 'C', NULL, @Correo, @idPersona, 1);

        SELECT @idEmpleado = ISNULL(MAX(idEmpleado), 0) + 1 FROM dbo.Empleado WITH (UPDLOCK, HOLDLOCK);
        INSERT INTO dbo.Empleado (idEmpleado, FechaContratacion, Persona_idPersona, Salario, Estado)
        VALUES (@idEmpleado, CAST(GETDATE() AS DATE), @idPersona, @Salario, 'A');

        INSERT INTO dbo.Servicios_has_Empleado (Servicios_idServicios, Empleado_idEmpleado, FechaAsignacion)
        SELECT sv.idServicio, @idEmpleado, CAST(GETDATE() AS DATE) FROM @servicios AS sv;

        IF @idHorario IS NOT NULL
            INSERT INTO dbo.Empleado_has_Horarios (Empleado_idEmpleado, Horarios_idHorarios, FechaInicioVigencia, FechaFinVigencia)
            VALUES (@idEmpleado, @idHorario, CAST(GETDATE() AS DATE), NULL);

        IF @tran = 1 COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @tran = 1 AND @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* ---------- Verificacion ---------- */
SELECT name AS ObjetoNuevo FROM sys.objects
WHERE name IN ('vw_AgendaCitasConCliente', 'fn_NotificacionesCliente', 'vw_NotificacionesEmpleado',
               'sp_AgendarCitaCliente', 'sp_CancelarCitaCliente', 'sp_RegistrarEmpleado');
SELECT COL_LENGTH('dbo.Cita', 'Cliente_idCliente') AS CitaCliente, COL_LENGTH('dbo.Servicios', 'DuracionMinutos') AS ServicioDuracion;
GO
