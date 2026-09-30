"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check, Pencil, X } from "lucide-react";
import type { WashRecord } from "@/types/domain";

function serviceDateInput(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

type EditableField = "serviceDate" | "paymentType" | "notes";

const fieldLabels: Record<EditableField, string> = {
  serviceDate: "fecha del servicio",
  paymentType: "forma de pago",
  notes: "comentarios",
};

export function WashDetailsEditor({ wash, field, canEdit, children, onSaved }: {
  wash: WashRecord;
  field: EditableField;
  canEdit: boolean;
  children: ReactNode;
  onSaved: (dateChanged: boolean) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const label = fieldLabels[field];
  const currentValue = field === "serviceDate"
    ? serviceDateInput(wash.createdAt)
    : field === "paymentType" ? wash.paymentType : wash.notes ?? "";

  function startEditing() {
    setDraft(currentValue);
    setError("");
    setEditing(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;

    const value = field === "notes" ? draft.trim() : draft;
    if (value === currentValue) {
      setEditing(false);
      return;
    }
    const patch = { [field]: field === "notes" ? value || null : value };

    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/washes/${wash.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(typeof payload?.error === "string" ? payload.error : "No fue posible guardar el servicio.");
        return;
      }
      setEditing(false);
      try {
        await onSaved(field === "serviceDate");
      } catch {
        setError("El servicio se guardó. Actualiza el historial para ver los cambios.");
      }
    } catch {
      setError("No fue posible conectar con el servidor. Intenta de nuevo.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (!canEdit) return <>{children}</>;

  return (
    <div className={`wash-detail-editor ${field === "notes" ? "wash-detail-notes" : ""}`}>
      {editing ? (
        <form className="wash-detail-form" onSubmit={save} aria-label={`Editar ${label}`}>
          {field === "serviceDate" && (
            <input type="date" aria-label="Fecha del servicio" required
              min="1000-01-01" max="9999-12-31" value={draft} disabled={saving}
              onChange={(event) => setDraft(event.target.value)} />
          )}
          {field === "paymentType" && (
            <select aria-label="Forma de pago" value={draft} disabled={saving}
              onChange={(event) => setDraft(event.target.value)}>
              <option value="CASH">Efectivo</option>
              <option value="CARD">Tarjeta</option>
              <option value="TRANSFER">Transferencia</option>
            </select>
          )}
          {field === "notes" && (
            <textarea aria-label="Comentarios" value={draft} maxLength={2000}
              rows={3} disabled={saving} placeholder="Agrega observaciones del servicio"
              onChange={(event) => setDraft(event.target.value)} />
          )}
          <div className="price-edit-actions">
            <button type="submit" title={`Guardar ${label}`} aria-label={`Guardar ${label}`} disabled={saving}>
              <Check size={14} />
            </button>
            <button type="button" title="Cancelar" aria-label={`Cancelar edición de ${label}`} disabled={saving}
              onClick={() => { setEditing(false); setError(""); }}>
              <X size={14} />
            </button>
          </div>
        </form>
      ) : (
        <div className="wash-detail-value">
          {children}
          <button type="button" className="price-edit-button" onClick={startEditing} disabled={saving}
            title={`Editar ${label}`} aria-label={`Editar ${label}`}>
            <Pencil size={13} />
          </button>
        </div>
      )}
      {error && <p className="history-alert" role="alert">{error}</p>}
    </div>
  );
}
