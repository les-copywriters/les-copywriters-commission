import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useRefunds, useUpdateRefundStatus } from "@/hooks/useRefunds";
import { useImpayes } from "@/hooks/useImpayes";
import { useSales } from "@/hooks/useSales";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

const RefundsPage = () => {
  const { t, locale } = useLanguage();
  const {
    data: refunds = [],
    isLoading: loadingRefunds,
    isError: refundsLoadFailed,
    error: refundsError,
    refetch: refetchRefunds,
  } = useRefunds();
  const {
    data: impayes = [],
    isLoading: loadingImpayes,
    isError: impayesLoadFailed,
    error: impayesError,
    refetch: refetchImpayes,
  } = useImpayes();
  const {
    data: sales = [],
    isError: salesLoadFailed,
    error: salesError,
    refetch: refetchSales,
  } = useSales();
  const updateStatus = useUpdateRefundStatus();

  const [confirmId, setConfirmId] = useState<string | null>(null);

  const fmt = (n: number) => formatCurrency(n, locale);
  const saleNameMap = useMemo(() => new Map(sales.map(s => [s.id, s.clientName])), [sales]);
  const getSaleName = (saleId: string) => saleNameMap.get(saleId) ?? saleId;
  const refundsErrorMessage = refundsError instanceof Error ? refundsError.message : "Failed to load refunds.";
  const impayesErrorMessage = impayesError instanceof Error ? impayesError.message : "Failed to load unpaid records.";
  const salesErrorMessage = salesError instanceof Error ? salesError.message : "Failed to load sales.";

  const handleToggle = (id: string) => {
    const refund = refunds.find(r => r.id === id);
    if (!refund) return;
    const newStatus = refund.status === "approved" ? "refused" : "approved";
    updateStatus.mutate({ id, saleId: refund.saleId, status: newStatus }, {
      onSuccess: () => { toast.success(t("refunds.toggled")); setConfirmId(null); },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t("refunds.title")}</h1>

        <Tabs defaultValue="refunds">
          <TabsList>
            <TabsTrigger value="refunds">{t("refunds.tab.refunds")} ({refunds.length})</TabsTrigger>
            <TabsTrigger value="impayes">{t("refunds.tab.impayes")} ({impayes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="refunds" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base">{t("refunds.requestsTitle")}</CardTitle></CardHeader>
              <CardContent>
                {refundsLoadFailed || salesLoadFailed ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Unable to load refunds</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p>{refundsLoadFailed ? refundsErrorMessage : salesErrorMessage}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          refetchRefunds();
                          refetchSales();
                        }}
                      >
                        Retry
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : loadingRefunds ? (
                  <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : refunds.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">{t("refunds.noRefunds")}</p>
                ) : (
                  <div className="overflow-x-auto">
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
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="impayes" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base">{t("refunds.failedTitle")}</CardTitle></CardHeader>
              <CardContent>
                {impayesLoadFailed || salesLoadFailed ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Unable to load failed payments</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p>{impayesLoadFailed ? impayesErrorMessage : salesErrorMessage}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          refetchImpayes();
                          refetchSales();
                        }}
                      >
                        Retry
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : loadingImpayes ? (
                  <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : impayes.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">{t("refunds.noImpayes")}</p>
                ) : (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("table.client")}</TableHead>
                        <TableHead>{t("table.amount")}</TableHead>
                        <TableHead>{t("table.date")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {impayes.map((imp) => (
                        <TableRow key={imp.id}>
                          <TableCell className="font-medium">{getSaleName(imp.saleId)}</TableCell>
                          <TableCell>{fmt(imp.amount)}</TableCell>
                          <TableCell className="text-muted-foreground">{imp.date}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
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
            <AlertDialogAction onClick={() => confirmId && handleToggle(confirmId)} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? t("common.loading") : t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default RefundsPage;
