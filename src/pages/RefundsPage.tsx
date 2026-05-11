import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useRefunds, useUpdateRefundStatus } from "@/hooks/useRefunds";
import { useImpayes } from "@/hooks/useImpayes";
import { useSales } from "@/hooks/useSales";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2, Undo2, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const monthlyRefundCount = refunds.filter((refund) => refund.date.startsWith(monthKey)).length;
  const weeklyImpayesCount = impayes.filter((impaye) => {
    const impayeDate = new Date(impaye.date);
    return !Number.isNaN(impayeDate.getTime()) && impayeDate >= weekStart;
  }).length;

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
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Manage service refunds and payment exceptions</p>
          <h1 className="text-xl font-semibold">{t("refunds.title")}</h1>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border/40 bg-background p-4">
            <p className="text-[11px] text-muted-foreground mb-1.5">Refunds this month</p>
            <p className="text-2xl font-semibold text-destructive tabular-nums">{monthlyRefundCount}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-background p-4">
            <p className="text-[11px] text-muted-foreground mb-1.5">Failed payments this week</p>
            <p className="text-2xl font-semibold text-amber-600 tabular-nums">{weeklyImpayesCount}</p>
          </div>
        </div>

        <Tabs defaultValue="refunds" className="space-y-4">
          <TabsList className="bg-muted/30 border border-border/40 p-0.5 rounded-lg h-9 w-full sm:w-auto">
            <TabsTrigger value="refunds" className="rounded-md px-4 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              {t("refunds.tab.refunds")}
              <Badge variant="outline" className="ml-2 rounded-md border-destructive/20 bg-destructive/5 text-destructive text-[10px] h-4 px-1.5">{refunds.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="impayes" className="rounded-md px-4 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              {t("refunds.tab.impayes")}
              <Badge variant="outline" className="ml-2 rounded-md border-amber-500/20 bg-amber-500/5 text-amber-600 text-[10px] h-4 px-1.5">{impayes.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="refunds" className="mt-0 focus-visible:outline-none">
            <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
              {refundsLoadFailed || salesLoadFailed ? (
                <div className="p-6">
                  <Alert variant="destructive" className="rounded-lg border-destructive/20 bg-destructive/5">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="font-medium">Unable to load refunds</AlertTitle>
                    <AlertDescription className="mt-2 flex flex-col gap-3">
                      <p className="text-sm">{refundsLoadFailed ? refundsErrorMessage : salesErrorMessage}</p>
                      <Button size="sm" variant="outline" className="w-fit rounded-lg text-xs" onClick={() => { refetchRefunds(); refetchSales(); }}>Retry</Button>
                    </AlertDescription>
                  </Alert>
                </div>
              ) : loadingRefunds ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                </div>
              ) : refunds.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-sm text-muted-foreground">{t("refunds.noRefunds")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="border-none hover:bg-muted/30">
                        <TableHead className="py-2.5 pl-4 text-[11px] font-medium text-muted-foreground">{t("table.client")}</TableHead>
                        <TableHead className="py-2.5 text-[11px] font-medium text-muted-foreground">{t("table.amount")}</TableHead>
                        <TableHead className="py-2.5 text-[11px] font-medium text-muted-foreground">{t("table.date")}</TableHead>
                        <TableHead className="py-2.5 text-[11px] font-medium text-muted-foreground">{t("table.status")}</TableHead>
                        <TableHead className="py-2.5 pr-4 text-right text-[11px] font-medium text-muted-foreground">{t("table.approve")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {refunds.map((r) => (
                        <TableRow key={r.id} className="hover:bg-muted/20 border-border/20">
                          <TableCell className="py-3 pl-4 font-medium text-sm">{getSaleName(r.saleId)}</TableCell>
                          <TableCell className="py-3 font-semibold text-primary tabular-nums text-sm">{fmt(r.amount)}</TableCell>
                          <TableCell className="py-3 text-muted-foreground tabular-nums text-xs">{r.date}</TableCell>
                          <TableCell className="py-3">
                            <Badge variant="outline" className={cn(
                              "rounded-md text-[10px] font-medium",
                              r.status === "approved" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                              r.status === "refused" ? "bg-destructive/10 text-destructive border-destructive/20" :
                              "bg-muted text-muted-foreground border-border/40"
                            )}>
                              {r.status === "approved" ? t("status.approved") : r.status === "refused" ? t("status.refused") : t("status.pending")}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 pr-4 text-right">
                            <Switch
                              checked={r.status === "approved"}
                              onCheckedChange={() => setConfirmId(r.id)}
                              className="data-[state=checked]:bg-emerald-500"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="impayes" className="mt-0 focus-visible:outline-none">
            <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
              {impayesLoadFailed || salesLoadFailed ? (
                <div className="p-6">
                   <Alert variant="destructive" className="rounded-lg border-destructive/20 bg-destructive/5">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="font-medium">Unable to load failed payments</AlertTitle>
                      <AlertDescription className="mt-2 flex flex-col gap-3">
                        <p className="text-sm">{impayesLoadFailed ? impayesErrorMessage : salesErrorMessage}</p>
                        <Button size="sm" variant="outline" className="w-fit rounded-lg text-xs" onClick={() => { refetchImpayes(); refetchSales(); }}>Retry</Button>
                      </AlertDescription>
                    </Alert>
                </div>
              ) : loadingImpayes ? (
                 <div className="p-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                </div>
              ) : impayes.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-sm text-muted-foreground">{t("refunds.noImpayes")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="border-none hover:bg-muted/30">
                        <TableHead className="py-2.5 pl-4 text-[11px] font-medium text-muted-foreground">{t("table.client")}</TableHead>
                        <TableHead className="py-2.5 text-[11px] font-medium text-muted-foreground">{t("table.amount")}</TableHead>
                        <TableHead className="py-2.5 pr-4 text-[11px] font-medium text-muted-foreground">{t("table.date")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {impayes.map((imp) => (
                        <TableRow key={imp.id} className="hover:bg-muted/20 border-border/20">
                          <TableCell className="py-3 pl-4 font-medium text-sm">{getSaleName(imp.saleId)}</TableCell>
                          <TableCell className="py-3 font-semibold text-amber-600 tabular-nums text-sm">{fmt(imp.amount)}</TableCell>
                          <TableCell className="py-3 pr-4 text-muted-foreground tabular-nums text-xs">{imp.date}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
        <AlertDialogContent className="rounded-xl border border-border/40 bg-background p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">{t("common.confirm")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground mt-1">
              {t("refunds.confirmToggle")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-4">
            <AlertDialogCancel className="rounded-lg h-9 border-border/60 text-sm">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmId && handleToggle(confirmId)}
              className="rounded-lg h-9 text-sm"
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default RefundsPage;
