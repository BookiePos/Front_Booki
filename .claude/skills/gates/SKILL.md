---
name: gates
description: Corre los gates del frontend en un solo comando (tsc, eslint, check-permisos contra el catálogo del backend, higiene de secretos; y next build con --build) y devuelve solo el resumen. Úsala antes de un commit de código o de abrir un PR, o cuando el usuario pida «gates», «verifica» o «¿está verde?».
---

# Gates del frontend

Un solo comando, desde la raíz del repo:

```bash
node scripts/gates.mjs           # antes de cada commit de código
node scripts/gates.mjs --build   # antes de abrir un PR: añade `next build`
```

El script imprime **un gate por línea**, con su cifra y su estado `OK`, `FALLA` o
`SIN MEDIR`, y deja la salida completa de cada gate en un archivo. **Lee solo ese
resumen.** Si un gate falla, abre únicamente el archivo de ese gate (las últimas ~40
líneas), no la salida entera.

Gates del frontend: `tsc`, `eslint`, `check-permisos` (`scripts/check-permisos.mjs`
compara las cadenas de permiso del front contra el snapshot
`scripts/permisos-backend.json`), secretos (`scripts/check-no-secrets.mjs`), y con
`--build` el build de Next.

## Reglas que hacen confiable el resultado

- **La ausencia de cifra es una falla.** Un gate que no imprime su número no corrió:
  se reporta `SIN MEDIR`, nunca verde. Casos típicos: un comando que muere antes de
  contar, un `tsc` que sale con exit≠0 y cero errores contados, una corrida e2e que
  reporta 0 pruebas porque no recolectó ninguna.
- **Reporta las cifras tal cual**, gate por gate. No resumas «todo verde» si alguna
  línea dice `SIN MEDIR`.
- **check-permisos** en rojo significa deriva con el backend. Si el backend cambió
  permisos a propósito, regenera el snapshot con
  `node scripts/check-permisos.mjs --actualizar` y revisa el diff de
  `scripts/permisos-backend.json` en el mismo PR; si no, corrige la cadena del front.
- **Verde unitario no es verde e2e.** Estos gates no levantan el stack. Si el cambio
  toca un flujo de usuario, corre el e2e aparte (`pnpm e2e`, configurable con
  `E2E_API_URL`, `E2E_BASE_URL`, `E2E_EMAIL`, `E2E_PASSWORD`) y reporta cuántas
  pruebas corrieron: 0 de 0 es `SIN MEDIR`.

## Techos (`scripts/techos.json`)

Es deuda congelada: cada cuenta (p. ej. errores de lint heredados) **solo puede
bajar**.

- Si tu cambio baja una cuenta, **baja el techo en el mismo PR**. Si no, la deuda que
  pagaste se puede volver a contraer sin que nadie lo note.
- Subir un techo exige **justificarlo por escrito en el PR** (por qué no hay otra
  forma). Nunca lo subas para poner un gate en verde sin decirlo.

## Triage de un test rojo

Antes de tocar una aserción, decide cuál de los dos casos es:

1. **Copy o comportamiento esperado**: el test fija un texto, un rol o un selector que
   el cambio modificó a propósito. Se actualiza esa aserción, una por una, y se dice
   en el commit por qué cambió.
2. **Regresión real**: el test detectó lo que tenía que detectar. Se arregla el
   código, no el test.

**Nunca actualices aserciones en bloque** (ni snapshots o capturas a ciegas): es la
forma más rápida de convertir una regresión en el nuevo comportamiento «esperado».
