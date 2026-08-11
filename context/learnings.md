# Project Learnings — app-familiar-v2

> Insights descubiertos durante el desarrollo y validados por el equipo.
> Diferente de `.claude/temp/LESSONS_LEARNED.md` (fallos de tools automáticos).
> Este archivo captura conocimiento de NEGOCIO y ENTORNO que el código no expresa.
> Gitignored — privado al proyecto.

## Terminología del dominio

<!-- Mapeos entre el lenguaje del cliente y el código.
     Ejemplo: "El cliente dice 'cosecha' → en código es HarvestEvent" -->

## Quirks de integraciones

<!-- Comportamientos no documentados o sorpresivos de APIs externas, PrimeNG, Supabase, etc.
     Ejemplo: "La API de pagos devuelve montos en centavos, no en la unidad base de la moneda" -->

## Decisiones de arquitectura y sus motivos

<!-- Enfoques que se intentaron y no funcionaron, con el porqué.
     Ejemplo: "Intentamos paginación server-side pero Supabase RLS con joins complejos
               devuelve count() incorrecto — usamos client-side con límite de 500 registros" -->

## Preferencias del equipo / cliente

<!-- Cosas que el cliente o el equipo han dicho explícitamente que quieren o no quieren.
     Ejemplo: "El cliente NO quiere que los usuarios puedan eliminar registros, solo archivar" -->
