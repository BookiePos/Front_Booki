# BookiPos — Frontend

Aplicación unificada de BookiPos: web pública, panel de operación y punto de venta en un solo origen.

[![Next.js](https://img.shields.io/badge/Next.js-16.2-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2-087EA4?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Playwright](https://img.shields.io/badge/E2E-Playwright-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev)
[![pnpm](https://img.shields.io/badge/pnpm-9-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)

---

## Índice

- [Qué es BookiPos](#qué-es-bookipos)
- [Un solo origen: la decisión de arquitectura](#un-solo-origen-la-decisión-de-arquitectura)
- [Arquitectura de rutas](#arquitectura-de-rutas)
  - [Árbol de rutas](#árbol-de-rutas)
  - [`/panel` frente a `/pos`](#panel-frente-a-pos)
- [Organización del código: components, hooks, lib](#organización-del-código-components-hooks-lib)
- [Integración con la API](#integración-con-la-api)
- [Requisitos previos](#requisitos-previos)
- [Puesta en marcha](#puesta-en-marcha)
- [Scripts](#scripts)
- [Sistema de diseño](#sistema-de-diseño)
- [Testing E2E con Playwright](#testing-e2e-con-playwright)
- [Accesibilidad y rendimiento](#accesibilidad-y-rendimiento)
- [Despliegue en Vercel](#despliegue-en-vercel)
- [Estructura de carpetas](#estructura-de-carpetas)
- [Convención de commits](#convención-de-commits)

---

## Qué es BookiPos

BookiPos es un sistema operacional para negocios en Colombia —restaurante, bar y retail— que reúne
punto de venta, inventario multi-sede, caja, cartera, compras, nómina, contabilidad y facturación
electrónica DIAN en un mismo producto.

Este repositorio es **el frontend completo**. Contiene las tres superficies del producto:

| Superficie | Ruta base | Para quién |
| --- | --- | --- |
| Web pública (marketing) | `/` | Visitantes: propuesta de valor, módulos, precios, preguntas |
| Autenticación y alta | `/login`, `/registro`, `/invitacion/[token]` | Con o sin sesión |
| Panel de operación (back-office) | `/panel/**` | Administración: finanzas, inventario, nómina, cumplimiento |
| Punto de venta (terminal) | `/pos/**` | Quien atiende y cobra en caja |

El backend (NestJS + MongoDB) vive en un repositorio hermano. Esta app **no tiene base de datos ni
lógica de servidor propia**: consume la API por HTTP desde el navegador.

> El producto se llamaba **GoCheck**. El renombrado a BookiPos está completo en el código
> (`refactor(marca): completar el renombrado de GoCheck a BookiPos`); todavía sobreviven algunas claves
> de `localStorage` con el prefijo histórico `sistemapos.` por compatibilidad de sesiones ya emitidas.

---

## Un solo origen: la decisión de arquitectura

Las tres superficies antes eran tres aplicaciones en tres orígenes distintos. Hoy son **una sola app
Next.js servida desde un único dominio**. Las consecuencias son concretas y están documentadas en el
propio código:

1. **Sesión compartida de verdad.** `src/app/(secure)/login/page.tsx` lo dice explícitamente: al vivir
   las tres zonas en el mismo origen, el login *es* SSO. La sesión abierta en `/login` sirve tal cual en
   `/panel` y en `/pos`, sin volver a pedir contraseña. La cookie `HttpOnly` del refresh token pertenece
   a ese único origen, así que no hay que replicarla ni sincronizarla entre dominios.
2. **Navegación de cliente entre zonas.** `src/lib/site.ts` define los enlaces a las otras zonas como
   rutas internas (`/panel`, `/pos`), no como URLs absolutas a otro puerto: pasar de la portada al panel
   es una navegación del router, no una recarga con reautenticación.
3. **Un solo despliegue y una sola política de seguridad.** `next.config.ts` aplica las cabeceras
   (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`) a `/:path*` una sola vez para las
   tres zonas.
4. **El coste se controla por layout, no por dominio.** El layout raíz es deliberadamente delgado
   (fuentes, estilos y tema). El contexto de sesión y el cliente de API se montan en
   `(secure)/layout.tsx`, de modo que la portada pública no los descarga. Lo mismo con
   `TooltipProvider`, que vive en los layouts de `/panel` y `/pos` y no en la raíz.

---

## Arquitectura de rutas

Next.js App Router con dos *route groups*. Los paréntesis agrupan sin aparecer en la URL:

- **`(marketing)`** — la única zona que se ve sin sesión. Su layout no monta `AuthProvider`; solo pinta
  su propio lienzo (`.zone-marketing`), porque el `<body>` lo comparten las tres zonas.
- **`(secure)`** — todo lo que necesita o produce sesión: `/login`, `/registro`, `/invitacion/[token]`,
  `/panel` y `/pos`. Su layout monta `AuthProvider` + `ConfirmProvider` **una sola vez** para las cuatro
  rutas: saltar de `/login` a `/panel`, o de `/panel` a `/pos`, no desmonta el contexto ni repite la
  llamada de rehidratación `GET /auth/me`.

Cada zona protegida añade sus propias capas:

```text
/panel/**  →  RequireAuth (erp) → TooltipProvider → AppShell → SuspensionGuard → FeatureGuard → página
/pos/**    →  RequireAuth (pos) → TooltipProvider → SedeProvider → OnboardingProvider → PosShell → página
```

| Guard | Archivo | Qué hace |
| --- | --- | --- |
| `RequireAuth` (panel) | `src/components/erp/require-auth.tsx` | Sin sesión → `/login`. Con sesión pero sin permisos de back-office → `/pos` (o `/login` si no tiene ninguna área habilitada). |
| `RequireAuth` (POS) | `src/components/pos/require-auth.tsx` | Sin sesión → `/login`. Con sesión pero sin `pos.sell` → `/panel` (o `/login`). |
| `SuspensionGuard` | `src/components/erp/suspension-guard.tsx` | Muestra el bloqueo de reactivación cuando el backend responde `ACCOUNT_SUSPENDED`. |
| `FeatureGuard` | `src/components/erp/feature-guard.tsx` | Bloquea por URL las páginas fuera del plan contratado (mapa prefijo → capacidad, resolviendo siempre el prefijo más largo). |

### Árbol de rutas

```text
src/app/
├── layout.tsx                          # raíz: fuentes, globals.css, ThemeProvider, anti-FOUC, toaster
├── globals.css
├── icon.svg
│
├── (marketing)/                        # zona pública, sin sesión
│   ├── layout.tsx
│   └── page.tsx                        → /
│
└── (secure)/                           # AuthProvider + ConfirmProvider
    ├── layout.tsx
    ├── login/page.tsx                  → /login
    ├── registro/page.tsx               → /registro
    ├── invitacion/[token]/page.tsx     → /invitacion/:token
    │
    ├── panel/                          # back-office (AppShell: sidebar + topbar)
    │   ├── layout.tsx
    │   ├── page.tsx                     → /panel                        (tablero de widgets)
    │   ├── sedes/page.tsx               → /panel/sedes
    │   ├── sedes/[id]/page.tsx          → /panel/sedes/:id
    │   ├── caja/page.tsx                → /panel/caja
    │   ├── inventario/page.tsx          → /panel/inventario
    │   ├── productos/page.tsx           → /panel/productos
    │   ├── compras/page.tsx             → /panel/compras
    │   ├── proveedores/page.tsx         → /panel/proveedores
    │   ├── clientes/page.tsx            → /panel/clientes               (cuentas por cobrar)
    │   ├── clientes/directorio/page.tsx → /panel/clientes/directorio
    │   ├── finanzas/
    │   │   ├── bancos/page.tsx          → /panel/finanzas/bancos
    │   │   ├── bancos/[id]/conciliar/   → /panel/finanzas/bancos/:id/conciliar
    │   │   ├── gastos/page.tsx          → /panel/finanzas/gastos
    │   │   ├── cxp/page.tsx             → /panel/finanzas/cxp
    │   │   ├── pl/page.tsx              → /panel/finanzas/pl
    │   │   ├── metas/page.tsx           → /panel/finanzas/metas
    │   │   ├── flujo/page.tsx           → /panel/finanzas/flujo
    │   │   └── reportes/page.tsx        → /panel/finanzas/reportes
    │   ├── empleados/page.tsx           → /panel/empleados
    │   ├── nomina/page.tsx              → /panel/nomina
    │   ├── nomina/deducciones/page.tsx  → /panel/nomina/deducciones
    │   ├── turnos/page.tsx              → /panel/turnos
    │   ├── impuestos/page.tsx           → /panel/impuestos
    │   ├── facturacion/page.tsx         → /panel/facturacion
    │   ├── auditoria/page.tsx           → /panel/auditoria
    │   ├── restaurante/page.tsx         → /panel/restaurante
    │   ├── pos/page.tsx                 → /panel/pos                    (venta rápida en el panel)
    │   └── config/
    │       ├── usuarios/page.tsx        → /panel/config/usuarios
    │       ├── parametros/page.tsx      → /panel/config/parametros
    │       └── plan/page.tsx            → /panel/config/plan
    │
    └── pos/                            # terminal de caja (PosShell)
        ├── layout.tsx
        ├── page.tsx                     → /pos                          (pantalla de venta)
        ├── ventas/page.tsx              → /pos/ventas
        ├── caja/page.tsx                → /pos/caja
        ├── inventario/page.tsx          → /pos/inventario
        ├── nomina/page.tsx              → /pos/nomina
        └── facturacion/page.tsx         → /pos/facturacion
```

### `/panel` frente a `/pos`

No son la misma aplicación con dos temas: son **dos superficies distintas sobre los mismos dominios de
negocio**, con permisos de entrada, chrome y clientes HTTP separados.

| | `/panel` — Operación | `/pos` — Punto de venta |
| --- | --- | --- |
| Público | Dueño, gerente, administrativo | Cajero, mesero, quien atiende |
| Permiso de entrada | Alguno de `OPERATION_PERMISSIONS` (`src/lib/access.ts`) | `pos.sell` |
| Chrome | `AppShell`: sidebar con seis secciones agrupadas + topbar | `PosShell`: barra lateral corta en escritorio, barra inferior en móvil |
| Navegación | `src/lib/erp/navigation.ts` — se filtra por giro de negocio, permisos y capacidades del plan | `src/lib/pos/navigation.ts` — seis destinos fijos; sin permiso, el ítem se muestra deshabilitado |
| Ámbito de datos | Toda la empresa; la sede se elige por página cuando aplica | Una **sede de trabajo** fijada para toda la sesión (`SedeProvider`, clave `pos.sedeId`) |
| Cliente HTTP | `src/lib/erp/api-*.ts` — 18 módulos (finanzas, nómina, auditoría, compras, impuestos, reportes…) | `src/lib/pos/api-*.ts` — 6 módulos (ventas, caja, inventario, clientes, asistencia, facturación electrónica) |
| Guards extra | `SuspensionGuard` + `FeatureGuard` (bloqueo por plan) | Ninguno: el terminal debe seguir vendiendo |
| Enfoque | Analizar, configurar, cerrar el mes | Cobrar rápido, imprimir, abrir y cerrar caja |

Hay una excepción deliberada: **`/panel/pos`** es una pantalla de venta simplificada dentro del panel
(usa `src/lib/erp/api-sales.ts`), pensada para que quien administra registre una venta sin salir del
back-office. El terminal real —órdenes de restaurante, propinas, descuentos, impresión de tirilla,
selección de sede persistente, recorridos guiados— es `/pos`.

---

## Organización del código: components, hooks, lib

| Carpeta | Qué es | Qué contiene aquí |
| --- | --- | --- |
| `src/components` | Todo lo que renderiza. Un archivo, un componente. | `ui/` (22 primitivas de shadcn/ui), `erp/` (shell, sidebar, topbar, guards, hojas laterales, factura electrónica), `pos/` (shell, comprobante, factura), `marketing/` (hero, beneficios, módulos, precios, FAQ, nav, footer), `onboarding/` (tour, checklist, bienvenida), `auth/`, `dashboard/` |
| `src/hooks` | Hooks reutilizables y agnósticos del dominio. Solo dos, a propósito. | `use-mobile.ts` (breakpoint de 768 px vía `matchMedia`), `use-scroll-progress.ts` (progreso de scroll suavizado, respeta `prefers-reduced-motion`) |
| `src/lib` | Lógica sin vista: clientes HTTP, contextos, catálogos, formato. | `api.ts` y `api-admin.ts` (auth y administración), `erp/` y `pos/` (clientes por dominio, navegación, CSV, formato), `auth-context.tsx`, `theme/`, `onboarding/`, `dashboard/`, `access.ts`, `env.ts`, `site.ts`, `utils.ts` |

Regla práctica: si tiene marcado, va en `components`; si es un hook genérico y reutilizable, en `hooks`;
si es dato, contrato con el backend o utilidad pura, en `lib`. Los contextos con provider
(`auth-context.tsx`, `theme/theme-context.tsx`, `pos/sede-context.tsx`) viven en `lib` aunque exporten
JSX, porque lo que aportan es estado, no vista.

Alias de importación: `@/*` → `./src/*` (definido en `tsconfig.json`).

---

## Integración con la API

### URL base

Se lee de `NEXT_PUBLIC_API_URL`, con `http://localhost:3001` como valor por defecto. Está declarada en
dos sitios, ambos como lectura directa de `process.env`:

```ts
// src/lib/api.ts y src/lib/api-admin.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
```

### Variables `NEXT_PUBLIC_*`

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Sí en producción (hay fallback a `localhost:3001`) | URL base del backend, sin barra final |
| `NEXT_PUBLIC_SITE_URL` | Recomendada por entorno | Origen público del sitio. Alimenta `metadataBase` (`src/lib/env.ts`): Open Graph y enlaces canónicos. Si llega mal escrita, cae a `https://www.bookipos.com` en lugar de romper el build |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | No | Mapa de la ficha de sede (`src/components/erp/sede-map.tsx`). Sin ella el resto del panel funciona igual |

> Toda variable `NEXT_PUBLIC_*` se incrusta **durante el build**. Tiene que existir donde corre
> `pnpm build`; definirla solo en el runtime no sirve, y cambiarla obliga a reconstruir. Nunca pongas un
> secreto ahí: queda a la vista de cualquiera en el bundle.

### Sesión, token y cookies

El flujo está partido en dos por diseño:

- **Access token** — llega en el cuerpo del login y se guarda en `localStorage` bajo la clave
  `sistemapos.auth`, junto con el usuario. Viaja en cada petición como `Authorization: Bearer …`.
- **Refresh token** — **nunca pasa por JavaScript**. El backend lo entrega en una cookie `HttpOnly`; por
  eso todas las llamadas de autenticación (`/auth/login`, `/auth/register`, `/auth/refresh`,
  `/auth/logout`, aceptar invitación) van con `credentials: "include"`.

`src/lib/auth-context.tsx` (`AuthProvider`) orquesta el ciclo:

1. Al montar, lee la sesión guardada y la valida contra `GET /auth/me`.
2. Si el access token venció, llama a `POST /auth/refresh` (la cookie viaja sola) y reintenta.
3. Si el refresh también falla, limpia `localStorage` y marca el estado como `unauthenticated`.

`authFetch` (`src/lib/api-admin.ts`) es el fetch autenticado que reutilizan **todos** los clientes de
`lib/erp` y `lib/pos`: añade el `Bearer`, y ante un `401` refresca **una sola vez** y reintenta la
petición original con el token nuevo.

El provider también expone lo que el token trae del backend: `permissions` (`hasPermission`), `plan` y
`entitlements` (`hasFeature`), y `tipoNegocio` (`isRetail` / `isRestaurant`). `hasFeature` es
deliberadamente **fail-open**: mientras la sesión carga, o con un token viejo sin el claim, devuelve
`true` para no bloquear de más.

### Cuenta suspendida

Cuando el backend responde `403` con `code: "ACCOUNT_SUSPENDED"`, el parser de errores emite el evento
global `bookipos:account-suspended` en `window`. El `AuthProvider` lo escucha, marca `suspended` y **no
cierra la sesión**: mantiene al usuario dentro para que `SuspensionGuard` muestre el bloqueo de
reactivación en lugar de un panel vacío.

### Si el backend no está levantado

La app **arranca igual**: la portada, `/login` y `/registro` son estáticas y no dependen de la API. A
partir de ahí:

- **Login** — el `fetch` falla en red (no llega a ser un `ApiError`) y la pantalla muestra
  *«No hay conexión con el servidor de BookiPos. Verifica tu internet e intenta de nuevo.»*
- **Sesión guardada** — `apiMe` y `apiRefresh` fallan, se limpia `localStorage`, el estado pasa a
  `unauthenticated` y `/panel` y `/pos` redirigen a `/login`.
- **Dentro del panel o del POS** — `authFetch` lanza `ApiError` y cada página muestra su propio error de
  carga.

En resumen: **para hacer cualquier cosa con sesión necesitas el backend corriendo.**

---

## Requisitos previos

| Requisito | Versión | Nota |
| --- | --- | --- |
| Node.js | `>= 20.9.0` | Requisito de `next@16.2.12` |
| pnpm | 9 o superior | El lockfile es `lockfileVersion: 9.0` |
| Backend BookiPos | — | NestJS + MongoDB, escuchando en `http://localhost:3001` |

---

## Puesta en marcha

```bash
# 1. Clonar
git clone https://github.com/BookiePos/Front_Booki.git
cd Front_Booki

# 2. Instalar dependencias
pnpm install

# 3. Configurar el entorno
cp .env.example .env.local

# 4. Arrancar en desarrollo
pnpm dev
```

La app queda en **http://localhost:3000**.

Ajusta `.env.local` según tu entorno:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_GOOGLE_MAPS_KEY=
```

### El backend es obligatorio

Sin la API arriba solo verás la web pública y el formulario de login. Para trabajar con datos reales:

```bash
# En el repositorio del backend (hermano de este)
cd ../Backend
npm install
npm run seed:demo    # datos de demostración
npm run dev          # http://localhost:3001
```

Necesitas además **MongoDB** en marcha (el backend trae un `docker-compose.yml`).

Credenciales de demostración que crea el seeder, usadas también por los tests E2E:

```text
usuario:    demo@sistemapos.local
contraseña: Demo123!
```

---

## Scripts

| Script | Comando | Qué hace |
| --- | --- | --- |
| `pnpm dev` | `next dev -p 3000` | Servidor de desarrollo en el puerto 3000 |
| `pnpm build` | `next build` | Build de producción |
| `pnpm start` | `next start -p 3000` | Sirve el build de producción en el puerto 3000 |
| `pnpm lint` | `eslint` | ESLint 9 con `core-web-vitals` + `typescript` de `eslint-config-next` |
| `pnpm e2e` | `playwright test` | Suite E2E completa (requiere el stack levantado) |
| `pnpm e2e:ui` | `playwright test --ui` | Runner interactivo de Playwright |

---

## Sistema de diseño

### Tailwind CSS v4

Sin `tailwind.config.js`. Toda la configuración vive en CSS: `src/app/globals.css` importa `tailwindcss`
y `tw-animate-css`, y define los tokens con `@theme` / `@theme inline`. El único cableado de build es
PostCSS:

```js
// postcss.config.mjs
const config = { plugins: { "@tailwindcss/postcss": {} } };
```

### Dos paletas que conviven

`globals.css` declara **dos familias de tokens que no comparten nombres**, y por eso pueden vivir en la
misma hoja sin pisarse:

| Familia | Tokens | La usa |
| --- | --- | --- |
| Tokens de shadcn/ui | `--background`, `--foreground`, `--primary`, `--card`, `--sidebar-*`, `--chart-1..5`, `--success`, `--warning`, `--info` | El producto: `/panel` y `/pos` (`bg-background`, `text-foreground`) |
| Tokens de marca | `--color-brand-50..950`, `--color-navy-900/950`, `--color-ink*`, `--color-surface*`, `--color-hairline` | La web pública, `/login` y `/registro` (`bg-brand-700`, `text-ink`) |

Cada zona pinta su propio fondo en su layout, de modo que ninguna compite por el `<body>`.

El primario es la orquídea de marca `#7621ab`, tomada del logo. Tipografía: **Inter** para texto
(`--font-sans`) y **Outfit** para display (`--font-display`), ambas vía `next/font/google` y cargadas una
sola vez en el layout raíz para las tres zonas. Radio base de `1rem`; sombras de base violeta y opacidad
baja. Utilidades propias: `.font-display`, `.tnum` (números tabulares), `.stat-figure`,
`.gradient-brand`, y `.text-warning-ink` / `.text-success-ink` / `.text-destructive-ink`.

### Modo oscuro

Disponible en **`/panel` y `/pos`**. La web pública, el login y el registro se quedan siempre en claro:
pintan su lienzo con tokens fijos de marca y `.zone-marketing` fuerza `color-scheme: light`.

Cómo funciona, de punta a punta:

| Pieza | Archivo | Rol |
| --- | --- | --- |
| Variante | `globals.css` → `@custom-variant dark (&:is(.dark *))` | Activa `dark:` a partir de la clase `.dark` en `<html>` |
| Almacén | `src/lib/theme/theme-store.ts` | Guarda el modo (`light` / `dark` / `system`) en `localStorage` bajo `bookipos.theme`; escribe la clase y `data-theme-mode` en `<html>` |
| Anti-FOUC | `THEME_INIT_SCRIPT`, inyectado en el `<head>` del layout raíz | Script inline y bloqueante que aplica el tema **antes del primer paint**. Sin él, al ser la app estática, quien usa oscuro vería un fogonazo blanco en cada carga. Por eso el `<html>` lleva `suppressHydrationWarning` |
| Provider | `src/lib/theme/theme-context.tsx` | Lee el almacén con `useSyncExternalStore` (no `useState` + `useEffect`): sin render en cascada y con snapshot de servidor |
| Interruptor | `src/components/ui/theme-toggle.tsx` | Montado en `AppTopbar` (`/panel`) y en `PosShell` (`/pos`) |

Detalles ya resueltos que conviene no romper:

- **Sincronización entre pestañas**: el store escucha el evento `storage`; cambiar el tema en una pestaña
  actualiza las demás sin recargar.
- **Modo `system`**: se suscribe a `prefers-color-scheme` y sigue al sistema operativo en vivo.
- **Barra del navegador**: las dos metaetiquetas `theme-color` se reescriben con el color resuelto, para
  que elegir oscuro con el sistema en claro no deje una franja descolgada.
- **Inversión de tono**: en oscuro el primario sube de `brand-700` a `brand-400` (`#c37bef`) sobre el
  lienzo marino `#00081c`, y el texto encima pasa a tinta oscura.
- **`color-scheme`** se declara por zona, para que scrollbars, autocompletado y `<input type="date">`
  nativos acompañen al tema.
- El toaster de **sonner** recibe el modo del tema (`AppToaster`), y el velo del recorrido guiado tiene su
  propia variable `--tour-scrim` por tema.

### shadcn/ui sobre Base UI

`components.json` configura shadcn/ui con estilo `base-nova`, base de color `neutral`, variables CSS, RSC
y `lucide` como librería de iconos. Las primitivas se generan sobre **`@base-ui/react`** (no Radix): por
ejemplo `src/components/ui/button.tsx` importa `Button as ButtonPrimitive` de `@base-ui/react/button` y
compone las variantes con `class-variance-authority`.

Alias configurados: `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`.

Para añadir un componente:

```bash
pnpm dlx shadcn@latest add <componente>
```

Se escribe en `src/components/ui/` y hereda los tokens de `globals.css` automáticamente. Las 22
primitivas ya presentes van de `button`, `input` y `table` a piezas propias del dominio como
`money-input`, `confirm-dialog` y `theme-toggle`.

### Optimización de bundle

`next.config.ts` activa `optimizePackageImports` para `lucide-react` y `@base-ui/react`: 61 archivos
importan del barril de iconos, que reexporta más de mil; sin esto el bundler recorre el barril entero en
cada uno.

---

## Testing E2E con Playwright

```bash
pnpm e2e        # headless: reporter list + HTML + JUnit
pnpm e2e:ui     # runner interactivo
```

### Requiere el stack completo levantado a mano

`playwright.config.ts` **no define `webServer`**, y es deliberado: el stack (MongoDB + NestJS + Next.js) no
se orquesta de forma fiable desde ahí. Antes de correr los tests:

```bash
# 1. MongoDB en marcha
# 2. Backend
cd ../Backend && npm run seed:demo && npm run dev     # → http://localhost:3001
# 3. Frontend
pnpm dev                                              # → http://localhost:3000
```

### Configuración

| Opción | Valor | Motivo |
| --- | --- | --- |
| `baseURL` | `http://localhost:3000` | Los tests navegan con rutas relativas (`page.goto("/login")`) |
| `testDir` | `./e2e` | — |
| `timeout` / `expect.timeout` | 30 s / 8 s | Flujos con login y navegación |
| `retries` | `0` | Los tests deben ser estables de entrada |
| `workers` | `1` | Evita conflictos de sesión de caja entre tests |
| `projects` | `chromium` (Desktop Chrome, 1280×800) | — |
| `extraHTTPHeaders` | `x-e2e-test: 1` | Identifica los requests E2E en los logs del backend |
| Artefactos | `trace: on-first-retry`, `screenshot: only-on-failure`, vídeo apagado | — |
| Reporters | `list`, HTML en `playwright-report/`, JUnit en `test-results/e2e-results.xml` | — |

### Qué cubre

**`e2e/login.spec.ts`** — flujo de autenticación:

- Login correcto con credenciales demo → aparece la pantalla de elección de zona («Punto de venta» /
  «Panel de operación») sin salir de `/login`.
- Tras el login, la cookie `refresh_token` existe en el contexto del navegador y no viene vacía.
- Credenciales incorrectas → mensaje en un `role="alert"`, la URL sigue en `/login` y el formulario
  permanece visible.
- Envío del formulario vacío → la validación HTML nativa bloquea el submit.

**`e2e/sale.spec.ts`** — flujo feliz de venta y protección de rutas:

- Login por interfaz → `/pos` → abrir caja si está cerrada → agregar producto → cobrar en efectivo con
  monto exacto → venta completada.
- `/pos` sin sesión → redirige a `/login`.
- `/panel` sin sesión → redirige a `/login`.

El spec es tolerante por diseño: si no hay productos vendibles o la caja no se puede abrir, hace `skip`
con un mensaje explicativo en vez de fallar en rojo.

**`e2e/helpers/auth.ts`** — credenciales demo y dos formas de autenticarse: `apiLogin` (POST directo al
backend, rápido, para preparar estado) y `uiLogin` (navegando por la interfaz real).

Los selectores son **por rol y por etiqueta accesible** (`getByRole`, `getByLabel`), no por clases CSS: si
un test se cae porque no encuentra un elemento, suele ser una regresión de accesibilidad real.

---

## Accesibilidad y rendimiento

Decisiones presentes en el código, no aspiraciones.

**Contraste.** `globals.css` documenta los ratios verificados de cada token contra su lienzo, en los dos
temas: `--primary` 7,6:1 en claro y 7,0:1 en oscuro; `--foreground` 16,9:1 / 16,2:1;
`--muted-foreground` 7,4:1 / 8,0:1; los semánticos (`success`, `warning`, `info`, `destructive`) entre
4,5:1 y 5,7:1. Dos correcciones concretas:

- Las clases `.text-warning-ink` / `.text-success-ink` / `.text-destructive-ink` existen porque
  `text-warning` sobre `bg-warning/10` se quedaba en 3,6:1; empujan la tinta hacia el color base del texto
  y suben a AA en ambos temas sin perder el significado del color.
- Las cabeceras en degradado (`.gradient-brand`) calculan su extremo desde los propios tokens: antes
  terminaban en un violeta fijo que, en modo oscuro, dejaba el texto en 1,9:1.

**Movimiento.** Bloque `@media (prefers-reduced-motion: reduce)` que anula animaciones y transiciones,
devuelve `scroll-behavior` a `auto`, apaga la aurora del hero y —importante— fuerza `filter: none` en
`.reveal`: sin eso el contenido quedaría permanentemente desenfocado.

**Foco.** Anillo de foco visible y consistente en todo elemento interactivo de la zona pública
(`:focus-visible` con `outline` de 2 px y `outline-offset`, WCAG 2.4.7). Las primitivas de `ui/` traen su
propio `focus-visible:ring` desde las variantes.

**Semántica.** Landmarks reales (`<main id="contenido">`, `<nav aria-label="Principal">`,
`<nav aria-label="Pie de página">`), secciones con `aria-labelledby`, pestañas con `aria-label`,
`sr-only` para el texto de iconos y de la tabla comparativa de precios, y `role="alert"` para los errores
de formulario. `window.confirm` fue reemplazado por un diálogo accesible propio
(`src/components/ui/confirm-dialog.tsx`).

**Idioma y formatos.** `<html lang="es">`; moneda y números con `Intl` y locale `es-CO` (`formatCOP`,
`formatNumber` en `src/lib/utils.ts`).

**Rendimiento.**

- Las revelaciones al hacer scroll usan `IntersectionObserver` y **se desconectan tras la primera
  aparición**; el `will-change` se libera al terminar para no dejar capas de GPU colgadas. `filter` solo
  aparece en esa entrada puntual, nunca atado al scroll continuo.
- La aurora del hero anima únicamente `transform` y `opacity`: sin reflow, sin CLS.
- Fuentes con `display: "swap"` y un solo par para las tres zonas: el navegador las descarga una vez.
- `optimizePackageImports` sobre los dos barriles grandes (`lucide-react`, `@base-ui/react`).
- `scroll-padding-top` en `html` compensa la barra fija en los saltos de ancla; `overscroll-behavior-y:
  none` evita las bandas blancas del rebote.

**Impresión.** Regla `@media print` dedicada al comprobante: rollo de 80 mm (`@page { size: 80mm auto }`),
área imprimible de 74 mm, todo a negro puro porque el gris «muted» sale casi invisible en impresora
térmica, y el resto de la interfaz oculto. Sirve igual para térmica y para «Guardar como PDF».

---

## Despliegue en Vercel

El proyecto se despliega en Vercel sin `vercel.json`: la detección automática de Next.js basta.

| Ajuste | Valor |
| --- | --- |
| Framework | Next.js |
| Install command | `pnpm install` |
| Build command | `pnpm build` (`next build`) |
| Node.js | 20.9 o superior |

Variables de entorno a definir en **Settings → Environment Variables**, en todos los entornos donde haya
build (Production, Preview y Development):

| Variable | Production | Preview |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | URL pública del backend (p. ej. `https://api.bookipos.com`) | Backend de staging |
| `NEXT_PUBLIC_SITE_URL` | `https://www.bookipos.com` | URL del preview, para no anunciar el dominio de producción en los canónicos |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Clave restringida por referente HTTP | Opcional |

Recordatorio: son variables de **build**. Cambiar cualquiera exige un redeploy; definirlas solo en el
runtime no tiene efecto.

Dos cosas que dependen del backend y no de esta app:

- **CORS** debe permitir el origen del frontend **con credenciales**, porque el refresh token viaja en
  cookie.
- La **cookie del refresh token** necesita `SameSite` y `Secure` coherentes con el dominio desde el que se
  sirve la app.

---

## Estructura de carpetas

```text
Frontend/
├── e2e/                          # Tests end-to-end (Playwright)
│   ├── helpers/auth.ts           # Credenciales demo, apiLogin / uiLogin
│   ├── login.spec.ts
│   └── sale.spec.ts
├── public/
│   └── brand/bookipos-og.jpg     # Imagen de Open Graph
├── src/
│   ├── app/
│   │   ├── (marketing)/          # Web pública
│   │   ├── (secure)/             # Login, registro, invitación, panel, POS
│   │   ├── globals.css           # Tailwind v4: tokens, temas, utilidades, impresión
│   │   ├── icon.svg
│   │   └── layout.tsx            # Layout raíz (fuentes, tema, toaster)
│   ├── components/
│   │   ├── auth/                 # Panel de marca de las pantallas de sesión
│   │   ├── dashboard/            # Grilla de widgets del panel
│   │   ├── erp/                  # Shell, sidebar, topbar, guards, hojas laterales
│   │   │   └── finance/
│   │   ├── marketing/            # Hero, beneficios, módulos, precios, FAQ, nav, footer
│   │   ├── onboarding/           # Recorrido guiado, checklist, bienvenida
│   │   ├── pos/                  # Shell del terminal, comprobante, factura
│   │   └── ui/                   # 22 primitivas shadcn/ui sobre @base-ui/react
│   ├── hooks/
│   │   ├── use-mobile.ts
│   │   └── use-scroll-progress.ts
│   └── lib/
│       ├── api.ts                # Auth pública: login, registro, refresh, invitaciones
│       ├── api-admin.ts          # authFetch + usuarios, roles, permisos, invitaciones
│       ├── auth-context.tsx      # AuthProvider: sesión, permisos, plan, suspensión
│       ├── access.ts             # Permisos que habilitan POS frente a Operación
│       ├── env.ts                # SITE_URL normalizada
│       ├── site.ts               # Contenido de la web pública (precios, módulos, FAQ)
│       ├── utils.ts              # cn, formatCOP, formatNumber, clamp
│       ├── dashboard/            # Registro de widgets, layout por usuario, datos
│       ├── erp/                  # 18 clientes HTTP del back-office + navegación + CSV
│       ├── onboarding/           # Contexto y registro de recorridos guiados
│       ├── pos/                  # Clientes HTTP del terminal + navegación + SedeProvider
│       └── theme/                # Store y provider del tema (claro / oscuro / sistema)
├── .env.example
├── components.json               # Configuración de shadcn/ui
├── eslint.config.mjs
├── next.config.ts
├── playwright.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

### Claves de `localStorage`

| Clave | Contenido |
| --- | --- |
| `sistemapos.auth` | Access token + usuario de la sesión |
| `bookipos.theme` | Modo de tema (`light` / `dark` / `system`) |
| `bookipos.dashboard.<userId>` | Layout de widgets del panel |
| `bookipos.onboarding.<userId>` | Progreso de los recorridos guiados |
| `pos.sedeId` | Sede de trabajo elegida en el terminal |

---

## Convención de commits

El historial sigue **Conventional Commits con ámbito y descripción en español**:

```text
<tipo>(<ámbito>): <descripción en imperativo, en minúscula>
```

Tipos en uso: `feat`, `fix`, `refactor`, `chore`, `test`.

Ámbitos reales del historial: `tema`, `web`, `diseño`, `marca`, `config`, `registro`, `billing`, `planes`,
`onboarding`, `restaurante`, `inventario`, `dashboard`, `finanzas`, `rbac`, `seguridad`, `ux`,
`pos/restaurante`, `turnos+nomina`, `caja+reportes`.

Ejemplos del propio repositorio:

```text
feat(tema): modo oscuro en el panel y el POS
fix(web): contraste WCAG, responsive y velocidad de la portada
refactor(marca): completar el renombrado de GoCheck a BookiPos
feat(config): dominio público por variable de entorno y env de seeders
```
