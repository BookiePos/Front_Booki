"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { BookiPosLogo } from "@/components/marketing/bookipos-logo";
import { useOverDarkSection, useScrolledPast } from "@/hooks/use-scroll-progress";
import { NAV_LINKS } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Alto de la barra (h-18). Vive aquí porque el panel móvil lo necesita para
 * calcular su alto máximo y el velo su borde superior.
 */
const ALTO_BARRA = "4.5rem";

/**
 * Barra de navegación fija.
 *
 * Contrastes medidos (WCAG 2.1):
 *   · sobre sección oscura: brand-100 sobre brand-950 ....... 13.19:1 ✓ AAA
 *   · sobre papel: ink-soft sobre blanco .................... 13.28:1 ✓ AAA
 *   · CTA claro: brand-900 sobre blanco ..................... 13.38:1 ✓ AAA
 *   · CTA morado: blanco sobre brand-600→brand-800 ... 5.92–10.50:1 ✓ AA
 *   · menú móvil "Iniciar sesión": brand-700 sobre brand-50 ... 7.9:1 ✓ AAA
 */
export function SiteNav() {
  const [open, setOpen] = useState(false);
  const scrolled = useScrolledPast(20);
  // La cortina de marca es violeta 950: sobre ella el nav va en claro.
  const onDark = useOverDarkSection() && !open;
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Escape cierra el menú y devuelve el foco al botón que lo abrió: el panel
  // se desmonta, así que sin esto el foco caería al <body>.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Al pasar a escritorio el panel se oculta con `lg:hidden`, pero el estado
  // seguía abierto y el <body> bloqueado: girar el teléfono dejaba la página
  // sin scroll y sin forma visible de recuperarlo.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 64rem)");
    const cerrar = () => {
      if (mq.matches) setOpen(false);
    };
    cerrar();
    mq.addEventListener("change", cerrar);
    return () => mq.removeEventListener("change", cerrar);
  }, [open]);

  // Bloquea el scroll de fondo mientras el panel móvil está abierto.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        // No se transiciona `backdrop-filter`: interpolarlo obliga a
        // recomponer el desenfoque en cada frame.
        "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300",
        open
          ? // Con el panel abierto la barra tiene que ser opaca sí o sí: si no,
            // arriba del todo se veía el hero por detrás del logo mientras el
            // panel de debajo era blanco.
            "border-b border-hairline bg-white shadow-[0_1px_24px_-12px_rgba(74,7,115,0.35)]"
          : onDark
            ? "border-b border-transparent bg-transparent"
            : scrolled
              ? "border-b border-hairline bg-white/85 shadow-[0_1px_24px_-12px_rgba(74,7,115,0.35)] backdrop-blur-xl"
              : "border-b border-transparent bg-transparent",
      )}
    >
      <nav
        aria-label="Principal"
        className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-5 sm:gap-6 sm:px-8"
      >
        <Link href="/" className="shrink-0 py-2" aria-label="BookiPos — inicio">
          <BookiPosLogo tone={onDark ? "light" : "dark"} />
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={cn(
                  "inline-flex h-11 items-center rounded-full px-4 text-[0.95rem] font-medium transition-colors duration-300",
                  onDark
                    ? "text-brand-100 hover:bg-white/10 hover:text-white"
                    : "text-ink-soft hover:bg-brand-50 hover:text-brand-700",
                )}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/login"
            className={cn(
              "inline-flex h-11 items-center rounded-full px-5 text-[0.95rem] font-semibold transition-colors duration-300",
              onDark
                ? "text-brand-100 hover:bg-white/10 hover:text-white"
                : "text-ink-soft hover:bg-brand-50 hover:text-brand-700",
            )}
          >
            Iniciar sesión
          </Link>
          {/* Recuadro morado del CTA: degradado entre pasos vecinos (600→800),
              anillo interior de 1px más claro que el relleno y sombra teñida
              de brand-900. La sombra anterior era el violeta viejo #6d28d9,
              ajeno a la paleta muestreada del logo. */}
          <a
            href="#precios"
            className={cn(
              "inline-flex h-11 items-center rounded-full px-5 text-[0.95rem] font-semibold transition-[background-color,background-image,transform] duration-300 active:scale-[0.97]",
              onDark
                ? "bg-white text-brand-900 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.55)] hover:bg-brand-100"
                : "bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 text-white shadow-[0_8px_22px_-8px_rgba(74,7,115,0.75)] ring-1 ring-inset ring-white/20 hover:from-brand-700 hover:via-brand-800 hover:to-brand-900",
            )}
          >
            Probar gratis
          </a>
        </div>

        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="menu-movil"
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors lg:hidden",
            onDark ? "text-white hover:bg-white/10" : "text-ink hover:bg-brand-50",
          )}
        >
          <span className="sr-only">{open ? "Cerrar menú" : "Abrir menú"}</span>
          {open ? (
            <X className="size-6" aria-hidden="true" />
          ) : (
            <Menu className="size-6" aria-hidden="true" />
          )}
        </button>
      </nav>

      {/* Panel móvil. Se desmonta al cerrar para no dejar foco atrapado. */}
      {open && (
        <>
          {/* Velo: separa el panel del contenido y da una salida grande para
              el pulgar. Va antes que el panel en el orden del DOM y ninguno
              lleva z-index, así que el panel (relative) queda encima. */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              toggleRef.current?.focus();
            }}
            className="fixed inset-x-0 bottom-0 bg-navy-950/45 lg:hidden"
            style={{ top: ALTO_BARRA }}
          >
            <span className="sr-only">Cerrar menú</span>
          </button>

          {/* El panel scrollea por dentro: en un móvil apaisado (≈360×400) los
              cinco enlaces más los dos botones no caben, y como el <body> está
              bloqueado quedaban inalcanzables. `svh` y no `vh` para que la
              barra del navegador móvil no recorte el último botón. */}
          <div
            id="menu-movil"
            className="relative overflow-y-auto overscroll-contain border-t border-hairline bg-gradient-to-b from-white to-brand-50 px-5 pt-4 lg:hidden"
            style={{
              maxHeight: `calc(100svh - ${ALTO_BARRA})`,
              paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
            }}
          >
            <ul className="flex flex-col">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex h-14 items-center border-b border-brand-100 text-lg font-medium text-ink transition-colors active:text-brand-700"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col gap-3">
              {/* El borde es lo ÚNICO que dibuja este botón —su relleno
                  brand-50 es el mismo color al que llega el degradado del
                  panel—, así que WCAG 1.4.11 le exige 3:1. brand-300 daba
                  1.90:1; brand-500 da 3.46:1 sobre brand-50. */}
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="inline-flex h-13 items-center justify-center rounded-full border border-brand-500 bg-brand-50 px-6 font-semibold text-brand-700 transition-transform duration-150 active:scale-[0.98]"
              >
                Iniciar sesión
              </Link>
              <a
                href="#precios"
                onClick={() => setOpen(false)}
                className="inline-flex h-13 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 px-6 font-semibold text-white shadow-[0_10px_26px_-10px_rgba(74,7,115,0.8)] ring-1 ring-inset ring-white/20 transition-transform duration-150 active:scale-[0.98]"
              >
                Probar gratis
              </a>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
