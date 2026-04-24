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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { User, Shield, Sliders, Moon, Sun, Globe, CheckCircle2, AlertCircle, LogOut, Eye, EyeOff, KeyRound, UserCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useUpdateFathomKey } from "@/hooks/useCallAnalysis";
import { useSetterIntegrationMappings, useUpsertSetterIntegrationMapping } from "@/hooks/useSetterDashboard";
import SetterIntegrationManager from "@/components/SetterIntegrationManager";
import GlobalIntegrationSettings from "@/components/GlobalIntegrationSettings";

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
  { key: "settings.strength.weak",      color: "bg-rose-500 shadow-rose-500/20" },
  { key: "settings.strength.fair",      color: "bg-amber-500 shadow-amber-500/20"     },
  { key: "settings.strength.strong",    color: "bg-blue-500 shadow-blue-500/20"     },
  { key: "settings.strength.veryStrong",color: "bg-emerald-500 shadow-emerald-500/20"     },
] as const;

function PasswordStrengthBar({ password, t }: { password: string; t: (k: string) => string }) {
  if (!password) return null;
  const level = getStrength(password);
  const { key, color } = strengthConfig[level];
  return (
    <div className="space-y-2.5 py-3">
      <div className="flex gap-2">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={cn(
              "h-2 flex-1 rounded-full transition-all duration-500 shadow-sm",
              i <= level ? color : "bg-muted"
            )}
          />
        ))}
      </div>
      <p className={cn("text-[10px] font-black uppercase tracking-[0.15em]",
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
        "flex h-32 w-32 items-center justify-center rounded-[2.5rem] text-4xl font-black text-white shadow-2xl transition-all duration-500 group-hover:scale-105 group-hover:rotate-3 bg-gradient-to-br",
        bgColors[role] ?? bgColors.admin
      )}>
        {initials}
      </div>
      <div className="absolute -bottom-2 -right-2 h-10 w-10 bg-background border-4 border-background rounded-2xl flex items-center justify-center shadow-xl">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
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
        "relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-all duration-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
        checked ? "bg-primary shadow-xl shadow-primary/20" : "bg-muted"
      )}
    >
      <span className={cn(
        "pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg",
        "transition-all duration-500 transform",
        checked ? "translate-x-6" : "translate-x-0"
      )} />
    </button>
  );
}

