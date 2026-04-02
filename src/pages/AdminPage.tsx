import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { mockSales } from "@/data/mock";
import { Sale } from "@/types";
import { Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/** Admin page — edit/remove sales, override commissions */
const AdminPage = () => {
  const [sales, setSales] = useState<Sale[]>(mockSales);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [commOverride, setCommOverride] = useState("");
  const { toast } = useToast();

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  const deleteSale = (id: string) => {
    // TODO: Replace with API call
    setSales((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "Vente supprimée" });
  };

  const saveOverride = () => {
    if (!editing) return;
    const override = parseFloat(commOverride);
    if (isNaN(override)) return;
    // TODO: Replace with API call
    setSales((prev) =>
      prev.map((s) => (s.id === editing.id ? { ...s, closerCommission: override } : s))
    );
    toast({ title: "Commission mise à jour", description: `Closer commission → ${fmt(override)}` });
    setEditing(null);
    setCommOverride("");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Administration</h1>

        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Gestion des ventes</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Closer</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Comm. closer</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-muted-foreground">{sale.date}</TableCell>
                    <TableCell className="font-medium">{sale.clientName}</TableCell>
                    <TableCell>{sale.closer}</TableCell>
                    <TableCell className="text-right">{fmt(sale.amount)}</TableCell>
                    <TableCell className="text-right">{fmt(sale.closerCommission)}</TableCell>
                    <TableCell>
                      {sale.refunded ? (
                        <Badge variant="destructive">Remboursé</Badge>
                      ) : sale.impaye ? (
                        <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">Impayé</Badge>
                      ) : (
                        <Badge className="bg-success text-success-foreground hover:bg-success/90">Payé</Badge>
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
                              <DialogTitle>Modifier la commission</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <p className="text-sm text-muted-foreground">Vente : {editing?.clientName} — {editing ? fmt(editing.amount) : ""}</p>
                              <div className="space-y-2">
                                <Label>Commission closer (€)</Label>
                                <Input type="number" value={commOverride} onChange={(e) => setCommOverride(e.target.value)} step="0.01" />
                              </div>
                              <Button onClick={saveOverride} className="w-full">Enregistrer</Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="icon" onClick={() => deleteSale(sale.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminPage;
