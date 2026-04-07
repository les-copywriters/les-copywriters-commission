import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { applyTheme, getTheme } from "@/lib/theme";
import { useUpdateProfile } from "@/hooks/useProfiles";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { User, Shield, Sliders, Moon, Sun, Globe } from "lucide-react";

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
  { key: "settings.strength.weak",      color: "bg-destructive" },
  { key: "settings.strength.fair",      color: "bg-warning"     },
  { key: "settings.strength.strong",    color: "bg-primary"     },
  { key: "settings.strength.veryStrong",color: "bg-success"     },
] as const;

function PasswordStrengthBar({ password, t }: { password: string; t: (k: string) => string }) {
  if (!password) return null;
  const level = getStrength(password);
  const { key, color } = strengthConfig[level];
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-300",
              i <= level ? color : "bg-muted"
            )}
          />
        ))}
      </div>
      <p className={cn("text-xs font-medium",
        level === 0 && "text-destructive",
        level === 1 && "text-warning",
        level === 2 && "text-primary",
        level === 3 && "text-success",
      )}>
        {t(key)}
      </p>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function ProfileAvatar({ name, role }: { name: string; role: string }) {
  const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  const bg: Record<string, string> = {
    admin:  "bg-primary/15 text-primary border-primary/30",
    closer: "bg-success/15 text-success border-success/30",
    setter: "bg-warning/15 text-warning border-warning/30",
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={cn(
        "flex h-20 w-20 items-center justify-center rounded-2xl border-2 text-2xl font-bold",
        bg[role] ?? bg.admin
      )}>
        {initials}
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
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span className={cn(
        "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm",
        "transition-transform duration-200",
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

  // ── Profile save ───────────────────────────────────────────────────────────
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

  // ── Password save ──────────────────────────────────────────────────────────
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

  // ── Dark mode toggle ───────────────────────────────────────────────────────
  const handleThemeToggle = (dark: boolean) => {
    setIsDark(dark);
    applyTheme(dark ? "dark" : "light");
  };

  // ── Sign out all ───────────────────────────────────────────────────────────
  const handleSignOutAll = async () => {
    await supabase.auth.signOut({ scope: "global" });
    logout();
  };

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">{t("settings.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("settings.subtitle")}</p>
        </div>

        <Tabs defaultValue="profile">
          <TabsList className="grid w-full grid-cols-3 mb-2">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />{t("settings.tab.profile")}
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />{t("settings.tab.security")}
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2">
              <Sliders className="h-4 w-4" />{t("settings.tab.preferences")}
            </TabsTrigger>
          </TabsList>

          {/* ── Profile tab ─────────────────────────────────────────────── */}
          <TabsContent value="profile">
            <Card className="border border-border/60 shadow-card">
              <CardHeader>
                <CardTitle className="text-base">{t("settings.profile")}</CardTitle>
                <CardDescription>{session?.user?.email}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {user && (
                  <div className="flex flex-col items-center gap-3 py-2">
                    <ProfileAvatar name={user.name} role={user.role} />
                    <Badge variant="outline" className="capitalize">{t(`role.${user.role}`)}</Badge>
                  </div>
                )}

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="displayName">{t("settings.name")}</Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("settings.email")}</Label>
                    <Input value={session?.user?.email ?? ""} disabled className="h-10 opacity-60" />
                  </div>
                  <Button
                    onClick={handleSaveName}
                    disabled={savingName || !displayName.trim() || displayName.trim() === user?.name}
                    className="w-full"
                  >
                    {savingName ? t("common.loading") : t("settings.saveName")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Security tab ────────────────────────────────────────────── */}
          <TabsContent value="security">
            <Card className="border border-border/60 shadow-card">
              <CardHeader>
                <CardTitle className="text-base">{t("settings.changePassword")}</CardTitle>
                <CardDescription>{t("settings.subtitle")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSavePassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="currentPw">{t("settings.currentPassword")}</Label>
                    <Input
                      id="currentPw"
                      type="password"
                      value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)}
                      className="h-10"
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newPw">{t("settings.newPassword")}</Label>
                    <Input
                      id="newPw"
                      type="password"
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      className="h-10"
                      required
                      autoComplete="new-password"
                    />
                    <PasswordStrengthBar password={newPw} t={t} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPw">{t("settings.confirmPassword")}</Label>
                    <Input
                      id="confirmPw"
                      type="password"
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      className="h-10"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={savingPw}>
                    {savingPw ? t("common.loading") : t("settings.savePassword")}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Danger zone */}
            <Card className="mt-4 border border-destructive/30 shadow-card">
              <CardHeader>
                <CardTitle className="text-base text-destructive">{t("settings.dangerZone")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{t("settings.signOutAll")}</p>
                    <p className="text-xs text-muted-foreground">{t("settings.signOutAllDesc")}</p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={handleSignOutAll}>
                    {t("settings.signOutAll")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Preferences tab ─────────────────────────────────────────── */}
          <TabsContent value="preferences">
            <Card className="border border-border/60 shadow-card">
              <CardHeader>
                <CardTitle className="text-base">{t("settings.tab.preferences")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 divide-y divide-border">
                {/* Dark mode */}
                <div className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    {isDark
                      ? <Moon className="h-5 w-5 text-muted-foreground" />
                      : <Sun className="h-5 w-5 text-muted-foreground" />
                    }
                    <div>
                      <p className="text-sm font-medium">{t("settings.darkMode")}</p>
                      <p className="text-xs text-muted-foreground">{t("settings.darkModeDesc")}</p>
                    </div>
                  </div>
                  <Toggle checked={isDark} onChange={handleThemeToggle} />
                </div>

                {/* Language */}
                <div className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{t("settings.language")}</p>
                      <p className="text-xs text-muted-foreground">{t("settings.languageDesc")}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 rounded-lg border border-border p-1">
                    {(["fr", "en"] as const).map(lang => (
                      <button
                        key={lang}
                        onClick={() => setLocale(lang)}
                        className={cn(
                          "rounded-md px-3 py-1 text-xs font-semibold uppercase transition-colors",
                          locale === lang
                            ? "bg-primary text-white shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {lang}
                      </button>
                    ))}
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
