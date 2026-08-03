"use client"

import * as React from "react"
import { Plus, Trash2, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Sede } from "@/lib/erp/api-inventory"
import {
  createEmployee,
  updateEmployee,
  type Employee,
  type EmployeeInput,
  type Position,
  type DocStatus,
  type EmpDocType,
  type ContractType,
  type EmployeeStatus,
  type Gender,
  type SalaryType,
  type ArlRiskLevel,
  type AccountType,
} from "@/lib/erp/api-employees"
import { ApiError } from "@/lib/api"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

const DOC_TYPES: EmpDocType[] = ["CC", "CE", "TI", "PA", "PEP", "NIT"]
const GENDERS: { v: Gender; l: string }[] = [
  { v: "M", l: "Masculino" },
  { v: "F", l: "Femenino" },
  { v: "O", l: "Otro" },
]
const CONTRACT_TYPES: { v: ContractType; l: string }[] = [
  { v: "indefinido", l: "Término indefinido" },
  { v: "fijo", l: "Término fijo" },
  { v: "obra_labor", l: "Obra o labor" },
  { v: "aprendizaje", l: "Aprendizaje" },
  { v: "prestacion_servicios", l: "Prestación de servicios" },
]
const SALARY_TYPES: { v: SalaryType; l: string }[] = [
  { v: "ordinario", l: "Ordinario" },
  { v: "integral", l: "Integral" },
]
const ARL_LEVELS: ArlRiskLevel[] = ["I", "II", "III", "IV", "V"]
const ACCOUNT_TYPES: { v: AccountType; l: string }[] = [
  { v: "ahorros", l: "Ahorros" },
  { v: "corriente", l: "Corriente" },
]
const STATUSES: { v: EmployeeStatus; l: string }[] = [
  { v: "activo", l: "Activo" },
  { v: "inactivo", l: "Inactivo" },
  { v: "retirado", l: "Retirado" },
]
const DOC_STATUSES: { v: DocStatus; l: string }[] = [
  { v: "pendiente", l: "Pendiente" },
  { v: "entregado", l: "Entregado" },
  { v: "vencido", l: "Vencido" },
]
const COMMON_DOCS = [
  "Contrato de trabajo",
  "Hoja de vida",
  "Fotocopia del documento",
  "Examen médico de ingreso",
  "Certificado de afiliación EPS",
  "Certificado de afiliación ARL",
  "Certificado de pensión (AFP)",
  "Certificado de cesantías",
  "Antecedentes judiciales",
  "Certificación bancaria",
]

const inputClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"

interface DocRow {
  type: string
  number: string
  issueDate: string
  expiryDate: string
  status: DocStatus
  note: string
}

interface Form {
  docType: EmpDocType
  docNumber: string
  firstName: string
  lastName: string
  birthDate: string
  gender: string
  phone: string
  email: string
  address: string
  city: string
  emergencyContactName: string
  emergencyContactPhone: string
  positionId: string
  sedeId: string
  contractType: ContractType
  hireDate: string
  endDate: string
  salary: string
  salaryType: string
  workSchedule: string
  eps: string
  afp: string
  arl: string
  arlRiskLevel: string
  compensationFund: string
  severanceFund: string
  bank: string
  accountType: string
  accountNumber: string
  status: EmployeeStatus
  terminationDate: string
  terminationReason: string
  notes: string
}

function blankForm(): Form {
  return {
    docType: "CC",
    docNumber: "",
    firstName: "",
    lastName: "",
    birthDate: "",
    gender: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    positionId: "",
    sedeId: "",
    contractType: "indefinido",
    hireDate: "",
    endDate: "",
    salary: "",
    salaryType: "",
    workSchedule: "",
    eps: "",
    afp: "",
    arl: "",
    arlRiskLevel: "",
    compensationFund: "",
    severanceFund: "",
    bank: "",
    accountType: "",
    accountNumber: "",
    status: "activo",
    terminationDate: "",
    terminationReason: "",
    notes: "",
  }
}

