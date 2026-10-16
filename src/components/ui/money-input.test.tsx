import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { MoneyInput } from "./money-input"

/**
 * El campo de dinero muestra el punto de los miles mientras se escribe y
 * entrega SIEMPRE un número limpio. Un cero de más en un precio no lo ve nadie
 * hasta que se cobró mal.
 */
function Controlado({ decimales, onValor }: { decimales?: number; onValor: (n: number | null) => void }) {
  const [v, setV] = React.useState<number | null>(null)
  return (
    <MoneyInput
      aria-label="Precio"
      value={v}
      decimales={decimales}
      onValueChange={(n) => {
        setV(n)
        onValor(n)
      }}
    />
  )
}

describe("MoneyInput", () => {
  it("pone el punto de miles al teclear y entrega el número", () => {
    const onValor = vi.fn()
    render(<Controlado onValor={onValor} />)
    const campo = screen.getByLabelText("Precio") as HTMLInputElement
    fireEvent.change(campo, { target: { value: "45000" } })
    expect(campo.value).toBe("45.000")
    expect(onValor).toHaveBeenLastCalledWith(45000)
  })

  it("sin decimales descarta coma, puntos y símbolos pegados", () => {
    const onValor = vi.fn()
    render(<Controlado onValor={onValor} />)
    fireEvent.change(screen.getByLabelText("Precio"), { target: { value: "$ 1.234,56" } })
    expect(onValor).toHaveBeenLastCalledWith(123456)
  })

  it("vacío es null, no cero", () => {
    const onValor = vi.fn()
    render(<Controlado onValor={onValor} />)
    fireEvent.change(screen.getByLabelText("Precio"), { target: { value: "500" } })
    fireEvent.change(screen.getByLabelText("Precio"), { target: { value: "" } })
    expect(onValor).toHaveBeenLastCalledWith(null)
  })

  it("con decimales deja escribir la coma y acepta el punto del teclado numérico", () => {
    const onValor = vi.fn()
    render(<Controlado decimales={2} onValor={onValor} />)
    const campo = screen.getByLabelText("Precio") as HTMLInputElement
    fireEvent.change(campo, { target: { value: "3," } })
    expect(campo.value).toBe("3,")
    fireEvent.change(campo, { target: { value: "3.8" } })
    expect(onValor).toHaveBeenLastCalledWith(3.8)
    fireEvent.blur(campo)
    expect(campo.value).toBe("3,8")
  })
})
