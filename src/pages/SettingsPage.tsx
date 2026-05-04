import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { applyTheme, getTheme } from "@/lib/theme";
import { useUpdateProfile } from "@/hooks/useProfiles";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Shield, Sliders, Moon, Sun, Globe, CheckCircle2, AlertCircle, XCircle, LogOut, Eye, EyeOff, KeyRound, UserCircle, Activity, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useUpdateFathomKey } from "@/hooks/useCallAnalysis";
import { useSetterIntegrationMappings, useUpsertSetterIntegrationMapping } from "@/hooks/useSetterDashboard";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import GlobalIntegrationSettings from "@/components/GlobalIntegrationSettings";
import AutoSyncStatus from "@/components/AutoSyncStatus";

// ── Password strength ─────────────────────────────────────────────────────────
function getStrength(pw: string): 0 | 1 | 2 | 3 {
  if (pw.length < 8) return 0;
  let score = 0;
  if (pw.length >= 12)          score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 3) as 0 | 1 | 2 | 3;
}

const strengthColors = ["bg-rose-500", "bg-amber-500", "bg-blue-500", "bg-emerald-500"] as const;
const strengthKeys = ["settings.strength.weak", "settings.strength.fair", "settings.strength.strong", "settings.strength.veryStrong"] as const;
const strengthText = ["text-rose-500", "text-amber-500", "text-blue-500", "text-emerald-500"] as const;

function PasswordStrengthBar({ password, t }: { password: string; t: (k: string) => string }) {
  if (!password) return null;
  const level = getStrength(password);
  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-all", i <= level ? strengthColors[level] : "bg-muted")} />
        ))}
      </div>
      <p className={cn("text-[11px]", strengthText[level])}>{t(strengthKeys[level])}</p>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
        checked ? "bg-primary" : "bg-muted"
      )}>
      <span className={cn("pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
        checked ? "translate-x-5" : "translate-x-0"
      )} />
    </button>
  );
}

