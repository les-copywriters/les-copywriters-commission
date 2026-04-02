import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { mockRefunds, mockImpayes, mockSales } from "@/data/mock";
import { Refund } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Refunds & Impayés page — toggle status for refund approval */
const RefundsPage = () => {
  const [refunds, setRefunds] = useState<Refund[]>(mockRefunds);
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  const getSaleName = (saleId: string) => mockSales.find((s) => s.id === saleId)?.clientName ?? saleId;

  const toggleRefund = (id: string) => {
    // TODO: Replace with API call
    setRefunds((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: r.status === "approved" ? "refused" : "approved" } : r
      )
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Remboursements & Impayés</h1>

        <Tabs defaultValue="refunds">
          <TabsList>
            <TabsTrigger value="refunds">Remboursements ({refunds.length})</TabsTrigger>
            <TabsTrigger value="impayes">Impayés ({mockImpayes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="refunds" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base">Demandes de remboursement</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Approuver</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refunds.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{getSaleName(r.saleId)}</TableCell>
                        <TableCell>{fmt(r.amount)}</TableCell>
                        <TableCell className="text-muted-foreground">{r.date}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === "approved" ? "default" : r.status === "refused" ? "destructive" : "secondary"}>
                            {r.status === "approved" ? "Approuvé" : r.status === "refused" ? "Refusé" : "En attente"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch checked={r.status === "approved"} onCheckedChange={() => toggleRefund(r.id)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="impayes" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base">Paiements échoués</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockImpayes.map((imp) => (
                      <TableRow key={imp.id}>
                        <TableCell className="font-medium">{getSaleName(imp.saleId)}</TableCell>
                        <TableCell>{fmt(imp.amount)}</TableCell>
                        <TableCell className="text-muted-foreground">{imp.date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default RefundsPage;
