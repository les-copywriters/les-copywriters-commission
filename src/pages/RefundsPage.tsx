import { useState } from "react";
import { useLanguage } from "@/i18n";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { mockRefunds, mockImpayes, mockSales } from "@/data/mock";
import { Refund } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const RefundsPage = () => {
  const { t, locale } = useLanguage();
  const [refunds, setRefunds] = useState<Refund[]>(mockRefunds);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const fmt = (n: number) => new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: "EUR" }).format(n);
  const getSaleName = (saleId: string) => mockSales.find((s) => s.id === saleId)?.clientName ?? saleId;

  const toggleRefund = (id: string) => {
    setRefunds((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: r.status === "approved" ? "refused" : "approved" } : r)
    );
    toast.success(t("refunds.toggled"));
    setConfirmId(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t("refunds.title")}</h1>

        <Tabs defaultValue="refunds">
          <TabsList>
            <TabsTrigger value="refunds">{t("refunds.tab.refunds")} ({refunds.length})</TabsTrigger>
            <TabsTrigger value="impayes">{t("refunds.tab.impayes")} ({mockImpayes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="refunds" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base">{t("refunds.requestsTitle")}</CardTitle></CardHeader>
              <CardContent>
                {refunds.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">{t("refunds.noRefunds")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("table.client")}</TableHead>
                        <TableHead>{t("table.amount")}</TableHead>
                        <TableHead>{t("table.date")}</TableHead>
                        <TableHead>{t("table.status")}</TableHead>
                        <TableHead>{t("table.approve")}</TableHead>
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
                              {r.status === "approved" ? t("status.approved") : r.status === "refused" ? t("status.refused") : t("status.pending")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Switch checked={r.status === "approved"} onCheckedChange={() => setConfirmId(r.id)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="impayes" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base">{t("refunds.failedTitle")}</CardTitle></CardHeader>
              <CardContent>
                {mockImpayes.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">{t("refunds.noImpayes")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("table.client")}</TableHead>
                        <TableHead>{t("table.amount")}</TableHead>
                        <TableHead>{t("table.date")}</TableHead>
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
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("refunds.confirmToggle")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmId && toggleRefund(confirmId)}>{t("common.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default RefundsPage;
