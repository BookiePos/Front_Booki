import { describe, expect, it, vi, type Mock } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import {
  accionDeTecla,
  useAtajosPos,
  type UseAtajosPosOptions,
} from "./use-atajos-pos"

type Espias = Pick<
  UseAtajosPosOptions,
  "cobroAbierto" | "ayudaAbierta" | "puedeCobrar"
> & {
  onBuscar: Mock
  onCobrar: Mock
  onCantidad: Mock
  onMetodo: Mock
  onCerrar: Mock
  onAyuda: Mock
}

function opciones(over: Partial<Espias> = {}): Espias {
  return {
    cobroAbierto: false,
    ayudaAbierta: false,
    puedeCobrar: true,
    onBuscar: vi.fn(),
    onCobrar: vi.fn(),
    onCantidad: vi.fn(),
    onMetodo: vi.fn(),
    onCerrar: vi.fn(),
    onAyuda: vi.fn(),
    ...over,
  }
}

function Probe({ o }: { o: UseAtajosPosOptions }) {
  useAtajosPos(o)
  return (
    <div>
      <input aria-label="campo" />
      <input type="checkbox" aria-label="marca" />
    </div>
  )
}

/** Dispara la tecla y devuelve true si nadie llamó a preventDefault. */
function tecla(init: KeyboardEventInit & { key: string }, el?: Element) {
  return fireEvent.keyDown(el ?? document.body, init)
}

describe("accionDeTecla", () => {
  it("deja pasar cualquier combinación con Ctrl o Meta", () => {
    const base = { code: "", altKey: false, shiftKey: false }
    for (const key of ["r", "w", "k", "F4", "F2", "+", "1"]) {
      expect(
        accionDeTecla({ ...base, key, ctrlKey: true, metaKey: false }, false),
      ).toBeNull()
      expect(
        accionDeTecla({ ...base, key, ctrlKey: false, metaKey: true }, false),
      ).toBeNull()
    }
  })

  it("Alt solo vale con dígito 1..4: Alt+F4 y Alt+5 no son nuestros", () => {
    const base = { ctrlKey: false, metaKey: false, shiftKey: false, altKey: true }
    expect(accionDeTecla({ ...base, key: "F4", code: "F4" }, false)).toBeNull()
    expect(accionDeTecla({ ...base, key: "5", code: "Digit5" }, false)).toBeNull()
    expect(accionDeTecla({ ...base, key: "3", code: "Digit3" }, false)).toEqual({
      accion: "metodo",
      indice: 2,
    })
  })
})

