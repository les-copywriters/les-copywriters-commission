import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

type Props = { refunded?: boolean; impaye?: boolean; className?: string };

const SaleStatusBadge = ({ refunded, impaye, className }: Props) => {
  const { t } = useLanguage();
  
  if (refunded) {
    return (
      <Badge className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-500 border-none shadow-sm shadow-rose-500/5", className)}>
        {t("status.refunded")}
      </Badge>
    );
  }
  
  if (impaye) {
    return (
      <Badge className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border-none shadow-sm shadow-amber-500/5", className)}>
        {t("status.unpaid")}
      </Badge>
    );
  }

  return (
    <Badge className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border-none shadow-sm shadow-emerald-500/5", className)}>
      {t("status.paid")}
    </Badge>
  );
};

export default SaleStatusBadge;
