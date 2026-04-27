import { useMemo, useState } from "react";
import { Sale } from "@/types";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import { BonusTier, formatMonth, calculateMonthBonus } from "@/lib/bonusCalculation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SaleStatusBadge from "@/components/SaleStatusBadge";
import SaleDetailsDialog from "@/components/SaleDetailsDialog";
import { Calendar, Eye, Gift, Layers, ListChecks, Wallet } from "lucide-react";

export type BonusDrilldownKind = "validatedCount" | "pifBonus" | "volumeBonus" | "total";

type Props = {
  month: string | null;
  kind: BonusDrilldownKind | null;
  sales: Sale[];
  tiers: BonusTier[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const kindMeta: Record<BonusDrilldownKind, { label: string; icon: typeof Gift; description: string }> = {
  validatedCount: {
    label: "Validated Sales",
    icon: ListChecks,
    description: "All validated transactions in this cycle.",
  },
  pifBonus: {
    label: "PIF Bonus",
    icon: Gift,
    description: "Only validated PIF transactions contribute to this bonus.",
  },
  volumeBonus: {
    label: "Volume Bonus",
    icon: Layers,
    description: "Validated transactions used to reach the monthly volume tier.",
  },
  total: {
    label: "Total Bonus",
    icon: Wallet,
    description: "Combined view of the validated transactions behind the full monthly reward.",
  },
};

const BonusTransactionsDialog = ({ month, kind, sales, tiers, open, onOpenChange }: Props) => {
  const { locale } = useLanguage();
  const fmt = (n: number) => formatCurrency(n, locale);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const detail = useMemo(() => {
    if (!month || !kind) return null;

    const monthSales = sales
      .filter((sale) => sale.date.slice(0, 7) === month)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const validatedSales = monthSales.filter((sale) => !sale.refunded && !sale.impaye);
    const pifSales = validatedSales.filter((sale) => sale.paymentType === "pif");
    const monthlyBonus = calculateMonthBonus(monthSales, tiers);

    const relevantSales = kind === "pifBonus"
      ? pifSales
      : validatedSales;

    return {
      monthSales,
      validatedSales,
      pifSales,
      relevantSales,
      monthlyBonus,
    };
  }, [kind, month, sales, tiers]);

  const meta = kind ? kindMeta[kind] : null;
  const monthLabel = month ? formatMonth(month, locale) : "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-premium rounded-[2.5rem] bg-background">
          <DialogHeader className="p-8 pb-5 border-b border-border/40">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    {meta && <meta.icon className="h-5 w-5" />}
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-black tracking-tight">
                      {meta?.label ?? "Bonus Detail"}
                    </DialogTitle>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-1">
                      {monthLabel}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {meta?.description}
                </p>
              </div>

              {detail && (
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-full px-3 py-1 bg-primary/5 text-primary border-primary/20 font-black uppercase tracking-widest text-[9px]">
                    <Calendar className="h-3 w-3 mr-1" />
                    {detail.validatedSales.length} validated
                  </Badge>
                  <Badge className="rounded-full px-3 py-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-black uppercase tracking-widest text-[9px]">
                    {detail.pifSales.length} pif
                  </Badge>
                </div>
              )}
            </div>
          </DialogHeader>

          {detail && (
            <div className="p-8 pt-6 space-y-6 max-h-[78vh] overflow-y-auto custom-scrollbar">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-[1.75rem] border border-border/40 bg-muted/10 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Validated Count</p>
                  <p className="mt-2 text-2xl font-black tabular-nums">{detail.monthlyBonus.validatedCount}</p>
                </div>
                <div className="rounded-[1.75rem] border border-border/40 bg-muted/10 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">PIF Bonus</p>
                  <p className="mt-2 text-2xl font-black tabular-nums text-emerald-500">{fmt(detail.monthlyBonus.pifBonus)}</p>
                </div>
                <div className="rounded-[1.75rem] border border-border/40 bg-muted/10 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Volume Bonus</p>
                  <p className="mt-2 text-2xl font-black tabular-nums text-emerald-500">{fmt(detail.monthlyBonus.volumeBonus)}</p>
                </div>
                <div className="rounded-[1.75rem] border border-primary/20 bg-primary/5 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Total Bonus</p>
                  <p className="mt-2 text-2xl font-black tabular-nums text-primary">{fmt(detail.monthlyBonus.total)}</p>
                </div>
              </div>

              <div className="rounded-[2rem] border border-border/40 bg-background overflow-hidden">
                <div className="p-5 border-b border-border/40 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                      Relevant Transactions
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {kind === "pifBonus"
                        ? "These validated PIF transactions generate the PIF bonus."
                        : "These validated transactions are the records behind this monthly bonus view."}
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-full px-3 py-1 font-black text-[10px]">
                    {detail.relevantSales.length} transaction{detail.relevantSales.length === 1 ? "" : "s"}
                  </Badge>
                </div>

                {detail.relevantSales.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">
                    No transactions found for this bonus slice.
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow className="border-none">
                        <TableHead className="pl-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</TableHead>
                        <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Client</TableHead>
                        <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Product</TableHead>
                        <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">HT Amount</TableHead>
                        <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Closer Comm</TableHead>
                        <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</TableHead>
                        <TableHead className="pr-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.relevantSales.map((sale) => (
                        <TableRow key={sale.id} className="group border-border/30 hover:bg-muted/10 transition-colors">
                          <TableCell className="pl-6 py-5 text-xs font-black text-muted-foreground/60 tabular-nums">{sale.date}</TableCell>
                          <TableCell className="py-5">
                            <div className="flex flex-col">
                              <span className="font-black text-sm">{sale.clientName}</span>
                              {sale.clientEmail && (
                                <span className="text-[10px] text-muted-foreground/50 font-bold truncate max-w-[220px]">
                                  {sale.clientEmail}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-5 text-sm font-bold text-muted-foreground">{sale.product}</TableCell>
                          <TableCell className="py-5 text-right font-black tabular-nums">{fmt(sale.amount)}</TableCell>
                          <TableCell className="py-5 text-right font-black tabular-nums text-primary">{fmt(sale.closerCommission)}</TableCell>
                          <TableCell className="py-5">
                            <div className="flex items-center gap-2">
                              <SaleStatusBadge refunded={sale.refunded} impaye={sale.impaye} />
                              {sale.paymentType === "pif" && (
                                <Badge className="text-[8px] font-black text-emerald-600 bg-emerald-500/10 border-emerald-500/20 h-5 px-1.5 rounded-sm uppercase tracking-widest">
                                  PIF
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="pr-6 py-5 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-2xl hover:bg-primary/10 hover:text-primary"
                              onClick={() => setSelectedSale(sale)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="rounded-[1.75rem] border border-border/40 bg-muted/5 p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Calculation Note</p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Bonus drill-downs use validated sales only, meaning transactions marked as refunded or unpaid are excluded.
                  {kind === "pifBonus" ? " The PIF slice further filters to `paymentType = pif`." : ""}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SaleDetailsDialog
        sale={selectedSale}
        open={!!selectedSale}
        onOpenChange={(nextOpen) => !nextOpen && setSelectedSale(null)}
      />
    </>
  );
};

export default BonusTransactionsDialog;
