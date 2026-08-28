---
name: nueva-vista-erp
description: Crea una vista nueva del panel o del POS con su cliente HTTP, su gating por permisos, su entrada de navegación y soporte de tema claro/oscuro. Úsalo cuando haya que exponer en la interfaz un área del backend (p. ej. "añade la vista de fidelización al panel").
---

# Vista nueva en BookiPos

Antes de escribir código, decide **en qué superficie va**. No son intercambiables.

| | `/panel` | `/pos` |
|---|---|---|
| Para quién | Back-office, administración | Turno de caja, operación |
| Entrada | alguno de `OPERATION_PERMISSIONS` | `pos.sell` |
| Shell | `AppShell` (sidebar + topbar) | `PosShell` (lateral / barra inferior) |
| Clientes HTTP | `src/lib/erp/api-*.ts` | `src/lib/pos/api-*.ts` |
| Sede | se elige por página | fijada para toda la sesión (`SedeProvider`) |
| Guards extra | `SuspensionGuard` + `FeatureGuard` | — |

Si dudas: ¿lo usa quien está de pie cobrando, o quien está sentado administrando?

## 1. Cliente HTTP

Va en `src/lib/erp/api-<modulo>.ts` (o `src/lib/pos/`), **un archivo por módulo del
backend**, respetando esa correspondencia 1:1.

- Reutiliza `authFetch` y `parseResponse` de `@/lib/api-admin`. **Nunca `fetch` suelto**:
  `authFetch` refresca el token una sola vez ante un 401 y reintenta.
- Exporta ahí los tipos y las etiquetas de dominio, como hacen los vecinos
  (`IVA_OPTIONS`, `SOURCE_TYPE_LABELS` en `api-catalog.ts`).
- Deja pasar el `code` de `ApiError` cuando la UI deba distinguir el caso
  (`ACCOUNT_SUSPENDED`, `PLAN_UPGRADE_REQUIRED`).

## 2. Ruta

`src/app/(secure)/panel/<area>/page.tsx` o `src/app/(secure)/pos/<area>/page.tsx`.

Mantén la página como **Server Component** siempre que puedas y baja la frontera de
cliente a la pieza que de verdad necesita interactividad. Hoy ~91 de 162 archivos son
cliente: no engordes esa cifra por inercia.

## 3. Gating por permisos

- Comprueba el permiso antes de ofrecer la acción, usando las cadenas del catálogo
  (`inventory.adjust`, `payroll.manage`, …). **Nunca por nombre de rol**: los roles los
  configura cada cliente, los permisos son estables.
- Acciones sensibles con su permiso fino: `pos.void.authorize`,
  `pos.discount.authorize`, `payroll.deduction.approve`, `caja.close`.
- Si el área es de back-office y su permiso no está en `OPERATION_PERMISSIONS`
  (`src/lib/access.ts`), añádelo, o el usuario no podrá ni entrar al panel.
- Si el área depende del plan, usa `hasFeature` (fail-open con tokens antiguos, por
  diseño) y ofrece un camino de mejora de plan, no un error crudo.
- Datos por sede: respeta `sedeIds` del usuario o exige `sede.view_all`.

## 4. Navegación

Añade la entrada en `src/lib/erp/navigation.ts` (panel) o en la navegación del POS.
La del panel se filtra por giro de negocio, permisos y capacidades de plan: rellena los
tres campos o la entrada aparecerá donde no debe.

Verifica que la ruta a la que apuntas **existe de verdad**. Ya hay al menos un caso de
entrada apuntando a una ruta inexistente (`/panel/resoluciones` → 404).

## 5. Interfaz

- Componentes de `@/components/ui` (shadcn estilo `base-nova` sobre `@base-ui/react`,
  iconos `lucide`). Para dinero, `money-input`. Para confirmaciones destructivas,
  `confirm-dialog`. Para avisos, `sonner`.
- Clases con `cn()` (`@/lib/utils`); variantes con `class-variance-authority`.
- **Colores solo por tokens.** Un literal (`text-[#666]`) rompe uno de los dos temas.
- Comprueba la vista en **claro y oscuro**. El panel y el POS tienen modo oscuro; la
  web pública fuerza claro (`.zone-marketing`).
- Tablas anchas dentro de un contenedor con `overflow-x: auto`. En el POS, objetivos
  táctiles de ~44x44 px.

## 6. Estados

Cubre los cuatro: cargando (`skeleton`), vacío (con acción sugerida), error (mensaje
útil, no el crudo del backend) y sin permiso. El estado vacío es el que más se olvida y
el primero que ve un cliente nuevo.

## 7. Verificación

- `pnpm lint` y `pnpm build`.
- Revisa con los agentes `auditor-rsc`, `auditor-a11y` y `auditor-permisos-ui`.
- Si el flujo es crítico del POS, añade un E2E (agente `tester-e2e`).

## 8. Commit

Conventional Commits en español: `feat(panel): ...` / `feat(pos): ...`.
