# BookiPos — Frontend (app unificada)

Web pública, panel de operación y punto de venta en **un solo origen**.
Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4. Gestor: **pnpm**.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Next en desarrollo, puerto 3000 |
| `pnpm build` | Build de producción |
| `pnpm start` | Sirve el build, puerto 3000 |
| `pnpm lint` | ESLint (`eslint-config-next`) |
| `pnpm e2e` | Playwright. **Requiere el stack levantado a mano** (Mongo + backend + front) |
| `pnpm e2e:ui` | Playwright en modo UI |

El backend NestJS corre en **:3001**. Sin él, la app arranca pero toda vista
autenticada falla.

## Un solo origen: por qué importa

La web pública, `/panel` y `/pos` comparten origen a propósito. Eso elimina el
preflight de CORS entre zonas y permite que la cookie HttpOnly del refresh token
funcione sin configuración extra. Al añadir superficie nueva, mantenla dentro de esta
app en vez de crear otro despliegue.

- `src/app/(marketing)` — web pública, sin sesión.
- `src/app/(secure)/login`, `/registro`, `/invitacion/[token]` — entrada.
- `src/app/(secure)/panel/...` — back-office administrativo (~17 áreas).
- `src/app/(secure)/pos/...` — operación en caja (ventas, caja, facturación,
  inventario, nómina). Es una superficie distinta sobre los mismos dominios,
  pensada para el turno, no para la administración. Fija una **sede de trabajo para
  toda la sesión** (`SedeProvider`, clave `pos.sedeId`), mientras que el panel elige
  sede por página.

No confundas `/pos` con `/panel/pos`: este último es una **venta rápida simplificada**
dentro del back-office (usa `lib/erp/api-sales.ts`). El terminal real —órdenes de
restaurante, propinas, descuentos, impresión de tirilla— es `/pos`.

Qué área ve cada usuario lo decide `src/lib/access.ts` a partir de sus permisos:
`permsAllowPos()` (necesita `pos.sell`) y `permsAllowOperation()` (cualquiera de
`OPERATION_PERMISSIONS`). Un rol puede calificar para ambas.

## Capa de datos

- `src/lib/api.ts` — cliente base, tipos de sesión (`AuthUser`, `Tokens`), `ApiError`
  y el evento global `bookipos:account-suspended` que dispara el bloqueo de cuenta.
- `src/lib/api-admin.ts` — `authFetch` y `parseResponse`: **todos los clientes los
  reutilizan**, no hagas `fetch` suelto. Ante un 401, `authFetch` refresca el token
  **una sola vez** y reintenta.
- `src/lib/erp/api-<modulo>.ts` (panel) y `src/lib/pos/api-*.ts` (POS) — un archivo por
  módulo del backend. Mantén esa correspondencia 1:1; ahí viven también los tipos y las
  etiquetas de dominio (`IVA_OPTIONS`, `SOURCE_TYPE_LABELS`).
- `src/lib/auth-context.tsx` — sesión en cliente. Rehidrata con `GET /auth/me` y cae a
  `/auth/refresh` si venció.

Sesión partida en dos, a propósito: el **access token** vive en `localStorage` bajo
`sistemapos.auth` (prefijo heredado de la marca antigua) y viaja como `Bearer`; el
**refresh token nunca pasa por JS** — es una cookie `HttpOnly`, de ahí el
`credentials: "include"` en login, register, refresh, logout e invitaciones.

Errores del backend: preserva el `code` de `ApiError` cuando el usuario deba ver un
mensaje distinto. Un 403 con `ACCOUNT_SUSPENDED` dispara el evento global
`bookipos:account-suspended`, que el provider traduce a estado **sin cerrar sesión**
para que `SuspensionGuard` muestre el bloqueo. `hasFeature` es fail-open a propósito
(los tokens antiguos no traen `entitlements`).

## Variables de entorno

`src/lib/env.ts` centraliza la lectura y documenta que **`NEXT_PUBLIC_*` se incrusta en
el bundle durante el build**: cambiarlas obliga a reconstruir, y no puede haber
secretos en ellas.

Hoy el código lee exactamente tres, todas públicas: `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY`. Ninguna variable de servidor:
toda credencial vive en el backend.

Deuda conocida: `api.ts` y `api-admin.ts` leen `process.env.NEXT_PUBLIC_API_URL`
directamente en vez de importar de `env.ts`. Si tocas esos archivos, centralízalo.

## Tema claro/oscuro

`src/lib/theme/` — modo `light | dark | system` guardado en `localStorage` bajo
`bookipos.theme`. Se pinta con la clase `dark` (`@custom-variant dark` en
`src/app/globals.css`, Tailwind v4).

**Solo aplica a `/panel` y `/pos`.** La web pública, el login y el registro fuerzan
`color-scheme: light` vía `.zone-marketing`.

`THEME_INIT_SCRIPT` es un script inline bloqueante en el `<head>` del layout raíz que
aplica el tema **antes del primer paint** (de ahí el `suppressHydrationWarning`). El
provider usa `useSyncExternalStore`, se sincroniza entre pestañas con el evento
`storage` y sigue `prefers-color-scheme` en vivo cuando el modo es `system`. Si tocas
esto, no lo conviertas en `useState` + `useEffect`: reintroduce el parpadeo.

Es preferencia **del dispositivo, no del usuario de negocio**: quien trabaja de noche
en una caja quiere esa pantalla oscura aunque en su portátil la prefiera clara. No la
cuelgues del `userId`.

Toda superficie nueva debe verse bien en ambos temas. Usa los tokens de color, nunca
colores literales.

## Componentes

- `src/components/ui/` — kit base (shadcn, estilo `base-nova`, sobre `@base-ui/react`,
  iconos `lucide`). Incluye piezas de dominio como `money-input` y `confirm-dialog`.
- `src/components/{auth,dashboard,erp,marketing,onboarding,pos}/` — por superficie.
- Alias: `@/components`, `@/lib`, `@/hooks`, `@/components/ui`.
- Composición de clases con `cn()` (`@/lib/utils`) y variantes con
  `class-variance-authority`. Toasts con `sonner` (`app-toaster`).

## Server y Client Components

Hoy ~91 de 162 archivos llevan `"use client"`. Es mucho: antes de añadir otro,
comprueba si el componente realmente necesita estado, efectos, `window` o handlers.
Empuja la frontera de cliente lo más abajo posible del árbol.

Nunca importes desde un Server Component un módulo que arrastre `"use client"` sin
darte cuenta, y nunca dejes que una clave o dato sensible llegue a un componente de
cliente por props.

## Testing E2E

Playwright, `baseURL http://localhost:3000`, solo Desktop Chrome, `trace on-first-retry`,
screenshot en fallo. **No hay `webServer` configurado a propósito**: el stack completo
(Mongo + NestJS + Next) no se orquesta de forma fiable, así que se levanta a mano.

`e2e/helpers/auth.ts` hace login por **API directa al backend** (más rápido que navegar
la UI) y devuelve el `storageState`. Credenciales demo (`demo@sistemapos.local`) creadas
por el seeder del backend. Las URLs están hardcodeadas ahí: si cambian, se cambian en
ese archivo.

## Convenciones

- Commits: Conventional Commits **en español** — `feat(pos): ...`, `fix(web): ...`.
- Comentarios en español, explicando el *porqué*. El código de este repo ya lo hace
  bien: mantén ese nivel.
- Sin punto y coma al final de línea en `src/` (el estilo dominante); respeta el
  archivo que estés tocando.
- Accesibilidad: hay trabajo hecho de contraste WCAG y responsive. No lo deshagas.
