import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

type Props = { refunded?: boolean; impaye?: boolean; className?: string };

const SaleStatusBadge = ({ refunded, impaye, className }: Props) => {
  const { t } = useLanguage();

  if (refunded) return (
    <Badge className={cn("rounded-md px-2 py-0.5 text-[10px] font-medium bg-rose-500/10 text-rose-600 border-rose-500/20", className)}>
      {t("status.refunded")}
    </Badge>
  );

  if (impaye) return (
    <Badge className={cn("rounded-md px-2 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-600 border-amber-500/20", className)}>
      {t("status.unpaid")}
    </Badge>
  );

  return (
    <Badge className={cn("rounded-md px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border-emerald-500/20", className)}>
      {t("status.paid")}
    </Badge>
  );
};

export default SaleStatusBadge;
