import { useState } from "react";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import AppLayout from "@/components/AppLayout";
import SalesTable from "@/components/admin/SalesTable";
import AddSaleDialog from "@/components/admin/AddSaleDialog";
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
import { cn } from "@/lib/utils";

const AdminPage = () => {
  const { t, locale } = useLanguage();
  const { data: sales = [], isLoading } = useSales();
  const { data: profiles = [] } = useProfiles();
  const updateCommission = useUpdateCommission();
  const deleteSale = useDeleteSale();
  const sync = useSyncJotform();

  const closers = profiles.filter(p => p.role === "closer");
  const setters = profiles.filter(p => p.role === "setter");

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
                    if (res.errors.length > 0) {
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
            <AddSaleDialog closers={closers} setters={setters} />
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
            {isLoading ? (
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
