import { useState } from "react";
import { useLanguage } from "@/i18n";
import { CLOSER_RATE, SETTER_RATE } from "@/lib/commissionRates";
import { formatCurrency } from "@/lib/formatCurrency";
import AppLayout from "@/components/AppLayout";
import SaleStatusBadge from "@/components/SaleStatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sale } from "@/types";
import { Pencil, Trash2, Plus, Download, Gift } from "lucide-react";
import { toast } from "sonner";
import { useSales, useUpdateCommission, useDeleteSale, useAddSale, NewSaleInput } from "@/hooks/useSales";
import { useProfiles } from "@/hooks/useProfiles";
import { useBonusTiers, useAddBonusTier, useDeleteBonusTier } from "@/hooks/useBonusTiers";
import { PIF_BONUS_PER_SALE } from "@/lib/commissionRates";

const PRODUCTS = ["Formation Pro", "Coaching Premium", "Mastermind"];
const PLATFORMS = ["Stripe", "PayPal", "Other"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyForm = (): NewSaleInput => ({
  date: new Date().toISOString().split("T")[0],
  clientName: "",
  clientEmail: "",
  product: "",
  closerId: "",
  setterId: "",
  amountTTC: 0,
  taxAmount: 0,
  paymentPlatform: "",
  paymentType: "pif",
  notes: "",
});

const AdminPage = () => {
  const { t, locale } = useLanguage();
  const { data: sales = [], isLoading } = useSales();
  const { data: profiles = [] } = useProfiles();
  const { data: tiers = [] } = useBonusTiers();
  const updateCommission = useUpdateCommission();
  const deleteSale = useDeleteSale();
  const addSale = useAddSale();
  const addTier = useAddBonusTier();
  const deleteTier = useDeleteBonusTier();

  const closers = profiles.filter(p => p.role === "closer");
  const setters = profiles.filter(p => p.role === "setter");

  const [editing, setEditing] = useState<Sale | null>(null);
  const [commOverride, setCommOverride] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<NewSaleInput>(emptyForm());

  // Bonus tier form
  const [newMinSales, setNewMinSales]       = useState("");
  const [newBonusAmount, setNewBonusAmount] = useState("");

  const fmt = (n: number) => formatCurrency(n, locale);
  const set = (field: keyof NewSaleInput, value: string | number) =>
    setForm(f => ({ ...f, [field]: value }));

  const amountHT = form.amountTTC - form.taxAmount;
  const previewCloserComm = Math.round(amountHT * CLOSER_RATE * 100) / 100;
  const previewSetterComm = Math.round(amountHT * SETTER_RATE * 100) / 100;

  const handleAdd = () => {
    if (!form.clientName.trim()) {
      toast.error(t("admin.validation.clientName")); return;
    }
    if (!form.clientEmail.trim() || !EMAIL_REGEX.test(form.clientEmail.trim())) {
      toast.error(t("admin.validation.clientEmail")); return;
    }
    if (!form.product) {
      toast.error(t("admin.validation.product")); return;
    }
    if (!form.closerId) {
      toast.error(t("admin.validation.closer")); return;
    }
    if (!form.setterId) {
      toast.error(t("admin.validation.setter")); return;
    }
    if (form.amountTTC <= 0) {
      toast.error(t("admin.validation.amount")); return;
    }
    if (form.taxAmount < 0 || form.taxAmount >= form.amountTTC) {
      toast.error(t("admin.validation.tax")); return;
    }
    if (!form.paymentPlatform) {
      toast.error(t("admin.validation.platform")); return;
    }
    addSale.mutate({ ...form, clientName: form.clientName.trim(), clientEmail: form.clientEmail.trim().toLowerCase() }, {
      onSuccess: () => {
        toast.success(t("admin.saleAdded"));
        setAddOpen(false);
        setForm(emptyForm());
      },
      onError: (e) => toast.error(e.message),
    });
  };

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
      s.date,
      s.clientName,
      s.clientEmail ?? "",
      s.product,
      s.closer,
      s.setter,
      s.amount.toFixed(2),
      s.closerCommission.toFixed(2),
      s.setterCommission.toFixed(2),
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-3xl font-bold">{t("admin.title")}</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportCSV} disabled={sales.length === 0}>
              <Download className="h-4 w-4 mr-2" />{t("admin.exportCSV")}
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setForm(emptyForm())}>
                  <Plus className="h-4 w-4 mr-2" />{t("admin.addSale")}
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("admin.addSaleTitle")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">

                {/* Client */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{t("admin.clientName")}</Label>
                    <Input value={form.clientName} onChange={e => set("clientName", e.target.value)} placeholder="Jean Dupont" />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("admin.clientEmail")}</Label>
                    <Input type="email" value={form.clientEmail} onChange={e => set("clientEmail", e.target.value)} placeholder="jean@mail.com" />
                  </div>
                </div>

                {/* Date + Product */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{t("table.date")}</Label>
                    <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("table.product")}</Label>
                    <Select value={form.product} onValueChange={v => set("product", v)}>
                      <SelectTrigger><SelectValue placeholder={t("admin.selectProduct")} /></SelectTrigger>
                      <SelectContent>
                        {PRODUCTS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Closer + Setter */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{t("table.closer")}</Label>
                    <Select value={form.closerId} onValueChange={v => set("closerId", v)}>
                      <SelectTrigger><SelectValue placeholder={t("admin.selectCloser")} /></SelectTrigger>
                      <SelectContent>
                        {closers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{t("table.setter")}</Label>
                    <Select value={form.setterId} onValueChange={v => set("setterId", v)}>
                      <SelectTrigger><SelectValue placeholder={t("admin.selectSetter")} /></SelectTrigger>
                      <SelectContent>
                        {setters.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Amount */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{t("admin.amountTTC")} (€)</Label>
                    <Input type="number" min={0} step="0.01" value={form.amountTTC || ""} onChange={e => set("amountTTC", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("admin.taxAmount")} (€)</Label>
                    <Input type="number" min={0} step="0.01" value={form.taxAmount || ""} onChange={e => set("taxAmount", parseFloat(e.target.value) || 0)} />
                  </div>
                </div>

                {/* Commission preview */}
                {form.amountTTC > 0 && (
                  <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                    <p className="font-medium">{t("admin.commPreview")}</p>
                    <p className="text-muted-foreground">HT: <span className="font-medium text-foreground">{fmt(amountHT)}</span></p>
                    <p className="text-muted-foreground">{t("table.closerComm")}: <span className="font-medium text-foreground">{fmt(previewCloserComm)}</span></p>
                    <p className="text-muted-foreground">{t("table.setterComm")}: <span className="font-medium text-foreground">{fmt(previewSetterComm)}</span></p>
                  </div>
                )}

                {/* Platform + Payment type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{t("admin.paymentPlatform")}</Label>
                    <Select value={form.paymentPlatform} onValueChange={v => set("paymentPlatform", v)}>
                      <SelectTrigger><SelectValue placeholder={t("admin.selectPlatform")} /></SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{t("admin.paymentType")}</Label>
                    <Select value={form.paymentType} onValueChange={v => set("paymentType", v as "pif" | "installments")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pif">PIF</SelectItem>
                        <SelectItem value="installments">{t("admin.installments")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <Label>{t("admin.notes")}</Label>
                  <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder={t("admin.notesPlaceholder")} />
                </div>

                <Button onClick={handleAdd} className="w-full" disabled={addSale.isPending}>
                  {addSale.isPending ? t("common.loading") : t("admin.addSaleConfirm")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">{t("admin.commissionsManagement")}</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : sales.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{t("admin.noData")}</p>
            ) : (
              <div className="overflow-x-auto">
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
                        <SaleStatusBadge refunded={sale.refunded} impaye={sale.impaye} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(sale); setCommOverride(sale.closerCommission.toString()); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(sale.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Bonus Tiers ──────────────────────────────────────────────── */}
        <Card className="border border-border/60 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">{t("bonus.tiers")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">{t("bonus.tierNote")} {t("bonus.pifNote")}</p>

            {/* Static PIF bonus row */}
            <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm">
              <span className="font-medium">PIF Bonus</span>
              <span className="text-primary font-bold">+€{PIF_BONUS_PER_SALE} {t("bonus.perSale")}</span>
            </div>

            {/* Volume tiers */}
            {tiers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">{t("bonus.noTiers")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("bonus.minSales")}</TableHead>
                    <TableHead className="text-right">{t("bonus.bonusAmount")}</TableHead>
                    <TableHead className="text-right">{t("table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.map(tier => (
                    <TableRow key={tier.id}>
                      <TableCell className="font-medium">≥ {tier.minSales} {t("detail.totalSales").toLowerCase()}</TableCell>
                      <TableCell className="text-right font-bold text-success">+{fmt(tier.bonusAmount)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => deleteTier.mutate(tier.id, {
                            onSuccess: () => toast.success(t("bonus.tierDeleted")),
                            onError: e => toast.error(e.message),
                          })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Add new tier */}
            <div className="flex gap-2 pt-2">
              <Input
                type="number" min={1} placeholder={t("bonus.minSales")}
                value={newMinSales} onChange={e => setNewMinSales(e.target.value)}
                className="h-9"
              />
              <Input
                type="number" min={1} placeholder={t("bonus.bonusAmount")}
                value={newBonusAmount} onChange={e => setNewBonusAmount(e.target.value)}
                className="h-9"
              />
              <Button
                size="sm"
                disabled={!newMinSales || !newBonusAmount || addTier.isPending}
                onClick={() => {
                  addTier.mutate(
                    { minSales: parseInt(newMinSales), bonusAmount: parseFloat(newBonusAmount) },
                    {
                      onSuccess: () => { toast.success(t("bonus.tierAdded")); setNewMinSales(""); setNewBonusAmount(""); },
                      onError: e => toast.error(e.message),
                    }
                  );
                }}
              >
                <Plus className="h-4 w-4 mr-1" />{t("bonus.addTier")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Single controlled edit dialog — lives outside the table to prevent race conditions */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) { setEditing(null); setCommOverride(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.editCommission")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">{editing?.clientName} — {editing ? fmt(editing.amount) : ""}</p>
            <div className="space-y-2">
              <Label>{t("admin.commLabel")}</Label>
              <Input type="number" value={commOverride} onChange={(e) => setCommOverride(e.target.value)} step="0.01" />
            </div>
            <Button onClick={handleSaveOverride} className="w-full" disabled={updateCommission.isPending}>
              {updateCommission.isPending ? t("common.loading") : t("admin.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
