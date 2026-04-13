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
  clientName: "",
  clientEmail: "",
  product: "",
  closerId: "",
  setterId: null,
  amountTTC: 0,
  taxAmount: 0,
  paymentPlatform: "",
  paymentType: "pif",
  notes: "",
});

type Props = {
  closers: User[];
  setters: User[];
  products: string[];
};

const AddSaleDialog = ({ closers, setters, products }: Props) => {
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
    // setter is optional
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
        <Button onClick={() => setForm(emptyForm())} className="gap-3 rounded-2xl bg-primary shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all font-black uppercase tracking-widest text-xs py-6 px-6">
          <Plus className="h-4 w-4" />{t("admin.addSale")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl p-0 overflow-hidden border-none shadow-premium rounded-[2.5rem] bg-background">
        <DialogHeader className="p-8 pb-4 border-b border-border/40">
           <div>
             <DialogTitle className="text-2xl font-black tracking-tight">{t("admin.addSaleTitle")}</DialogTitle>
             <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mt-1">New transaction record</p>
           </div>
        </DialogHeader>

        <div className="p-8 pt-6 max-h-[75vh] overflow-y-auto custom-scrollbar space-y-8">
          <div className="space-y-6">
            {/* Client Section */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/60">Client Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{t("admin.clientName")}</Label>
                  <Input 
                    value={form.clientName} 
                    onChange={e => set("clientName", e.target.value)} 
                    placeholder="Jean Dupont"
                    className="rounded-xl bg-muted/20 border-transparent focus:border-primary/20 transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{t("admin.clientEmail")}</Label>
                  <Input 
                    type="email" 
                    value={form.clientEmail} 
                    onChange={e => set("clientEmail", e.target.value)} 
                    placeholder="jean@mail.com"
                    className="rounded-xl bg-muted/20 border-transparent focus:border-primary/20 transition-all font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Logistics Section */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/60">Execution Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{t("table.date")}</Label>
                  <Input 
                    type="date" 
                    value={form.date} 
                    onChange={e => set("date", e.target.value)}
                    className="rounded-xl bg-muted/20 border-transparent focus:border-primary/20 transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{t("table.product")}</Label>
                  <Select value={form.product} onValueChange={v => set("product", v)}>
                    <SelectTrigger className="rounded-xl bg-muted/20 border-transparent focus:border-primary/20 transition-all font-bold italic">
                      <SelectValue placeholder={t("admin.selectProduct")} />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-premium">
                      {products.map(p => <SelectItem key={p} value={p} className="font-bold">{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{t("table.closer")}</Label>
                  <Select value={form.closerId} onValueChange={v => set("closerId", v)}>
                    <SelectTrigger className="rounded-xl bg-muted/20 border-transparent focus:border-primary/20 transition-all font-bold">
                      <SelectValue placeholder={t("admin.selectCloser")} />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-premium">
                      {closers.map(c => <SelectItem key={c.id} value={c.id} className="font-bold">{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{t("table.setter")} <span className="opacity-40 italic font-medium">(optional)</span></Label>
                  <Select value={form.setterId ?? "__none__"} onValueChange={v => set("setterId", v === "__none__" ? "" : v)}>
                    <SelectTrigger className="rounded-xl bg-muted/20 border-transparent focus:border-primary/20 transition-all font-bold">
                      <SelectValue placeholder={t("admin.selectSetter")} />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-premium">
                      <SelectItem value="__none__" className="font-bold">— No setter —</SelectItem>
                      {setters.map(s => <SelectItem key={s.id} value={s.id} className="font-bold">{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Financial Section */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/60">Financial Data</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{t("admin.amountTTC")} (€)</Label>
                  <Input 
                    type="number" 
                    min={0} 
                    step="0.01" 
                    value={form.amountTTC || ""} 
                    onChange={e => set("amountTTC", parseFloat(e.target.value) || 0)}
                    className="rounded-xl bg-muted/20 border-transparent focus:border-primary/20 transition-all font-black text-lg h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{t("admin.taxAmount")} (€)</Label>
                  <Input 
                    type="number" 
                    min={0} 
                    step="0.01" 
                    value={form.taxAmount || ""} 
                    onChange={e => set("taxAmount", parseFloat(e.target.value) || 0)}
                    className="rounded-xl bg-muted/20 border-transparent focus:border-primary/20 transition-all font-bold"
                  />
                </div>
              </div>

              {form.amountTTC > 0 && (
                <div className="rounded-3xl bg-primary/5 border border-primary/10 p-6 space-y-3 shadow-inner">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="font-black text-primary text-[10px] uppercase tracking-[0.2em] leading-none">{t("admin.commPreview")}</p>
                  </div>
                  <div className="flex justify-between items-center bg-muted/40 rounded-lg p-2"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Net HT</span><span className="font-black tabular-nums">{fmt(amountHT)}</span></div>
                  <div className="flex justify-between items-center border-b border-primary/10 pb-2"><span className="text-xs font-bold text-muted-foreground">{t("table.closerComm")}</span><span className="font-black text-primary tabular-nums text-lg">{fmt(previewCloserComm)}</span></div>
                  <div className="flex justify-between items-center pt-1"><span className="text-xs font-bold text-muted-foreground">{t("table.setterComm")}</span><span className="font-black text-emerald-600 tabular-nums text-lg">{fmt(previewSetterComm)}</span></div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{t("admin.paymentPlatform")}</Label>
                <Select value={form.paymentPlatform} onValueChange={v => set("paymentPlatform", v)}>
                  <SelectTrigger className="rounded-xl bg-muted/20 border-transparent focus:border-primary/20 transition-all font-bold">
                    <SelectValue placeholder={t("admin.selectPlatform")} />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-premium">
                    {PLATFORMS.map(p => <SelectItem key={p} value={p} className="font-bold">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{t("admin.paymentType")}</Label>
                <Select value={form.paymentType} onValueChange={v => set("paymentType", v as "pif" | "installments")}>
                  <SelectTrigger className="rounded-xl bg-muted/20 border-transparent focus:border-primary/20 transition-all font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-premium">
                    <SelectItem value="pif" className="font-bold text-primary">PIF (Full Payment)</SelectItem>
                    <SelectItem value="installments" className="font-bold text-amber-600">{t("admin.installments")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{t("admin.notes")}</Label>
              <Textarea 
                value={form.notes} 
                onChange={e => set("notes", e.target.value)} 
                rows={3} 
                placeholder={t("admin.notesPlaceholder")}
                className="rounded-2xl bg-muted/20 border-transparent focus:border-primary/20 transition-all font-medium py-4 px-4"
              />
            </div>

            <div className="pt-4 pb-2">
              <Button onClick={handleAdd} className="w-full h-14 rounded-2xl shadow-xl shadow-primary/30 font-black uppercase tracking-[0.2em] text-sm" disabled={addSale.isPending}>
                {addSale.isPending ? t("common.loading") : t("admin.addSaleConfirm")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddSaleDialog;
