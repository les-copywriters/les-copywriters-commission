import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/i18n";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock, Mail, TrendingUp } from "lucide-react";

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
    const { error } = await login(email, password);
    setLoading(false);
    if (error) setError(error);
    else navigate("/dashboard");
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-md">
            <span className="text-base font-black text-white">LC</span>
          </div>
          <div>
            <p className="font-bold text-white text-lg leading-none">Les Copywriters</p>
            <p className="text-xs text-white/50 mt-0.5">Commission Dashboard</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-white leading-tight">
              Suivez vos<br />commissions<br />en temps réel.
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-xs">
              Un tableau de bord clair pour chaque closer et setter de l'équipe.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Closers", value: "3", icon: TrendingUp },
              { label: "Setters", value: "4", icon: TrendingUp },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl bg-white/5 border border-white/10 p-4">
                <Icon className="h-5 w-5 text-primary mb-2" />
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-white/60 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/40">
          © {new Date().getFullYear()} Les Copywriters. Tous droits réservés.
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <span className="text-base font-black text-white">LC</span>
          </div>
          <span className="font-bold text-xl">Les Copywriters</span>
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div>
            <h2 className="text-2xl font-bold">{t("login.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("login.description")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">{t("login.email")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  className="pl-9 h-11"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="vous@lescopywriters.fr"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("login.password")}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  className="pl-9 h-11"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={loading}>
              {loading ? t("common.loading") : t("login.submit")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
