"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { GoCheckLogo } from "@/components/marketing/gocheck-logo";
import { useOverDarkSection, useScrolledPast } from "@/hooks/use-scroll-progress";
import { NAV_LINKS } from "@/lib/site";
import { cn } from "@/lib/utils";

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const scrolled = useScrolledPast(20);
  // La cortina de marca es violeta 950: sobre ella el nav va en claro.
  const onDark = useOverDarkSection() && !open;
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Escape cierra el menú y devuelve el foco al botón que lo abrió.
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
        "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter,border-color] duration-300",
        onDark
          ? "border-b border-transparent bg-transparent"
          : scrolled
            ? "border-b border-hairline bg-white/85 shadow-[0_1px_24px_-12px_rgba(46,16,101,0.35)] backdrop-blur-xl"
            : "border-b border-transparent bg-transparent",
      )}
    >
      <nav
        aria-label="Principal"
        className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8"
      >
        <Link href="/" className="shrink-0 py-2" aria-label="GoCheck — inicio">
          <GoCheckLogo tone={onDark ? "light" : "dark"} />
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
              "inline-flex h-11 items-center rounded-full px-5 text-[0.95rem] font-semibold transition-colors duration-300 text-black",
              onDark
                ? "hover:bg-white/10"
                : "hover:bg-brand-50",
            )}
          >
            Iniciar sesión
          </Link>
          <a
            href="#precios"
            className={cn(
              "inline-flex h-11 items-center rounded-full px-5 text-[0.95rem] font-semibold transition-[background-color,color,transform] duration-300 active:scale-[0.97]",
              onDark
                ? "bg-white text-brand-900 hover:bg-brand-100"
                : "bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-[0_6px_20px_-6px_rgba(109,40,217,0.75)] hover:from-brand-700 hover:to-brand-900",
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
            "inline-flex size-11 items-center justify-center rounded-full transition-colors lg:hidden",
            onDark ? "text-white hover:bg-white/10" : "text-ink hover:bg-brand-50",
          )}
        >
          <span className="sr-only">{open ? "Cerrar menú" : "Abrir menú"}</span>
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </nav>

      {/* Panel móvil. Se desmonta al cerrar para no dejar foco atrapado. */}
      {open && (
        <div
          id="menu-movil"
          ref={panelRef}
          className="border-t border-hairline bg-white px-5 pb-8 pt-4 lg:hidden"
        >
          <ul className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex h-14 items-center border-b border-hairline text-lg font-medium text-ink"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="inline-flex h-13 items-center justify-center rounded-full border border-brand-200 px-6 font-semibold text-black"
            >
              Iniciar sesión
            </Link>
            <a
              href="#precios"
              onClick={() => setOpen(false)}
              className="inline-flex h-13 items-center justify-center rounded-full bg-brand-700 px-6 font-semibold text-white"
            >
              Probar gratis
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
