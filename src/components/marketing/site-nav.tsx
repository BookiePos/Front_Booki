"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { BookiPosLogo } from "@/components/marketing/bookipos-logo";
import { useScrolledPast } from "@/hooks/use-scroll-progress";
import { CTA_REGISTRO, NAV_LINKS } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Alto de la barra (h-18). Vive aquí porque el panel móvil lo necesita para
 * calcular su alto máximo y el velo su borde superior.
 */
const ALTO_BARRA = "4.5rem";

/**
 * Barra de navegación fija de la portada.
 *
 * Arriba del todo es transparente: deja ver la tirilla cortada por el borde.
 * Al bajar toma el gris de la mesa con una raya de 2px, la misma de las
 * secciones. Enlaces en la monoespaciada de la portada, botón recto.
 */
export function SiteNav() {
  const [open, setOpen] = useState(false);
  const scrolled = useScrolledPast(20);
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
        "fixed inset-x-0 top-0 z-50 border-b-2 transition-[background-color,border-color] duration-300",
        open
          ? "border-navy-950 bg-mesa"
          : scrolled
            ? "border-navy-950 bg-mesa/90 backdrop-blur-md"
            : "border-transparent bg-transparent",
      )}
    >
      <nav
        aria-label="Principal"
        className="mx-auto flex h-18 max-w-7xl items-center gap-4 px-5 sm:gap-6 sm:px-8"
      >
        <Link href="/" className="shrink-0 py-2" aria-label="BookiPos, inicio">
          <BookiPosLogo />
        </Link>

        <ul className="ml-6 hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="inline-flex h-11 items-center px-3 font-mono text-sm font-medium text-navy-950 underline-offset-4 transition-colors hover:text-brand-700 hover:underline"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto hidden items-center gap-2 font-mono text-sm font-bold uppercase lg:flex">
          <Link
            href="/login"
            className="inline-flex h-11 items-center px-4 text-navy-950 underline-offset-4 transition-colors hover:text-brand-700 hover:underline"
          >
            Iniciar sesión
          </Link>
          <Link
            href={CTA_REGISTRO.href}
            className="inline-flex h-11 items-center bg-navy-950 px-5 text-white transition-colors duration-150 hover:bg-brand-700"
          >
            {CTA_REGISTRO.label}
          </Link>
        </div>

        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="menu-movil"
          className="ml-auto inline-flex size-11 shrink-0 items-center justify-center text-navy-950 lg:hidden"
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
            className="fixed inset-x-0 bottom-0 bg-navy-950/40 lg:hidden"
            style={{ top: ALTO_BARRA }}
          >
            <span className="sr-only">Cerrar menú</span>
          </button>

          {/* El panel scrollea por dentro: en un móvil apaisado (≈360×400) los
              enlaces más los dos botones no caben, y como el <body> está
              bloqueado quedaban inalcanzables. `svh` y no `vh` para que la
              barra del navegador móvil no recorte el último botón. */}
          <div
            id="menu-movil"
            className="relative overflow-y-auto overscroll-contain bg-mesa px-5 pt-2 lg:hidden"
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
                    className="flex h-14 items-center border-b border-navy-950/20 font-mono text-xl font-extrabold tracking-[-0.03em] text-navy-950 uppercase"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col font-mono text-sm font-bold uppercase">
              <Link
                href={CTA_REGISTRO.href}
                onClick={() => setOpen(false)}
                className="inline-flex h-13 items-center justify-center bg-navy-950 px-6 text-white"
              >
                {CTA_REGISTRO.label}
              </Link>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="inline-flex h-13 items-center justify-center border-2 border-t-0 border-navy-950 px-6 text-navy-950"
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
