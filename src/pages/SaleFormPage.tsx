import { useState } from "react";
import { useLanguage } from "@/i18n";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockUsers } from "@/data/mock";
import { toast } from "sonner";

const SaleFormPage = () => {
  const { t, locale } = useLanguage();
  const closers = mockUsers.filter((u) => u.role === "closer");
  const setters = mockUsers.filter((u) => u.role === "setter");

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    clientName: "",
    clientEmail: "",
    product: "",
    closer: "",
    setter: "",
    amount: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const amount = parseFloat(form.amount) || 0;
  const closerComm = Math.round(amount * 0.088 * 100) / 100;
  const setterComm = Math.round(amount * 0.01 * 100) / 100;

  const fmt = (n: number) => new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: "EUR" }).format(n);
  const update = (key: string, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.clientName.trim()) e.clientName = t("saleForm.validation.clientName");
    if (!form.clientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clientEmail)) e.clientEmail = t("saleForm.validation.clientEmail");
    if (!form.product) e.product = t("saleForm.validation.product");
    if (!form.closer) e.closer = t("saleForm.validation.closer");
    if (!form.setter) e.setter = t("saleForm.validation.setter");
    if (amount <= 0) e.amount = t("saleForm.validation.amount");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    toast.success(t("saleForm.success"), { description: `${form.clientName} — ${fmt(amount)}` });
    setForm({ date: new Date().toISOString().split("T")[0], clientName: "", clientEmail: "", product: "", closer: "", setter: "", amount: "" });
  };

  const fieldError = (key: string) => errors[key] ? <p className="text-sm text-destructive">{errors[key]}</p> : null;

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">{t("saleForm.title")}</h1>

        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">{t("saleForm.info")}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("saleForm.date")}</Label>
                  <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>{t("saleForm.product")}</Label>
                  <Select value={form.product} onValueChange={(v) => update("product", v)}>
                    <SelectTrigger className={errors.product ? "border-destructive" : ""}><SelectValue placeholder={t("saleForm.productPlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Formation Pro">Formation Pro</SelectItem>
                      <SelectItem value="Coaching Premium">Coaching Premium</SelectItem>
                      <SelectItem value="Mastermind">Mastermind</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldError("product")}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("saleForm.clientName")}</Label>
                  <Input className={errors.clientName ? "border-destructive" : ""} value={form.clientName} onChange={(e) => update("clientName", e.target.value)} placeholder={t("saleForm.clientNamePlaceholder")} />
                  {fieldError("clientName")}
                </div>
                <div className="space-y-2">
                  <Label>{t("saleForm.clientEmail")}</Label>
                  <Input className={errors.clientEmail ? "border-destructive" : ""} type="email" value={form.clientEmail} onChange={(e) => update("clientEmail", e.target.value)} placeholder={t("saleForm.clientEmailPlaceholder")} />
                  {fieldError("clientEmail")}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("saleForm.closer")}</Label>
                  <Select value={form.closer} onValueChange={(v) => update("closer", v)}>
                    <SelectTrigger className={errors.closer ? "border-destructive" : ""}><SelectValue placeholder={t("saleForm.closerPlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      {closers.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {fieldError("closer")}
                </div>
                <div className="space-y-2">
                  <Label>{t("saleForm.setter")}</Label>
                  <Select value={form.setter} onValueChange={(v) => update("setter", v)}>
                    <SelectTrigger className={errors.setter ? "border-destructive" : ""}><SelectValue placeholder={t("saleForm.setterPlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      {setters.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {fieldError("setter")}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("saleForm.amount")}</Label>
                <Input className={errors.amount ? "border-destructive" : ""} type="number" value={form.amount} onChange={(e) => update("amount", e.target.value)} placeholder="0.00" min="0" step="0.01" />
                {fieldError("amount")}
              </div>

              {amount > 0 && (
                <div className="rounded-lg bg-muted p-4 space-y-1">
                  <p className="text-sm font-medium">{t("saleForm.calculatedComm")}</p>
                  <p className="text-sm text-muted-foreground">{t("saleForm.closerComm")} : <span className="font-semibold text-foreground">{fmt(closerComm)}</span></p>
                  <p className="text-sm text-muted-foreground">{t("saleForm.setterComm")} : <span className="font-semibold text-foreground">{fmt(setterComm)}</span></p>
                </div>
              )}

              <Button type="submit" className="w-full">{t("saleForm.submit")}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default SaleFormPage;
