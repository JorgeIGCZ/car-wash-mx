"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  CarFront,
  ClipboardList,
  HandCoins,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { formatMoney } from "@/lib/format";
import type { AppUser, WashRecord } from "@/types/domain";

type Period = "TODAY" | "WEEK" | "MONTH" | "RANGE";

type HistoryStats = {
  count: number;
  income?: number;
  commissions?: number;
  selectedCommission: number;
  netIncome?: number;
};

type WashHistoryProps = {
  embedded?: boolean;
  scope?: "PERSONAL" | "ALL";
  users?: AppUser[];
};

export function WashHistory({
  embedded = false,
  scope = "PERSONAL",
  users = [],
}: WashHistoryProps) {
  const [period, setPeriod] = useState<Period>("TODAY");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedUser, setSelectedUser] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [washes, setWashes] = useState<WashRecord[]>([]);
  const [stats, setStats] = useState<HistoryStats>({
    count: 0,
    income: 0,
    commissions: 0,
    selectedCommission: 0,
    netIncome: 0,
  });
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const globalScope = scope === "ALL";

  const load = useCallback(async () => {
    if (period === "RANGE" && (!from || !to)) return;
    setLoading(true);
    const params = new URLSearchParams({ period });
    if (period === "RANGE") {
      params.set("from", from);
      params.set("to", to);
    }
    if (globalScope) {
      params.set("scope", "all");
      if (selectedUser !== "ALL") params.set("userId", selectedUser);
    }
    const response = await fetch(`/api/washes?${params}`, { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      setWashes(data.washes);
      setStats(data.stats);
      setRange(data.range);
    }
    setLoading(false);
  }, [from, globalScope, period, selectedUser, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const filters = (
    <HistoryFilters
      period={period}
      from={from}
      to={to}
      range={range}
      users={users}
      selectedUser={selectedUser}
      showUserFilter={globalScope}
      onPeriodChange={setPeriod}
      onFromChange={setFrom}
      onToChange={setTo}
      onUserChange={setSelectedUser}
    />
  );

  return (
    <div className={embedded ? "admin-history-view" : "mobile-page history-page"}>
      {embedded ? (
        <section className="admin-section admin-history-summary">
          <div className="content-heading">
            <ClipboardList size={23} />
            <div>
              <h2>Historial de todo el equipo</h2>
              <p>
                Filtra por trabajador y revisa ingresos, comisiones y ganancia
                neta sin salir de Administración.
              </p>
            </div>
          </div>
          {filters}
          <div className="financial-stats">
            <StatCard label="Servicios" value={String(stats.count)} />
            <StatCard label="Ingresos" value={formatMoney(stats.income ?? 0)} />
            <StatCard
              label={selectedUser === "ALL" ? "Comisiones" : "Comisión del usuario"}
              value={formatMoney(
                selectedUser === "ALL"
                  ? stats.commissions ?? 0
                  : stats.selectedCommission,
              )}
              icon="commission"
            />
            <StatCard
              label="Ganancia neta"
              value={formatMoney(stats.netIncome ?? 0)}
              icon="net"
            />
          </div>
        </section>
      ) : (
        <PageHero title="Mi historial y comisiones">
          {filters}
          <div className="hero-stats">
            <div>
              <span>SERVICIOS</span>
              <strong>{stats.count}</strong>
              <small>en los que participé</small>
            </div>
            <div>
              <span>MI COMISIÓN</span>
              <strong>{formatMoney(stats.selectedCommission)}</strong>
              <small>ganada en el periodo</small>
            </div>
          </div>
        </PageHero>
      )}

      <section className={`history-list ${embedded ? "admin-history-list" : ""}`}>
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
                <div className="record-amount">
                  <span>{embedded ? "Cobrado" : "Mi comisión"}</span>
                  <strong>
                    {formatMoney(
                      embedded
                        ? wash.chargedPrice ?? 0
                        : wash.personalCommission,
                    )}
                  </strong>
                </div>
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
                    ...wash.participants.map(
                      (participant) => participant.user.name,
                    ),
                  ].join(", ")}
                </span>
              </div>
              {embedded && (
                <>
                  <div className="record-financials">
                    <div>
                      <span>Comisiones</span>
                      <strong>{formatMoney(wash.totalCommission ?? 0)}</strong>
                    </div>
                    <div>
                      <span>Ganancia</span>
                      <strong>{formatMoney(wash.netIncome ?? 0)}</strong>
                    </div>
                  </div>
                  <div className="commission-breakdown">
                    {wash.commissions.length === 0 ? (
                      <span>Registro anterior a la configuración de comisiones.</span>
                    ) : (
                      wash.commissions.map((commission) => (
                        <span
                          className={
                            selectedUser === String(commission.user.id)
                              ? "selected"
                              : ""
                          }
                          key={commission.user.id}
                        >
                          <b>{commission.user.name}</b>
                          {commission.type === "PERCENTAGE"
                            ? `${commission.value}%`
                            : `${formatMoney(commission.value)} fijos`}
                          <strong>{formatMoney(commission.amount)}</strong>
                        </span>
                      ))
                    )}
                  </div>
                </>
              )}
              {(wash.customServiceDescription || wash.notes) && (
                <div className="record-notes">
                  {wash.customServiceDescription && (
                    <p>
                      <b>Servicio:</b> {wash.customServiceDescription}
                    </p>
                  )}
                  {wash.notes && (
                    <p>
                      <b>Observaciones:</b> {wash.notes}
                    </p>
                  )}
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

function HistoryFilters({
  period,
  from,
  to,
  range,
  users,
  selectedUser,
  showUserFilter,
  onPeriodChange,
  onFromChange,
  onToChange,
  onUserChange,
}: {
  period: Period;
  from: string;
  to: string;
  range: { start: string; end: string } | null;
  users: AppUser[];
  selectedUser: string;
  showUserFilter: boolean;
  onPeriodChange: (period: Period) => void;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
  onUserChange: (userId: string) => void;
}) {
  return (
    <div className={showUserFilter ? "admin-history-filters" : ""}>
      {showUserFilter && (
        <label className="user-filter">
          Usuario
          <select
            value={selectedUser}
            onChange={(event) => onUserChange(event.target.value)}
          >
            <option value="ALL">Todo el equipo</option>
            {users
              .filter((user) => user.role !== "ADMINISTRATIVE")
              .map((user) => (
                <option value={user.id} key={user.id}>
                  {user.name}
                </option>
              ))}
          </select>
        </label>
      )}
      <div className="period-tabs">
        {([
          ["TODAY", "Hoy"],
          ["WEEK", "Semana"],
          ["MONTH", "Mes"],
          ["RANGE", "Rango"],
        ] as [Period, string][]).map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={period === value ? "selected" : ""}
            onClick={() => onPeriodChange(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {period === "RANGE" && (
        <div className="range-fields">
          <label>
            Desde
            <input
              type="date"
              value={from}
              onChange={(event) => onFromChange(event.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={to}
              onChange={(event) => onToChange(event.target.value)}
            />
          </label>
        </div>
      )}
      {period === "WEEK" && range && (
        <p className="period-caption">
          Semana laboral: {formatRangeDay(range.start)} –{" "}
          {formatRangeDay(
            new Date(new Date(range.end).getTime() - 1).toISOString(),
          )}
        </p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: "commission" | "net";
}) {
  return (
    <div className={icon ? "with-icon" : "without-icon"}>
      {icon === "commission" && <HandCoins size={19} />}
      {icon === "net" && <TrendingUp size={19} />}
      <span>{label}</span>
      <strong>{value}</strong>
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
