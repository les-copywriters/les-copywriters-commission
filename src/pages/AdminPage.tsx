import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import AppLayout from "@/components/AppLayout";
import SalesTable from "@/components/admin/SalesTable";
import BonusTiersCard from "@/components/admin/BonusTiersCard";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Sale } from "@/types";
import { Download, Shield, FileSpreadsheet, RefreshCw, Trash2, AlertTriangle, BellRing, Wallet, TrendingUp, TrendingDown, Layers, ShoppingCart } from "lucide-react";

import { toast } from "sonner";
import { useSales, useUpdateCommission, useDeleteSale } from "@/hooks/useSales";
import { useProfiles } from "@/hooks/useProfiles";
import { Badge } from "@/components/ui/badge";
import { useSyncJotform } from "@/hooks/useSyncJotform";
import { useCommissionHealthReport } from "@/hooks/useCommissionHealthReport";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
          <div>
            <h1 className="text-2xl font-black tracking-tight">{t("admin.title")}</h1>
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest text-[10px] mt-1">{t("admin.commissionsManagement")}</p>
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
                className="gap-2 h-10 px-4 rounded-xl font-bold border-border/60 hover:bg-primary/5 transition-all active:scale-95"
              >
                <RefreshCw className={cn("h-4 w-4", sync.isPending && "animate-spin")} />
                {sync.isPending ? t("sync.syncing") : t("sync.button")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={healthReport.isPending}
                className="gap-2 h-10 px-4 rounded-xl font-bold border-border/60 hover:bg-primary/5 transition-all active:scale-95"
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
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={sales.length === 0} className="gap-2 h-10 px-4 rounded-xl font-bold border-border/60 hover:bg-primary/5 transition-all active:scale-95">
              <Download className="h-4 w-4" />{t("admin.exportCSV")}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title={t("detail.totalSales")} value={String(sales.length)} accent="blue" icon={<ShoppingCart className="h-5 w-5" />} />
          <StatCard title={t("status.paid")} value={String(paidSales.length)} accent="green" icon={<Shield className="h-5 w-5" />} />
          <StatCard title={t("dashboard.totalCommissions")} value={fmt(totalComm)} accent="blue" icon={<Wallet className="h-5 w-5" />} trend="up" />
          <StatCard title={t("dashboard.refunds")} value={String(sales.filter(s => s.refunded).length)} accent="red" icon={<AlertTriangle className="h-5 w-5" />} trend="down" />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sales Table */}
          <div className="lg:col-span-2">
            <Card className="border-none shadow-premium rounded-[2.5rem] bg-background overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between p-8 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary"><FileSpreadsheet className="h-4 w-4" /></div>
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">{t("dashboard.recentCommissions")}</CardTitle>
                </div>
                <Badge className="px-4 py-1.5 rounded-full bg-primary/5 text-primary border-primary/20 font-black text-[10px] uppercase tracking-widest">
                  {sales.length} Transactions
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                {showLoadError ? (
                  <div className="p-10">
                    <Alert variant="destructive" className="rounded-[2rem] border-none shadow-lg bg-rose-500/10 p-6">
                      <AlertTriangle className="h-5 w-5 text-rose-500" />
                      <AlertTitle className="font-black uppercase tracking-widest text-rose-500">Database Error</AlertTitle>
                      <AlertDescription className="mt-4 flex flex-col gap-6">
                        <p className="text-sm font-medium opacity-90">{loadErrorMessage}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-fit rounded-xl border-rose-500/20 text-rose-500 font-bold hover:bg-rose-500/10"
                          onClick={() => { refetchSales(); refetchProfiles(); }}
                        >
                          Retry Connection
                        </Button>
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : isLoading ? (
                  <div className="p-8 space-y-4">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}
                  </div>
                ) : sales.length === 0 ? (
                  <div className="text-center py-32 grayscale opacity-40">
                    <div className="h-20 w-20 bg-muted/40 rounded-full flex items-center justify-center mx-auto mb-6">
                      <FileSpreadsheet className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                    <p className="text-lg font-black tracking-tight">{t("admin.noData")}</p>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Sync with JotForm to see recent sales</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <SalesTable
                      sales={sales}
                      onEdit={(sale) => { setEditing(sale); setCommOverride(sale.closerCommission.toString()); }}
                      onDelete={(id) => setDeleteId(id)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: Data Quality & Bonus Tiers */}
          <div className="space-y-8">
            <Card className="border-none shadow-premium rounded-[2.5rem] bg-background overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between p-8 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500"><AlertTriangle className="h-4 w-4" /></div>
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Data Quality</CardTitle>
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted" onClick={exportDiscrepancies} disabled={discrepancies.length === 0}>
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                {discrepancies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 grayscale opacity-40 text-center">
                    <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                      <Shield className="h-8 w-8 text-emerald-500" />
                    </div>
                    <p className="text-sm font-black uppercase tracking-widest">Data is healthy</p>
                    <p className="text-xs text-muted-foreground mt-1">No mapping issues found.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(discrepancyCounts).map(([cat, count]) => (
                        <div key={cat} className="flex flex-col gap-1 px-4 py-3 rounded-2xl bg-muted/30 border border-border/40">
                          <span className="text-[9px] uppercase font-black tracking-widest text-muted-foreground/60">{cat.replace('_', ' ')}</span>
                          <span className="text-lg font-black">{count}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
                      {discrepancies.slice(0, 15).map((item, idx) => (
                        <div key={idx} className={cn(
                          "p-4 rounded-[1.25rem] border border-border/40 transition-all hover:bg-muted/10",
                          item.severity === "error" ? "bg-rose-500/5" :
                          item.severity === "warning" ? "bg-amber-500/5" :
                          "bg-blue-500/5"
                        )}>
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <p className="text-sm font-black leading-none truncate">{item.client}</p>
                            <Badge variant="outline" className={cn(
                              "text-[8px] h-4 leading-none uppercase font-black border-none px-1.5 shrink-0 rounded-full",
                              item.severity === "error" ? "bg-rose-500/20 text-rose-600" :
                              item.severity === "warning" ? "bg-amber-500/20 text-amber-600" :
                              "bg-blue-500/20 text-blue-600"
                            )}>
                              {item.severity}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-medium leading-relaxed line-clamp-2">{item.issue}</p>
                        </div>
                      ))}
                    </div>
                    {discrepancies.length > 15 && (
                      <p className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 py-2">
                        + {discrepancies.length - 15} more issues
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
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-[2rem]">
          <div className="p-10 bg-gradient-to-br from-primary/10 via-background to-background">
            <DialogHeader className="mb-8">
              <DialogTitle className="text-2xl font-black tracking-tight">{t("admin.editCommission")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-8">
              <div className="flex items-center gap-5 p-5 rounded-[1.5rem] bg-muted/40 border border-border/40">
                <div className="h-12 w-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary font-black text-lg">
                  {editing?.clientName[0]}
                </div>
                <div>
                  <p className="font-black text-sm tracking-tight">{editing?.clientName}</p>
                  <p className="text-sm text-primary font-black mt-0.5">{editing ? fmt(editing.amount) : ""}</p>
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t("admin.commLabel")}</Label>
                <div className="relative group">
                  <Input 
                    type="number" 
                    value={commOverride} 
                    onChange={(e) => setCommOverride(e.target.value)} 
                    step="0.01"
                    className="h-14 pl-12 text-xl font-black rounded-2xl border-2 focus-visible:ring-primary/20 transition-all bg-muted/20" 
                  />
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground font-black">€</div>
                </div>
              </div>
              <Button onClick={handleSaveOverride} className="w-full h-14 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 mt-4" disabled={updateCommission.isPending}>
                {updateCommission.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                {updateCommission.isPending ? t("common.loading") : t("admin.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
          <div className="p-10">
            <AlertDialogHeader className="items-center text-center space-y-6">
              <div className="h-20 w-20 bg-rose-500/10 rounded-full flex items-center justify-center">
                <Trash2 className="h-10 w-10 text-rose-500" />
              </div>
              <div>
                <AlertDialogTitle className="text-2xl font-black tracking-tight">{t("common.confirm")}</AlertDialogTitle>
                <AlertDialogDescription className="text-base font-medium mt-3 leading-relaxed max-w-xs">
                  {t("admin.confirmDelete")}
                  <br />
                  <span className="text-rose-500 font-black uppercase tracking-widest text-[10px] block mt-4">Permanent Action</span>
                </AlertDialogDescription>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-4 mt-10">
              <AlertDialogCancel className="w-full h-14 rounded-2xl border-none bg-muted/50 hover:bg-muted font-black uppercase tracking-widest text-xs transition-all">{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="w-full h-14 rounded-2xl bg-rose-500 hover:bg-rose-600 font-black uppercase tracking-widest text-xs shadow-xl shadow-rose-500/20 transition-all hover:scale-[1.02] active:scale-95" disabled={deleteSale.isPending}>
                {deleteSale.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
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
