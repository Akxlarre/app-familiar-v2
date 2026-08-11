<!-- spec-version: 2026-08-11 -->
<!-- auto-refresh: indices:sync -->

# Registro de Base de Datos (Supabase)

> **Regla de Actualización (OBLIGATORIA):** El Agente DEBE usar sus herramientas de escritura de archivos para definir nuevas tablas en la lista de abajo cada vez que genere migraciones en `supabase/migrations/`. La documentación del RLS y FDs debe ser estricta.
>
> **Spec Header en migraciones:** Toda migración nueva DEBE incluir un bloque de especificación al inicio:
> ```sql
> -- spec:
> --   tables_added: [nombre_tabla]
> --   columns_added: [col1, col2, ...]
> --   breaking: false
> --   description: "Descripción breve"
> -- /spec
> ```
> Este header es la fuente de verdad legible por el agente — permite entender el contrato de la migración sin parsear el SQL completo.

## Mapa por contexto

> El detalle columna por columna lo genera `npm run indices:sync` más abajo. Esta
> tabla es el mapa: qué contexto es dueño de qué, y por dónde entra el dato.
> Ver `context/domain.md` para el lenguaje ubicuo y las reglas de negocio.

| Contexto | Tablas | Cómo entran los datos | Hito |
|---|---|---|---|
| **Hogar** | `households`, `profiles` | manual, una vez (crear hogar o unirse por código) | 0 ✅ |
| **Captura** | `capturas`, `integraciones_email`, `parsers_email` | **automática** — correo del banco vía cron | 0 ✅ |
| **Dinero** | `cuentas`, `detalle_credito`, `categorias_gasto`, `movimientos`, `alias_comercio`, `compras_en_cuotas` | **automática** desde Captura; categoría aprendida una vez por comercio | 0 ✅ |
| Artículos | `articulos`, `articulo_alias`, `articulo_nutricion`, `categorias_articulo` | boleta + Open Food Facts | 1 |
| Despensa | `despensa`, `movimientos_despensa`, `listas_compra`, `items_lista`, `precios_observados` | boleta; consumo inferido de la recompra | 1 |
| Alimentación | `perfil_nutricional`, `registro_comida`, `comidas_guardadas`, `items_comida_guardada`, `recetas`, `ingredientes_receta`, `planes_comida`, `slots_plan` | un gesto (código de barras, repetir comida) | 2 |
| Cuerpo | `mediciones` | manual con intención | 2 |
| Entrenamiento | `ejercicios`, `rutinas`, `ejercicios_rutina`, `sesiones`, `series_sesion`, `records_personales`, `metas` | manual con intención | 3 |

**Regla que gobierna todo el RLS (RN-01):** cada tabla del hogar cuelga de
`household_id` y su policy usa `public.belongs_to_household(household_id)`. Esa
función es `SECURITY DEFINER` con `search_path` fijo — sin eso, la policy de
`profiles` invoca una función que lee `profiles` y entra en recursión.

**Verificación:** `./scripts/db-test.sh` levanta una base limpia, aplica las
migraciones dos veces (idempotencia), comprueba que ninguna tabla quedó sin RLS y
corre 21 casos de aislamiento con tres usuarios en dos hogares.

## Auto-Index — Detectado por AST (generado automáticamente)

<!-- AUTO-GENERATED:BEGIN -->
## Esquema efectivo (11 tablas, acumulado de las migraciones)

