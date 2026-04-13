import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import AppLayout from "@/components/AppLayout";
import SalesTable from "@/components/admin/SalesTable";
import BonusTiersCard from "@/components/admin/BonusTiersCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Sale } from "@/types";
import { Download, Shield, FileSpreadsheet, RefreshCw, Trash2 } from "lucide-react";

import { toast } from "sonner";
import { useSales, useUpdateCommission, useDeleteSale } from "@/hooks/useSales";
import { useProfiles } from "@/hooks/useProfiles";
import { Badge } from "@/components/ui/badge";
import { useSyncJotform } from "@/hooks/useSyncJotform";
import { useCommissionHealthReport } from "@/hooks/useCommissionHealthReport";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, BellRing } from "lucide-react";

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
  const sync = useSyncJotform();
  const healthReport = useCommissionHealthReport();

  const closerIds = useMemo(
    () => new Set(profiles.filter((p) => p.role === "closer").map((p) => p.id)),
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
    updateCommission.mutate({ id: editing.id, closerCommission: override }, {
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
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
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
      const issues: Array<{ category: "sync" | "required_field" | "amount" | "mapping" | "installments"; issue: string; severity: "error" | "warning" | "info" }> = [];
      if (!sale.jotformSubmissionId) issues.push({ category: "sync", issue: "Missing JotForm submission ID", severity: "warning" });
      if (!sale.clientEmail) issues.push({ category: "required_field", issue: "Missing client email", severity: "info" });
      if (sale.amount <= 0) issues.push({ category: "amount", issue: "Invalid amount", severity: "error" });
      if (!closerIds.has(sale.closerId)) issues.push({ category: "mapping", issue: "Closer profile mismatch", severity: "error" });
      if (sale.setterId && !setterIds.has(sale.setterId)) issues.push({ category: "mapping", issue: "Setter profile mismatch", severity: "error" });
      if (sale.paymentType === "installments" && (!sale.numInstallments || !sale.installmentAmount)) {
        issues.push({ category: "installments", issue: "Installment fields incomplete", severity: "warning" });
      }
      return issues.map((entry) => ({ saleId: sale.id, client: sale.clientName, ...entry }));
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

  return (
    <AppLayout>
      <div className="space-y-10 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shadow-inner">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">{t("admin.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("admin.commissionsManagement")}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-lg border border-border/40">
              <Button
                variant="ghost"
                size="sm"
                disabled={sync.isPending}
                onClick={() =>
                  sync.mutate(undefined, {
                    onSuccess: (res) => {
                      const updated = res.updated ?? 0;
                      if (res.imported > 0 || updated > 0) {
                        toast.success(
                          [
                            res.imported > 0 ? `${res.imported} ${t("sync.imported")}` : null,
                            updated > 0 ? `${updated} setter(s) updated` : null,
                          ].filter(Boolean).join(" · ")
                        );
                      } else {
                        toast.info(t("sync.upToDate"));
                      }
                      if ((res.errors?.length ?? 0) > 0) {
                        toast.warning(`${res.errors.length} submission(s) skipped`, {
                          description: res.errors.slice(0, 3).join("\n"),
                        });
                      }
                    },
                    onError: (e) => toast.error(`${t("sync.error")}: ${e.message}`),
                  })
                }
                className="gap-2 h-9 px-4"
              >
                <RefreshCw className={cn("h-4 w-4", sync.isPending && "animate-spin")} />
                {sync.isPending ? t("sync.syncing") : t("sync.button")}
              </Button>
              <div className="w-[1px] h-4 bg-border/60 mx-1" />
              <Button
                variant="ghost"
                size="sm"
                disabled={healthReport.isPending}
                className="gap-2 h-9 px-4"
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
            </div>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={sales.length === 0} className="gap-2 h-11 px-4 border-dashed">
              <Download className="h-4 w-4" />{t("admin.exportCSV")}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {[
            { label: t("detail.totalSales"), value: sales.length, icon: FileSpreadsheet, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: t("status.paid"), value: paidSales.length, icon: Shield, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: t("dashboard.totalCommissions"), value: fmt(totalComm), icon: FileSpreadsheet, color: "text-primary", bg: "bg-primary/10" },
            { label: t("dashboard.refunds"), value: sales.filter(s => s.refunded).length, icon: AlertTriangle, color: "text-rose-500", bg: "bg-rose-500/10" }
          ].map((stat, i) => (
            <Card key={i} className="border-none shadow-sm rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", stat.bg)}>
                    <stat.icon className={cn("h-6 w-6", stat.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest truncate">{stat.label}</p>
                    <p className="text-xl font-bold mt-0.5">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sales Table */}
          <div className="lg:col-span-2">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between px-6 py-5 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-semibold">{t("dashboard.recentCommissions")}</CardTitle>
                </div>
                <Badge variant="secondary" className="px-3 py-1 font-medium">
                  {sales.length} transactions
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                {showLoadError ? (
                  <div className="p-8">
                    <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                      <AlertTriangle className="h-5 w-5" />
                      <AlertTitle className="font-bold">Database Error</AlertTitle>
                      <AlertDescription className="mt-2 flex flex-col gap-4">
                        <p className="text-sm opacity-90">{loadErrorMessage}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-fit border-destructive/30 hover:bg-destructive/10"
                          onClick={() => { refetchSales(); refetchProfiles(); }}
                        >
                          Retry Connection
                        </Button>
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : isLoading ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                  </div>
                ) : sales.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="h-16 w-16 bg-muted/40 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileSpreadsheet className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <p className="text-base font-medium text-muted-foreground/60">{t("admin.noData")}</p>
                    <p className="text-sm text-muted-foreground/40 mt-1">Sync with JotForm to see recent sales</p>
                  </div>
                ) : (
                  <SalesTable
                    sales={sales}
                    onEdit={(sale) => { setEditing(sale); setCommOverride(sale.closerCommission.toString()); }}
                    onDelete={(id) => setDeleteId(id)}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: Data Quality & Bonus Tiers */}
          <div className="space-y-8">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between px-6 py-5 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <CardTitle className="text-base font-semibold">Data Quality</CardTitle>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={exportDiscrepancies} disabled={discrepancies.length === 0}>
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {discrepancies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 opacity-60">
                    <div className="h-10 w-10 bg-emerald-500/10 rounded-full flex items-center justify-center mb-3">
                      <Shield className="h-5 w-5 text-emerald-500" />
                    </div>
                    <p className="text-sm font-medium">Data is healthy</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(discrepancyCounts).map(([cat, count]) => (
                        <div key={cat} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 border border-border/40">
                          <span className="text-[10px] uppercase font-bold tracking-tight text-muted-foreground">{cat.replace('_', ' ')}</span>
                          <span className="text-sm font-bold">{count}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                      {discrepancies.slice(0, 15).map((item, idx) => (
                        <div key={idx} className={cn(
                          "p-3 rounded-xl border border-border/40",
                          item.severity === "error" ? "bg-rose-500/5" :
                          item.severity === "warning" ? "bg-amber-500/5" :
                          "bg-blue-500/5"
                        )}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-sm font-bold leading-none truncate">{item.client}</p>
                            <Badge variant="outline" className={cn(
                              "text-[9px] h-4 leading-none uppercase border-none px-1.5 shrink-0",
                              item.severity === "error" ? "bg-rose-500/20 text-rose-600" :
                              item.severity === "warning" ? "bg-amber-500/20 text-amber-600" :
                              "bg-blue-500/20 text-blue-600"
                            )}>
                              {item.severity}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{item.issue}</p>
                        </div>
                      ))}
                    </div>
                    {discrepancies.length > 15 && (
                      <p className="text-center text-[10px] text-muted-foreground italic py-1">
                        + {discrepancies.length - 15} more — export to see all
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <BonusTiersCard />
          </div>
        </div>
      </div>

      {/* Dialogs and Overlays */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) { setEditing(null); setCommOverride(""); } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-6 bg-gradient-to-br from-primary/10 via-background to-background">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-2xl font-bold">{t("admin.editCommission")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pb-2">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/60 border border-border/40">
                <div className="h-10 w-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary font-bold">
                  {editing?.clientName[0]}
                </div>
                <div>
                  <p className="font-bold">{editing?.clientName}</p>
                  <p className="text-sm text-primary font-semibold">{editing ? fmt(editing.amount) : ""}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase ml-1">{t("admin.commLabel")}</Label>
                <div className="relative">
                  <Input 
                    type="number" 
                    value={commOverride} 
                    onChange={(e) => setCommOverride(e.target.value)} 
                    step="0.01"
                    className="h-12 pl-10 text-lg font-medium rounded-xl border-2 focus-visible:ring-primary/20" 
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">€</div>
                </div>
              </div>
              <Button onClick={handleSaveOverride} className="w-full h-12 rounded-xl text-md font-bold shadow-lg shadow-primary/20" disabled={updateCommission.isPending}>
                {updateCommission.isPending ? <RefreshCw className="animate-spin mr-2" /> : null}
                {updateCommission.isPending ? t("common.loading") : t("admin.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
          <div className="p-8">
            <AlertDialogHeader className="items-center text-center space-y-4">
              <div className="h-16 w-16 bg-rose-500/10 rounded-full flex items-center justify-center">
                <Trash2 className="h-8 w-8 text-rose-500" />
              </div>
              <div>
                <AlertDialogTitle className="text-2xl font-bold">{t("common.confirm")}</AlertDialogTitle>
                <AlertDialogDescription className="text-md mt-2">
                  {t("admin.confirmDelete")}
                  <br />
                  <span className="text-rose-500 font-semibold italic text-sm">This action cannot be undone.</span>
                </AlertDialogDescription>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-3 mt-8">
              <AlertDialogCancel className="w-full h-12 rounded-xl border-none bg-muted/50 hover:bg-muted font-bold">{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="w-full h-12 rounded-xl bg-rose-500 hover:bg-rose-600 font-bold shadow-lg shadow-rose-500/20" disabled={deleteSale.isPending}>
                {deleteSale.isPending ? <RefreshCw className="animate-spin mr-2" /> : null}
                {deleteSale.isPending ? t("common.loading") : t("admin.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default AdminPage;
