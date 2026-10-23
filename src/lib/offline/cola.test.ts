import "fake-indexeddb/auto"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  ConflictoOffline,
  encolarVenta,
  guardarCopia,
  guardarReserva,
  leerCopia,
  leerReserva,
  motivosNoOffline,
  reintentar,
  restantes,
  SinNumerosError,
  sincronizar,
  ventasEnCola,
  type NuevaVentaOffline,
  type SyncDto,
} from "@/lib/offline/cola"
import {
  borrarTodo,
  dbName,
  limpiarAlCerrarSesion,
  ventasSinSincronizar,
  type Alcance,
} from "@/lib/offline/idb"
import { alcanceDeToken } from "@/lib/offline/alcance"

const A: Alcance = { businessId: "biz-a", userId: "u-1" }
const B: Alcance = { businessId: "biz-b", userId: "u-1" }
const SEDE = "sede-1"
const TURNO = "turno-1"

function venta(over: Partial<NuevaVentaOffline> = {}): NuevaVentaOffline {
  return {
    sedeId: SEDE,
    cajaSessionId: TURNO,
    sale: {
      sedeId: SEDE,
      lines: [{ productId: "p1", qty: 2 }],
      payment: { method: "cash", received: 30_000 },
      orderType: "mostrador",
      packaging: [],
      packagingExplicit: true,
    },
    lineas: [{ productId: "p1", name: "Arepa", sku: "A1", unit: "und", qty: 2, unitPrice: 11_900 }],
    expectedGrandTotal: 23_800,
    cashierEmail: "cajero@bookipos.local",
    ...over,
  }
}

async function reservar(a: Alcance, from = 1, to = 5) {
  return guardarReserva(a, {
    reservationId: "res-1",
    sedeId: SEDE,
    cajaSessionId: TURNO,
    prefix: "FVC",
    from,
    to,
  })
}

afterEach(async () => {
  await borrarTodo()
})

describe("consecutivos reservados", () => {
  it("10 cobros simultáneos reciben números distintos y contiguos del bloque", async () => {
    await reservar(A, 41, 60)
    const ventas = await Promise.all(Array.from({ length: 10 }, () => encolarVenta(A, venta())))
    const nums = ventas.map((v) => v.saleNumber).sort()
    expect(new Set(nums).size).toBe(10)
    expect(nums[0]).toBe("FVC-000041")
    expect(nums[9]).toBe("FVC-000050")
    expect(new Set(ventas.map((v) => v.offlineId)).size).toBe(10)
    expect(restantes(await leerReserva(A, SEDE))).toBe(10)
  })

  it("con el bloque agotado no se encola nada", async () => {
    await reservar(A, 1, 2)
    await encolarVenta(A, venta())
    await encolarVenta(A, venta())
    await expect(encolarVenta(A, venta())).rejects.toBeInstanceOf(SinNumerosError)
    expect(await ventasEnCola(A)).toHaveLength(2)
  })

  it("un bloque de otro turno no sirve", async () => {
    await reservar(A)
    await expect(encolarVenta(A, venta({ cajaSessionId: "otro" }))).rejects.toBeInstanceOf(
      SinNumerosError,
    )
    expect(await ventasEnCola(A)).toHaveLength(0)
  })

  it("el total tiene que ser un entero en pesos", async () => {
    await reservar(A)
    await expect(encolarVenta(A, venta({ expectedGrandTotal: 100.5 }))).rejects.toThrow()
    expect((await leerReserva(A, SEDE))?.next).toBe(1)
  })
})

describe("sincronización", () => {
  it("manda en orden, borra lo registrado y reenviar no duplica", async () => {
    await reservar(A)
    await encolarVenta(A, venta())
    await encolarVenta(A, venta())
    const vistos: SyncDto[] = []
    const registradas = new Set<string>()
    const enviar = vi.fn(async (dto: SyncDto) => {
      vistos.push(dto)
      const dup = registradas.has(dto.offlineId)
      registradas.add(dto.offlineId)
      return { status: dup ? ("duplicada" as const) : ("creada" as const) }
    })
    const r = await sincronizar(A, enviar)
    expect(r).toEqual({ enviadas: 2, conflictos: 0, interrumpida: false })
    expect(vistos.map((d) => d.saleNumber)).toEqual(["FVC-000001", "FVC-000002"])
    expect(vistos[0]).toMatchObject({ expectedGrandTotal: 23_800, reservationId: "res-1" })
    expect(await ventasEnCola(A)).toHaveLength(0)
    // Una segunda corrida no tiene nada que mandar.
    await sincronizar(A, enviar)
    expect(enviar).toHaveBeenCalledTimes(2)
  })

  it("sin red la venta sigue pendiente con el mismo UUID", async () => {
    await reservar(A)
    const v = await encolarVenta(A, venta())
    const r = await sincronizar(A, async () => {
      throw new TypeError("Failed to fetch")
    })
    expect(r.interrumpida).toBe(true)
    const cola = await ventasEnCola(A)
    expect(cola).toHaveLength(1)
    expect(cola[0]).toMatchObject({ offlineId: v.offlineId, estado: "pendiente" })
  })

  it("un conflicto va a la bandeja con su motivo y se puede reintentar al turno abierto", async () => {
    await reservar(A)
    const v = await encolarVenta(A, venta())
    await sincronizar(A, async () => {
      throw new ConflictoOffline("TURNO_CERRADO", "El turno ya se cerró")
    })
    let [enBandeja] = await ventasEnCola(A)
    expect(enBandeja).toMatchObject({
      estado: "conflicto",
      motivo: { reason: "TURNO_CERRADO", message: "El turno ya se cerró" },
    })
    // En conflicto no se reenvía sola.
    const enviar = vi.fn(async () => ({ status: "creada" as const }))
    await sincronizar(A, enviar)
    expect(enviar).not.toHaveBeenCalled()

    await reintentar(A, v.offlineId, { useOpenShift: true })
    ;[enBandeja] = await ventasEnCola(A)
    expect(enBandeja.estado).toBe("pendiente")
    await sincronizar(A, enviar)
    expect(enviar).toHaveBeenCalledWith(
      expect.objectContaining({ offlineId: v.offlineId, useOpenShift: true }),
    )
    expect(await ventasEnCola(A)).toHaveLength(0)
  })

  it("EN_PROCESO deja la venta pendiente", async () => {
    await reservar(A)
    await encolarVenta(A, venta())
    await sincronizar(A, async () => {
      throw new ConflictoOffline("EN_PROCESO", "reintenta")
    })
    expect((await ventasEnCola(A))[0].estado).toBe("pendiente")
  })
})

