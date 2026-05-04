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

const PLATFORMS = ["Stripe", "PayPal", "Other"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyForm = (): NewSaleInput => ({
  date: new Date().toISOString().split("T")[0],
  clientName: "", clientEmail: "", product: "",
  closerId: "", setterId: null,
  amountTTC: 0, taxAmount: 0,
  paymentPlatform: "", paymentType: "pif", notes: "",
});

type Props = { closers: User[]; setters: User[]; products: string[] };

const fieldClass = "h-9 rounded-lg border border-border/40 bg-muted/20 text-sm px-3 focus-visible:ring-primary/20";
const selectContentClass = "rounded-lg border border-border/40 shadow-md";

const AddSaleDialog = ({ closers, setters, products }: Props) => {
  const { t, locale } = useLanguage();
  const addSale = useAddSale();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewSaleInput>(emptyForm());
  const fmt = (n: number) => formatCurrency(n, locale);

  const set = (field: keyof NewSaleInput, value: string | number) =>
    setForm(f => ({ ...f, [field]: value }));

  const amountHT        = form.amountTTC - form.taxAmount;
  const previewCloserComm = Math.round(amountHT * CLOSER_RATE * 100) / 100;
  const previewSetterComm = Math.round(amountHT * SETTER_RATE * 100) / 100;

  const handleAdd = () => {
    if (!form.clientName.trim())                                       { toast.error(t("admin.validation.clientName"));   return; }
    if (!form.clientEmail.trim() || !EMAIL_REGEX.test(form.clientEmail.trim())) { toast.error(t("admin.validation.clientEmail")); return; }
    if (!form.product)                                                 { toast.error(t("admin.validation.product"));      return; }
    if (!form.closerId)                                                { toast.error(t("admin.validation.closer"));       return; }
    if (form.amountTTC <= 0)                                           { toast.error(t("admin.validation.amount"));       return; }
    if (form.taxAmount < 0 || form.taxAmount >= form.amountTTC)        { toast.error(t("admin.validation.tax"));         return; }
    if (!form.paymentPlatform)                                         { toast.error(t("admin.validation.platform"));    return; }

    addSale.mutate(
      { ...form, clientName: form.clientName.trim(), clientEmail: form.clientEmail.trim().toLowerCase() },
      {
        onSuccess: () => { toast.success(t("admin.saleAdded")); setOpen(false); setForm(emptyForm()); },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setForm(emptyForm())} className="h-9 rounded-lg text-xs font-medium gap-1.5">
          <Plus className="h-3.5 w-3.5" />{t("admin.addSale")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl p-0 overflow-hidden rounded-xl border border-border/40 bg-background">
        <DialogHeader className="px-4 py-3 border-b border-border/40 bg-muted/30">
          <DialogTitle className="text-base font-semibold">{t("admin.addSaleTitle")}</DialogTitle>
          <p className="text-[11px] text-muted-foreground">New transaction record</p>
        </DialogHeader>

        <div className="p-4 max-h-[75vh] overflow-y-auto space-y-5">

          {/* Client */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Client Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">{t("admin.clientName")}</Label>
                <Input value={form.clientName} onChange={e => set("clientName", e.target.value)} placeholder="Jean Dupont" className={fieldClass} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">{t("admin.clientEmail")}</Label>
                <Input type="email" value={form.clientEmail} onChange={e => set("clientEmail", e.target.value)} placeholder="jean@mail.com" className={fieldClass} />
              </div>
            </div>
          </div>

          {/* Execution */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Execution Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">{t("table.date")}</Label>
                <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} className={fieldClass} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">{t("table.product")}</Label>
                <Select value={form.product} onValueChange={v => set("product", v)}>
                  <SelectTrigger className={fieldClass}><SelectValue placeholder={t("admin.selectProduct")} /></SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">{t("table.closer")}</Label>
                <Select value={form.closerId} onValueChange={v => set("closerId", v)}>
                  <SelectTrigger className={fieldClass}><SelectValue placeholder={t("admin.selectCloser")} /></SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {closers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">{t("table.setter")} <span className="text-muted-foreground/50">(optional)</span></Label>
                <Select value={form.setterId ?? "__none__"} onValueChange={v => set("setterId", v === "__none__" ? "" : v)}>
                  <SelectTrigger className={fieldClass}><SelectValue placeholder={t("admin.selectSetter")} /></SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <SelectItem value="__none__">— No setter —</SelectItem>
                    {setters.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Financials */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Financial Data</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">{t("admin.amountTTC")} (€)</Label>
                <Input type="number" min={0} step="0.01" value={form.amountTTC || ""} onChange={e => set("amountTTC", parseFloat(e.target.value) || 0)} className={fieldClass} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">{t("admin.taxAmount")} (€)</Label>
                <Input type="number" min={0} step="0.01" value={form.taxAmount || ""} onChange={e => set("taxAmount", parseFloat(e.target.value) || 0)} className={fieldClass} />
              </div>
            </div>

            {form.amountTTC > 0 && (
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 space-y-2">
                <p className="text-[11px] text-primary font-medium">{t("admin.commPreview")}</p>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Net HT</span><span className="font-medium tabular-nums">{fmt(amountHT)}</span></div>
                <div className="flex justify-between text-xs border-b border-border/30 pb-2"><span className="text-muted-foreground">{t("table.closerComm")}</span><span className="font-semibold text-primary tabular-nums">{fmt(previewCloserComm)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t("table.setterComm")}</span><span className="font-semibold text-emerald-600 tabular-nums">{fmt(previewSetterComm)}</span></div>
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">{t("admin.paymentPlatform")}</Label>
              <Select value={form.paymentPlatform} onValueChange={v => set("paymentPlatform", v)}>
                <SelectTrigger className={fieldClass}><SelectValue placeholder={t("admin.selectPlatform")} /></SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">{t("admin.paymentType")}</Label>
              <Select value={form.paymentType} onValueChange={v => set("paymentType", v as "pif" | "installments")}>
                <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="pif">PIF (Full Payment)</SelectItem>
                  <SelectItem value="installments">{t("admin.installments")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">{t("admin.notes")}</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3}
              placeholder={t("admin.notesPlaceholder")}
              className="rounded-lg border border-border/40 bg-muted/20 text-sm px-3 py-2 resize-none focus-visible:ring-primary/20" />
          </div>

          <Button onClick={handleAdd} className="w-full h-9 rounded-lg text-sm font-medium" disabled={addSale.isPending}>
            {addSale.isPending ? t("common.loading") : t("admin.addSaleConfirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddSaleDialog;
