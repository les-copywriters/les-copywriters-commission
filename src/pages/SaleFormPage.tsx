import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockUsers } from "@/data/mock";
import { useToast } from "@/hooks/use-toast";

/** Sale creation form — auto-calculates commissions. Replace submit with API call later. */
const SaleFormPage = () => {
  const { toast } = useToast();
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

  const amount = parseFloat(form.amount) || 0;
  const closerComm = Math.round(amount * 0.088 * 100) / 100;
  const setterComm = Math.round(amount * 0.01 * 100) / 100;

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  const update = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Replace with API call to create sale
    toast({ title: "Vente enregistrée", description: `${form.clientName} — ${fmt(amount)}` });
    setForm({ date: new Date().toISOString().split("T")[0], clientName: "", clientEmail: "", product: "", closer: "", setter: "", amount: "" });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">Nouvelle vente</h1>

        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Informations de la vente</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Produit</Label>
                  <Select value={form.product} onValueChange={(v) => update("product", v)}>
                    <SelectTrigger><SelectValue placeholder="Choisir un produit" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Formation Pro">Formation Pro</SelectItem>
                      <SelectItem value="Coaching Premium">Coaching Premium</SelectItem>
                      <SelectItem value="Mastermind">Mastermind</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nom du client</Label>
                  <Input value={form.clientName} onChange={(e) => update("clientName", e.target.value)} placeholder="Jean Dupont" required />
                </div>
                <div className="space-y-2">
                  <Label>Email du client</Label>
                  <Input type="email" value={form.clientEmail} onChange={(e) => update("clientEmail", e.target.value)} placeholder="jean@mail.com" required />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Closer</Label>
                  <Select value={form.closer} onValueChange={(v) => update("closer", v)}>
                    <SelectTrigger><SelectValue placeholder="Choisir un closer" /></SelectTrigger>
                    <SelectContent>
                      {closers.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Setter</Label>
                  <Select value={form.setter} onValueChange={(v) => update("setter", v)}>
                    <SelectTrigger><SelectValue placeholder="Choisir un setter" /></SelectTrigger>
                    <SelectContent>
                      {setters.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Montant (€)</Label>
                <Input type="number" value={form.amount} onChange={(e) => update("amount", e.target.value)} placeholder="0.00" min="0" step="0.01" required />
              </div>

              {/* Auto-calculated commissions */}
              {amount > 0 && (
                <div className="rounded-lg bg-muted p-4 space-y-1">
                  <p className="text-sm font-medium">Commissions calculées</p>
                  <p className="text-sm text-muted-foreground">Closer (8.8%) : <span className="font-semibold text-foreground">{fmt(closerComm)}</span></p>
                  <p className="text-sm text-muted-foreground">Setter (1%) : <span className="font-semibold text-foreground">{fmt(setterComm)}</span></p>
                </div>
              )}

              <Button type="submit" className="w-full">Enregistrer la vente</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default SaleFormPage;
