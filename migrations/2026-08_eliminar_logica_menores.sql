-- 
--  migrations/2026-08_eliminar_logica_menores.sql
--  PhysicalPicking ahora es exclusivo para adultos de
--  18 a 30 años. La aplicacion (frontend y backend) ya NO usa la
--  logica de menores/acudientes desde este cambio, pero las
--  columnas correspondientes siguen existiendo en la base de datos
--  por compatibilidad (para no romper el backend si lo despliegams
--  antes de correr esta migracion).
--
--  script para usar y limpiar columnas que no se usan.
--

-- 1. Columnas de acudiente en "consentimientos" (ya no se escriben)
alter table public.consentimientos drop column if exists nombre_acudiente;
alter table public.consentimientos drop column if exists documento_acudiente;

-- 2. "es_mayor_de_edad": con la restriccion de edad 18-30 impuesta
--    por la aplicacion, este campo es redundante (siempre true).
--    Si lo conservarmos como registro historico, omitir esta linea.
alter table public.consentimientos drop column if exists es_mayor_de_edad;

-- 3. "es_menor_edad" en resultados_test, mismo caso: el backend ya
--    no la escribe ni la lee.
alter table public.resultados_test drop column if exists es_menor_edad;

--
--  OPCIONAL Y CON PRECAUCIÓN: endurecer el CHECK de edad a 18-30
--  a nivel de base de datos (defensa en profundidad adicional a la
--  validación que ya hace el backend en cada petición).
--
--  IA dice: ADVERTENCIA: si ya tienes registros de prueba guardados con una
--  edad fuera de 18-30 (de cuando el sistema aceptaba 1-120), este
--  ALTER fallará hasta que los borres o corrijas. Revisa primero:
--
--    select id, participante_edad from public.resultados_test
--    where participante_edad < 18 or participante_edad > 30;
--
--  Si esa consulta no devuelve filas, es seguro correr lo siguiente:
--
-- alter table public.resultados_test
--   drop constraint if exists resultados_test_participante_edad_check;
-- alter table public.resultados_test
--   add constraint resultados_test_participante_edad_check
--   check (participante_edad between 18 and 30);
