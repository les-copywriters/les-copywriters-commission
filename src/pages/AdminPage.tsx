import { useState } from "react";
import { useLanguage } from "@/i18n";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { mockSales } from "@/data/mock";
import { Sale } from "@/types";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

/** Admin page — override commissions, remove entries */
const AdminPage = () => {
  const { t, locale } = useLanguage();
  const [sales, setSales] = useState<Sale[]>(mockSales);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [commOverride, setCommOverride] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fmt = (n: number) => new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: "EUR" }).format(n);

  const deleteSale = () => {
    if (!deleteId) return;
    setSales((prev) => prev.filter((s) => s.id !== deleteId));
    toast.success(t("admin.saleDeleted"));
    setDeleteId(null);
  };

  const saveOverride = () => {
    if (!editing) return;
    const override = parseFloat(commOverride);
    if (isNaN(override)) return;
    setSales((prev) =>
      prev.map((s) => (s.id === editing.id ? { ...s, closerCommission: override } : s))
    );
    toast.success(t("admin.commUpdated"), { description: `Closer commission → ${fmt(override)}` });
    setEditing(null);
    setCommOverride("");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t("admin.title")}</h1>

        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">{t("admin.commissionsManagement")}</CardTitle></CardHeader>
          <CardContent>
            {sales.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{t("admin.noData")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.date")}</TableHead>
                    <TableHead>{t("table.client")}</TableHead>
                    <TableHead>{t("table.closer")}</TableHead>
                    <TableHead className="text-right">{t("table.amount")}</TableHead>
                    <TableHead className="text-right">{t("table.closerComm")}</TableHead>
                    <TableHead className="text-right">{t("table.setterComm")}</TableHead>
                    <TableHead>{t("table.status")}</TableHead>
                    <TableHead className="text-right">{t("table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-muted-foreground">{sale.date}</TableCell>
                      <TableCell className="font-medium">{sale.clientName}</TableCell>
                      <TableCell>{sale.closer}</TableCell>
                      <TableCell className="text-right">{fmt(sale.amount)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(sale.closerCommission)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(sale.setterCommission)}</TableCell>
                      <TableCell>
                        {sale.refunded ? (
                          <Badge variant="destructive">{t("status.refunded")}</Badge>
                        ) : sale.impaye ? (
                          <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">{t("status.unpaid")}</Badge>
                        ) : (
                          <Badge className="bg-success text-success-foreground hover:bg-success/90">{t("status.paid")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => { setEditing(sale); setCommOverride(sale.closerCommission.toString()); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{t("admin.editCommission")}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <p className="text-sm text-muted-foreground">{editing?.clientName} — {editing ? fmt(editing.amount) : ""}</p>
                                <div className="space-y-2">
                                  <Label>{t("admin.commLabel")}</Label>
                                  <Input type="number" value={commOverride} onChange={(e) => setCommOverride(e.target.value)} step="0.01" />
                                </div>
                                <Button onClick={saveOverride} className="w-full">{t("admin.save")}</Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(sale.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.confirmDelete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSale}>{t("admin.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default AdminPage;
