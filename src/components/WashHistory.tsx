"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { FormEvent, TouchEvent } from "react";
import {
  AlertCircle,
  CalendarDays,
  CarFront,
  Check,
  ChevronRight,
  ClipboardList,
  CreditCard,
  HandCoins,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Trash2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { PhotoLightbox, type LightboxPhoto } from "@/components/PhotoLightbox";
import { formatMoney, formatPaymentType } from "@/lib/format";
import type { AppUser, ProfitDetail, WashRecord } from "@/types/domain";

type Period = "TODAY" | "WEEK" | "MONTH" | "RANGE";

type LightboxState = {
  photos: LightboxPhoto[];
  startIndex: number;
  title: string;
};

type HistoryStats = {
  count: number;
  income?: number;
  commissions?: number;
  expenses?: number;
  selectedCommission: number;
  netIncome?: number;
  profitDetail?: ProfitDetail;
};

type WashHistoryProps = {
  embedded?: boolean;
  scope?: "PERSONAL" | "ALL";
  users?: AppUser[];
  canDelete?: boolean;
  canEditCommissions?: boolean;
  canEditPrices?: boolean;
};

type WashCommissionEntry = WashRecord["commissions"][number];

type CommissionEditState = {
  washId: number;
  userId: number;
  type: WashCommissionEntry["type"];
  value: string;
  mode: "edit" | "add";
};

type PriceEditState = {
  washId: number;
  value: string;
};

const pullRefreshThreshold = 72;
const pullRefreshMaxDistance = 96;

export function WashHistory({
  embedded = false,
  scope = "PERSONAL",
  users = [],
  canDelete = false,
  canEditCommissions = false,
  canEditPrices = false,
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
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [showProfitDetail, setShowProfitDetail] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [commissionError, setCommissionError] = useState("");
  const [commissionEdit, setCommissionEdit] =
    useState<CommissionEditState | null>(null);
  const [savingCommissionKey, setSavingCommissionKey] = useState<string | null>(
    null,
  );
  const [priceError, setPriceError] = useState("");
  const [priceEdit, setPriceEdit] = useState<PriceEditState | null>(null);
  const [savingPriceId, setSavingPriceId] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullStartY = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const globalScope = scope === "ALL";

  const load = useCallback(async () => {
    if (period === "RANGE" && (!from || !to)) return;
    setLoading(true);
    try {
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
    } finally {
      setLoading(false);
    }
  }, [from, globalScope, period, selectedUser, to]);

  const refreshResults = useCallback(async () => {
    if (refreshingRef.current) return;

    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await load();
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
      pullDistanceRef.current = 0;
      setPullDistance(0);
    }
  }, [load]);

  function updatePullDistance(value: number) {
    pullDistanceRef.current = value;
    setPullDistance(value);
  }

  function touchCanStartRefresh(target: EventTarget) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.closest("button, a, input, select, textarea")) return false;
    return window.scrollY <= 2;
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (refreshingRef.current || loading || !touchCanStartRefresh(event.target)) {
      pullStartY.current = null;
      return;
    }

    pullStartY.current = event.touches[0]?.clientY ?? null;
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (pullStartY.current === null) return;

    const touchY = event.touches[0]?.clientY;
    if (touchY === undefined) return;

    const delta = touchY - pullStartY.current;
    if (delta <= 0) {
      updatePullDistance(0);
      return;
    }

    event.preventDefault();
    updatePullDistance(Math.min(delta * 0.55, pullRefreshMaxDistance));
  }

  function handleTouchEnd() {
    const shouldRefresh = pullDistanceRef.current >= pullRefreshThreshold;
    pullStartY.current = null;

    if (shouldRefresh) {
      void refreshResults();
      return;
    }

    updatePullDistance(0);
  }

  async function deleteWash(wash: WashRecord) {
    const confirmed = window.confirm(
      `¿Eliminar el servicio #${wash.id}? Se ocultará del historial y de los totales, pero quedará auditado.`,
    );
    if (!confirmed) return;

    setDeleteError("");
    setDeletingId(wash.id);
    const response = await fetch(`/api/washes/${wash.id}`, {
      method: "DELETE",
    });
    setDeletingId(null);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setDeleteError(
        typeof payload?.error === "string"
          ? payload.error
          : "No fue posible eliminar el servicio.",
      );
      return;
    }

    await load();
  }

  function startCommissionEdit(
    washId: number,
    commission: WashCommissionEntry,
  ) {
    setCommissionError("");
    setPriceEdit(null);
    setCommissionEdit({
      washId,
      userId: commission.user.id,
      type: commission.type,
      value: String(commission.value),
      mode: "edit",
    });
  }

  function startCommissionAdd(wash: WashRecord) {
    setCommissionError("");
    setPriceEdit(null);
    setCommissionEdit({
      washId: wash.id,
      userId: 0,
      type: "PERCENTAGE",
      value: "",
      mode: "add",
    });
  }

  async function saveCommission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commissionEdit) return;

    if (!Number.isInteger(commissionEdit.userId) || commissionEdit.userId <= 0) {
      setCommissionError("Selecciona una persona para comisionar.");
      return;
    }

    const value = Number(commissionEdit.value);
    if (!Number.isFinite(value) || value < 0) {
      setCommissionError("Captura una comisión válida.");
      return;
    }
    if (commissionEdit.type === "PERCENTAGE" && value > 100) {
      setCommissionError("El porcentaje no puede ser mayor a 100.");
      return;
    }

    const key = commissionKey(commissionEdit.washId, commissionEdit.userId);
    setCommissionError("");
    setSavingCommissionKey(key);
    const response = await fetch(`/api/washes/${commissionEdit.washId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: commissionEdit.userId,
        type: commissionEdit.type,
        value,
      }),
    });
    setSavingCommissionKey(null);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setCommissionError(
        typeof payload?.error === "string"
          ? payload.error
          : "No fue posible actualizar la comisión.",
      );
      return;
    }

    setCommissionEdit(null);
    await load();
  }

  function startPriceEdit(wash: WashRecord) {
    setPriceError("");
    setCommissionEdit(null);
    setPriceEdit({
      washId: wash.id,
      value: String(wash.chargedPrice ?? 0),
    });
  }

  async function savePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!priceEdit) return;

    const chargedPrice = Number(priceEdit.value);
    if (!Number.isFinite(chargedPrice) || chargedPrice <= 0 || chargedPrice > 999999) {
      setPriceError("Captura una cantidad cobrada válida.");
      return;
    }

    setPriceError("");
    setSavingPriceId(priceEdit.washId);
    const response = await fetch(`/api/washes/${priceEdit.washId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chargedPrice }),
    });
    setSavingPriceId(null);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setPriceError(
        typeof payload?.error === "string"
          ? payload.error
          : "No fue posible actualizar la cantidad cobrada.",
      );
      return;
    }

    setPriceEdit(null);
    await load();
  }

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setShowProfitDetail(false);
  }, [from, period, selectedUser, to]);

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

  const pullReady = pullDistance >= pullRefreshThreshold;

  return (
    <div
      className={embedded ? "admin-history-view" : "mobile-page history-page"}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        className={`pull-refresh-indicator ${pullReady ? "ready" : ""} ${
          refreshing ? "refreshing" : ""
        }`}
        aria-hidden={pullDistance === 0 && !refreshing}
        style={{
          height: refreshing
            ? 54
            : Math.round(Math.min(pullDistance, pullRefreshThreshold)),
          opacity: refreshing || pullDistance > 8 ? 1 : 0,
        }}
      >
        <RefreshCw size={18} />
        <span>
          {refreshing
            ? "Actualizando..."
            : pullReady
              ? "Suelta para actualizar"
              : "Jala para actualizar"}
        </span>
      </div>
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
            <StatCard label="Servicios" value={String(stats.count)} icon="services" />
            <StatCard label="Ingresos" value={formatMoney(stats.income ?? 0)} icon="income" />
            <StatCard
              label={selectedUser === "ALL" ? "Comisiones" : "Comisión del usuario"}
              value={formatMoney(
                selectedUser === "ALL"
                  ? stats.commissions ?? 0
                  : stats.selectedCommission,
              )}
              icon="commission"
            />
            {selectedUser === "ALL" && (
              <StatCard
                label="Egresos"
                value={formatMoney(stats.expenses ?? 0)}
                icon="expense"
              />
            )}
            <StatCard
              label="Ganancia neta"
              value={formatMoney(stats.netIncome ?? 0)}
              icon="net"
              onClick={
                selectedUser === "ALL" && stats.profitDetail
                  ? () => setShowProfitDetail(true)
                  : undefined
              }
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
        {(deleteError || commissionError || priceError) && (
          <div className="history-alert">
            <AlertCircle size={17} />
            {deleteError || commissionError || priceError}
          </div>
        )}
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
                <RecordAmount
                  wash={wash}
                  embedded={embedded}
                  canEdit={canEditPrices}
                  edit={priceEdit}
                  savingId={savingPriceId}
                  onStartEdit={startPriceEdit}
                  onCancelEdit={() => setPriceEdit(null)}
                  onDraftChange={(value) =>
                    setPriceEdit((current) =>
                      current ? { ...current, value } : current,
                    )
                  }
                  onSave={savePrice}
                />
                {embedded && canDelete && (
                  <button
                    type="button"
                    className="record-delete-button"
                    title="Eliminar servicio"
                    disabled={deletingId === wash.id}
                    onClick={() => void deleteWash(wash)}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
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
                <span>
                  <CreditCard size={15} />
                  {formatPaymentType(wash.paymentType)}
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
                  <CommissionBreakdown
                    wash={wash}
                    users={users}
                    selectedUser={selectedUser}
                    canEdit={canEditCommissions}
                    edit={commissionEdit}
                    savingKey={savingCommissionKey}
                    onStartEdit={startCommissionEdit}
                    onStartAdd={startCommissionAdd}
                    onCancelEdit={() => setCommissionEdit(null)}
                    onDraftChange={(patch) =>
                      setCommissionEdit((current) =>
                        current ? { ...current, ...patch } : current,
                      )
                    }
                    onSave={saveCommission}
                  />
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
                  {wash.photos
                    .filter(
                      (photo): photo is (typeof photo & { url: string }) =>
                        Boolean(photo.url),
                    )
                    .map((photo, index, availablePhotos) => (
                      <button
                        type="button"
                        key={photo.id}
                        aria-label={`Ver fotografía ${index + 1} de ${availablePhotos.length} del lavado ${wash.id}`}
                        style={{ backgroundImage: `url("${photo.url}")` }}
                        onClick={() =>
                          setLightbox({
                            photos: availablePhotos,
                            startIndex: index,
                            title: `Lavado #${wash.id}`,
                          })
                        }
                      />
                    ))}
                </div>
              )}
            </article>
          ))
        )}
      </section>

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          startIndex={lightbox.startIndex}
          title={lightbox.title}
          onClose={() => setLightbox(null)}
        />
      )}
      {showProfitDetail && stats.profitDetail && (
        <ProfitDetailDialog
          detail={stats.profitDetail}
          onClose={() => setShowProfitDetail(false)}
        />
      )}
    </div>
  );
}

