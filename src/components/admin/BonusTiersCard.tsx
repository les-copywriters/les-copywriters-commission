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
    <Card className="border border-border/60 shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Gift className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">{t("bonus.tiers")}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{t("bonus.tierNote")}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Static PIF bonus */}
        <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 px-5 py-3.5">
          <div>
            <span className="text-sm font-semibold">PIF Bonus</span>
            <p className="text-xs text-muted-foreground">{t("bonus.pifNote")}</p>
          </div>
          <span className="text-primary font-bold text-lg">+€{PIF_BONUS_PER_SALE}</span>
        </div>

        {/* Volume tiers */}
        {tiers.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">{t("bonus.noTiers")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">{t("bonus.minSales")}</TableHead>
                  <TableHead className="text-right">{t("bonus.bonusAmount")}</TableHead>
                  <TableHead className="text-right pr-6 w-16">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.map(tier => (
                  <TableRow key={tier.id} className="group">
                    <TableCell className="pl-6 font-medium">≥ {tier.minSales} {t("detail.totalSales").toLowerCase()}</TableCell>
                    <TableCell className="text-right font-bold text-success">+{fmt(tier.bonusAmount)}</TableCell>
                    <TableCell className="text-right pr-6">
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                        onClick={() => deleteTier.mutate(tier.id, {
                          onSuccess: () => toast.success(t("bonus.tierDeleted")),
                          onError: e => toast.error(e.message),
                        })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Add new tier */}
        <div className="flex gap-2 pt-2 border-t border-border/60">
          <Input
            type="number" min={1} placeholder={t("bonus.minSales")}
            value={newMinSales} onChange={e => setNewMinSales(e.target.value)}
            className="h-9"
          />
          <Input
            type="number" min={1} placeholder={`${t("bonus.bonusAmount")} (€)`}
            value={newBonusAmount} onChange={e => setNewBonusAmount(e.target.value)}
            className="h-9"
          />
          <Button
            size="sm"
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
            <Plus className="h-4 w-4 mr-1" />{t("bonus.addTier")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BonusTiersCard;