### `alias_comercio` — 🔒 RLS

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | UUID | NO | `gen_random_uuid()` | — |
| `household_id` | UUID | NO | — | → `households.id` |
| `patron` | TEXT | NO | — | — |
| `categoria_id` | UUID | NO | — | → `categorias_gasto.id` |
| `aciertos` | INT | NO | `0` | — |
| `created_at` | TIMESTAMPTZ | NO | `now()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| alias_comercio_all | ALL | `public.belongs_to_household(household_id)` | `public.belongs_to_household(household_id)` |

**Índices:** `idx_alias_comercio_trgm`

### `capturas` — 🔒 RLS

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | UUID | NO | `gen_random_uuid()` | — |
| `household_id` | UUID | NO | — | → `households.id` |
| `origen` | TEXT | NO | — | — |
| `origen_ref` | TEXT | NO | — | — |
| `payload` | JSONB | NO | `'{}'::jsonb` | — |
| `interpretado` | JSONB | sí | — | — |
| `estado` | TEXT | NO | `'pendiente'` | — |
| `motivo` | TEXT | sí | — | — |
| `intentos` | INT | NO | `0` | — |
| `parser_id` | UUID | sí | — | → `parsers_email.id` |
| `fecha_origen` | TIMESTAMPTZ | sí | — | — |
| `created_at` | TIMESTAMPTZ | NO | `now()` | — |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| capturas_select | SELECT | `public.belongs_to_household(household_id)` | — |
| capturas_update | UPDATE | `public.belongs_to_household(household_id)` | `public.belongs_to_household(household_id)` |

**Índices:** `idx_capturas_bandeja`

### `categorias_gasto` — 🔒 RLS

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | UUID | NO | `gen_random_uuid()` | — |
| `household_id` | UUID | sí | — | → `households.id` |
| `nombre` | TEXT | NO | — | — |
| `tipo` | TEXT | NO | `'gasto'` | — |
| `padre_id` | UUID | sí | — | → `categorias_gasto.id` |
| `icono` | TEXT | sí | — | — |
| `color` | TEXT | sí | — | — |
| `created_at` | TIMESTAMPTZ | NO | `now()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| categorias_gasto_select | SELECT | `household_id IS NULL OR public.belongs_to_household(household_id)` | — |
| categorias_gasto_write | ALL | `public.belongs_to_household(household_id)` | `public.belongs_to_household(household_id)` |

**Índices:** `idx_categorias_gasto_household`