function commissionKey(washId: number, userId: number) {
  return `${washId}:${userId}`;
}

function RecordAmount({
  wash,
  embedded,
  canEdit,
  edit,
  savingId,
  onStartEdit,
  onCancelEdit,
  onDraftChange,
  onSave,
}: {
  wash: WashRecord;
  embedded: boolean;
  canEdit: boolean;
  edit: PriceEditState | null;
  savingId: number | null;
  onStartEdit: (wash: WashRecord) => void;
  onCancelEdit: () => void;
  onDraftChange: (value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isEditing = edit?.washId === wash.id;
  const isSaving = savingId === wash.id;
  const amount = embedded ? wash.chargedPrice ?? 0 : wash.personalCommission;

  if (isEditing) {
    return (
      <form className="record-amount price-edit-form" onSubmit={onSave}>
        <label>
          Cobrado
          <input
            type="number"
            min="0.01"
            max="999999"
            step="0.01"
            value={edit.value}
            disabled={isSaving}
            onChange={(event) => onDraftChange(event.target.value)}
          />
        </label>
        <div className="price-edit-actions">
          <button type="submit" title="Guardar cantidad cobrada" disabled={isSaving}>
            <Check size={14} />
          </button>
          <button type="button" title="Cancelar" disabled={isSaving} onClick={onCancelEdit}>
            <X size={14} />
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="record-amount">
      <span>{embedded ? "Cobrado" : "Mi comisión"}</span>
      <div className="record-amount-line">
        <strong>{formatMoney(amount)}</strong>
        {embedded && canEdit && (
          <button
            type="button"
            className="price-edit-button"
            title="Editar cantidad cobrada"
            onClick={() => onStartEdit(wash)}
          >
            <Pencil size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function getCommissionEntries(wash: WashRecord): WashCommissionEntry[] {
  const commissionsByUser = new Map(
    wash.commissions.map((commission) => [commission.user.id, commission]),
  );
  const workers = [
    wash.createdBy,
    ...wash.participants.map((participant) => participant.user),
  ];
  const seen = new Set<number>();
  const entries = workers
    .filter((worker) => {
      if (seen.has(worker.id)) return false;
      seen.add(worker.id);
      return true;
    })
    .map(
      (worker) =>
        commissionsByUser.get(worker.id) ?? {
          type: "PERCENTAGE" as const,
          value: 0,
          amount: 0,
          user: worker,
        },
    );

  for (const commission of wash.commissions) {
    if (!seen.has(commission.user.id)) entries.push(commission);
  }

  return entries;
}

function CommissionBreakdown({
  wash,
  users,
  selectedUser,
  canEdit,
  edit,
  savingKey,
  onStartEdit,
  onStartAdd,
  onCancelEdit,
  onDraftChange,
  onSave,
}: {
  wash: WashRecord;
  users: AppUser[];
  selectedUser: string;
  canEdit: boolean;
  edit: CommissionEditState | null;
  savingKey: string | null;
  onStartEdit: (washId: number, commission: WashCommissionEntry) => void;
  onStartAdd: (wash: WashRecord) => void;
  onCancelEdit: () => void;
  onDraftChange: (patch: Partial<CommissionEditState>) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const entries = getCommissionEntries(wash);
  const commissionedUserIds = new Set(
    entries.map((commission) => commission.user.id),
  );
  const availableUsers = users.filter(
    (user) =>
      user.active &&
      user.role !== "ADMINISTRATIVE" &&
      !commissionedUserIds.has(user.id),
  );
  const isAdding = edit?.washId === wash.id && edit.mode === "add";
  const addSavingKey =
    edit && isAdding ? commissionKey(wash.id, edit.userId) : null;

  return (
    <div className="commission-breakdown">
      {entries.map((commission) => {
        const key = commissionKey(wash.id, commission.user.id);
        const isSelected = selectedUser === String(commission.user.id);
        const isEditing =
          edit?.mode === "edit" &&
          edit.washId === wash.id &&
          edit.userId === commission.user.id;
        const isSaving = savingKey === key;

        if (isEditing) {
          return (
            <form
              className={`commission-row commission-edit-form ${isSelected ? "selected" : ""}`}
              key={commission.user.id}
              onSubmit={onSave}
            >
              <b className="commission-person">{commission.user.name}</b>
              <select
                value={edit.type}
                disabled={isSaving}
                onChange={(event) =>
                  onDraftChange({
                    type: event.target.value as CommissionEditState["type"],
                  })
                }
              >
                <option value="PERCENTAGE">Porcentaje</option>
                <option value="FIXED">Monto fijo</option>
              </select>
              <input
                type="number"
                min="0"
                max={edit.type === "PERCENTAGE" ? 100 : 999999}
                step="0.01"
                value={edit.value}
                disabled={isSaving}
                onChange={(event) => onDraftChange({ value: event.target.value })}
              />
              <div className="commission-row-actions">
                <button type="submit" title="Guardar comisión" disabled={isSaving}>
                  <Check size={14} />
                </button>
                <button type="button" title="Cancelar" disabled={isSaving} onClick={onCancelEdit}>
                  <X size={14} />
                </button>
              </div>
            </form>
          );
        }

        return (
          <div
            className={`commission-row ${isSelected ? "selected" : ""} ${
              commission.amount === 0 ? "empty-commission" : ""
            }`}
            key={commission.user.id}
          >
            <b className="commission-person">{commission.user.name}</b>
            <span className="commission-rule">
              {commission.type === "PERCENTAGE" ? "Porcentaje" : "Monto fijo"}
            </span>
            <span className="commission-value">
              {commission.type === "PERCENTAGE"
                ? `${commission.value}%`
                : formatMoney(commission.value)}
            </span>
            <strong>{formatMoney(commission.amount)}</strong>
            {canEdit && (
              <button
                type="button"
                className="commission-edit-button"
                title="Editar comisión"
                onClick={() => onStartEdit(wash.id, commission)}
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
        );
      })}
      {canEdit && edit && isAdding && (
        <form
          className="commission-row commission-edit-form commission-add-form"
          onSubmit={onSave}
        >
          <select
            className="commission-person-select"
            value={edit.userId}
            disabled={savingKey === addSavingKey}
            onChange={(event) =>
              onDraftChange({ userId: Number(event.target.value) })
            }
          >
            <option value={0}>Persona</option>
            {availableUsers.map((user) => (
              <option value={user.id} key={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <select
            value={edit.type}
            disabled={savingKey === addSavingKey}
            onChange={(event) =>
              onDraftChange({
                type: event.target.value as CommissionEditState["type"],
              })
            }
          >
            <option value="PERCENTAGE">Porcentaje</option>
            <option value="FIXED">Monto fijo</option>
          </select>
          <input
            type="number"
            min="0"
            max={edit.type === "PERCENTAGE" ? 100 : 999999}
            step="0.01"
            value={edit.value}
            disabled={savingKey === addSavingKey}
            placeholder={edit.type === "PERCENTAGE" ? "0%" : "$0.00"}
            onChange={(event) => onDraftChange({ value: event.target.value })}
          />
          <div className="commission-row-actions">
            <button
              type="submit"
              title="Guardar comisión"
              disabled={savingKey === addSavingKey || availableUsers.length === 0}
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              title="Cancelar"
              disabled={savingKey === addSavingKey}
              onClick={onCancelEdit}
            >
              <X size={14} />
            </button>
          </div>
        </form>
      )}
      {canEdit && !isAdding && availableUsers.length > 0 && (
        <button
          type="button"
          className="commission-add-button"
          onClick={() => onStartAdd(wash)}
        >
          <Plus size={14} />
          Agregar comisión
        </button>
      )}
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
  onClick,
}: {
  label: string;
  value: string;
  icon: "services" | "income" | "commission" | "expense" | "net";
  onClick?: () => void;
}) {
  const Icon =
    icon === "services"
      ? CarFront
      : icon === "income"
        ? CreditCard
        : icon === "commission"
          ? HandCoins
          : icon === "expense"
            ? ReceiptText
            : TrendingUp;
  const content = (
    <>
      <span className="stat-card-icon">
        <Icon size={18} />
      </span>
      <div className="stat-card-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {onClick && (
          <small className="stat-card-action">
            Ver detalle
            <ChevronRight size={14} aria-hidden="true" />
          </small>
        )}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={`with-icon clickable ${icon}`}
        aria-label={`${label}: ${value}. Ver detalle`}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`with-icon ${icon}`}>
      {content}
    </div>
  );
}

function ProfitDetailDialog({
  detail,
  onClose,
}: {
  detail: ProfitDetail;
  onClose: () => void;
}) {
  return (
    <div className="profit-dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="profit-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profit-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="profit-dialog-heading">
          <div>
            <h2 id="profit-detail-title">Detalle de ganancia neta</h2>
            <p>Utilidad, caja disponible y reparto entre socios activos.</p>
          </div>
          <button type="button" className="icon-button" title="Cerrar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="profit-formula">
          <div>
            <span>Ingresos</span>
            <strong>{formatMoney(detail.income)}</strong>
          </div>
          <div>
            <span>Comisiones</span>
            <strong>-{formatMoney(detail.commissions)}</strong>
          </div>
          <div>
            <span>Tomado de caja</span>
            <strong>-{formatMoney(detail.cashExpenses)}</strong>
          </div>
          <div>
            <span>Fuera de caja</span>
            <strong>-{formatMoney(detail.externalExpenses)}</strong>
          </div>
          <div className="total">
            <span>Ganancia neta</span>
            <strong>{formatMoney(detail.netIncome)}</strong>
          </div>
        </div>

        <div className="profit-payout-summary">
          <div>
            <span>Caja antes de socios</span>
            <strong>{formatMoney(detail.cashBeforePartnerPayout)}</strong>
          </div>
          <div>
            <span>Reembolsos</span>
            <strong>{formatMoney(detail.reimbursableExpenses)}</strong>
          </div>
          <div className="total">
            <span>Total a entregar</span>
            <strong>{formatMoney(detail.totalPartnerPayout)}</strong>
          </div>
        </div>

        {detail.externalNonReimbursableExpenses > 0 && (
          <div className="profit-info">
            Hay {formatMoney(detail.externalNonReimbursableExpenses)} fuera de caja sin
            reembolso. Reduce la ganancia neta, pero no se suma al total a entregar.
          </div>
        )}

        {!detail.hasValidPartnerShares && (
          <div className="profit-warning">
            <AlertCircle size={18} />
            Los porcentajes de socios activos suman {detail.partnerShareTotal}%.
            Deben sumar 100% para calcular el reparto final.
          </div>
        )}

        <div className="partner-payout-list">
          {detail.partners.length === 0 ? (
            <div className="empty-state">No hay socios activos configurados.</div>
          ) : (
            detail.partners.map((partner) => (
              <article key={partner.id}>
                <div>
                  <strong>{partner.name}</strong>
                  <span>{partner.sharePercentage}% de participación</span>
                </div>
                {detail.hasValidPartnerShares ? (
                  <>
                    <span className="partner-payout-value">
                      <em>Utilidad</em>
                      {formatMoney(partner.profitShare)}
                    </span>
                    <span className="partner-payout-value">
                      <em>Reembolso</em>
                      {formatMoney(partner.reimbursement)}
                    </span>
                    <strong className="partner-payout-value">
                      <em>Total</em>
                      {formatMoney(partner.totalPayout)}
                    </strong>
                  </>
                ) : (
                  <span className="pending-payout">
                    Reembolso registrado: {formatMoney(partner.reimbursement)}
                  </span>
                )}
              </article>
            ))
          )}
        </div>
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
