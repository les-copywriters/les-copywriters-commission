import { useState } from "react";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import { PIF_BONUS_PER_SALE } from "@/lib/commissionRates";
import { useBonusTiers, useAddBonusTier, useDeleteBonusTier } from "@/hooks/useBonusTiers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gift, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const BonusTiersCard = () => {
  const { t, locale } = useLanguage();
  const { data: tiers = [] } = useBonusTiers();
  const addTier = useAddBonusTier();
  const deleteTier = useDeleteBonusTier();
  const fmt = (n: number) => formatCurrency(n, locale);

  const [newMinSales, setNewMinSales] = useState("");
  const [newBonusAmount, setNewBonusAmount] = useState("");

  return (
    <Card className="border border-border/40 shadow-premium rounded-[2.5rem] overflow-hidden bg-background">
      <CardHeader className="p-8 pb-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20 text-white">
            <Gift className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-xl font-black tracking-tight">{t("bonus.tiers")}</CardTitle>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mt-1">{t("bonus.tierNote")}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 pt-4 space-y-6">
        {/* Static PIF bonus */}
        <div className="group flex items-center justify-between rounded-3xl bg-gradient-to-br from-primary/5 via-primary/10 to-transparent border border-primary/20 p-6 transition-all hover:shadow-lg hover:shadow-primary/5">
          <div className="flex items-center gap-4">
             <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
             <div>
               <span className="text-xs font-black uppercase tracking-widest text-primary">Global Incentive</span>
               <p className="text-sm font-bold text-muted-foreground/80 mt-1">{t("bonus.pifNote")}</p>
             </div>
          </div>
          <div className="flex flex-col items-end">
             <span className="text-primary font-black text-2xl tracking-tighter">+€{PIF_BONUS_PER_SALE}</span>
             <span className="text-[9px] font-black uppercase tracking-widest text-primary/40">Per PIF Sale</span>
          </div>
        </div>

        {/* Volume tiers */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 ml-1">Volume Rewarding Structure</h4>
          {tiers.length === 0 ? (
            <div className="text-center py-12 rounded-[2rem] border border-dashed border-border/60 bg-muted/20">
              <p className="text-sm font-bold text-muted-foreground/60 italic">{t("bonus.noTiers")}</p>
            </div>
          ) : (
            <div className="rounded-[2rem] border border-border/40 bg-muted/5 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead className="pl-8 h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("bonus.minSales")}</TableHead>
                    <TableHead className="text-right h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("bonus.bonusAmount")}</TableHead>
                    <TableHead className="text-right pr-8 w-16 h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.map(tier => (
                    <TableRow key={tier.id} className="group hover:bg-muted/20 transition-all border-border/30">
                      <TableCell className="pl-8 py-5">
                        <div className="flex items-center gap-3">
                           <span className="text-sm font-black tabular-nums">≥ {tier.minSales}</span>
                           <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-40">{t("detail.totalSales")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-5 pr-4">
                        <span className="font-black text-lg text-emerald-500 tabular-nums">+{fmt(tier.bonusAmount)}</span>
                      </TableCell>
                      <TableCell className="text-right pr-8 py-5">
                        <Button
                          variant="ghost" size="icon"
                          className="h-9 w-9 opacity-0 group-hover:opacity-100 transition-all rounded-xl hover:bg-rose-500/10 hover:text-rose-500"
                          onClick={() => deleteTier.mutate(tier.id, {
                            onSuccess: () => toast.success(t("bonus.tierDeleted")),
                            onError: e => toast.error(e.message),
                          })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Add new tier */}
        <div className="p-6 rounded-[2rem] bg-muted/20 border border-muted-foreground/10 space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Add Performance Tier</h4>
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Input
                type="number" min={1} placeholder={t("bonus.minSales")}
                value={newMinSales} onChange={e => setNewMinSales(e.target.value)}
                className="h-12 rounded-xl bg-background border-transparent focus:border-primary/20 transition-all font-bold"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Input
                type="number" min={1} placeholder={`${t("bonus.bonusAmount")} (€)`}
                value={newBonusAmount} onChange={e => setNewBonusAmount(e.target.value)}
                className="h-12 rounded-xl bg-background border-transparent focus:border-primary/20 transition-all font-bold"
              />
            </div>
            <Button
              className="h-12 rounded-xl px-6 font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20"
              disabled={!newMinSales || !newBonusAmount || addTier.isPending}
              onClick={() => {
                addTier.mutate(
                  { minSales: parseInt(newMinSales), bonusAmount: parseFloat(newBonusAmount) },
                  {
                    onSuccess: () => { toast.success(t("bonus.tierAdded")); setNewMinSales(""); setNewBonusAmount(""); },
                    onError: e => toast.error(e.message),
                  }
                );
              }}
            >
              <Plus className="h-4 w-4 mr-2" />{t("bonus.addTier")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BonusTiersCard;
