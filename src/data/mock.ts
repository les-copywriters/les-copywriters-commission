import { Sale, User, Refund, Impaye } from "@/types";

/** Placeholder users — replace with API call later */
export const mockUsers: User[] = [
  { id: "u1", name: "Karim B.", role: "closer" },
  { id: "u2", name: "Sophie L.", role: "closer" },
  { id: "u3", name: "Yassine M.", role: "setter" },
  { id: "u4", name: "Léa D.", role: "setter" },
  { id: "u5", name: "Admin", role: "admin" },
];

/** Helper to compute commissions */
const makeSale = (
  id: string, date: string, clientName: string, clientEmail: string,
  product: string, closer: string, setter: string, amount: number,
  opts?: { bonus?: number; refunded?: boolean; impaye?: boolean }
): Sale => ({
  id, date, clientName, clientEmail, product, closer, setter, amount,
  closerCommission: Math.round(amount * 0.088 * 100) / 100,
  setterCommission: Math.round(amount * 0.01 * 100) / 100,
  ...opts,
});

/** Placeholder sales — replace with API call later */
export const mockSales: Sale[] = [
  makeSale("s1", "2025-03-01", "Jean Dupont", "jean@mail.com", "Formation Pro", "Karim B.", "Yassine M.", 2500),
  makeSale("s2", "2025-03-03", "Marie Claire", "marie@mail.com", "Coaching Premium", "Sophie L.", "Léa D.", 4800, { bonus: 200 }),
  makeSale("s3", "2025-03-05", "Pierre Martin", "pierre@mail.com", "Formation Pro", "Karim B.", "Léa D.", 2500),
  makeSale("s4", "2025-03-08", "Lucie Bernard", "lucie@mail.com", "Mastermind", "Sophie L.", "Yassine M.", 9700, { bonus: 500 }),
  makeSale("s5", "2025-03-10", "Thomas Leroy", "thomas@mail.com", "Coaching Premium", "Karim B.", "Yassine M.", 4800, { refunded: true }),
  makeSale("s6", "2025-03-12", "Camille Petit", "camille@mail.com", "Formation Pro", "Sophie L.", "Léa D.", 2500, { impaye: true }),
  makeSale("s7", "2025-03-15", "Hugo Moreau", "hugo@mail.com", "Mastermind", "Karim B.", "Yassine M.", 9700),
  makeSale("s8", "2025-03-18", "Emma Robert", "emma@mail.com", "Coaching Premium", "Sophie L.", "Léa D.", 4800),
  makeSale("s9", "2025-03-20", "Antoine Blanc", "antoine@mail.com", "Formation Pro", "Karim B.", "Léa D.", 2500, { bonus: 100 }),
  makeSale("s10", "2025-03-22", "Julie Simon", "julie@mail.com", "Mastermind", "Sophie L.", "Yassine M.", 9700, { impaye: true }),
];

export const mockRefunds: Refund[] = [
  { id: "r1", saleId: "s5", amount: 4800, date: "2025-03-15", status: "approved" },
  { id: "r2", saleId: "s6", amount: 2500, date: "2025-03-20", status: "pending" },
];

export const mockImpayes: Impaye[] = [
  { id: "i1", saleId: "s6", amount: 2500, date: "2025-03-14" },
  { id: "i2", saleId: "s10", amount: 9700, date: "2025-03-25" },
];
