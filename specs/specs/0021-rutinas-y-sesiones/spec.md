# Spec 0021 — Rutinas y sesiones

> **Status:** draft
> **Created:** 2026-08-11
> **Owner:** Benjamín
> **Priority:** P2
> **Costo de entrada:** 🟡 manual con intención
> **Hito:** 4 — entrenamiento

---

## 1. Contexto de negocio

**Origen:** REQ-070.

**Persona afectada:** cada miembro por separado, y sólo quien entrena.

**Problema que resuelve:**
Este es el módulo que más se parece a lo que mató a v1 —entrada 100% manual— y sin embargo se
queda en el alcance. La razón está declarada en el discovery: **el momento de registro es
distinto**. En el gimnasio, entre series, con noventa segundos muertos y el teléfono en la mano,
registrar la serie que se acaba de hacer no es una carga: es lo que uno hace igual, en una nota o
en la cabeza.

Y hay una razón de dominio para que exista acá y no en otra app: las metas de peso corporal leen
de Cuerpo (spec 0015). Tener el entrenamiento afuera obligaría a duplicar el peso, que es
exactamente RN-08.

Es el último hito a propósito: no habilita nada más y es el más prescindible.

**Hipótesis de valor:**
Registrar entre series se sostiene porque el usuario ya está ahí y quiere el dato. Si eso resulta
falso, este módulo es candidato a archivarse sin que nada más se caiga.

---

## 2. User Stories

- **US1**: Como usuario, quiero armar mi rutina con ejercicios, series, reps y peso objetivo.
- **US2**: Como usuario, quiero registrar la sesión con lo que realmente hice, entre serie y serie.
- **US3**: Como usuario, quiero ver mi progreso por ejercicio a lo largo del tiempo.
- **US4**: Como usuario, quiero fijar metas y que las de peso corporal lean mis mediciones.

---

## 3. Acceptance Criteria (Gherkin)

### Rutinas

- **AC1**: Given un usuario, When arma una rutina, Then elige ejercicios de un catálogo y define series, reps y peso objetivo.
- **AC2**: Given el catálogo de ejercicios, When se busca, Then trae nombre, grupo muscular y técnica.
- **AC3**: Given un ejercicio que no está, When el usuario lo agrega, Then entra al catálogo global.
- **AC4**: Given una rutina, When se edita, Then las sesiones ya registradas no cambian — son eventos y congelan (RN-04 por analogía).

### Sesiones — el momento que decide

- **AC5**: Given una rutina, When se empieza una sesión, Then los ejercicios aparecen precargados con el peso y las reps de la última vez.
- **AC6**: Given una serie hecha, When se registra, Then cuesta **un toque** confirmar lo propuesto, y dos ajustarlo.
- **AC7**: Given una serie, When se registra, Then se pueden anotar RPE y RIR, y son opcionales.
- **AC8**: Given una sesión en curso, When se cierra la app o se pierde la conexión, Then no se pierde lo registrado.
- **AC9**: Given una sesión, When se termina, Then queda con su fecha, duración y todo lo hecho.

### Progreso

- **AC10**: Given varias sesiones con el mismo ejercicio, When se abre su historial, Then se ve la evolución del peso y el volumen.
- **AC11**: Given un récord personal, When se supera, Then se detecta y se avisa en el momento.
- **AC12**: Given los récords, When se consultan, Then vienen de las sesiones, no de una tabla que alguien mantiene.

### Metas

- **AC13**: Given una meta de peso corporal, When se consulta el progreso, Then lee de `mediciones` (spec 0015) y **no** copia el peso (RN-08).
- **AC14**: Given una meta de PR, When se supera en una sesión, Then se marca cumplida sola.

### Edge cases obligatorios

- **AC-E1**: Given una sesión sin rutina (entrenamiento libre), When se registra, Then se permite agregar ejercicios sobre la marcha.
- **AC-E2**: Given un ejercicio unilateral o con banda, When no aplica el peso, Then se registra sin peso y el progreso usa reps o volumen.
- **AC-E3**: Given una sesión registrada con un peso absurdo (typo), When se detecta un salto imposible, Then se pide confirmación en vez de festejar un PR falso.
- **AC-E4**: Given una rutina borrada, When se miran sus sesiones pasadas, Then siguen existiendo con lo que se hizo.

---

## 4. Out of scope

- ❌ **Rutinas prearmadas o generadas.** Otro producto, y opinar sobre cómo debe entrenar el usuario no es el trabajo de esta app.
- ❌ **Videos y técnica de ejercicios.** YouTube existe.
- ❌ **Cronómetro de descanso.** Toda app de gimnasio lo tiene; si hace falta, es trivial, pero no es lo que define esta spec.
- ❌ **Compartir entrenamientos.** R-06.
- ❌ **Integración con relojes o pulsómetros.** R-05.

---

## 5. Dependencias

### Specs previas
- 0015 — las metas de peso corporal leen de ahí (AC13). **Bloqueante duro** para esa parte.
- 0003 — lugar en la navegación.

### Capacidades del proyecto que se asumen existentes
- Serie de mediciones, RLS por perfil (misma decisión pendiente que la spec 0015).

### Capacidades nuevas requeridas
- Tablas `ejercicios`, `rutinas`, `ejercicios_rutina`, `sesiones`, `series_sesion`, `records_personales`, `metas`.
- **Persistencia local de la sesión en curso** (AC8) — en el gimnasio la señal es mala y perder una sesión a la mitad es motivo suficiente para dejar de usar la app.
- Detección de PR — función pura con tests.

---

## 6. Datos y modelo

- **Tablas nuevas:** las siete de arriba.
- **`records_personales` es caché**, no fuente (AC12): se deriva de las sesiones y se puede reconstruir.
- **Modelo UI:** `Rutina`, `Sesion`, `SerieRegistrada`, `ProgresoEjercicio`, `Meta`.
- **`ejercicios` es global** como el catálogo de artículos (spec 0009): un press de banca es un hecho del mundo.

---

## 7. UX y flujos

- **Pantalla:** `/app/cuerpo/entrenamiento`.
- **La pantalla que importa es la sesión en curso**, y tiene un contexto de uso muy particular: una mano, sudor, poca atención, entre series. Eso manda sobre cualquier consideración estética.
  - Botones grandes.
  - El valor propuesto es el de la última vez: confirmar es un toque.
  - Nada de scroll para llegar al botón de la serie siguiente.
  - Funciona sin conexión y sincroniza después.
- **Rutinas y progreso** son pantallas normales, que se miran en el sillón.
- **Estados:** sin rutinas, con la primera como oferta; sesión en curso recuperable tras cerrar la app.

---

## 8. Métricas de éxito post-launch

- **La métrica que decide si el módulo sobrevive:** sesiones registradas por semana, en la semana 6.
- Series por sesión (si baja, registrar molesta y la pantalla de sesión está mal).
- % de sesiones completadas vs. abandonadas a la mitad.

---

## 9. Notas / decisiones abiertas

- [ ] ¿Persistencia local con IndexedDB o `localStorage`? Depende del tamaño; IndexedDB es lo correcto para una sesión con muchas series.
- [ ] ¿El catálogo de ejercicios se semilla con los comunes o se arma desde cero? Semilla: escribir "press banca" la primera vez es fricción evitable.
- [x] ¿Entrenamiento se queda en el alcance? **Sí.** Está acoplado a Alimentación por composición corporal, y sacarlo obligaría a duplicar el peso (RN-08).
- [x] ¿Récords en tabla o derivados? **Derivados, con caché.**

---

## Changelog

- 2026-08-11 — draft inicial.
