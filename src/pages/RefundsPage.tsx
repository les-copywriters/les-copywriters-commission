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
import { AlertTriangle, Undo2, CreditCard } from "lucide-react";
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
      <div className="space-y-10 animate-in fade-in duration-500">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("refunds.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage service refunds and payment exceptions</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Card className="border-none shadow-sm rounded-2xl bg-destructive/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5 text-destructive">
               <Undo2 className="h-20 w-20" />
            </div>
            <CardContent className="p-6">
              <p className="text-xs font-medium text-destructive/60 mb-2">Refunds this month</p>
              <p className="text-3xl font-bold text-destructive tabular-nums">{monthlyRefundCount}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm rounded-2xl bg-amber-500/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5 text-amber-600">
               <CreditCard className="h-20 w-20" />
            </div>
            <CardContent className="p-6">
              <p className="text-xs font-medium text-amber-600/60 mb-2">Failed payments this week</p>
              <p className="text-3xl font-bold text-amber-600 tabular-nums">{weeklyImpayesCount}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="refunds" className="space-y-6">
          <TabsList className="bg-muted/30 border border-border/40 p-1 rounded-xl h-12 w-full sm:w-auto">
            <TabsTrigger value="refunds" className="rounded-lg px-6 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">
              {t("refunds.tab.refunds")}
              <Badge variant="outline" className="ml-2 border-none bg-destructive/10 text-destructive text-[10px] h-4 px-1">{refunds.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="impayes" className="rounded-lg px-6 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">
              {t("refunds.tab.impayes")}
              <Badge variant="outline" className="ml-2 border-none bg-amber-500/10 text-amber-600 text-[10px] h-4 px-1">{impayes.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="refunds" className="mt-0 focus-visible:outline-none">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {refundsLoadFailed || salesLoadFailed ? (
                  <div className="p-8">
                    <Alert variant="destructive" className="rounded-2xl">
                      <AlertTriangle className="h-5 w-5" />
                      <AlertTitle className="font-bold">Unable to load refunds</AlertTitle>
                      <AlertDescription className="mt-2 flex flex-col gap-4">
                        <p>{refundsLoadFailed ? refundsErrorMessage : salesErrorMessage}</p>
                        <Button size="sm" variant="outline" className="w-fit" onClick={() => { refetchRefunds(); refetchSales(); }}>Retry</Button>
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : loadingRefunds ? (
                  <div className="p-6 space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                  </div>
                ) : refunds.length === 0 ? (
                  <div className="text-center py-20 bg-muted/10">
                    <Undo2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium italic">{t("refunds.noRefunds")}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow className="border-none hover:bg-muted/30">
                          <TableHead className="py-4 pl-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.client")}</TableHead>
                          <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.amount")}</TableHead>
                          <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.date")}</TableHead>
                          <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.status")}</TableHead>
                          <TableHead className="py-4 pr-6 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.approve")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {refunds.map((r) => (
                          <TableRow key={r.id} className="group hover:bg-muted/10 transition-colors border-border/30">
                            <TableCell className="py-5 pl-6 font-bold">{getSaleName(r.saleId)}</TableCell>
                            <TableCell className="py-5 font-black text-primary tabular-nums">{fmt(r.amount)}</TableCell>
                            <TableCell className="py-5 text-muted-foreground tabular-nums text-xs font-medium">{r.date}</TableCell>
                            <TableCell className="py-5">
                              <Badge variant="outline" className={cn(
                                "px-3 py-1 border-none shadow-sm uppercase text-[9px] font-black tracking-wider h-5",
                                r.status === "approved" ? "bg-emerald-500 text-white" : 
                                r.status === "refused" ? "bg-destructive text-white" : 
                                "bg-muted text-muted-foreground"
                              )}>
                                {r.status === "approved" ? t("status.approved") : r.status === "refused" ? t("status.refused") : t("status.pending")}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-5 pr-6 text-right">
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="impayes" className="mt-0 focus-visible:outline-none">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {impayesLoadFailed || salesLoadFailed ? (
                  <div className="p-8">
                     <Alert variant="destructive" className="rounded-2xl">
                        <AlertTriangle className="h-5 w-5" />
                        <AlertTitle className="font-bold">Unable to load failed payments</AlertTitle>
                        <AlertDescription className="mt-2 flex flex-col gap-4">
                          <p>{impayesLoadFailed ? impayesErrorMessage : salesErrorMessage}</p>
                          <Button size="sm" variant="outline" className="w-fit" onClick={() => { refetchImpayes(); refetchSales(); }}>Retry</Button>
                        </AlertDescription>
                      </Alert>
                  </div>
                ) : loadingImpayes ? (
                   <div className="p-6 space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                  </div>
                ) : impayes.length === 0 ? (
                  <div className="text-center py-20 bg-muted/10">
                    <CreditCard className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium italic">{t("refunds.noImpayes")}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow className="border-none hover:bg-muted/30">
                          <TableHead className="py-4 pl-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.client")}</TableHead>
                          <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.amount")}</TableHead>
                          <TableHead className="py-4 pr-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.date")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {impayes.map((imp) => (
                          <TableRow key={imp.id} className="group hover:bg-muted/10 transition-colors border-border/30">
                            <TableCell className="py-5 pl-6 font-bold">{getSaleName(imp.saleId)}</TableCell>
                            <TableCell className="py-5 font-black text-amber-600 tabular-nums">{fmt(imp.amount)}</TableCell>
                            <TableCell className="py-5 pr-6 text-muted-foreground tabular-nums text-xs font-medium">{imp.date}</TableCell>
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
        <AlertDialogContent className="border-none shadow-2xl rounded-3xl p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold tracking-tight">{t("common.confirm")}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-medium py-2">
              {t("refunds.confirmToggle")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-4">
            <AlertDialogCancel className="rounded-xl h-11 border-border/60 hover:bg-muted/50 font-bold">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => confirmId && handleToggle(confirmId)} 
              className="rounded-xl h-11 bg-primary text-white font-bold shadow-lg shadow-primary/20"
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? <Skeleton className="h-4 w-12" /> : t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default RefundsPage;
