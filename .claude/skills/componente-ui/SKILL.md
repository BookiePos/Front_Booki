---
name: componente-ui
description: Añade o modifica un componente del kit base en src/components/ui respetando el sistema de diseño (shadcn base-nova sobre Base UI, tokens, variantes con cva, tema claro/oscuro). Úsalo cuando haga falta una pieza reutilizable de interfaz, no una vista.
---

# Componente del kit base

Solo entra en `src/components/ui/` lo que es **reutilizable y sin lógica de negocio**.
Si sabe de ventas, de sedes o de nómina, va en
`src/components/{erp,pos,dashboard,auth,marketing,onboarding}/`.

## 1. Antes: ¿ya existe?

El kit tiene 22 piezas (button, input, select, dialog vía `sheet`, `table`, `card`,
`badge`, `tooltip`, `dropdown-menu`, `checkbox`, `slider`, `progress`, `skeleton`,
`sidebar`, `breadcrumb`, `avatar`, `separator`, `label`, `theme-toggle`,
`app-toaster`, `confirm-dialog`, `money-input`). Léelas antes de crear nada: casi
siempre lo que hace falta es una **variante nueva**, no un componente nuevo.

## 2. Configuración del sistema

`components.json`: shadcn con estilo `base-nova`, `rsc: true`, base color `neutral`,
variables CSS activadas, iconos `lucide`. La base real es **`@base-ui/react`**, no
Radix: al traer un componente de shadcn, comprueba que la primitiva sea la de Base UI
o adáptalo. Alias: `@/components/ui`, `@/lib/utils`, `@/hooks`.

## 3. Reglas de escritura

- **Sin `"use client"` salvo que lo necesite de verdad** (estado, efectos, refs al DOM,
  handlers, `window`). Un componente presentacional debe poder renderizarse en
  servidor.
- Variantes con `class-variance-authority`, no con encadenados de ternarios.
- Composición de clases con `cn()` de `@/lib/utils`, y acepta siempre `className` para
  que quien lo use pueda ajustar.
- Reenvía las props nativas del elemento (`React.ComponentProps<"button">`) y la `ref`.
- Estilo del repo: comentarios en español explicando el *porqué*; sin punto y coma al
  final de línea, como el resto de `src/`.

## 4. Tema y color

- **Solo tokens.** Nunca un color literal: rompe claro u oscuro.
- Prueba la pieza en los dos temas. El oscuro se activa con la clase `dark`
  (`@custom-variant dark` en `src/app/globals.css`, Tailwind v4) e invierte tonos, no
  solo los oscurece.
- Recuerda que la web pública fuerza tema claro (`.zone-marketing`): si el componente
  se usa también ahí, verifícalo en ese contexto.

## 5. Accesibilidad (no es opcional en este kit)

- Elemento semántico correcto: `<button>`, `<a>`, `<input>`. Nunca `<div onClick>`.
- `<Label>` asociado por `htmlFor`/`id` en todo control de formulario.
- Foco visible: no elimines el outline sin sustituirlo por algo con contraste ≥ 3:1.
- Overlays (sheet, dialog): foco atrapado, Escape cierra, el foco vuelve al disparador.
- Icono solo dentro de un botón → `aria-label` en el botón.
- Estado de error → `aria-invalid` + `aria-describedby` al mensaje.
- Contraste AA: 4.5:1 texto normal, 3:1 texto grande y componentes de interfaz.
- El color nunca como único portador de significado.
- En piezas del POS, objetivo táctil ~44x44 px.

Los tests E2E seleccionan por rol accesible (`getByRole`, `getByLabel`): un componente
mal etiquetado rompe los tests además de a las personas.

## 6. Verificación

- `pnpm lint` y `pnpm build`.
- Pásale los agentes `auditor-a11y` y `auditor-rsc`.
- Compruébalo en claro y en oscuro, y con navegación solo por teclado.

## 7. Commit

`feat(ui): ...` o `fix(ui): ...`, en español.