// ── Integration row ───────────────────────────────────────────────────────────
const dotColors: Record<string, string> = {
  blue: "bg-blue-500", violet: "bg-violet-500", amber: "bg-amber-500", green: "bg-emerald-500",
};
const badgeColors: Record<string, string> = {
  blue:   "bg-blue-500/10 text-blue-600 border-blue-500/20",
  violet: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  amber:  "bg-amber-500/10 text-amber-600 border-amber-500/20",
  green:  "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

function IntegrationRow({ color, name, description, connected, t, children }: {
  color: string; name: string; description: string; connected: boolean;
  t: (k: string) => string; children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-4 space-y-4 border-b border-border/20 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={cn("mt-1 h-2 w-2 rounded-full shrink-0", dotColors[color] ?? dotColors.blue)} />
          <div>
            <p className="text-sm font-medium">{name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <span className={cn("shrink-0 inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium",
          connected ? (badgeColors[color] ?? badgeColors.blue) : "bg-muted/40 text-muted-foreground border-transparent"
        )}>
          {connected ? t("settings.connected") : t("settings.notSet")}
        </span>
      </div>
      <div className="space-y-3 pl-5">{children}</div>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, children, className, headerAction, collapsible = false, defaultOpen = true }: {
  title: string; icon?: React.ElementType; children: React.ReactNode; className?: string; headerAction?: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("rounded-xl border border-border/40 overflow-hidden bg-background", className)}>
      <div
        className={cn("flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border/40", collapsible && "cursor-pointer select-none")}
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
      >
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <p className="text-sm font-medium flex-1">{title}</p>
        {headerAction && <div onClick={e => e.stopPropagation()}>{headerAction}</div>}
        {collapsible && (
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground/50 transition-transform duration-300 ease-in-out", open && "rotate-180")} />
        )}
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const SettingsPage = () => {
  const { user, session, logout, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "profile";
  const { t, locale, setLocale } = useLanguage();
  const updateProfile = useUpdateProfile();
  const { data: globalSettings = [] } = useGlobalSettings();

  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [savingName, setSavingName]   = useState(false);
  useEffect(() => { setDisplayName(user?.name ?? ""); }, [user?.name]);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw]   = useState(false);

  const [isDark, setIsDark] = useState(getTheme() === "dark");

  const [fathomKey, setFathomKey]         = useState("");
  const [showFathomKey, setShowFathomKey] = useState(false);
  const [savingFathom, setSavingFathom]   = useState(false);
  const updateFathomKey = useUpdateFathomKey();

  const isSetter = user?.role === "setter";
  const { data: setterMappings = [] } = useSetterIntegrationMappings();
  const upsertMapping = useUpsertSetterIntegrationMapping();
  const myMapping = setterMappings.find(m => m.profileId === user?.id);

  const [setterIds, setSetterIds] = useState({
    aircallUserId: "", aircallEmail: "",
    iclosedUserId: "", iclosedEmail: "",
    iclosedApiKey: "", iclosedApiBaseUrl: "https://public.api.iclosed.io/v1",
  });
  const [setterIdsLoaded, setSetterIdsLoaded]   = useState(false);
  const [savingSetterIds, setSavingSetterIds]   = useState(false);
  const [fetchingUserId, setFetchingUserId]     = useState(false);
  const [fetchingAircallUserId, setFetchingAircallUserId] = useState(false);
  const [verifying, setVerifying] = useState(false);
  type VerifyResult = { ok: boolean; label: string; detail: string };
  const [verifyResults, setVerifyResults] = useState<VerifyResult[] | null>(null);

  useEffect(() => {
    if (myMapping && !setterIdsLoaded) {
      setSetterIds({
        aircallUserId: myMapping.aircallUserId ?? "",
        aircallEmail: myMapping.aircallEmail ?? "",
        iclosedUserId: myMapping.iclosedUserId ?? "",
        iclosedEmail: myMapping.iclosedEmail ?? "",
        iclosedApiKey: myMapping.iclosedApiKey ?? "",
        iclosedApiBaseUrl: myMapping.iclosedApiBaseUrl ?? "https://public.api.iclosed.io/v1",
      });
      setSetterIdsLoaded(true);
    }
  }, [myMapping, setterIdsLoaded]);

  useQuery({
    queryKey: ["profile_fathom_key", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("profiles").select("fathom_api_key").eq("id", user.id).single();
      const key = (data as { fathom_api_key: string | null } | null)?.fathom_api_key ?? "";
      setFathomKey(key);
      return key;
    },
    enabled: !!user?.id,
  });

  const handleFetchAircallUserId = async () => {
    // Only block if global settings are readable (admin) AND the keys are missing.
    // Setters can't read global_settings due to RLS — trust the edge function in that case.
    const globalAircallId    = globalSettings.find(s => s.key === "aircall_api_id")?.value;
    const globalAircallToken = globalSettings.find(s => s.key === "aircall_api_token")?.value;
    if (globalSettings.length > 0 && (!globalAircallId || !globalAircallToken)) {
      toast.error("Aircall not configured", { description: "Ask your admin to set the global Aircall API credentials in Settings → API Keys." });
      return;
    }
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
      const match = users.find(u => u.email === setterIds.aircallEmail)
        ?? users.find(u => u.email === session?.user?.email)
        ?? users.find(u => u.name.toLowerCase().includes((user?.name ?? "").toLowerCase()))
        ?? null;
      if (match) {
        setSetterIds(p => ({ ...p, aircallUserId: String(match.id) }));
        toast.success(`Matched: ${match.name} (${match.email ?? "no email"}) — ID ${match.id}`);
      } else {
        toast.info(`No auto-match. Available: ${users.map(u => `${u.name}: ${u.id}`).join(" | ")}`);
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to fetch."); }
    finally { setFetchingAircallUserId(false); }
  };

  const handleFetchIclosedUserId = async () => {
    // Only block if global settings are readable (admin) AND both the global key and personal key are missing.
    // Setters can't read global_settings due to RLS — trust the edge function in that case.
    const globalIclosedKey = globalSettings.find(s => s.key === "iclosed_api_key")?.value;
    if (globalSettings.length > 0 && !globalIclosedKey && !setterIds.iclosedApiKey.trim()) {
      toast.error("iClosed not configured", { description: "Ask your admin to set the global iClosed API key in Settings → API Keys, or enter your personal iClosed API key above." });
      return;
    }
    setFetchingUserId(true);
    try {
      const { data, error } = await supabase.functions.invoke("iclosed-lookup", {
        body: { baseUrl: setterIds.iclosedApiBaseUrl?.trim() || globalSettings.find(s => s.key === "iclosed_api_base_url")?.value || null },
      });
      if (error) {
        const ctx = error as { context?: { json?: () => Promise<{ error?: string }> } };
        const body = await ctx.context?.json?.().catch(() => null);
        throw new Error((body as { error?: string })?.error ?? error.message);
      }
      const result = data as { users?: Array<{ id: number; name?: string; firstName?: string; lastName?: string; email?: string | null }>; source?: string; message?: string; hint?: string };
      const users = result?.users ?? [];
      if (!users.length) { toast.error(result?.message ?? "No users found.", result?.hint ? { description: result.hint } : undefined); return; }
      const match = users.find(u => u.email === setterIds.iclosedEmail) ?? users.find(u => u.email === session?.user?.email) ?? users[0];
      const dname = match.name ?? `${match.firstName ?? ""} ${match.lastName ?? ""}`.trim();
      setSetterIds(p => ({ ...p, iclosedUserId: String(match.id) }));
      toast.success(`Matched: ${dname || "User"} — ID ${match.id}${result?.source === "eventCalls" ? " (via event calls)" : ""}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to fetch."); }
    finally { setFetchingUserId(false); }
  };

  const handleVerifyCredentials = async () => {
    setVerifying(true);
    setVerifyResults(null);
    const results: VerifyResult[] = [];

    // ── Verify Aircall ────────────────────────────────────────────────────────
    try {
      const { data, error } = await supabase.functions.invoke("aircall-lookup");
      if (error) throw new Error(error.message);
      const users = ((data as { users?: Array<{ id: number | string; name: string }> })?.users ?? []);
      const savedId = setterIds.aircallUserId.trim();
      if (!savedId) {
        results.push({ ok: false, label: "Aircall", detail: "No user ID saved yet." });
      } else {
        const match = users.find(u => String(u.id) === savedId);
        if (match) {
          results.push({ ok: true, label: "Aircall", detail: `User confirmed: ${match.name} (ID ${match.id})` });
        } else {
          results.push({ ok: false, label: "Aircall", detail: `ID ${savedId} not found in your Aircall account. Available: ${users.map(u => u.id).join(", ")}` });
        }
      }
    } catch (e) {
      results.push({ ok: false, label: "Aircall", detail: e instanceof Error ? e.message : "Connection failed" });
    }

    // ── Verify iClosed ────────────────────────────────────────────────────────
    try {
      const { data, error } = await supabase.functions.invoke("iclosed-lookup", {
        body: { baseUrl: setterIds.iclosedApiBaseUrl?.trim() || globalSettings.find(s => s.key === "iclosed_api_base_url")?.value || null },
      });
      if (error) throw new Error(error.message);
      const users = ((data as { users?: Array<{ id: number | string; name?: string }> })?.users ?? []);
      const savedId = setterIds.iclosedUserId.trim();
      if (!savedId) {
        results.push({ ok: false, label: "iClosed", detail: "No user ID saved yet." });
      } else {
        const match = users.find(u => String(u.id) === savedId);
        if (match) {
          results.push({ ok: true, label: "iClosed", detail: `User confirmed: ${match.name ?? "User"} (ID ${match.id})` });
        } else if (users.length === 0) {
          results.push({ ok: false, label: "iClosed", detail: "Could not fetch users — check your iClosed API key." });
        } else {
          results.push({ ok: false, label: "iClosed", detail: `ID ${savedId} not found. Available: ${users.map(u => u.id).join(", ")}` });
        }
      }
    } catch (e) {
      results.push({ ok: false, label: "iClosed", detail: e instanceof Error ? e.message : "Connection failed" });
    }

    setVerifyResults(results);
    setVerifying(false);

    const allOk = results.every(r => r.ok);
    if (allOk) toast.success("All credentials verified ✓");
    else toast.warning("Some credentials could not be verified — see details below.");
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
        iclosedApiKey: setterIds.iclosedApiKey.trim() || null,
        iclosedApiBaseUrl: setterIds.iclosedApiBaseUrl.trim() || null,
        notes: myMapping?.notes ?? null,
      },
      {
        onSuccess: () => toast.success(t("settings.myIntegrationsSaved")),
        onError: e => toast.error(e.message),
        onSettled: () => setSavingSetterIds(false),
      },
    );
  };

  const handleSaveFathomKey = () => {
    if (!user) return;
    setSavingFathom(true);
    updateFathomKey.mutate(
      { profileId: user.id, apiKey: fathomKey.trim() },
      { onSuccess: () => toast.success(t("settings.fathomSaved")), onError: e => toast.error(e.message), onSettled: () => setSavingFathom(false) }
    );
  };

  const handleSaveName = async () => {
    if (!user || !displayName.trim()) return;
    setSavingName(true);
    updateProfile.mutate(
      { id: user.id, name: displayName.trim(), role: user.role },
      {
        onSuccess: async () => { await refreshProfile(); toast.success(t("settings.nameUpdated")); },
        onError: e => toast.error(e.message),
        onSettled: () => setSavingName(false),
      }
    );
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8)   { toast.error(t("settings.errorLength")); return; }
    if (newPw !== confirmPw) { toast.error(t("settings.errorMatch"));  return; }
    if (newPw === currentPw) { toast.error(t("settings.errorSame"));   return; }
    setSavingPw(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: session?.user?.email ?? "", password: currentPw });
    if (authError) { toast.error(t("settings.errorCurrent")); setSavingPw(false); return; }
    const { error: updErr } = await supabase.auth.updateUser({ password: newPw });
    if (updErr) toast.error(updErr.message);
    else { toast.success(t("settings.success")); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }
    setSavingPw(false);
  };

  const handleThemeToggle = (dark: boolean) => { setIsDark(dark); applyTheme(dark ? "dark" : "light"); };
  const handleSignOutAll  = async () => { await supabase.auth.signOut({ scope: "global" }); logout(); };

  // Avatar initials + color
  const initials = (user?.name ?? "").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  const avatarColors: Record<string, string> = {
    admin: "bg-primary/15 text-primary", closer: "bg-emerald-500/15 text-emerald-600", setter: "bg-amber-500/15 text-amber-600",
  };

  const fieldClass = "h-9 rounded-lg border border-border/40 bg-muted/20 text-sm px-3 focus-visible:ring-primary/20";
  const btnClass   = "h-9 rounded-lg text-xs font-medium";

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">

        {/* Header */}
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("settings.subtitle")}</p>
          <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
        </div>

        <Tabs defaultValue={initialTab} className="space-y-6">
          <TabsList className="bg-muted/40 border border-border/40 p-1 rounded-lg flex w-fit h-auto gap-1">
            {([
              { value: "profile",     icon: UserCircle, label: t("settings.tab.profile")      },
              { value: "security",    icon: Shield,     label: t("settings.tab.security")     },
              { value: "preferences", icon: Sliders,    label: t("settings.tab.preferences")  },
              { value: "apikeys",     icon: KeyRound,   label: t("settings.tab.apiKeys")      },
            ] as const).map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary">
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Profile ── */}
          <TabsContent value="profile">
            <div className="grid gap-4 lg:grid-cols-5">
              {/* Avatar card */}
              <div className="lg:col-span-2 rounded-xl border border-border/40 bg-background p-6 flex flex-col items-center justify-center gap-4">
                {user && (
                  <>
                    <div className={cn("h-16 w-16 rounded-xl flex items-center justify-center text-xl font-semibold", avatarColors[user.role] ?? avatarColors.admin)}>
                      {initials}
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-sm">{user.name}</p>
                      <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium mt-1", avatarColors[user.role] ?? avatarColors.admin)}>
                        {t(`role.${user.role}`)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{session?.user?.email}</p>
                  </>
                )}
              </div>

              {/* Edit profile */}
              <SectionCard title={t("settings.profile")} icon={UserCircle} className="lg:col-span-3">
                <div className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="displayName" className="text-[11px] text-muted-foreground">{t("settings.name")}</Label>
                    <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} className={fieldClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">{t("settings.email")}</Label>
                    <Input value={session?.user?.email ?? ""} disabled className={cn(fieldClass, "opacity-50 cursor-not-allowed")} />
                  </div>
                  <Button onClick={handleSaveName} disabled={savingName || !displayName.trim() || displayName.trim() === user?.name} className={btnClass}>
                    {savingName ? <CheckCircle2 className="h-3.5 w-3.5 animate-pulse mr-1.5" /> : null}
                    {savingName ? t("common.loading") : t("settings.saveName")}
                  </Button>
                </div>
              </SectionCard>
            </div>
          </TabsContent>

          {/* ── Security ── */}
          <TabsContent value="security">
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title={t("settings.changePassword")} icon={Shield}>
                <form onSubmit={handleSavePassword} className="p-4 space-y-4">
                  {[
                    { id: "currentPw", label: t("settings.currentPassword"), value: currentPw, set: setCurrentPw, ac: "current-password" },
                    { id: "newPw",     label: t("settings.newPassword"),     value: newPw,     set: setNewPw,     ac: "new-password" },
                    { id: "confirmPw", label: t("settings.confirmPassword"), value: confirmPw, set: setConfirmPw, ac: "new-password" },
                  ].map(f => (
                    <div key={f.id} className="space-y-1.5">
                      <Label htmlFor={f.id} className="text-[11px] text-muted-foreground">{f.label}</Label>
                      <Input id={f.id} type="password" value={f.value} onChange={e => f.set(e.target.value)}
                        className={fieldClass} required autoComplete={f.ac} />
                      {f.id === "newPw" && <PasswordStrengthBar password={newPw} t={t} />}
                    </div>
                  ))}
                  <Button type="submit" disabled={savingPw} className={btnClass}>
                    {savingPw ? t("common.loading") : t("settings.savePassword")}
                  </Button>
                </form>
              </SectionCard>

              {/* Danger zone */}
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-rose-500/15">
                  <AlertCircle className="h-4 w-4 text-rose-500" />
                  <p className="text-sm font-medium text-rose-600">{t("settings.dangerZone")}</p>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-sm font-medium">{t("settings.signOutAll")}</p>
                  <p className="text-[11px] text-muted-foreground">{t("settings.signOutAllDesc")}</p>
                  <Button variant="outline" onClick={handleSignOutAll}
                    className="rounded-lg h-9 text-xs border-rose-500/30 text-rose-600 hover:bg-rose-500 hover:text-white hover:border-rose-500">
                    <LogOut className="h-3.5 w-3.5 mr-1.5" />
                    {t("settings.signOutAll")}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Preferences ── */}
          <TabsContent value="preferences">
            <SectionCard title={t("settings.tab.preferences")} icon={Sliders}>
              <div className="divide-y divide-border/30">
                {/* Dark mode */}
                <div className="flex items-center justify-between px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground">
                      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t("settings.darkMode")}</p>
                      <p className="text-[11px] text-muted-foreground">{t("settings.darkModeDesc")}</p>
                    </div>
                  </div>
                  <Toggle checked={isDark} onChange={handleThemeToggle} />
                </div>

                {/* Language */}
                <div className="flex items-center justify-between px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t("settings.language")}</p>
                      <p className="text-[11px] text-muted-foreground">{t("settings.languageDesc")}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 bg-muted/40 p-1 rounded-lg">
                    {(["fr", "en"] as const).map(lang => (
                      <button key={lang} onClick={() => setLocale(lang)}
                        className={cn("px-3 py-1 rounded-md text-xs font-medium transition-all uppercase",
                          locale === lang ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}>{lang}</button>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          </TabsContent>

          {/* ── API Keys ── */}
          <TabsContent value="apikeys">
            <SectionCard title={t("settings.apiKeysTitle")} icon={KeyRound} collapsible>
              <div>
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                  <p className="text-[11px] text-muted-foreground">{t("settings.apiKeysDesc")}</p>
                  {isSetter && (
                    <button
                      onClick={handleVerifyCredentials}
                      disabled={verifying}
                      className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      <Activity className={cn("h-3.5 w-3.5", verifying && "animate-pulse")} />
                      {verifying ? "Verifying…" : "Verify credentials"}
                    </button>
                  )}
                </div>

                {/* Verification results */}
                {verifyResults && isSetter && (
                  <div className="mx-4 mb-3 rounded-lg border border-border/40 overflow-hidden">
                    {verifyResults.map(r => (
                      <div key={r.label} className={cn(
                        "flex items-start gap-2.5 px-3 py-2.5 border-b last:border-0 border-border/20",
                        r.ok ? "bg-emerald-500/5" : "bg-rose-500/5"
                      )}>
                        {r.ok
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          : <XCircle     className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />}
                        <div>
                          <p className="text-xs font-medium">{r.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{r.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Fathom — admins & closers */}
                {!isSetter && (
                  <IntegrationRow color="blue" name="Fathom" description={t("settings.fathomDesc")} connected={!!fathomKey} t={t}>
                    <div className="space-y-1.5">
                      <Label htmlFor="fathomKey" className="text-[11px] text-muted-foreground">{t("settings.fathomKey")}</Label>
                      <div className="relative">
                        <Input id="fathomKey" type={showFathomKey ? "text" : "password"} value={fathomKey}
                          onChange={e => setFathomKey(e.target.value)} placeholder={t("settings.fathomPlaceholder")}
                          className={cn(fieldClass, "pr-10 font-mono")} autoComplete="off" />
                        <button type="button" onClick={() => setShowFathomKey(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showFathomKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground/50">{t("settings.fathomHint")}</p>
                    </div>
                    <Button onClick={handleSaveFathomKey} disabled={savingFathom} className={btnClass}>
                      {savingFathom ? t("common.loading") : t("settings.fathomSave")}
                    </Button>
                  </IntegrationRow>
                )}

                {/* Aircall — setters */}
                {isSetter && (
                  <IntegrationRow color="violet" name="Aircall"
                    description="Connect your Aircall account to sync call volume and talk time."
                    connected={!!setterIds.aircallUserId} t={t}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="aircallUserId" className="text-[11px] text-muted-foreground">{t("settings.aircallUserId")}</Label>
                        <div className="flex gap-2">
                          <Input id="aircallUserId" value={setterIds.aircallUserId} placeholder="e.g. 123456"
                            onChange={e => setSetterIds(p => ({ ...p, aircallUserId: e.target.value }))}
                            className={cn(fieldClass, "font-mono flex-1")} autoComplete="off" />
                          <Button type="button" variant="outline" disabled={fetchingAircallUserId}
                            onClick={handleFetchAircallUserId} className="h-9 rounded-lg text-xs px-3 border-border/60">
                            {fetchingAircallUserId ? "…" : "Fetch"}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="aircallEmail" className="text-[11px] text-muted-foreground">{t("settings.aircallEmail")}</Label>
                        <Input id="aircallEmail" type="email" value={setterIds.aircallEmail} placeholder="you@company.com"
                          onChange={e => setSetterIds(p => ({ ...p, aircallEmail: e.target.value }))}
                          className={fieldClass} autoComplete="off" />
                      </div>
                    </div>
                    <Button onClick={handleSaveSetterIds} disabled={savingSetterIds} className={btnClass}>
                      {savingSetterIds ? t("common.loading") : t("settings.saveMapping")}
                    </Button>
                  </IntegrationRow>
                )}

                {/* iClosed — setters */}
                {isSetter && (
                  <IntegrationRow color="amber" name="iClosed"
                    description="Connect your iClosed account to sync leads, show-ups, and closes. The API credentials are managed by your admin."
                    connected={!!setterIds.iclosedUserId} t={t}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="iclosedUserId" className="text-[11px] text-muted-foreground">{t("settings.iclosedUserId")}</Label>
                        <div className="flex gap-2">
                          <Input id="iclosedUserId" value={setterIds.iclosedUserId} placeholder="e.g. 987654"
                            onChange={e => setSetterIds(p => ({ ...p, iclosedUserId: e.target.value }))}
                            className={cn(fieldClass, "font-mono flex-1")} autoComplete="off" />
                          <Button type="button" variant="outline" disabled={fetchingUserId}
                            onClick={handleFetchIclosedUserId} className="h-9 rounded-lg text-xs px-3 border-border/60">
                            {fetchingUserId ? "…" : "Fetch"}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="iclosedEmail" className="text-[11px] text-muted-foreground">{t("settings.iclosedEmail")}</Label>
                        <Input id="iclosedEmail" type="email" value={setterIds.iclosedEmail} placeholder="you@company.com"
                          onChange={e => setSetterIds(p => ({ ...p, iclosedEmail: e.target.value }))}
                          className={fieldClass} autoComplete="off" />
                      </div>
                    </div>
                    <Button onClick={handleSaveSetterIds} disabled={savingSetterIds} className={btnClass}>
                      {savingSetterIds ? t("common.loading") : t("settings.saveMapping")}
                    </Button>
                  </IntegrationRow>
                )}
              </div>
            </SectionCard>

            {user?.role === "admin" && (
              <div className="mt-4 space-y-4">
                <GlobalIntegrationSettings />
                <AutoSyncStatus />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
