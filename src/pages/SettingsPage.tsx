import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { applyTheme, getTheme } from "@/lib/theme";
import { useUpdateProfile } from "@/hooks/useProfiles";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { User, Shield, Sliders, Moon, Sun, Globe, CheckCircle2, AlertCircle, LogOut, Settings } from "lucide-react";

// ── Password strength ─────────────────────────────────────────────────────────
function getStrength(pw: string): 0 | 1 | 2 | 3 {
  if (pw.length < 8)  return 0;
  let score = 0;
  if (pw.length >= 12)           score++;
  if (/[A-Z]/.test(pw))         score++;
  if (/[0-9]/.test(pw))         score++;
  if (/[^A-Za-z0-9]/.test(pw))  score++;
  return Math.min(score, 3) as 0 | 1 | 2 | 3;
}

const strengthConfig = [
  { key: "settings.strength.weak",      color: "bg-rose-500" },
  { key: "settings.strength.fair",      color: "bg-amber-500"     },
  { key: "settings.strength.strong",    color: "bg-blue-500"     },
  { key: "settings.strength.veryStrong",color: "bg-emerald-500"     },
] as const;

function PasswordStrengthBar({ password, t }: { password: string; t: (k: string) => string }) {
  if (!password) return null;
  const level = getStrength(password);
  const { key, color } = strengthConfig[level];
  return (
    <div className="space-y-2 py-2">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-500",
              i <= level ? color : "bg-muted shadow-inner"
            )}
          />
        ))}
      </div>
      <p className={cn("text-[10px] font-black uppercase tracking-widest",
        level === 0 && "text-rose-500",
        level === 1 && "text-amber-500",
        level === 2 && "text-blue-500",
        level === 3 && "text-emerald-500",
      )}>
        {t(key)}
      </p>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function ProfileAvatar({ name, role }: { name: string; role: string }) {
  const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  const bgColors: Record<string, string> = {
    admin:  "from-blue-500 to-indigo-600",
    closer: "from-emerald-500 to-teal-600",
    setter: "from-amber-500 to-orange-600",
  };
  return (
    <div className="relative group">
      <div className={cn(
        "flex h-24 w-24 items-center justify-center rounded-[2rem] text-3xl font-black text-white shadow-xl shadow-primary/20 bg-gradient-to-br transform transition-transform duration-500 group-hover:scale-105",
        bgColors[role] ?? bgColors.admin
      )}>
        {initials}
      </div>
      <div className="absolute -bottom-1 -right-1 h-8 w-8 bg-background border-4 border-background rounded-full flex items-center justify-center shadow-lg">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      </div>
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
        checked ? "bg-primary shadow-lg shadow-primary/20" : "bg-muted"
      )}
    >
      <span className={cn(
        "pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-md",
        "transition-all duration-300 transform",
        checked ? "translate-x-5" : "translate-x-0"
      )} />
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const SettingsPage = () => {
  const { user, session, logout, refreshProfile } = useAuth();
  const { t, locale, setLocale } = useLanguage();
  const updateProfile = useUpdateProfile();

  // Profile tab
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [savingName, setSavingName]   = useState(false);

  // Security tab
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [savingPw, setSavingPw]     = useState(false);

  // Preferences tab
  const [isDark, setIsDark] = useState(getTheme() === "dark");

  const handleSaveName = async () => {
    if (!user || !displayName.trim()) return;
    setSavingName(true);
    updateProfile.mutate(
      { id: user.id, name: displayName.trim(), role: user.role },
      {
        onSuccess: async () => {
          await refreshProfile();
          toast.success(t("settings.nameUpdated"));
        },
        onError: e => toast.error(e.message),
        onSettled: () => setSavingName(false),
      }
    );
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) { toast.error(t("settings.errorLength")); return; }
    if (newPw !== confirmPw) { toast.error(t("settings.errorMatch")); return; }
    if (newPw === currentPw) { toast.error(t("settings.errorSame")); return; }

    setSavingPw(true);
    const email = session?.user?.email ?? "";
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: currentPw });
    if (authError) { toast.error(t("settings.errorCurrent")); setSavingPw(false); return; }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPw });
    if (updateError) { toast.error(updateError.message); }
    else {
      toast.success(t("settings.success"));
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    }
    setSavingPw(false);
  };

  const handleThemeToggle = (dark: boolean) => {
    setIsDark(dark);
    applyTheme(dark ? "dark" : "light");
  };

  const handleSignOutAll = async () => {
    await supabase.auth.signOut({ scope: "global" });
    logout();
  };

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-10 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shadow-inner">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">{t("settings.title")}</h1>
            <p className="text-muted-foreground font-medium">{t("settings.subtitle")}</p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-8">
          <TabsList className="bg-background/50 backdrop-blur-sm border border-border/40 p-1.5 rounded-2xl flex w-fit h-auto shadow-sm">
            <TabsTrigger value="profile" className="rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest gap-2 transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20">
              <User className="h-3.5 w-3.5" />{t("settings.tab.profile")}
            </TabsTrigger>
            <TabsTrigger value="security" className="rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest gap-2 transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20">
              <Shield className="h-3.5 w-3.5" />{t("settings.tab.security")}
            </TabsTrigger>
            <TabsTrigger value="preferences" className="rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest gap-2 transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20">
              <Sliders className="h-3.5 w-3.5" />{t("settings.tab.preferences")}
            </TabsTrigger>
          </TabsList>

          {/* ── Profile tab ─────────────────────────────────────────────── */}
          <TabsContent value="profile" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid gap-6 lg:grid-cols-5">
               <Card className="lg:col-span-2 border-none shadow-sm rounded-[2.5rem] bg-background/50 backdrop-blur-sm overflow-hidden p-8 flex flex-col items-center">
                  {user && (
                    <div className="flex flex-col items-center gap-6 py-4">
                      <ProfileAvatar name={user.name} role={user.role} />
                      <div className="text-center space-y-1">
                        <h2 className="text-xl font-black tracking-tight">{user.name}</h2>
                        <Badge variant="outline" className="capitalize border-primary/20 text-primary font-bold px-3 py-0.5 rounded-full">{t(`role.${user.role}`)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-medium text-center">{session?.user?.email}</p>
                    </div>
                  )}
               </Card>

               <Card className="lg:col-span-3 border-none shadow-premium rounded-[2.5rem] bg-background overflow-hidden">
                  <div className="p-8 border-b border-border/40">
                    <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">{t("settings.profile")}</h3>
                  </div>
                  <CardContent className="p-8 space-y-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="displayName" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t("settings.name")}</Label>
                        <Input
                          id="displayName"
                          value={displayName}
                          onChange={e => setDisplayName(e.target.value)}
                          className="h-12 rounded-2xl border-2 focus-visible:ring-primary/20 bg-muted/20 font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t("settings.email")}</Label>
                        <Input value={session?.user?.email ?? ""} disabled className="h-12 rounded-2xl border-2 opacity-60 bg-muted/20 cursor-not-allowed italic" />
                      </div>
                    </div>
                    <Button
                      onClick={handleSaveName}
                      disabled={savingName || !displayName.trim() || displayName.trim() === user?.name}
                      className="w-full h-12 rounded-2xl font-bold text-md shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      {savingName ? <CheckCircle2 className="animate-pulse mr-2" /> : null}
                      {savingName ? t("common.loading") : t("settings.saveName")}
                    </Button>
                  </CardContent>
               </Card>
            </div>
          </TabsContent>

          {/* ── Security tab ────────────────────────────────────────────── */}
          <TabsContent value="security" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid gap-6 lg:grid-cols-2">
               <Card className="border-none shadow-premium rounded-[2.5rem] bg-background overflow-hidden">
                  <div className="p-8 border-b border-border/40">
                    <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">{t("settings.changePassword")}</h3>
                  </div>
                  <CardContent className="p-8">
                    <form onSubmit={handleSavePassword} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="currentPw" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t("settings.currentPassword")}</Label>
                        <Input
                          id="currentPw"
                          type="password"
                          value={currentPw}
                          onChange={e => setCurrentPw(e.target.value)}
                          className="h-12 rounded-2xl border-2 bg-muted/20 focus-visible:ring-primary/20"
                          required
                          autoComplete="current-password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newPw" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t("settings.newPassword")}</Label>
                        <Input
                          id="newPw"
                          type="password"
                          value={newPw}
                          onChange={e => setNewPw(e.target.value)}
                          className="h-12 rounded-2xl border-2 bg-muted/20 focus-visible:ring-primary/20"
                          required
                          autoComplete="new-password"
                        />
                        <PasswordStrengthBar password={newPw} t={t} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPw" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t("settings.confirmPassword")}</Label>
                        <Input
                          id="confirmPw"
                          type="password"
                          value={confirmPw}
                          onChange={e => setConfirmPw(e.target.value)}
                          className="h-12 rounded-2xl border-2 bg-muted/20 focus-visible:ring-primary/20"
                          required
                          autoComplete="new-password"
                        />
                      </div>
                      <Button type="submit" className="w-full h-12 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all" disabled={savingPw}>
                        {savingPw ? t("common.loading") : t("settings.savePassword")}
                      </Button>
                    </form>
                  </CardContent>
               </Card>

               <div className="space-y-6">
                  <Card className="border-none shadow-sm rounded-[2.5rem] bg-rose-500/5 overflow-hidden">
                    <div className="p-8 border-b border-rose-500/10">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-rose-500" />
                        <h3 className="font-black text-sm uppercase tracking-widest text-rose-500">{t("settings.dangerZone")}</h3>
                      </div>
                    </div>
                    <CardContent className="p-8 space-y-6">
                       <div className="space-y-2">
                         <p className="text-sm font-bold tracking-tight">{t("settings.signOutAll")}</p>
                         <p className="text-xs text-muted-foreground font-medium leading-relaxed">{t("settings.signOutAllDesc")}</p>
                       </div>
                       <Button variant="outline" className="w-full h-12 rounded-2xl border-rose-500/20 text-rose-500 font-bold hover:bg-rose-500 hover:text-white transition-all" onClick={handleSignOutAll}>
                         <LogOut className="h-4 w-4 mr-2" />
                         {t("settings.signOutAll")}
                       </Button>
                    </CardContent>
                  </Card>
               </div>
            </div>
          </TabsContent>

          {/* ── Preferences tab ─────────────────────────────────────────── */}
          <TabsContent value="preferences" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Card className="border-none shadow-premium rounded-[2.5rem] bg-background overflow-hidden">
              <div className="p-8 border-b border-border/40">
                <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">{t("settings.tab.preferences")}</h3>
              </div>
              <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  {/* Dark mode */}
                  <div className="flex items-center justify-between p-8 hover:bg-muted/5 transition-colors">
                    <div className="flex items-center gap-5">
                      <div className="h-12 w-12 rounded-2xl bg-muted/40 flex items-center justify-center text-muted-foreground">
                        {isDark ? <Moon className="h-6 w-6" /> : <Sun className="h-6 w-6" />}
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold tracking-tight">{t("settings.darkMode")}</p>
                        <p className="text-xs text-muted-foreground font-medium">{t("settings.darkModeDesc")}</p>
                      </div>
                    </div>
                    <Toggle checked={isDark} onChange={handleThemeToggle} />
                  </div>

                  {/* Language */}
                  <div className="flex items-center justify-between p-8 hover:bg-muted/5 transition-colors">
                    <div className="flex items-center gap-5">
                      <div className="h-12 w-12 rounded-2xl bg-muted/40 flex items-center justify-center text-muted-foreground">
                        <Globe className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold tracking-tight">{t("settings.language")}</p>
                        <p className="text-xs text-muted-foreground font-medium">{t("settings.languageDesc")}</p>
                      </div>
                    </div>
                    <div className="bg-muted/30 p-1 rounded-xl flex gap-1 shadow-inner border border-border/40">
                      {(["fr", "en"] as const).map(lang => (
                        <button
                          key={lang}
                          onClick={() => setLocale(lang)}
                          className={cn(
                            "rounded-lg px-6 py-2 text-xs font-black uppercase tracking-widest transition-all",
                            locale === lang
                              ? "bg-white text-primary shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
