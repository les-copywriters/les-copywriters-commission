import { useState, useMemo } from "react";
import { CLOSER_RATE } from "@/lib/commissionRates";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import AppLayout from "@/components/AppLayout";
import SalesTable from "@/components/admin/SalesTable";
import BonusTiersCard from "@/components/admin/BonusTiersCard";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Sale } from "@/types";
import { Download, Shield, FileSpreadsheet, RefreshCw, Trash2, AlertTriangle, BellRing, Wallet, ShoppingCart, UserCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { toast } from "sonner";
import { useSales, useUpdateCommission, useDeleteSale, useMarkAsRefunded, useMarkAsImpaye, useReassignCloser } from "@/hooks/useSales";
import { useCommissionAuditLog } from "@/hooks/useCommissionAuditLog";
import { useProfiles } from "@/hooks/useProfiles";
import { Badge } from "@/components/ui/badge";
import { useSyncJotform } from "@/hooks/useSyncJotform";
import { useCommissionHealthReport } from "@/hooks/useCommissionHealthReport";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const timeAgo = (iso: string | null) => {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const AdminPage = () => {
  const { t, locale } = useLanguage();
  const {
    data: sales = [],
    isLoading,
    isError: salesLoadFailed,
    error: salesError,
    refetch: refetchSales,
  } = useSales();
  const {
    data: profiles = [],
    isError: profilesLoadFailed,
    error: profilesError,
    refetch: refetchProfiles,
  } = useProfiles();
  const updateCommission = useUpdateCommission();
  const deleteSale = useDeleteSale();
  const markRefunded = useMarkAsRefunded();
  const markImpaye = useMarkAsImpaye();
  const reassignCloser = useReassignCloser();
  const [reassignSaleId, setReassignSaleId] = useState<string | null>(null);
  const [reassignPickedId, setReassignPickedId] = useState("");
  const sync = useSyncJotform();
  const healthReport = useCommissionHealthReport();
  const { data: auditLog = [] } = useCommissionAuditLog();

  // Include legacy (inactive) closers so their historical sales don't trigger false mismatch errors.
  const closerIds = useMemo(
    () => new Set(profiles.filter((p) => p.role === "closer" || p.role === "admin").map((p) => p.id)),
    [profiles]
  );
  const setterIds = useMemo(
    () => new Set(profiles.filter((p) => p.role === "setter").map((p) => p.id)),
    [profiles]
  );

  const [editing, setEditing] = useState<Sale | null>(null);
  const [commOverride, setCommOverride] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fmt = (n: number) => formatCurrency(n, locale);

  const handleDelete = () => {
    if (!deleteId) return;
    deleteSale.mutate(deleteId, {
      onSuccess: () => { toast.success(t("admin.saleDeleted")); setDeleteId(null); },
      onError: (e) => toast.error(e.message),
    });
  };

  const handleSaveOverride = () => {
    if (!editing) return;
    const override = parseFloat(commOverride);
    if (isNaN(override)) return;
    updateCommission.mutate({
      id: editing.id,
      closerCommission: override,
      oldCommission: editing.closerCommission
    }, {
      onSuccess: () => {
        toast.success(t("admin.commUpdated"), { description: `Closer commission → ${fmt(override)}` });
        setEditing(null);
        setCommOverride("");
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const exportCSV = () => {
    const headers = [
      t("table.date"), t("table.client"), "Email", t("table.product"),
      t("table.closer"), t("table.setter"),
      t("table.amount"), t("table.closerComm"), t("table.setterComm"),
      t("table.status"),
    ];
    const rows = sales.map(s => [
      s.date, s.clientName, s.clientEmail ?? "", s.product,
      s.closer, s.setter,
      s.amount.toFixed(2), s.closerCommission.toFixed(2), s.setterCommission.toFixed(2),
      s.refunded ? t("status.refunded") : s.impaye ? t("status.unpaid") : t("status.paid"),
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commissions_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const paidSales = sales.filter(s => !s.refunded && !s.impaye);
  const totalComm = paidSales.reduce((a, s) => a + s.closerCommission + s.setterCommission, 0);

  const discrepancies = useMemo(() => {
    return sales.flatMap((sale) => {
      const issues: Array<{ category: "sync" | "required_field" | "amount" | "mapping" | "installments"; issue: string; severity: "error" | "warning" | "info"; closerName?: string }> = [];
      if (!sale.jotformSubmissionId) issues.push({ category: "sync", issue: "Missing JotForm submission ID", severity: "warning" });
      if (!sale.clientEmail) issues.push({ category: "required_field", issue: "Missing client email", severity: "info" });
      if (sale.amount <= 0) issues.push({ category: "amount", issue: "Invalid amount", severity: "error" });
      if (!closerIds.has(sale.closerId)) issues.push({ category: "mapping", issue: "Closer profile mismatch", severity: "error", closerName: sale.closer || "Unknown" });
      if (sale.setterId && !setterIds.has(sale.setterId)) issues.push({ category: "mapping", issue: "Setter profile mismatch", severity: "error" });
      if (sale.paymentType === "installments" && (!sale.numInstallments || !sale.installmentAmount)) {
        issues.push({ category: "installments", issue: "Installment fields incomplete", severity: "warning" });
      }
      return issues.map((entry) => ({ saleId: sale.id, client: sale.clientName, amount: sale.amount, ...entry }));
    });
  }, [sales, closerIds, setterIds]);

  const discrepancyCounts = useMemo(
    () =>
      discrepancies.reduce<Record<string, number>>((acc, item) => {
        acc[item.category] = (acc[item.category] ?? 0) + 1;
        return acc;
      }, {}),
    [discrepancies]
  );

  const showLoadError = salesLoadFailed || profilesLoadFailed;
  const loadErrorMessage = salesLoadFailed
    ? salesError instanceof Error ? salesError.message : "Failed to load commission data."
    : profilesError instanceof Error ? profilesError.message : "Failed to load profiles.";

  const exportDiscrepancies = () => {
    if (discrepancies.length === 0) return;
    const headers = ["sale_id", "client", "category", "issue", "severity"];
    const rows = discrepancies.map((item) => [item.saleId, item.client, item.category, item.issue, item.severity]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `discrepancies_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const syncHealth = healthReport.data?.syncHealth ?? {};
  const reconciliation = healthReport.data?.reconciliation;

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("admin.commissionsManagement")}</p>
            <h1 className="text-xl font-semibold">{t("admin.title")}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <Button
              variant="outline"
              size="sm"
              disabled={sync.isPending}
              onClick={() =>
                sync.mutate(undefined, {
                  onSuccess: (res) => {
                    const updated = res.updated ?? 0;
                    const skipped = res.skipped ?? 0;
                    const errorCount = res.errors?.length ?? 0;
                    const total = res.total ?? 0;
                    const nonActive = res.nonActive ?? 0;
                    const checkedDesc = [
                      total > 0 ? `Checked ${total} submission(s) from JotForm.` : null,
                      nonActive > 0 ? `${nonActive} had non-active status.` : null,
                    ].filter(Boolean).join(" ") || undefined;
                    if (res.imported > 0 || updated > 0) {
                      toast.success(
                        [
                          res.imported > 0 ? `${res.imported} ${t("sync.imported")}` : null,
                          updated > 0 ? `${updated} ${t("sync.updated")}` : null,
                        ].filter(Boolean).join(" · "),
                        { description: checkedDesc }
                      );
                    } else if (skipped > 0 || errorCount > 0) {
                      toast.warning(t("sync.completedWithIssues"), {
                        description: [
                          checkedDesc,
                          skipped > 0 ? `${skipped} ${t("sync.skipped")}` : null,
                          errorCount > 0 ? `${errorCount} ${t("sync.errors")}: ${res.errors.slice(0, 2).join(" | ")}` : null,
                        ].filter(Boolean).join(" — "),
                      });
                    } else {
                      toast.info(t("sync.upToDate"), { description: checkedDesc });
                    }
                  },
                  onError: (e) => toast.error(`${t("sync.error")}: ${e.message}`),
                })
              }
              className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", sync.isPending && "animate-spin")} />
              {sync.isPending ? t("sync.syncing") : t("sync.button")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={healthReport.isPending}
              className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground gap-2"
              onClick={() =>
                healthReport.mutate(
                  { notifySlack: false },
                  {
                    onSuccess: (report) => {
                      toast.success(`Health report generated`, {description: `${report.totalDiscrepancies} discrepancies found`});
                    },
                    onError: (error) => toast.error(error.message),
                  }
                )
              }
            >
              <BellRing className={cn("h-4 w-4", healthReport.isPending && "animate-pulse")} />
              {healthReport.isPending ? "Running..." : "Check health"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={sales.length === 0} className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground gap-2">
              <Download className="h-4 w-4" />{t("admin.exportCSV")}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title={t("detail.totalSales")} value={String(sales.length)} accent="blue" icon={<ShoppingCart className="h-4 w-4" />} />
          <StatCard title={t("status.paid")} value={String(paidSales.length)} accent="green" icon={<Shield className="h-4 w-4" />} />
          <StatCard title={t("dashboard.totalCommissions")} value={fmt(totalComm)} accent="blue" icon={<Wallet className="h-4 w-4" />} trend="up" />
          <StatCard title={t("dashboard.refunds")} value={String(sales.filter(s => s.refunded).length)} accent="red" icon={<AlertTriangle className="h-4 w-4" />} trend="down" />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales Table */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/40">
                <p className="text-sm font-medium">{t("dashboard.recentCommissions")}</p>
                <Badge variant="outline" className="rounded-md text-[10px] font-medium bg-primary/5 text-primary border-primary/20">
                  {sales.length} Transactions
                </Badge>
              </div>
              <div>
                {showLoadError ? (
                  <div className="p-6">
                    <Alert variant="destructive" className="rounded-lg border-destructive/20 bg-destructive/5">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="font-semibold">Database Error</AlertTitle>
                      <AlertDescription className="mt-2 flex flex-col gap-3">
                        <p className="text-sm">{loadErrorMessage}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-fit rounded-lg border-destructive/20 text-destructive"
                          onClick={() => { refetchSales(); refetchProfiles(); }}
                        >
                          Retry Connection
                        </Button>
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : isLoading ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                  </div>
                ) : sales.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-sm font-medium text-muted-foreground">{t("admin.noData")}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Sync with JotForm to see recent sales</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <SalesTable
                      sales={sales}
                      onEdit={(sale) => { setEditing(sale); setCommOverride(sale.closerCommission.toString()); }}
                      onDelete={(id) => setDeleteId(id)}
                      onMarkRefund={(sale) => markRefunded.mutate(
                        { id: sale.id, amount: sale.amount, date: sale.date },
                        {
                          onSuccess: () => toast.success(`${sale.clientName} marked as refunded`),
                          onError: (e) => toast.error(e.message),
                        }
                      )}
                      onMarkImpaye={(sale) => markImpaye.mutate(
                        { id: sale.id, amount: sale.amount, date: sale.date },
                        {
                          onSuccess: () => toast.success(`${sale.clientName} marked as failed payment`),
                          onError: (e) => toast.error(e.message),
                        }
                      )}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar: Data Quality & Bonus Tiers */}
          <div className="space-y-6">
            <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/40">
                <p className="text-sm font-medium">Data Quality</p>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-muted" onClick={exportDiscrepancies} disabled={discrepancies.length === 0}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="p-4 space-y-4">
                {Object.keys(syncHealth).length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-medium text-muted-foreground">Platform Sync Health</p>
                      <Badge variant="outline" className="rounded-md text-[10px]">
                        {healthReport.data?.generatedAt ? `Updated ${timeAgo(healthReport.data.generatedAt)}` : "Health report"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {["jotform", "aircall", "iclosed"].map((source) => {
                        const item = syncHealth[source];
                        if (!item) return null;
                        const tone =
                          item.freshness === "fresh" && item.status === "success" ? "emerald" :
                          item.status === "partial" || item.freshness === "aging" ? "amber" :
                          item.status === "error" || item.freshness === "stale" || item.freshness === "missing" ? "rose" :
                          "blue";

                        return (
                          <div
                            key={source}
                            className={cn(
                              "rounded-lg border px-3 py-2.5",
                              tone === "emerald" && "border-emerald-500/20 bg-emerald-500/5",
                              tone === "amber" && "border-amber-500/20 bg-amber-500/5",
                              tone === "rose" && "border-rose-500/20 bg-rose-500/5",
                              tone === "blue" && "border-blue-500/20 bg-blue-500/5",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-xs font-medium">{source}</p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {item.startedAt ? `Last run ${timeAgo(item.startedAt)}` : "No sync run recorded"}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "rounded-md text-[10px]",
                                    tone === "emerald" && "border-emerald-500/20 text-emerald-600",
                                    tone === "amber" && "border-amber-500/20 text-amber-600",
                                    tone === "rose" && "border-rose-500/20 text-rose-600",
                                    tone === "blue" && "border-blue-500/20 text-blue-600",
                                  )}
                                >
                                  {item.status} · {item.freshness}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {item.rowsWritten} written / {item.recordsSeen} seen
                                </span>
                              </div>
                            </div>
                            {item.lastError && (
                              <p className="mt-2 text-[11px] text-rose-500 line-clamp-2">{item.lastError}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {reconciliation && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-muted-foreground">Reconciliation Snapshot</p>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-medium">JotForm</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {reconciliation.jotform.importedSales} imported · {reconciliation.jotform.uniqueSubmissionIds} unique IDs
                            </p>
                          </div>
                          <Badge variant="outline" className="rounded-md text-[10px]">
                            {reconciliation.jotform.duplicateSubmissionCount} duplicates
                          </Badge>
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          Missing IDs: {reconciliation.jotform.missingSubmissionIdCount}
                          {reconciliation.jotform.latestImportedSaleDate ? ` · latest ${reconciliation.jotform.latestImportedSaleDate}` : ""}
                        </p>
                      </div>

                      <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5">
                        <p className="text-xs font-medium">Aircall</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {reconciliation.aircall.storedCallRecords} call records stored
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Latest: {reconciliation.aircall.latestRunRecordsSeen} seen · {reconciliation.aircall.latestRunRowsWritten} written · {reconciliation.aircall.latestRunStatus}
                        </p>
                      </div>

                      <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5">
                        <p className="text-xs font-medium">iClosed</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {reconciliation.iclosed.storedFunnelMetricRows} funnel metric rows stored
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Latest: {reconciliation.iclosed.latestRunRecordsSeen} seen · {reconciliation.iclosed.latestRunRowsWritten} written · {reconciliation.iclosed.latestRunStatus}
                        </p>
                      </div>

                      <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5">
                        <p className="text-xs font-medium">Fathom</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {reconciliation.fathom.importedMeetings} meetings · {reconciliation.fathom.meetingsWithTranscript} with transcript
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Pending: {reconciliation.fathom.pendingTranscriptCount}
                          {reconciliation.fathom.latestImportedAt ? ` · latest ${timeAgo(reconciliation.fathom.latestImportedAt)}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {discrepancies.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm font-medium text-muted-foreground">Data is healthy</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">No mapping issues found.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(discrepancyCounts).map(([cat, count]) => (
                        <div key={cat} className="flex flex-col gap-1 px-3 py-2 rounded-lg bg-muted/30 border border-border/40">
                          <span className="text-[10px] text-muted-foreground">{cat.replace('_', ' ')}</span>
                          <span className="text-base font-semibold">{count}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                      {discrepancies.slice(0, 15).map((item, idx) => (
                        <div key={idx} className={cn(
                          "p-3 rounded-lg border border-border/40 space-y-2",
                          item.severity === "error" ? "bg-rose-500/5" :
                          item.severity === "warning" ? "bg-amber-500/5" :
                          "bg-blue-500/5"
                        )}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-none truncate">{item.client}</p>
                              {item.category === "mapping" && item.closerName && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">Closer: <span className="font-medium text-foreground">{item.closerName}</span></p>
                              )}
                            </div>
                            <Badge variant="outline" className={cn(
                              "rounded-md text-[10px] shrink-0",
                              item.severity === "error" ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                              item.severity === "warning" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                              "bg-blue-500/10 text-blue-600 border-blue-500/20"
                            )}>
                              {item.severity}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{item.issue}</p>
                          {item.category === "mapping" && item.issue === "Closer profile mismatch" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-full rounded-lg text-[11px] border-border/60 gap-1.5"
                              onClick={() => { setReassignSaleId(item.saleId); setReassignPickedId(""); }}
                            >
                              <UserCheck className="h-3 w-3" />
                              Reassign Closer
                            </Button>
                          )}
                          {item.category === "installments" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-full rounded-lg text-[11px] border-amber-500/30 text-amber-600 hover:bg-amber-500/10 gap-1.5"
                              onClick={() => {
                                const sale = sales.find(s => s.id === item.saleId);
                                if (sale) { setEditing(sale); setCommOverride(sale.closerCommission.toString()); }
                              }}
                            >
                              <FileSpreadsheet className="h-3 w-3" />
                              Edit Installment Details
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    {discrepancies.length > 15 && (
                      <p className="text-center text-[11px] text-muted-foreground/50 py-1">
                        + {discrepancies.length - 15} more issues
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <BonusTiersCard />

            {auditLog.length > 0 && (
              <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/40">
                  <p className="text-sm font-medium">Commission Overrides</p>
                  <Badge variant="outline" className="rounded-md text-[10px] bg-amber-500/5 text-amber-600 border-amber-500/20">
                    {auditLog.length} logged
                  </Badge>
                </div>
                <div className="divide-y divide-border/30 max-h-[340px] overflow-y-auto">
                  {auditLog.map(entry => (
                    <div key={entry.id} className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-muted/20 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{entry.clientName}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          by {entry.changedByName} · {new Date(entry.changedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground line-through">{fmt(entry.oldAmount)}</p>
                        <p className="text-sm font-semibold text-primary">{fmt(entry.newAmount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs and Overlays */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) { setEditing(null); setCommOverride(""); } }}>
        <DialogContent className="max-w-md overflow-hidden rounded-xl border border-border/40 bg-background p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-base font-semibold">{t("admin.editCommission")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                {editing?.clientName[0]}
              </div>
              <div>
                <p className="font-medium text-sm">{editing?.clientName}</p>
                <p className="text-sm text-primary">{editing ? fmt(editing.amount) : ""}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("admin.commLabel")}</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={commOverride}
                  onChange={(e) => setCommOverride(e.target.value)}
                  step="0.01"
                  className="h-9 pl-7 rounded-lg text-sm"
                />
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</div>
              </div>
            </div>
            <Button onClick={handleSaveOverride} className="w-full rounded-lg h-9 px-4 text-xs font-medium" disabled={updateCommission.isPending}>
              {updateCommission.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              {updateCommission.isPending ? t("common.loading") : t("admin.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reassign Closer Dialog */}
      <Dialog open={!!reassignSaleId} onOpenChange={(open) => !open && setReassignSaleId(null)}>
        <DialogContent className="rounded-xl border border-border/40 bg-background p-6 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Reassign Closer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">
              Select the correct closer for this sale. This will update the commission assignment.
            </p>
            <Select value={reassignPickedId} onValueChange={setReassignPickedId}>
              <SelectTrigger className="h-9 rounded-lg border-border/60 text-sm">
                <SelectValue placeholder="Choose a closer…" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {profiles.filter(p => p.role === "closer" || p.role === "admin").map(p => (
                  <SelectItem key={p.id} value={p.id} className="text-sm">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 rounded-lg h-9 text-sm" onClick={() => setReassignSaleId(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-lg h-9 text-sm"
                disabled={!reassignPickedId || reassignCloser.isPending}
                onClick={() => {
                  if (!reassignSaleId || !reassignPickedId) return;
                  const sale = sales.find(s => s.id === reassignSaleId);
                  const closer = profiles.find(p => p.id === reassignPickedId);
                  if (!sale || !closer) return;
                  const commission = Math.round(sale.amount * CLOSER_RATE * 100) / 100;
                  reassignCloser.mutate(
                    { saleId: reassignSaleId, closerId: reassignPickedId, closerName: closer.name, closerCommission: commission },
                    {
                      onSuccess: () => { toast.success(`Closer reassigned to ${closer.name}`); setReassignSaleId(null); },
                      onError: (e) => toast.error(e.message),
                    }
                  );
                }}
              >
                {reassignCloser.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-xl border border-border/40 bg-background p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">{t("common.confirm")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground mt-1">
              {t("admin.confirmDelete")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-4">
            <AlertDialogCancel className="rounded-lg h-9 border-border/60 text-sm">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-lg h-9 bg-rose-500 hover:bg-rose-600 text-sm" disabled={deleteSale.isPending}>
              {deleteSale.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              {deleteSale.isPending ? t("common.loading") : t("admin.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default AdminPage;
