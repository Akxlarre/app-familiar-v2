# Acceptance 0005 — La pantalla de la plata

> **Spec:** [spec.md](./spec.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verificado:** 2026-08-12
> **Método:** 475 tests + QA en navegador contra **Supabase real**, con datos en Postgres.

---

## Por qué esta spec se verificó distinto

Es la primera que se construyó con la base levantada. Todo lo anterior se había verificado sobre
`/_ds`, que no toca datos: se comprobaba que la pantalla se pintara, no que dijera la verdad.

Acá cada AC se midió contra filas reales — y tres defectos aparecieron sólo así.

---

## Los AC

| AC | Qué exige | Estado | Evidencia |
|---|---|---|---|
| **AC1** | Lista agrupada por día, más recientes primero | ✅ | Navegador: 15 filas en 11 días, orden descendente |
| **AC2** | Ingreso y gasto se distinguen sin leer el signo | ✅ | Color e icono (`trending-up`/`down`) además del signo |
| **AC3** | Punto de miles, sin decimales (RB-04) | ✅ | `$397.430`, `−$18.700`. **Los KPIs del hero salían sin formato**: ver hallazgos |
| **AC4** | Cargar más sin recargar ni perder la posición | ✅ | "Ver más" con 5.032 filas: pide 48, la lista crece en su lugar |
| **AC5** | Ver el correo que originó el movimiento | ✅ | Bloque "De dónde salió" con remitente, asunto y extracto. Si se cargó a mano, lo dice |
| **AC6** | Hero con gastado, ingresado y saldo | ✅ | Los tres, sumados por la base |
| **AC7** | Reparto por categoría de mayor a menor, con % | ✅ | 9 categorías con barra y porcentaje. "Sin categorizar" incluido, no escondido |
| **AC8** | Vacío de período ≠ "no hay datos en la app" | ✅ | Copy propio, y sólo tras haber consultado |
| **AC9** | Cambiar categoría se guarda | ✅ | Drawer → selector → guardar |
| **AC10** | "Recordar" hace que los futuros usen la categoría | ✅ | **Verificado en la base**: tras corregir, `categoria_para_comercio('JUMBO MAIPU')` devuelve la categoría nueva. Un correo futuro ya no pasa por la bandeja |
| **AC11** | Ofrecer aplicar a los pasados, con el usuario decidiendo | ✅ | "Aplicar también a los **3** anteriores" — el número exacto, y sin marcar por defecto |
| **AC12** | Borrar devuelve la captura a revisable (RN-09) | ✅ | RPC `borrar_movimiento`; el toast lo dice. Un movimiento cargado a mano no promete una bandeja que no existe |
| **AC13** | Los números del hero se recalculan sobre lo filtrado | ✅ | Filtrar por Supermercado: **15 → 3 filas y `$397.430` → `$71.840`** |
| **AC14** | El filtro sobrevive a la recarga — vive en la URL | ✅ | Recarga con `?categoria=…`: lista, números y barra de filtros intactos. El botón "atrás" también funciona |
| **AC15** | Buscar ignora mayúsculas y acentos | ✅ | `"jumbo"` encuentra `JUMBO MAIPU` (`ILIKE` en la lista y en los agregados) |
| **AC-E1** | Sin categoría se ve y se arregla de un toque | ✅ | Aparece como "Sin categorizar" en el reparto y se corrige desde la fila |
| **AC-E2** | Movimiento de una cuenta borrada no rompe la fila | ✅ | La consulta no depende de `cuentas`; el comercio nulo cae a "Sin comercio" |
| **AC-E3** | Cuota "3 de 12" enlazando a la compra | ⬜ | **Diferido a la spec 0007**, que crea las compras en cuotas |
| **AC-E4** | 5.000 movimientos dentro de RNF-02 | ✅ | Ver abajo |

**17 de 19.** AC-E3 depende de una spec que no existe; el otro pendiente es de navegación (ver más abajo).

---

## AC-E4 — la prueba de volumen

5.032 movimientos en la base, midiendo **lo que la app pide de verdad**, no lo que uno cree:

```
consultas REST: 6 · 12,4 kB en total
  · 1 fila    profiles
  · 11 filas  categorias_gasto
  · 50 filas  movimientos      ← la mayor
  · 12 filas  gasto_por_categoria
  · 1 fila    resumen_del_periodo
  · 1 fila    cuentas

primer render: 0,5 s (límite RNF-02: 30 s)
"Ver más": pide 48 filas, no el resto
```

Lo que se estaba comprobando no era si Postgres aguanta —el plan usa
`idx_movimientos_household_fecha` y resuelve en 0,6 ms— sino **que la pantalla no se traiga el
conjunto completo**. El modo de fallar de una lista es pedir todo y paginar en el cliente, y eso
no se nota hasta que hay volumen.

Esto **cierra también AC-E1 de la spec 0002**, que pedía 500 filas en móvil y quedó diferido desde
entonces por no haber ninguna pantalla con ese volumen.

---

## Lo que la verificación encontró

| # | Defecto | Cómo apareció |
|---|---|---|
| 1 | **Los KPIs del hero sin separador de miles** (`$348400`) | La **captura de pantalla**. `section-hero` interpola `kpi.value` tal cual |
| 2 | **`CREATE OR REPLACE` no reemplaza si cambia la firma** | Al llamar el RPC: `function is not unique`. El SQL se aplica sin quejarse, y habría roto a todos los clientes |
| 3 | **El perfil se pedía 3 veces por carga** | Contando las consultas REST en la prueba de volumen |
| 4 | Tres comprobaciones de mi propio QA pasaban vacuamente | Revisando por qué un test pasaba con el hero vacío |
| 5 | El drawer inyectaba el repositorio y el toast | ARCH-02 |

El nº 3 es el más interesante: `onAuthStateChange` dispara varias veces por sesión y `getUser()`
suma la suya. Un caché por sí solo bajó de 3 a 2 —las dos primeras corren en paralelo y ambas ven
el caché vacío—, así que hizo falta **deduplicar la promesa en vuelo** para llegar a una.

---

## Lo que queda declarado

- **AC-E3** (cuotas) → spec 0007.
- **Los tabs de subsección de Plata** no se construyeron. Plata tiene una sola subsección hasta
  que existan Cuentas (0006), Cuotas (0007) y Presupuestos (0008); ponerlos ahora sería inventar
  las promesas que AC4 de la spec 0003 prohíbe. Por eso **AC3, AC7 y AC-E3 de la spec 0003 siguen
  diferidos**, ahora a la 0006 — corrigiendo lo que se anunció al cerrar la fase 1 de esta spec.

---

## Comandos de verificación

```bash
npm run test:ci        # 475 tests
npm run lint:arch      # 0 errores, 2 advertencias (ARCH-09 heredadas)
node --test supabase/tests/grants.test.mjs   # 9 casos

# QA en navegador, con la base levantada y datos sembrados
npx supabase start -x edge-runtime,studio,imgproxy,logflare,vector,supavisor,realtime,storage-api,inbucket,pg_meta,mailpit
psql < supabase/seeds/movimientos-demo.sql
ng serve --port 4292
QA_CORREO=<usuario> node qa-plata.mjs qa-corregir.mjs qa-filtros.mjs qa-volumen.mjs
```