### `compras_en_cuotas` — 🔒 RLS

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | UUID | NO | `gen_random_uuid()` | — |
| `household_id` | UUID | NO | — | → `households.id` |
| `cuenta_id` | UUID | sí | — | → `cuentas.id` |
| `descripcion` | TEXT | NO | — | — |
| `comercio` | TEXT | sí | — | — |
| `monto_cuota` | BIGINT | NO | — | — |
| `cuotas_total` | SMALLINT | NO | — | — |
| `primera_fecha` | DATE | sí | — | — |
| `created_at` | TIMESTAMPTZ | NO | `now()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| compras_en_cuotas_all | ALL | `public.belongs_to_household(household_id)` | `public.belongs_to_household(household_id)` |

**Índices:** `idx_compras_en_cuotas_household`

### `cuentas` — 🔒 RLS

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | UUID | NO | `gen_random_uuid()` | — |
| `household_id` | UUID | NO | — | → `households.id` |
| `titular_id` | UUID | sí | — | → `profiles.id` |
| `nombre` | TEXT | NO | — | — |
| `tipo` | TEXT | NO | — | — |
| `banco` | TEXT | sí | — | — |
| `last4` | TEXT | sí | — | — |
| `proposito` | TEXT | sí | — | — |
| `correo_vinculado` | TEXT | sí | — | — |
| `carpeta_inbox` | TEXT | sí | — | — |
| `activa` | BOOLEAN | NO | `true` | — |
| `created_at` | TIMESTAMPTZ | NO | `now()` | — |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| cuentas_all | ALL | `public.belongs_to_household(household_id)` | `public.belongs_to_household(household_id)` |

**Índices:** `idx_cuentas_household`

### `detalle_credito` — 🔒 RLS

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `cuenta_id` PK | UUID | NO | — | → `cuentas.id` |
| `cupo_total` | BIGINT | sí | — | — |
| `dia_facturacion` | SMALLINT | sí | — | — |
| `dia_vencimiento` | SMALLINT | sí | — | — |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| detalle_credito_all | ALL | `EXISTS (SELECT 1 FROM public.cuentas c WHERE c.id = cuenta_id AND public.belo…` | `EXISTS (SELECT 1 FROM public.cuentas c WHERE c.id = cuenta_id AND public.belo…` |

### `households` — 🔒 RLS

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | UUID | NO | `gen_random_uuid()` | — |
| `nombre` | TEXT | NO | — | — |
| `invite_code` UQ | TEXT | NO | — | — |
| `timezone` | TEXT | NO | `'America/Santiago'` | — |
| `created_at` | TIMESTAMPTZ | NO | `now()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| households_select | SELECT | `public.belongs_to_household(id)` | — |
| households_update | UPDATE | `public.belongs_to_household(id)` | `public.belongs_to_household(id)` |

### `integraciones_email` — 🔒 RLS

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | UUID | NO | `gen_random_uuid()` | — |
| `household_id` | UUID | NO | — | → `households.id` |
| `profile_id` | UUID | NO | — | → `profiles.id` |
| `proveedor` | TEXT | NO | `'gmail'` | — |
| `email` | TEXT | NO | — | — |
| `access_token` | TEXT | sí | — | — |
| `refresh_token` | TEXT | sí | — | — |
| `expira_en` | TIMESTAMPTZ | sí | — | — |
| `carpeta` | TEXT | NO | `'INBOX'` | — |
| `estado` | TEXT | NO | `'activa'` | — |
| `ultima_sync` | TIMESTAMPTZ | sí | — | — |
| `ultimo_error` | TEXT | sí | — | — |
| `created_at` | TIMESTAMPTZ | NO | `now()` | — |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| integraciones_email_delete | DELETE | `profile_id = auth.uid()` | — |
| integraciones_email_select | SELECT | `profile_id = auth.uid()` | — |

**Índices:** `idx_integraciones_email_household`

### `movimientos` — 🔒 RLS

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | UUID | NO | `gen_random_uuid()` | — |
| `household_id` | UUID | NO | — | → `households.id` |
| `cuenta_id` | UUID | sí | — | → `cuentas.id` |
| `profile_id` | UUID | sí | — | → `profiles.id` |
| `categoria_id` | UUID | sí | — | → `categorias_gasto.id` |
| `monto` | BIGINT | NO | — | — |
| `tipo` | TEXT | NO | — | — |
| `fecha` | DATE | NO | `CURRENT_DATE` | — |
| `comercio` | TEXT | sí | — | — |
| `nota` | TEXT | sí | — | — |
| `captura_id` | UUID | sí | — | → `capturas.id` |
| `created_at` | TIMESTAMPTZ | NO | `now()` | — |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | — |
| `compra_cuotas_id` | UUID | sí | — | → `compras_en_cuotas.id` |
| `numero_cuota` | SMALLINT | sí | — | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| movimientos_all | ALL | `public.belongs_to_household(household_id)` | `public.belongs_to_household(household_id)` |

**Índices:** `idx_movimientos_categoria`, `idx_movimientos_compra_cuotas`, `idx_movimientos_cuenta`, `idx_movimientos_household_fecha`, `uq_movimientos_captura`

### `parsers_email` — 🔒 RLS

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | UUID | NO | `gen_random_uuid()` | — |
| `household_id` | UUID | NO | — | → `households.id` |
| `banco` | TEXT | NO | — | — |
| `tipo` | TEXT | NO | — | — |
| `remitente_patron` | TEXT | NO | — | — |
| `asunto_patron` | TEXT | sí | — | — |
| `regex_monto` | TEXT | NO | — | — |
| `regex_comercio` | TEXT | sí | — | — |
| `regex_fecha` | TEXT | sí | — | — |
| `regex_cuota` | TEXT | sí | — | — |
| `regex_tarjeta` | TEXT | sí | — | — |
| `cuenta_id` | UUID | sí | — | → `cuentas.cuenta_id` |
| `activo` | BOOLEAN | NO | `true` | — |
| `created_at` | TIMESTAMPTZ | NO | `now()` | — |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| parsers_email_all | ALL | `public.belongs_to_household(household_id)` | `public.belongs_to_household(household_id)` |

**Índices:** `idx_parsers_email_household`

### `profiles` — 🔒 RLS

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | UUID | NO | — | → `auth.id` |
| `household_id` | UUID | sí | — | → `households.id` |
| `display_name` | TEXT | sí | — | — |
| `avatar_url` | TEXT | sí | — | — |
| `created_at` | TIMESTAMPTZ | NO | `now()` | — |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| profiles_select | SELECT | `id = auth.uid() OR public.belongs_to_household(household_id)` | — |
| profiles_update | UPDATE | `id = auth.uid()` | `id = auth.uid() AND household_id IS NOT DISTINCT FROM (SELECT household_id FR…` |

**Índices:** `idx_profiles_household`

## Vistas

| Vista | Definida en |
|-------|-------------|
| `mis_integraciones_email` | `20260811110000_captura_create_bandeja_integraciones.sql` |

## Funciones (helpers RLS y lógica de BD)

| Función | Argumentos |
|---------|-----------|
| `belongs_to_household` | `(household_uuid UUID)` |
| `create_household` | `(p_nombre TEXT)` |
| `get_my_household_id` | `()` |
| `handle_new_user` | `()` |
| `incrementar_aciertos_alias` | `(p_alias_id UUID)` |
| `join_household_by_code` | `(p_code TEXT)` |


<!-- AUTO-GENERATED:END -->
