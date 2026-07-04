"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  CarFront,
  ClipboardList,
  Users,
} from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { formatMoney } from "@/lib/format";
import type { WashRecord } from "@/types/domain";

type Period = "TODAY" | "WEEK" | "MONTH" | "RANGE";

export function WashHistory() {
  const [period, setPeriod] = useState<Period>("TODAY");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [washes, setWashes] = useState<WashRecord[]>([]);
  const [stats, setStats] = useState({ count: 0, income: 0 });
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);

  const load = useCallback(async () => {
    if (period === "RANGE" && (!from || !to)) return;
    setLoading(true);
    const params = new URLSearchParams({ period });
    if (period === "RANGE") {
      params.set("from", from);
      params.set("to", to);
    }
    const response = await fetch(`/api/washes?${params}`, { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      setWashes(data.washes);
      setStats(data.stats);
      setRange(data.range);
    }
    setLoading(false);
  }, [from, period, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mobile-page history-page">
      <PageHero title="Historial de lavados">
        <div className="period-tabs">
          {([
            ["TODAY", "Hoy"],
            ["WEEK", "Semana"],
            ["MONTH", "Mes"],
            ["RANGE", "Rango"],
          ] as [Period, string][]).map(([value, label]) => (
            <button
              key={value}
              className={period === value ? "selected" : ""}
              onClick={() => setPeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {period === "RANGE" && (
          <div className="range-fields">
            <label>
              Desde
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              Hasta
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
        )}
        {period === "WEEK" && range && (
          <p className="period-caption">
            Semana laboral: {formatRangeDay(range.start)} –{" "}
            {formatRangeDay(new Date(new Date(range.end).getTime() - 1).toISOString())}
          </p>
        )}
        <div className="hero-stats">
          <div>
            <span>VEHÍCULOS</span>
            <strong>{stats.count}</strong>
            <small>en el periodo</small>
          </div>
          <div>
            <span>INGRESOS</span>
            <strong>{formatMoney(stats.income)}</strong>
            <small>totales</small>
          </div>
        </div>
      </PageHero>

      <section className="history-list">
        {loading ? (
          <div className="empty-state">Consultando lavados…</div>
        ) : washes.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={54} />
            <h2>Sin lavados registrados</h2>
            <p>No hay movimientos en el periodo seleccionado.</p>
          </div>
        ) : (
          washes.map((wash) => (
            <article className="wash-record" key={wash.id}>
              <div className="record-icon">
                <CarFront size={24} />
              </div>
              <div className="record-main">
                <div>
                  <span className="record-number">#{wash.id}</span>
                  <h2>{wash.package.name}</h2>
                  <p>
                    {wash.vehicleType.name}
                    {wash.plate ? ` · ${wash.plate}` : ""}
                  </p>
                </div>
                <strong>{formatMoney(wash.chargedPrice)}</strong>
              </div>
              <div className="record-meta">
                <span>
                  <CalendarDays size={15} />
                  {new Intl.DateTimeFormat("es-MX", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(wash.createdAt))}
                </span>
                <span>
                  <Users size={15} />
                  {[
                    wash.createdBy.name,
                    ...wash.participants.map((participant) => participant.user.name),
                  ].join(", ")}
                </span>
              </div>
              {(wash.customServiceDescription || wash.notes) && (
                <div className="record-notes">
                  {wash.customServiceDescription && (
                    <p><b>Servicio:</b> {wash.customServiceDescription}</p>
                  )}
                  {wash.notes && <p><b>Observaciones:</b> {wash.notes}</p>}
                </div>
              )}
              {wash.photos.some((photo) => photo.url) && (
                <div className="record-photos">
                  {wash.photos.map(
                    (photo, index) =>
                      photo.url && (
                        <a
                          href={photo.url}
                          target="_blank"
                          rel="noreferrer"
                          key={photo.id}
                          aria-label={`Abrir fotografía ${index + 1} del lavado ${wash.id}`}
                          style={{ backgroundImage: `url("${photo.url}")` }}
                        />
                      ),
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function formatRangeDay(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}
