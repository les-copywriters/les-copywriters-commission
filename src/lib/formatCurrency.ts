export const formatCurrency = (amount: number, locale: string): string =>
  new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
