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
import { Download, Shield, FileSpreadsheet, RefreshCw } from "lucide-react";
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
      const issues: Array<{ category: string; issue: string }> = [];
      if (!sale.jotformSubmissionId) issues.push({ category: "sync", issue: "Missing JotForm submission ID" });
      if (!sale.clientEmail) issues.push({ category: "required_field", issue: "Missing client email" });
      if (sale.amount <= 0) issues.push({ category: "amount", issue: "Invalid amount" });
      if (!closerIds.has(sale.closerId)) issues.push({ category: "mapping", issue: "Closer profile mismatch" });
      if (sale.setterId && !setterIds.has(sale.setterId)) issues.push({ category: "mapping", issue: "Setter profile mismatch" });
      if (sale.paymentType === "installments" && (!sale.numInstallments || !sale.installmentAmount)) {
        issues.push({ category: "installments", issue: "Installment fields incomplete" });
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
    const headers = ["sale_id", "client", "category", "issue"];
    const rows = discrepancies.map((item) => [item.saleId, item.client, item.category, item.issue]);
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
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t("admin.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("admin.commissionsManagement")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
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
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", sync.isPending && "animate-spin")} />
              {sync.isPending ? t("sync.syncing") : t("sync.button")}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={sales.length === 0} className="gap-2">
              <Download className="h-4 w-4" />{t("admin.exportCSV")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={healthReport.isPending}
              className="gap-2"
              onClick={() =>
                healthReport.mutate(
                  { notifySlack: false },
                  {
                    onSuccess: (report) => {
                      toast.success(`Health report generated (${report.totalDiscrepancies} discrepancies)`);
                    },
                    onError: (error) => toast.error(error.message),
                  }
                )
              }
            >
              <BellRing className={cn("h-4 w-4", healthReport.isPending && "animate-pulse")} />
              {healthReport.isPending ? "Running..." : "Run health report"}
            </Button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-card border border-border/60 p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("detail.totalSales")}</p>
            <p className="text-2xl font-bold mt-1">{sales.length}</p>
          </div>
          <div className="rounded-xl bg-card border border-border/60 p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("status.paid")}</p>
            <p className="text-2xl font-bold mt-1 text-success">{paidSales.length}</p>
          </div>
          <div className="rounded-xl bg-card border border-border/60 p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("dashboard.totalCommissions")}</p>
            <p className="text-2xl font-bold mt-1 text-primary">{fmt(totalComm)}</p>
          </div>
          <div className="rounded-xl bg-card border border-border/60 p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("dashboard.refunds")}</p>
            <p className="text-2xl font-bold mt-1 text-destructive">{sales.filter(s => s.refunded).length}</p>
          </div>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Automation mode enabled</AlertTitle>
          <AlertDescription>
            Sales should be synced from JotForm. Manual admin sale entry is intentionally disabled.
          </AlertDescription>
        </Alert>

        <Card className="border border-border/60 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Data quality checks</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={discrepancies.length === 0 ? "secondary" : "destructive"}>
                {discrepancies.length} issue{discrepancies.length === 1 ? "" : "s"}
              </Badge>
              <Button variant="outline" size="sm" onClick={exportDiscrepancies} disabled={discrepancies.length === 0}>
                Export issues
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {discrepancies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No discrepancies detected in current sales data.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(discrepancyCounts).map(([category, count]) => (
                    <Badge key={category} variant="outline" className="text-xs">
                      {category}: {count}
                    </Badge>
                  ))}
                </div>
                <div className="space-y-2">
                {discrepancies.slice(0, 12).map((item) => (
                  <div key={`${item.saleId}-${item.issue}`} className="rounded-md border border-border/60 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{item.client}</p>
                      <Badge variant="secondary" className="text-[10px] uppercase">{item.category}</Badge>
                    </div>
                    <p className="text-muted-foreground">{item.issue}</p>
                  </div>
                ))}
                {discrepancies.length > 12 && (
                  <p className="text-xs text-muted-foreground">Showing first 12 issues.</p>
                )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales table */}
        <Card className="border border-border/60 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">{t("dashboard.recentCommissions")}</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs font-normal">
              {sales.length} {t("detail.totalSales").toLowerCase()}
            </Badge>
          </CardHeader>
          <CardContent>
            {showLoadError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Unable to load admin data</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>{loadErrorMessage}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      refetchSales();
                      refetchProfiles();
                    }}
                  >
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : sales.length === 0 ? (
              <div className="text-center py-12">
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">{t("admin.noData")}</p>
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

        {/* Bonus Tiers */}
        <BonusTiersCard />
      </div>

      {/* Edit commission dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) { setEditing(null); setCommOverride(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.editCommission")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium">{editing?.clientName}</p>
              <p className="text-muted-foreground">{editing ? fmt(editing.amount) : ""}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("admin.commLabel")}</Label>
              <Input type="number" value={commOverride} onChange={(e) => setCommOverride(e.target.value)} step="0.01" />
            </div>
            <Button onClick={handleSaveOverride} className="w-full" disabled={updateCommission.isPending}>
              {updateCommission.isPending ? t("common.loading") : t("admin.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.confirmDelete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteSale.isPending}>
              {deleteSale.isPending ? t("common.loading") : t("admin.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default AdminPage;