describe("aislamiento por empresa y usuario", () => {
  it("cada empresa y cada usuario tienen su propia base", async () => {
    expect(dbName(A)).not.toBe(dbName(B))
    expect(dbName(A)).not.toBe(dbName({ ...A, userId: "u-2" }))
    await reservar(A)
    await encolarVenta(A, venta())
    await guardarCopia(A, "catalogo", SEDE, [{ _id: "p1" }])
    expect(await ventasEnCola(B)).toHaveLength(0)
    expect(await leerReserva(B, SEDE)).toBeUndefined()
    expect(await leerCopia(B, "catalogo", SEDE)).toBeUndefined()
    expect(await leerCopia(A, "catalogo", SEDE)).toMatchObject({ data: [{ _id: "p1" }] })
  })

  it("cerrar sesión borra copias y reservas pero NUNCA las ventas cobradas", async () => {
    await reservar(A)
    await reservar(B)
    await guardarCopia(A, "catalogo", SEDE, [{ _id: "p1" }])
    const v = await encolarVenta(A, venta())
    await limpiarAlCerrarSesion()
    // La venta sigue en la cola de su empresa y usuario: se sincroniza al volver.
    expect((await ventasEnCola(A)).map((x) => x.offlineId)).toEqual([v.offlineId])
    expect(await leerReserva(A, SEDE)).toBeUndefined()
    expect(await leerCopia(A, "catalogo", SEDE)).toBeUndefined()
    expect(await leerReserva(B, SEDE)).toBeUndefined()
  })

  it("cuenta lo pendiente de todas las sesiones de este equipo", async () => {
    await reservar(A)
    await encolarVenta(A, venta())
    await reservar(B)
    await encolarVenta(B, venta())
    expect(await ventasSinSincronizar()).toBe(2)
  })

  it("el alcance sale de `biz` y `sub` del token", () => {
    const payload = btoa(JSON.stringify({ sub: "u-9", biz: "biz-9" }))
    expect(alcanceDeToken(`h.${payload}.f`)).toEqual({ businessId: "biz-9", userId: "u-9" })
    expect(alcanceDeToken(`h.${btoa(JSON.stringify({ sub: "u-9" }))}.f`)).toBeNull()
    expect(alcanceDeToken(undefined)).toBeNull()
  })
})

describe("qué se puede cobrar sin conexión", () => {
  const base = {
    method: "cash",
    split: false,
    hasDiscount: false,
    orderType: "mostrador",
    emitInvoice: false,
    activeOrder: false,
  }
  it("efectivo de mostrador sí", () => {
    expect(motivosNoOffline(base)).toEqual([])
  })
  it("fiado, tarjeta, dividido, descuentos, listas, cliente, domicilio, factura y cuentas no", () => {
    expect(motivosNoOffline({ ...base, method: "credit" })).not.toEqual([])
    expect(motivosNoOffline({ ...base, method: "card" })).not.toEqual([])
    expect(motivosNoOffline({ ...base, split: true })).not.toEqual([])
    expect(motivosNoOffline({ ...base, hasDiscount: true })).not.toEqual([])
    expect(motivosNoOffline({ ...base, priceListId: "l1" })).not.toEqual([])
    expect(motivosNoOffline({ ...base, customerId: "c1" })).not.toEqual([])
    expect(motivosNoOffline({ ...base, orderType: "domicilio" })).not.toEqual([])
    expect(motivosNoOffline({ ...base, emitInvoice: true })).not.toEqual([])
    expect(motivosNoOffline({ ...base, activeOrder: true })).not.toEqual([])
  })
})