// ── Integration row ───────────────────────────────────────────────────────────
const colorMap: Record<string, { dot: string; badge: string }> = {
  blue:   { dot: "bg-blue-500 shadow-blue-500/40",   badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  violet: { dot: "bg-violet-500 shadow-violet-500/40", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" },
  amber:  { dot: "bg-amber-500 shadow-amber-500/40",  badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  green:  { dot: "bg-emerald-500 shadow-emerald-500/40",badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
};

function IntegrationRow({
  color,
  name,
  description,
  connected,
  t,
  children,
}: {
  color: string;
  name: string;
  description: string;
  connected: boolean;
  t: (k: string) => string;
  children: React.ReactNode;
}) {
  const { dot, badge } = colorMap[color] ?? colorMap.blue;
  return (
    <div className="px-10 py-10 space-y-6 hover:bg-muted/5 transition-all">
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-5">
          <span className={`mt-2 h-2.5 w-2.5 rounded-full shrink-0 shadow-lg ${dot}`} />
          <div className="space-y-1.5">
            <p className="font-black text-base tracking-tight leading-none">{name}</p>
            <p className="text-xs text-muted-foreground font-medium max-w-sm leading-relaxed">{description}</p>
          </div>
        </div>
        <Badge variant="outline" className={cn(
          "shrink-0 rounded-full px-4 py-1 text-[9px] font-black uppercase tracking-widest border transition-all",
          connected ? badge : "bg-muted/50 text-muted-foreground border-transparent"
        )}>
          {connected ? t("settings.connected") : t("settings.notSet")}
        </Badge>
      </div>
      <div className="space-y-4 pl-7">{children}</div>
    </div>
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

  // Fathom API key
  const [fathomKey, setFathomKey]       = useState("");
  const [showFathomKey, setShowFathomKey] = useState(false);
  const [savingFathom, setSavingFathom] = useState(false);
  const updateFathomKey = useUpdateFathomKey();

  // Setter integration IDs (self-service for setters)
  const isSetter = user?.role === "setter";
  const { data: setterMappings = [] } = useSetterIntegrationMappings();
  const upsertMapping = useUpsertSetterIntegrationMapping();
  const myMapping = setterMappings.find((m) => m.profileId === user?.id);
  const [setterIds, setSetterIds] = useState({
    aircallUserId: "",
    aircallEmail: "",
    iclosedUserId: "",
    iclosedEmail: "",
  });
  const [setterIdsLoaded, setSetterIdsLoaded] = useState(false);
  const [savingSetterIds, setSavingSetterIds] = useState(false);
  const [fetchingUserId, setFetchingUserId] = useState(false);
  const [fetchingAircallUserId, setFetchingAircallUserId] = useState(false);

  if (isSetter && myMapping && !setterIdsLoaded) {
    setSetterIds({
      aircallUserId: myMapping.aircallUserId ?? "",
      aircallEmail: myMapping.aircallEmail ?? "",
      iclosedUserId: myMapping.iclosedUserId ?? "",
      iclosedEmail: myMapping.iclosedEmail ?? "",
    });
    setSetterIdsLoaded(true);
  }

  useQuery({
    queryKey: ["profile_fathom_key", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("fathom_api_key")
        .eq("id", user.id)
        .single();
      const key = (data as { fathom_api_key: string | null } | null)?.fathom_api_key ?? "";
      setFathomKey(key);
      return key;
    },
    enabled: !!user?.id,
  });

  const handleFetchAircallUserId = async () => {
    setFetchingAircallUserId(true);
    try {
      const { data, error } = await supabase.functions.invoke("aircall-lookup");
      if (error) {
        const ctx = error as { context?: { json?: () => Promise<{ error?: string }> } };
        const body = await ctx.context?.json?.().catch(() => null);
        throw new Error((body as { error?: string })?.error ?? error.message);
      }
      const users = ((data as { users?: Array<{ id: number; name: string; email: string | null }> })?.users ?? []);
      if (!users.length) { toast.error("No users found in your Aircall account."); return; }
      const sessionEmail = session?.user?.email ?? "";
      const match =
        users.find(u => u.email === setterIds.aircallEmail) ??
        users.find(u => u.email === sessionEmail) ??
        users.find(u => u.name.toLowerCase().includes((user?.name ?? "").toLowerCase())) ??
        null;
      if (match) {
        setSetterIds(p => ({ ...p, aircallUserId: String(match.id) }));
        toast.success(`Matched: ${match.name} (${match.email ?? "no email"}) — ID ${match.id}`);
      } else {
        const list = users.map(u => `${u.name}: ${u.id}`).join(" | ");
        toast.info(`No auto-match found. Available users — ${list}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to fetch Aircall users.");
    } finally {
      setFetchingAircallUserId(false);
    }
  };

  const handleFetchIclosedUserId = async () => {
    setFetchingUserId(true);
    try {
      const { data, error } = await supabase.functions.invoke("iclosed-lookup", {
        body: {
          // We pass null/undefined if empty, Edge function will fall back to global
          apiKey: myMapping?.iclosedApiKey || null,
          baseUrl: myMapping?.iclosedApiBaseUrl || null
        },
      });
      if (error) {
        const ctx = error as { context?: { json?: () => Promise<{ error?: string }> } };
        const body = await ctx.context?.json?.().catch(() => null);
        throw new Error((body as { error?: string })?.error ?? error.message);
      }
      const users = ((data as { users?: Array<{ id: number; firstName?: string; lastName?: string; email?: string }> })?.users ?? []);
      if (!users.length) { toast.error("No users found in your iClosed account."); return; }
      // Match by the setter's own email (session email or iclosedEmail field)
      const sessionEmail = session?.user?.email ?? "";
      const iclosedEmail = setterIds.iclosedEmail;
      const match = users.find((u) => u.email === iclosedEmail)
        ?? users.find((u) => u.email === sessionEmail)
        ?? users[0];
      setSetterIds((p) => ({ ...p, iclosedUserId: String(match.id) }));
      toast.success(`Matched: ${match.firstName ?? ""} ${match.lastName ?? ""} — ID ${match.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to fetch users.");
    } finally {
      setFetchingUserId(false);
    }
  };

  const handleSaveSetterIds = () => {
    if (!user) return;
    setSavingSetterIds(true);
    upsertMapping.mutate(
      {
        profileId: user.id,
        aircallUserId: setterIds.aircallUserId.trim() || null,
        aircallEmail: setterIds.aircallEmail.trim() || null,
        pipedriveOwnerId: myMapping?.pipedriveOwnerId ?? null,
        pipedriveEmail: myMapping?.pipedriveEmail ?? null,
        iclosedUserId: setterIds.iclosedUserId.trim() || null,
        iclosedEmail: setterIds.iclosedEmail.trim() || null,
        notes: myMapping?.notes ?? null,
      },
      {
        onSuccess: () => toast.success(t("settings.myIntegrationsSaved")),
        onError: (e) => toast.error(e.message),
        onSettled: () => setSavingSetterIds(false),
      },
    );
  };

  const handleSaveFathomKey = () => {
    if (!user) return;
    setSavingFathom(true);
    updateFathomKey.mutate(
      { profileId: user.id, apiKey: fathomKey.trim() },
      {
        onSuccess: () => toast.success(t("settings.fathomSaved")),
        onError: (e) => toast.error(e.message),
        onSettled: () => setSavingFathom(false),
      }
    );
  };

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
      <div className="max-w-5xl space-y-10 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex items-center gap-5">
           <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-primary/10 shadow-inner">
              <Sliders className="h-7 w-7 text-primary" />
            </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{t("settings.title")}</h1>
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest text-[10px] mt-1">{t("settings.subtitle")}</p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-10">
          <TabsList className="bg-muted/30 border border-border/40 p-1.5 rounded-[1.25rem] flex w-fit h-auto gap-1">
            <TabsTrigger value="profile" className="rounded-xl px-6 py-2.5 text-[10px] font-black uppercase tracking-widest gap-2 transition-all data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:text-primary">
              <UserCircle className="h-3.5 w-3.5" />{t("settings.tab.profile")}
            </TabsTrigger>
            <TabsTrigger value="security" className="rounded-xl px-6 py-2.5 text-[10px] font-black uppercase tracking-widest gap-2 transition-all data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:text-primary">
              <Shield className="h-3.5 w-3.5" />{t("settings.tab.security")}
            </TabsTrigger>
            <TabsTrigger value="preferences" className="rounded-xl px-6 py-2.5 text-[10px] font-black uppercase tracking-widest gap-2 transition-all data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:text-primary">
              <Sliders className="h-3.5 w-3.5" />{t("settings.tab.preferences")}
            </TabsTrigger>
            <TabsTrigger value="apikeys" className="rounded-xl px-6 py-2.5 text-[10px] font-black uppercase tracking-widest gap-2 transition-all data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:text-primary">
              <KeyRound className="h-3.5 w-3.5" />{t("settings.tab.apiKeys")}
            </TabsTrigger>
          </TabsList>

          {/* ── Profile tab ─────────────────────────────────────────────── */}
          <TabsContent value="profile" className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid gap-8 lg:grid-cols-5">
               <Card className="lg:col-span-2 border-none shadow-premium rounded-[2.5rem] bg-background/50 backdrop-blur-sm overflow-hidden p-10 flex flex-col items-center justify-center">
                  {user && (
                    <div className="flex flex-col items-center gap-8 py-4">
                      <ProfileAvatar name={user.name} role={user.role} />
                      <div className="text-center space-y-3">
                        <h2 className="text-2xl font-black tracking-tight leading-none">{user.name}</h2>
                        <Badge variant="outline" className="capitalize border-primary/20 text-primary font-black uppercase tracking-widest text-[9px] px-4 py-1 rounded-full bg-primary/5">{t(`role.${user.role}`)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-medium opacity-60 italic">{session?.user?.email}</p>
                    </div>
                  )}
               </Card>

               <Card className="lg:col-span-3 border-none shadow-premium rounded-[2.5rem] bg-background overflow-hidden">
                  <div className="px-10 py-8 border-b border-border/40">
                    <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">{t("settings.profile")}</h3>
                  </div>
                  <CardContent className="p-10 space-y-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="displayName" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t("settings.name")}</Label>
                        <Input
                          id="displayName"
                          value={displayName}
                          onChange={e => setDisplayName(e.target.value)}
                          className="h-14 rounded-2xl border-2 focus-visible:ring-primary/20 bg-muted/20 font-black text-base px-6 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t("settings.email")}</Label>
                        <Input value={session?.user?.email ?? ""} disabled className="h-14 rounded-2xl border-2 opacity-50 bg-muted/30 cursor-not-allowed px-6 font-bold" />
                      </div>
                    </div>
                    <Button
                      onClick={handleSaveName}
                      disabled={savingName || !displayName.trim() || displayName.trim() === user?.name}
                      className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      {savingName ? <CheckCircle2 className="animate-pulse mr-2 h-4 w-4" /> : null}
                      {savingName ? t("common.loading") : t("settings.saveName")}
                    </Button>
                  </CardContent>
               </Card>
            </div>
          </TabsContent>

          {/* ── Security tab ────────────────────────────────────────────── */}
          <TabsContent value="security" className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid gap-8 lg:grid-cols-2">
               <Card className="border-none shadow-premium rounded-[2.5rem] bg-background overflow-hidden">
                  <div className="px-10 py-8 border-b border-border/40">
                    <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">{t("settings.changePassword")}</h3>
                  </div>
                  <CardContent className="p-10">
                    <form onSubmit={handleSavePassword} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="currentPw" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t("settings.currentPassword")}</Label>
                        <Input
                          id="currentPw"
                          type="password"
                          value={currentPw}
                          onChange={e => setCurrentPw(e.target.value)}
                          className="h-14 rounded-2xl border-2 bg-muted/20 focus-visible:ring-primary/20 px-6"
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
                          className="h-14 rounded-2xl border-2 bg-muted/20 focus-visible:ring-primary/20 px-6"
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
                          className="h-14 rounded-2xl border-2 bg-muted/20 focus-visible:ring-primary/20 px-6"
                          required
                          autoComplete="new-password"
                        />
                      </div>
                      <Button type="submit" className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95" disabled={savingPw}>
                        {savingPw ? t("common.loading") : t("settings.savePassword")}
                      </Button>
                    </form>
                  </CardContent>
               </Card>

               <div className="space-y-8">
                  <Card className="border-none shadow-premium rounded-[2.5rem] bg-rose-500/5 overflow-hidden">
                    <div className="px-10 py-8 border-b border-rose-500/10">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-rose-500" />
                        <h3 className="font-black text-sm uppercase tracking-widest text-rose-500">{t("settings.dangerZone")}</h3>
                      </div>
                    </div>
                    <CardContent className="p-10 space-y-8">
                       <div className="space-y-3">
                         <p className="text-base font-black tracking-tight">{t("settings.signOutAll")}</p>
                         <p className="text-xs text-muted-foreground font-medium leading-relaxed opacity-70">{t("settings.signOutAllDesc")}</p>
                       </div>
                       <Button variant="outline" className="w-full h-14 rounded-2xl border-rose-500/20 text-rose-500 font-black uppercase tracking-widest text-[10px] hover:bg-rose-500 hover:text-white transition-all active:scale-95" onClick={handleSignOutAll}>
                         <LogOut className="h-4 w-4 mr-2" />
                         {t("settings.signOutAll")}
                       </Button>
                    </CardContent>
                  </Card>
               </div>
            </div>
          </TabsContent>

          {/* ── Preferences tab ─────────────────────────────────────────── */}
          <TabsContent value="preferences" className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Card className="border-none shadow-premium rounded-[2.5rem] bg-background overflow-hidden">
              <div className="px-10 py-8 border-b border-border/40">
                <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">{t("settings.tab.preferences")}</h3>
              </div>
              <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  {/* Dark mode */}
                  <div className="flex items-center justify-between p-10 hover:bg-muted/5 transition-all">
                    <div className="flex items-center gap-6">
                      <div className="h-16 w-16 rounded-[1.25rem] bg-muted/40 flex items-center justify-center text-muted-foreground shadow-inner">
                        {isDark ? <Moon className="h-8 w-8" /> : <Sun className="h-8 w-8" />}
                      </div>
                      <div className="space-y-1.5">
                        <p className="font-black text-base tracking-tight leading-none">{t("settings.darkMode")}</p>
                        <p className="text-xs text-muted-foreground font-medium opacity-60">{t("settings.darkModeDesc")}</p>
                      </div>
                    </div>
                    <Toggle checked={isDark} onChange={handleThemeToggle} />
                  </div>

                  {/* Language */}
                  <div className="flex items-center justify-between p-10 hover:bg-muted/5 transition-all">
                    <div className="flex items-center gap-6">
                      <div className="h-16 w-16 rounded-[1.25rem] bg-muted/40 flex items-center justify-center text-muted-foreground shadow-inner">
                        <Globe className="h-8 w-8" />
                      </div>
                      <div className="space-y-1.5">
                        <p className="font-black text-base tracking-tight leading-none">{t("settings.language")}</p>
                        <p className="text-xs text-muted-foreground font-medium opacity-60">{t("settings.languageDesc")}</p>
                      </div>
                    </div>
                    <div className="bg-muted/30 p-1.5 rounded-2xl flex gap-1.5 shadow-inner border border-border/40">
                      {(["fr", "en"] as const).map(lang => (
                        <button
                          key={lang}
                          onClick={() => setLocale(lang)}
                          className={cn(
                            "rounded-xl px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                            locale === lang
                              ? "bg-white text-primary shadow-lg"
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
          {/* ── API Keys tab ─────────────────────────────────────────── */}
          <TabsContent value="apikeys" className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Card className="border-none shadow-premium rounded-[2.5rem] bg-background overflow-hidden">
              <div className="px-10 py-8 border-b border-border/40">
                <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">{t("settings.apiKeysTitle")}</h3>
                <p className="text-[10px] text-muted-foreground/40 font-black uppercase tracking-widest mt-2">{t("settings.apiKeysDesc")}</p>
              </div>

              <div className="divide-y divide-border/40">

                {/* ── Fathom (admins & closers only) ── */}
                {!isSetter && <IntegrationRow
                  color="blue"
                  name="Fathom"
                  description={t("settings.fathomDesc")}
                  connected={!!fathomKey}
                  t={t}
                >
                  <div className="space-y-3">
                    <Label htmlFor="fathomKey" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                      {t("settings.fathomKey")}
                    </Label>
                    <div className="relative group">
                      <Input
                        id="fathomKey"
                        type={showFathomKey ? "text" : "password"}
                        value={fathomKey}
                        onChange={e => setFathomKey(e.target.value)}
                        placeholder={t("settings.fathomPlaceholder")}
                        className="h-14 rounded-2xl border-2 bg-muted/20 font-mono text-base pr-14 pl-6 transition-all focus-visible:border-primary"
                        autoComplete="off"
                      />
                      <button type="button" onClick={() => setShowFathomKey(v => !v)} className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors">
                        {showFathomKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-30">{t("settings.fathomHint")}</p>
                  </div>
                  <Button onClick={handleSaveFathomKey} disabled={savingFathom} size="sm" className="h-12 rounded-xl font-black uppercase tracking-widest text-[10px] px-8 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95">
                    {savingFathom ? t("common.loading") : t("settings.fathomSave")}
                  </Button>
                </IntegrationRow>}

                {/* ── Aircall (setters only) ── */}
                {isSetter && (
                  <IntegrationRow
                    color="violet"
                    name="Aircall"
                    description="Connect your Aircall account to sync call volume and talk time to your dashboard."
                    connected={!!setterIds.aircallUserId}
                    t={t}
                  >
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="aircallUserId" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t("settings.aircallUserId")}</Label>
                        <div className="flex gap-3">
                          <Input id="aircallUserId" value={setterIds.aircallUserId} onChange={(e) => setSetterIds((p) => ({ ...p, aircallUserId: e.target.value }))} placeholder="e.g. 123456" className="h-12 rounded-xl border-2 bg-muted/20 font-mono text-sm px-5 w-full" autoComplete="off" />
                          <Button type="button" variant="outline" size="sm" className="h-12 rounded-xl px-4 shrink-0 font-black uppercase tracking-widest text-[10px] border-border/60 hover:bg-muted" disabled={fetchingAircallUserId} onClick={handleFetchAircallUserId}>
                            {fetchingAircallUserId ? "..." : "Fetch"}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="aircallEmail" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t("settings.aircallEmail")}</Label>
                        <Input id="aircallEmail" type="email" value={setterIds.aircallEmail} onChange={(e) => setSetterIds((p) => ({ ...p, aircallEmail: e.target.value }))} placeholder="you@company.com" className="h-12 rounded-xl border-2 bg-muted/20 text-sm px-5" autoComplete="off" />
                      </div>
                    </div>
                    <Button onClick={handleSaveSetterIds} disabled={savingSetterIds} size="sm" className="h-12 rounded-xl font-black uppercase tracking-widest text-[10px] px-8 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95">
                      {savingSetterIds ? t("common.loading") : t("settings.saveMapping")}
                    </Button>
                  </IntegrationRow>
                )}

                {/* ── iClosed (setters only) ── */}
                {isSetter && (
                  <IntegrationRow
                    color="amber"
                    name="iClosed"
                    description="Connect your iClosed account to sync leads, show-ups, and closes to your dashboard."
                    connected={!!setterIds.iclosedUserId}
                    t={t}
                  >
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="iclosedUserId" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t("settings.iclosedUserId")}</Label>
                        <div className="flex gap-3">
                          <Input id="iclosedUserId" value={setterIds.iclosedUserId} onChange={(e) => setSetterIds((p) => ({ ...p, iclosedUserId: e.target.value }))} placeholder="e.g. 987654" className="h-12 rounded-xl border-2 bg-muted/20 font-mono text-sm px-5 w-full" autoComplete="off" />
                          <Button type="button" variant="outline" size="sm" className="h-12 rounded-xl px-4 shrink-0 font-black uppercase tracking-widest text-[10px] border-border/60 hover:bg-muted" disabled={fetchingUserId} onClick={handleFetchIclosedUserId}>
                            {fetchingUserId ? "..." : "Fetch"}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="iclosedEmail" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{t("settings.iclosedEmail")}</Label>
                        <Input id="iclosedEmail" type="email" value={setterIds.iclosedEmail} onChange={(e) => setSetterIds((p) => ({ ...p, iclosedEmail: e.target.value }))} placeholder="you@company.com" className="h-12 rounded-xl border-2 bg-muted/20 text-sm px-5" autoComplete="off" />
                      </div>
                    </div>
                    <Button onClick={handleSaveSetterIds} disabled={savingSetterIds} size="sm" className="h-12 rounded-xl font-black uppercase tracking-widest text-[10px] px-8 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95">
                      {savingSetterIds ? t("common.loading") : t("settings.saveMapping")}
                    </Button>
                  </IntegrationRow>
                )}

              </div>
            </Card>

            {user?.role === "admin" && (
              <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
                <GlobalIntegrationSettings />
                <SetterIntegrationManager />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
