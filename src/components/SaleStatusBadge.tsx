import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n";

type Props = { refunded?: boolean; impaye?: boolean };

const SaleStatusBadge = ({ refunded, impaye }: Props) => {
  const { t } = useLanguage();
  if (refunded) return <Badge variant="destructive">{t("status.refunded")}</Badge>;
  if (impaye) return <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">{t("status.unpaid")}</Badge>;
  return <Badge className="bg-success text-success-foreground hover:bg-success/90">{t("status.paid")}</Badge>;
};

export default SaleStatusBadge;
