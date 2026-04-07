import { useState } from "react";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import { CLOSER_RATE, SETTER_RATE } from "@/lib/commissionRates";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { NewSaleInput, useAddSale } from "@/hooks/useSales";
import { User } from "@/types";

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

type Props = {
  closers: User[];
  setters: User[];
};

const AddSaleDialog = ({ closers, setters }: Props) => {
  const { t, locale } = useLanguage();
  const addSale = useAddSale();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewSaleInput>(emptyForm());
  const fmt = (n: number) => formatCurrency(n, locale);

  const set = (field: keyof NewSaleInput, value: string | number) =>
    setForm(f => ({ ...f, [field]: value }));

  const amountHT = form.amountTTC - form.taxAmount;
  const previewCloserComm = Math.round(amountHT * CLOSER_RATE * 100) / 100;
  const previewSetterComm = Math.round(amountHT * SETTER_RATE * 100) / 100;

  const handleAdd = () => {
    if (!form.clientName.trim()) { toast.error(t("admin.validation.clientName")); return; }
    if (!form.clientEmail.trim() || !EMAIL_REGEX.test(form.clientEmail.trim())) { toast.error(t("admin.validation.clientEmail")); return; }
    if (!form.product) { toast.error(t("admin.validation.product")); return; }
    if (!form.closerId) { toast.error(t("admin.validation.closer")); return; }
    if (!form.setterId) { toast.error(t("admin.validation.setter")); return; }
    if (form.amountTTC <= 0) { toast.error(t("admin.validation.amount")); return; }
    if (form.taxAmount < 0 || form.taxAmount >= form.amountTTC) { toast.error(t("admin.validation.tax")); return; }
    if (!form.paymentPlatform) { toast.error(t("admin.validation.platform")); return; }

    addSale.mutate(
      { ...form, clientName: form.clientName.trim(), clientEmail: form.clientEmail.trim().toLowerCase() },
      {
        onSuccess: () => {
          toast.success(t("admin.saleAdded"));
          setOpen(false);
          setForm(emptyForm());
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setForm(emptyForm())} className="gap-2">
          <Plus className="h-4 w-4" />{t("admin.addSale")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("admin.addSaleTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Client */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("admin.clientName")}</Label>
              <Input value={form.clientName} onChange={e => set("clientName", e.target.value)} placeholder="Jean Dupont" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("admin.clientEmail")}</Label>
              <Input type="email" value={form.clientEmail} onChange={e => set("clientEmail", e.target.value)} placeholder="jean@mail.com" />
            </div>
          </div>

          {/* Date + Product */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("table.date")}</Label>
              <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("table.product")}</Label>
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
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("table.closer")}</Label>
              <Select value={form.closerId} onValueChange={v => set("closerId", v)}>
                <SelectTrigger><SelectValue placeholder={t("admin.selectCloser")} /></SelectTrigger>
                <SelectContent>
                  {closers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("table.setter")}</Label>
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
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("admin.amountTTC")} (€)</Label>
              <Input type="number" min={0} step="0.01" value={form.amountTTC || ""} onChange={e => set("amountTTC", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("admin.taxAmount")} (€)</Label>
              <Input type="number" min={0} step="0.01" value={form.taxAmount || ""} onChange={e => set("taxAmount", parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          {/* Commission preview */}
          {form.amountTTC > 0 && (
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-sm space-y-2">
              <p className="font-semibold text-primary text-xs uppercase tracking-wider">{t("admin.commPreview")}</p>
              <div className="flex justify-between"><span className="text-muted-foreground">HT</span><span className="font-semibold">{fmt(amountHT)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("table.closerComm")}</span><span className="font-semibold text-primary">{fmt(previewCloserComm)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("table.setterComm")}</span><span className="font-semibold text-primary">{fmt(previewSetterComm)}</span></div>
            </div>
          )}

          {/* Platform + Payment type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("admin.paymentPlatform")}</Label>
              <Select value={form.paymentPlatform} onValueChange={v => set("paymentPlatform", v)}>
                <SelectTrigger><SelectValue placeholder={t("admin.selectPlatform")} /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("admin.paymentType")}</Label>
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
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{t("admin.notes")}</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder={t("admin.notesPlaceholder")} />
          </div>

          <Button onClick={handleAdd} className="w-full" disabled={addSale.isPending}>
            {addSale.isPending ? t("common.loading") : t("admin.addSaleConfirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddSaleDialog;