describe("useAtajosPos", () => {
  it("F2 busca, F4 cobra y ambos evitan la acción del navegador", () => {
    const o = opciones()
    render(<Probe o={o} />)
    expect(tecla({ key: "F2" })).toBe(false)
    expect(tecla({ key: "F4" })).toBe(false)
    expect(o.onBuscar).toHaveBeenCalledTimes(1)
    expect(o.onCobrar).toHaveBeenCalledTimes(1)
  })

  it("F4 no hace nada sin nada que cobrar ni con el cobro ya abierto", () => {
    const vacio = opciones({ puedeCobrar: false })
    const { unmount } = render(<Probe o={vacio} />)
    expect(tecla({ key: "F4" })).toBe(true)
    expect(vacio.onCobrar).not.toHaveBeenCalled()
    unmount()

    const abierto = opciones({ cobroAbierto: true })
    render(<Probe o={abierto} />)
    tecla({ key: "F4" })
    expect(abierto.onCobrar).not.toHaveBeenCalled()
  })

  it("F4 mantenida no repite el cobro", () => {
    const o = opciones()
    render(<Probe o={o} />)
    tecla({ key: "F4", repeat: true })
    expect(o.onCobrar).not.toHaveBeenCalled()
  })

  it("F2 y F4 funcionan con el foco dentro de un campo", () => {
    const o = opciones()
    render(<Probe o={o} />)
    const campo = screen.getByLabelText("campo")
    tecla({ key: "F2" }, campo)
    tecla({ key: "F4" }, campo)
    expect(o.onBuscar).toHaveBeenCalledTimes(1)
    expect(o.onCobrar).toHaveBeenCalledTimes(1)
  })

  it("+ y − cambian la cantidad fuera de un campo", () => {
    const o = opciones()
    render(<Probe o={o} />)
    tecla({ key: "+" })
    tecla({ key: "-" })
    tecla({ key: "−" })
    expect(o.onCantidad.mock.calls).toEqual([[1], [-1], [-1]])
  })

  it("+, − y ? no se secuestran mientras se escribe en un campo", () => {
    const o = opciones()
    render(<Probe o={o} />)
    const campo = screen.getByLabelText("campo")
    expect(tecla({ key: "+" }, campo)).toBe(true)
    expect(tecla({ key: "-" }, campo)).toBe(true)
    expect(tecla({ key: "?" }, campo)).toBe(true)
    expect(o.onCantidad).not.toHaveBeenCalled()
    expect(o.onAyuda).not.toHaveBeenCalled()
  })

  it("una casilla no cuenta como campo de texto", () => {
    const o = opciones()
    render(<Probe o={o} />)
    tecla({ key: "+" }, screen.getByLabelText("marca"))
    expect(o.onCantidad).toHaveBeenCalledWith(1)
  })

  it("? abre la ayuda", () => {
    const o = opciones()
    render(<Probe o={o} />)
    tecla({ key: "?", shiftKey: true })
    expect(o.onAyuda).toHaveBeenCalledTimes(1)
  })

  it("F6..F9 y Alt+1..4 eligen método solo con el cobro abierto", () => {
    const cerrado = opciones()
    const { unmount } = render(<Probe o={cerrado} />)
    tecla({ key: "F6" })
    tecla({ key: "1", code: "Digit1", altKey: true })
    expect(cerrado.onMetodo).not.toHaveBeenCalled()
    unmount()

    const o = opciones({ cobroAbierto: true })
    render(<Probe o={o} />)
    for (const k of ["F6", "F7", "F8", "F9"]) tecla({ key: k })
    for (const n of [1, 2, 3, 4]) {
      tecla({ key: String(n), code: `Digit${n}`, altKey: true })
    }
    expect(o.onMetodo.mock.calls.map((c) => c[0])).toEqual([
      0, 1, 2, 3, 0, 1, 2, 3,
    ])
  })

  it("Esc cierra la ayuda solo si está abierta", () => {
    const cerrada = opciones()
    const { unmount } = render(<Probe o={cerrada} />)
    expect(tecla({ key: "Escape" })).toBe(true)
    expect(cerrada.onCerrar).not.toHaveBeenCalled()
    unmount()

    const abierta = opciones({ ayudaAbierta: true })
    render(<Probe o={abierta} />)
    expect(tecla({ key: "Escape" })).toBe(false)
    expect(abierta.onCerrar).toHaveBeenCalledTimes(1)
  })

  it("con la ayuda abierta no se dispara nada más", () => {
    const o = opciones({ ayudaAbierta: true, cobroAbierto: true })
    render(<Probe o={o} />)
    for (const key of ["F2", "F4", "F6", "+"]) tecla({ key })
    expect(o.onBuscar).not.toHaveBeenCalled()
    expect(o.onCobrar).not.toHaveBeenCalled()
    expect(o.onMetodo).not.toHaveBeenCalled()
    expect(o.onCantidad).not.toHaveBeenCalled()
  })

  it("respeta los atajos del navegador: Ctrl+R, Ctrl+W, Alt+F4", () => {
    const o = opciones({ cobroAbierto: true })
    render(<Probe o={o} />)
    expect(tecla({ key: "r", code: "KeyR", ctrlKey: true })).toBe(true)
    expect(tecla({ key: "w", code: "KeyW", ctrlKey: true })).toBe(true)
    expect(tecla({ key: "F4", code: "F4", altKey: true })).toBe(true)
    expect(tecla({ key: "1", code: "Digit1", ctrlKey: true })).toBe(true)
    expect(o.onMetodo).not.toHaveBeenCalled()
    expect(o.onCobrar).not.toHaveBeenCalled()
  })

  it("enabled=false apaga todo y al desmontar se suelta el escucha", () => {
    const apagado = opciones()
    const { unmount } = render(<Probe o={{ ...apagado, enabled: false }} />)
    tecla({ key: "F2" })
    expect(apagado.onBuscar).not.toHaveBeenCalled()
    unmount()

    const o = opciones()
    render(<Probe o={o} />).unmount()
    tecla({ key: "F2" })
    expect(o.onBuscar).not.toHaveBeenCalled()
  })

  it("usa siempre la última versión de los callbacks", () => {
    const a = opciones()
    const b = opciones()
    const { rerender } = render(<Probe o={a} />)
    rerender(<Probe o={b} />)
    tecla({ key: "F2" })
    expect(a.onBuscar).not.toHaveBeenCalled()
    expect(b.onBuscar).toHaveBeenCalledTimes(1)
  })
})
