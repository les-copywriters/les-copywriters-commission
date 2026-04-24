import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/i18n";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Lock, Mail, Sparkles, ShieldCheck, PieChart, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const LoginPage = () => {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();
  const { t }     = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await login(email, password);
      if (error) setError(error);
      else navigate("/dashboard");
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background selection:bg-primary/20">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#0A0D14] flex-col justify-between p-16 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -mr-64 -mt-64" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] -ml-40 -mb-40" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-white shadow-2xl shadow-primary/20 overflow-hidden border border-white/10">
              <img src="/Les Copywriters Logo.jpg" alt="Logo" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="font-black text-white text-2xl tracking-tight leading-none">Les CopyWriters</p>
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-1.5 opacity-80">Commission Dashboard</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-10">
          <div className="space-y-6 animate-in fade-in slide-in-from-left-8 duration-1000 delay-300">
            <h1 className="text-4xl font-black text-white leading-tight tracking-tight">
              Gérez vos <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-400">performances.</span>
            </h1>
            <p className="text-white/50 text-base font-medium leading-relaxed max-w-sm">
              L'outil ultime de tracking de commissions conçu pour l'élite des closers et setters.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
            {[
              { label: "Closers", value: "3", icon: ShieldCheck, color: "text-emerald-400" },
              { label: "Setters", value: "4", icon: PieChart, color: "text-blue-400" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="group rounded-[1.25rem] bg-white/[0.03] border border-white/5 p-5 backdrop-blur-sm transition-all hover:bg-white/[0.05] hover:border-white/10">
                <Icon className={cn("h-5 w-5 mb-3 transition-transform group-hover:scale-110", color)} />
                <p className="text-3xl font-black text-white tabular-nums tracking-tight">{value}</p>
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-2">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/30">
            © {new Date().getFullYear()} Les CopyWriters
          </p>
          <div className="flex gap-4">
            <div className="h-1.5 w-8 rounded-full bg-primary" />
            <div className="h-1.5 w-1.5 rounded-full bg-white/10" />
            <div className="h-1.5 w-1.5 rounded-full bg-white/10" />
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-1 flex-col items-center justify-center p-8 lg:p-24 bg-background relative">
        <div className="absolute top-12 right-12 hidden lg:block">
           <Badge variant="outline" className="rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest border-border text-muted-foreground">System v3.0.4</Badge>
        </div>

        {/* Mobile logo */}
        <div className="mb-12 flex items-center gap-4 lg:hidden">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xl shadow-primary/20 overflow-hidden border border-border">
            <img src="/Les Copywriters Logo.jpg" alt="Logo" className="h-full w-full object-cover" />
          </div>
          <span className="font-black text-2xl tracking-tight">Les CopyWriters</span>
        </div>

        <div className="w-full max-w-[400px] space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tight">{t("login.title")}</h2>
            <p className="text-muted-foreground font-medium text-base leading-relaxed">{t("login.description")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground ml-1">{t("login.email")}</Label>
              <div className="group relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  className="pl-12 h-14 rounded-2xl border-2 bg-muted/20 focus-visible:ring-primary/20 focus-visible:border-primary transition-all font-medium text-md"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1 leading-none">
                <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">{t("login.password")}</Label>
                <button type="button" className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors">Forgot?</button>
              </div>
              <div className="group relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  className="pl-12 h-14 rounded-2xl border-2 bg-muted/20 focus-visible:ring-primary/20 focus-visible:border-primary transition-all font-medium"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-[1.5rem] bg-rose-500/5 border border-rose-500/10 p-4 flex items-center gap-3 animate-in shake duration-500">
                <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
                <p className="text-sm font-bold text-rose-500 leading-tight">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full h-14 rounded-2xl text-[13px] font-black uppercase tracking-[0.15em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all" disabled={loading}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t("common.loading")}
                </div>
              ) : t("login.submit")}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground font-medium pt-4">
            Authorized personnel only. Access monitored.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
