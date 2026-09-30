"use client";

import { useRef, useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import type { PaymentType, WashRecord } from "@/types/domain";

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

export function WashDetailsEditor({ wash, onSaved }: {
  wash: WashRecord;
  onSaved: (dateChanged: boolean) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [serviceDate, setServiceDate] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("CASH");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  function startEditing() {
    setServiceDate(serviceDateInput(wash.createdAt));
    setPaymentType(wash.paymentType);
    setNotes(wash.notes ?? "");
    setError("");
    setEditing(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;

    const dateChanged = serviceDate !== serviceDateInput(wash.createdAt);
    const patch = {
      ...(dateChanged ? { serviceDate } : {}),
      ...(paymentType !== wash.paymentType ? { paymentType } : {}),
      ...(notes.trim() !== (wash.notes ?? "") ? { notes: notes.trim() || null } : {}),
    };
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }

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
        await onSaved(dateChanged);
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

  return (
    <div className="wash-details-editor">
      {editing ? (
        <form className="wash-details-form" onSubmit={save} aria-label={`Editar servicio #${wash.id}`}>
          <label>
            Fecha del servicio
            <input type="date" required min="1000-01-01" max="9999-12-31" value={serviceDate}
              disabled={saving} onChange={(event) => setServiceDate(event.target.value)} />
          </label>
          <label>
            Forma de pago
            <select value={paymentType} disabled={saving}
              onChange={(event) => setPaymentType(event.target.value as PaymentType)}>
              <option value="CASH">Efectivo</option>
              <option value="CARD">Tarjeta</option>
              <option value="TRANSFER">Transferencia</option>
            </select>
          </label>
          <label className="wash-details-notes">
            Comentarios
            <textarea value={notes} maxLength={2000} rows={3} disabled={saving}
              placeholder="Agrega observaciones del servicio"
              onChange={(event) => setNotes(event.target.value)} />
          </label>
          <div className="wash-details-actions">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
            <button className="secondary-button" type="button" disabled={saving}
              onClick={() => { setEditing(false); setError(""); }}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button type="button" className="secondary-button" onClick={startEditing} disabled={saving}
          aria-label={`Editar servicio #${wash.id}`}>
          <Pencil size={15} /> Editar servicio
        </button>
      )}
      {error && <p className="history-alert" role="alert">{error}</p>}
    </div>
  );
}
