import { useState } from "react";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import { PIF_BONUS_PER_SALE } from "@/lib/commissionRates";
import { useBonusTiers, useAddBonusTier, useDeleteBonusTier } from "@/hooks/useBonusTiers";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gift, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const BonusTiersCard = () => {
  const { t, locale } = useLanguage();
  const { data: tiers = [] } = useBonusTiers();
  const addTier   = useAddBonusTier();
  const deleteTier = useDeleteBonusTier();
  const fmt = (n: number) => formatCurrency(n, locale);

  const [newMinSales,    setNewMinSales]    = useState("");
  const [newBonusAmount, setNewBonusAmount] = useState("");

  return (
    <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border/40">
        <Gift className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">{t("bonus.tiers")}</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Static PIF bonus */}
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <div>
              <p className="text-xs font-medium text-primary">Global Incentive</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t("bonus.pifNote")}</p>
            </div>
          </div>
          <span className="text-primary font-semibold text-base tabular-nums">+€{PIF_BONUS_PER_SALE}</span>
        </div>

        {/* Volume tiers */}
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">Volume Rewarding Structure</p>

          {tiers.length === 0 ? (
            <div className="text-center py-8 rounded-lg border border-dashed border-border/40 bg-muted/10">
              <p className="text-sm text-muted-foreground">{t("bonus.noTiers")}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border/40 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-border/30">
                    <TableHead className="pl-4 h-9 text-[11px] font-medium text-muted-foreground">{t("bonus.minSales")}</TableHead>
                    <TableHead className="text-right h-9 text-[11px] font-medium text-muted-foreground">{t("bonus.bonusAmount")}</TableHead>
                    <TableHead className="text-right pr-4 w-12 h-9" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.map(tier => (
                    <TableRow key={tier.id} className="group hover:bg-muted/20 transition-colors border-border/20">
                      <TableCell className="pl-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium tabular-nums">≥ {tier.minSales}</span>
                          <span className="text-[11px] text-muted-foreground">{t("detail.totalSales").toLowerCase()}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <span className="font-semibold text-emerald-600 tabular-nums">+{fmt(tier.bonusAmount)}</span>
                      </TableCell>
                      <TableCell className="text-right pr-4 py-3">
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-rose-500/10 hover:text-rose-500"
                          onClick={() => deleteTier.mutate(tier.id, {
                            onSuccess: () => toast.success(t("bonus.tierDeleted")),
                            onError: e => toast.error(e.message),
                          })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Add tier */}
        <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-3">
          <p className="text-[11px] text-muted-foreground">Add Performance Tier</p>
          <div className="flex gap-2">
            <Input
              type="number" min={1} placeholder={t("bonus.minSales")}
              value={newMinSales} onChange={e => setNewMinSales(e.target.value)}
              className="h-9 rounded-lg text-sm flex-1"
            />
            <Input
              type="number" min={1} placeholder={`${t("bonus.bonusAmount")} (€)`}
              value={newBonusAmount} onChange={e => setNewBonusAmount(e.target.value)}
              className="h-9 rounded-lg text-sm flex-1"
            />
            <Button
              className="h-9 rounded-lg px-3 text-xs font-medium shrink-0"
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
              <Plus className="h-3.5 w-3.5 mr-1" />{t("bonus.addTier")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BonusTiersCard;
