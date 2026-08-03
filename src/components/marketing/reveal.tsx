"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Retardo en ms — usar en cascada (30–50ms por ítem) dentro de una grilla. */
  delay?: number;
  as?: ElementType;
}

/**
 * Aparición al entrar en viewport, vía IntersectionObserver (no scroll listener).
 * Se desconecta tras la primera aparición: la entrada ocurre una sola vez.
 *
 * El contenido está siempre en el DOM y es accesible; solo cambian opacity y
 * transform. Con `prefers-reduced-motion` el CSS anula el desplazamiento.
 */
export function Reveal({ children, className, delay = 0, as: Tag = "div" }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn("reveal", className)}
      data-visible={visible}
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}