function fromEmployee(e: Employee): Form {
  return {
    docType: e.docType,
    docNumber: e.docNumber,
    firstName: e.firstName,
    lastName: e.lastName,
    birthDate: e.birthDate ?? "",
    gender: e.gender ?? "",
    phone: e.phone ?? "",
    email: e.email ?? "",
    address: e.address ?? "",
    city: e.city ?? "",
    emergencyContactName: e.emergencyContactName ?? "",
    emergencyContactPhone: e.emergencyContactPhone ?? "",
    positionId: e.positionId ?? "",
    sedeId: e.sedeId ?? "",
    contractType: e.contractType,
    hireDate: e.hireDate ?? "",
    endDate: e.endDate ?? "",
    salary: e.salary != null ? String(e.salary) : "",
    salaryType: e.salaryType ?? "",
    workSchedule: e.workSchedule ?? "",
    eps: e.eps ?? "",
    afp: e.afp ?? "",
    arl: e.arl ?? "",
    arlRiskLevel: e.arlRiskLevel ?? "",
    compensationFund: e.compensationFund ?? "",
    severanceFund: e.severanceFund ?? "",
    bank: e.bank ?? "",
    accountType: e.accountType ?? "",
    accountNumber: e.accountNumber ?? "",
    status: e.status,
    terminationDate: e.terminationDate ?? "",
    terminationReason: e.terminationReason ?? "",
    notes: e.notes ?? "",
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

export function EmployeeSheet({
  open,
  employee,
  positions,
  sedes,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  employee: Employee | null
  positions: Position[]
  sedes: Sede[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [form, setForm] = React.useState<Form>(blankForm)
  const [docs, setDocs] = React.useState<DocRow[]>([])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reinicia el formulario cada vez que se abre.
  React.useEffect(() => {
    if (!open) return
    setError(null)
    if (employee) {
      setForm(fromEmployee(employee))
      setDocs(
        employee.documents.map((d) => ({
          type: d.type,
          number: d.number ?? "",
          issueDate: d.issueDate ?? "",
          expiryDate: d.expiryDate ?? "",
          status: d.status,
          note: d.note ?? "",
        })),
      )
    } else {
      setForm(blankForm())
      setDocs([])
    }
  }, [open, employee])

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addDoc() {
    setDocs((prev) => [
      ...prev,
      { type: "", number: "", issueDate: "", expiryDate: "", status: "pendiente", note: "" },
    ])
  }

  function setDoc(i: number, patch: Partial<DocRow>) {
    setDocs((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)))
  }

  function removeDoc(i: number) {
    setDocs((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function submit() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.docNumber.trim()) {
      setError("Nombre, apellido y documento son obligatorios.")
      return
    }
    setSaving(true)
    setError(null)
    const isRetired = form.status === "retirado"
    const payload: EmployeeInput = {
      docType: form.docType,
      docNumber: form.docNumber.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      birthDate: form.birthDate,
      gender: (form.gender || undefined) as Gender | undefined,
      phone: form.phone,
      email: form.email,
      address: form.address,
      city: form.city,
      emergencyContactName: form.emergencyContactName,
      emergencyContactPhone: form.emergencyContactPhone,
      positionId: form.positionId,
      sedeId: form.sedeId,
      contractType: form.contractType,
      hireDate: form.hireDate,
      endDate: form.endDate,
      salary: form.salary ? Number(form.salary) : undefined,
      salaryType: (form.salaryType || undefined) as SalaryType | undefined,
      workSchedule: form.workSchedule,
      eps: form.eps,
      afp: form.afp,
      arl: form.arl,
      arlRiskLevel: (form.arlRiskLevel || undefined) as ArlRiskLevel | undefined,
      compensationFund: form.compensationFund,
      severanceFund: form.severanceFund,
      bank: form.bank,
      accountType: (form.accountType || undefined) as AccountType | undefined,
      accountNumber: form.accountNumber,
      documents: docs
        .filter((d) => d.type.trim())
        .map((d) => ({
          type: d.type.trim(),
          number: d.number || undefined,
          issueDate: d.issueDate || undefined,
          expiryDate: d.expiryDate || undefined,
          status: d.status,
          note: d.note || undefined,
        })),
      status: form.status,
      terminationDate: isRetired ? form.terminationDate : undefined,
      terminationReason: isRetired ? form.terminationReason : undefined,
      notes: form.notes,
    }
    try {
      if (employee) await updateEmployee(employee._id, payload)
      else await createEmployee(payload)
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <div className="flex flex-col gap-5 px-4 py-2">
          <SheetHeader className="px-0">
            <SheetTitle className="font-display text-lg">
              {employee ? "Editar empleado" : "Nuevo empleado"}
            </SheetTitle>
            <SheetDescription>
              Datos personales, contratación, seguridad social y documentos.
            </SheetDescription>
          </SheetHeader>

          {/* Datos personales */}
          <Section title="Datos personales">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo doc.">
                <NativeSelect
                  value={form.docType}
                  onChange={(v) => set("docType", v as EmpDocType)}
                  options={DOC_TYPES.map((t) => ({ v: t, l: t }))}
                />
              </Field>
              <Field label="Número de documento *">
                <Input
                  value={form.docNumber}
                  onChange={(e) => set("docNumber", e.target.value)}
                />
              </Field>
              <Field label="Nombres *">
                <Input
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                />
              </Field>
              <Field label="Apellidos *">
                <Input
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                />
              </Field>
              <Field label="Fecha de nacimiento">
                <Input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => set("birthDate", e.target.value)}
                />
              </Field>
              <Field label="Género">
                <NativeSelect
                  value={form.gender}
                  onChange={(v) => set("gender", v)}
                  options={GENDERS}
                  emptyLabel="Sin especificar"
                />
              </Field>
              <Field label="Teléfono">
                <Input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>
              <Field label="Correo">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label="Dirección">
                <Input
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                />
              </Field>
              <Field label="Ciudad">
                <Input
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </Field>
              <Field label="Contacto de emergencia">
                <Input
                  value={form.emergencyContactName}
                  onChange={(e) => set("emergencyContactName", e.target.value)}
                />
              </Field>
              <Field label="Tel. de emergencia">
                <Input
                  value={form.emergencyContactPhone}
                  onChange={(e) => set("emergencyContactPhone", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          {/* Contratación */}
          <Section title="Contratación">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cargo">
                <NativeSelect
                  value={form.positionId}
                  onChange={(v) => set("positionId", v)}
                  options={positions.map((p) => ({ v: p._id, l: p.name }))}
                  emptyLabel="Sin cargo"
                />
              </Field>
              <Field label="Sede">
                <NativeSelect
                  value={form.sedeId}
                  onChange={(v) => set("sedeId", v)}
                  options={sedes.map((s) => ({ v: s._id, l: s.name }))}
                  emptyLabel="Sin sede"
                />
              </Field>
              <Field label="Tipo de contrato">
                <NativeSelect
                  value={form.contractType}
                  onChange={(v) => set("contractType", v as ContractType)}
                  options={CONTRACT_TYPES}
                />
              </Field>
              <Field label="Jornada / horario">
                <Input
                  value={form.workSchedule}
                  onChange={(e) => set("workSchedule", e.target.value)}
                  placeholder="Ej. Lun-Sáb 8am-5pm"
                />
              </Field>
              <Field label="Fecha de ingreso">
                <Input
                  type="date"
                  value={form.hireDate}
                  onChange={(e) => set("hireDate", e.target.value)}
                />
              </Field>
              {form.contractType === "fijo" && (
                <Field label="Fin de contrato">
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => set("endDate", e.target.value)}
                  />
                </Field>
              )}
              <Field label="Salario (COP)">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.salary}
                  onChange={(e) => set("salary", e.target.value)}
                />
              </Field>
              <Field label="Tipo de salario">
                <NativeSelect
                  value={form.salaryType}
                  onChange={(v) => set("salaryType", v)}
                  options={SALARY_TYPES}
                  emptyLabel="Sin especificar"
                />
              </Field>
            </div>
          </Section>

          {/* Seguridad social */}
          <Section title="Seguridad social">
            <div className="grid grid-cols-2 gap-3">
              <Field label="EPS (salud)">
                <Input value={form.eps} onChange={(e) => set("eps", e.target.value)} />
              </Field>
              <Field label="Fondo de pensión (AFP)">
                <Input value={form.afp} onChange={(e) => set("afp", e.target.value)} />
              </Field>
              <Field label="ARL (riesgos)">
                <Input value={form.arl} onChange={(e) => set("arl", e.target.value)} />
              </Field>
              <Field label="Nivel de riesgo ARL">
                <NativeSelect
                  value={form.arlRiskLevel}
                  onChange={(v) => set("arlRiskLevel", v)}
                  options={ARL_LEVELS.map((r) => ({ v: r, l: `Nivel ${r}` }))}
                  emptyLabel="Sin especificar"
                />
              </Field>
              <Field label="Caja de compensación">
                <Input
                  value={form.compensationFund}
                  onChange={(e) => set("compensationFund", e.target.value)}
                />
              </Field>
              <Field label="Fondo de cesantías">
                <Input
                  value={form.severanceFund}
                  onChange={(e) => set("severanceFund", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          {/* Bancario */}
          <Section title="Datos bancarios (pago de nómina)">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Banco">
                <Input value={form.bank} onChange={(e) => set("bank", e.target.value)} />
              </Field>
              <Field label="Tipo de cuenta">
                <NativeSelect
                  value={form.accountType}
                  onChange={(v) => set("accountType", v)}
                  options={ACCOUNT_TYPES}
                  emptyLabel="Sin especificar"
                />
              </Field>
              <Field label="Número de cuenta">
                <Input
                  value={form.accountNumber}
                  onChange={(e) => set("accountNumber", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          {/* Documentos / certificados */}
          <Section title="Documentos y certificados">
            <datalist id="common-docs">
              {COMMON_DOCS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin documentos. Agrega el contrato, exámenes médicos, afiliaciones,
                etc.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {docs.map((d, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <Label className="text-xs">Documento</Label>
                        <input
                          list="common-docs"
                          className={inputClass}
                          value={d.type}
                          placeholder="Ej. Contrato de trabajo"
                          onChange={(e) => setDoc(i, { type: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Estado</Label>
                        <NativeSelect
                          value={d.status}
                          onChange={(v) => setDoc(i, { status: v as DocStatus })}
                          options={DOC_STATUSES}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">N.º / referencia</Label>
                        <Input
                          value={d.number}
                          onChange={(e) => setDoc(i, { number: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Emisión</Label>
                        <Input
                          type="date"
                          value={d.issueDate}
                          onChange={(e) => setDoc(i, { issueDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Vencimiento</Label>
                        <Input
                          type="date"
                          value={d.expiryDate}
                          onChange={(e) => setDoc(i, { expiryDate: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeDoc(i)}
                      >
                        <Trash2 className="size-4" />
                        Quitar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
              onClick={addDoc}
            >
              <Plus className="size-4" />
              Agregar documento
            </Button>
          </Section>

          {/* Estado */}
          <Section title="Estado">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Estado del empleado">
                <NativeSelect
                  value={form.status}
                  onChange={(v) => set("status", v as EmployeeStatus)}
                  options={STATUSES}
                />
              </Field>
              {form.status === "retirado" && (
                <>
                  <Field label="Fecha de retiro">
                    <Input
                      type="date"
                      value={form.terminationDate}
                      onChange={(e) => set("terminationDate", e.target.value)}
                    />
                  </Field>
                  <Field label="Motivo de retiro" className="col-span-2">
                    <Input
                      value={form.terminationReason}
                      onChange={(e) => set("terminationReason", e.target.value)}
                    />
                  </Field>
                </>
              )}
              <Field label="Notas" className="col-span-2">
                <Input
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="sticky bottom-0 flex gap-2 border-t border-border bg-background py-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button className="flex-1 gap-2" onClick={() => void submit()} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {employee ? "Guardar cambios" : "Crear empleado"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

function NativeSelect({
  value,
  onChange,
  options,
  emptyLabel,
}: {
  value: string
  onChange: (v: string) => void
  options: { v: string; l: string }[]
  emptyLabel?: string
}) {
  return (
    <select
      className={inputClass}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  )
}
