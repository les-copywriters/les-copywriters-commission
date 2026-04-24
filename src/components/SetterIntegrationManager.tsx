import { useMemo, useState } from "react";
import { useProfiles } from "@/hooks/useProfiles";
import {
  useSetterIntegrationMappings,
  useSetterSyncHealth,
  useSyncSetterDashboard,
  useUpsertSetterIntegrationMapping,
} from "@/hooks/useSetterDashboard";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import { useLanguage } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Activity, CloudCog, RefreshCcw, Save, ShieldCheck } from "lucide-react";

const emptyForm = {
  aircallUserId: "",
  aircallEmail: "",
  pipedriveOwnerId: "",
  pipedriveEmail: "",
  iclosedUserId: "",
  iclosedEmail: "",
  notes: "",
};

const SetterIntegrationManager = () => {
  const { t } = useLanguage();
  const { data: profiles = [], isLoading: isLoadingProfiles } = useProfiles();
  const { data: mappings = [], isLoading: isLoadingMappings } = useSetterIntegrationMappings();
  const { data: syncRuns = [], isLoading: isLoadingSync } = useSetterSyncHealth();
  const { data: globalSettings = [], isLoading: isLoadingSettings } = useGlobalSettings();
  const upsertMapping = useUpsertSetterIntegrationMapping();
  const syncDashboard = useSyncSetterDashboard();

  const setters = useMemo(() => profiles.filter((profile) => profile.role === "setter"), [profiles]);
  const [selectedSetterId, setSelectedSetterId] = useState<string>("");
  const selectedMapping = mappings.find((mapping) => mapping.profileId === selectedSetterId);
  const [form, setForm] = useState(emptyForm);
  const [fetchingAircallUser, setFetchingAircallUser] = useState(false);

  const handleFetchAircallUserId = async () => {
    if (!selectedSetterId) return;
    setFetchingAircallUser(true);
    try {
      const { data, error } = await supabase.functions.invoke("aircall-lookup");
      if (error) {
        const ctx = error as { context?: { json?: () => Promise<{ error?: string }> } };
        const body = await ctx.context?.json?.().catch(() => null);
        throw new Error((body as { error?: string })?.error ?? error.message);
      }
      const users = ((data as { users?: Array<{ id: number; name: string; email: string | null }> })?.users ?? []);
      if (!users.length) { toast.error("No users found in your Aircall account."); return; }

      const setter = profiles.find(p => p.id === selectedSetterId);
      const match =
        users.find(u => u.email && u.email === form.aircallEmail) ??
        users.find(u => u.name.toLowerCase().includes((setter?.name ?? "").toLowerCase())) ??
        null;

      if (match) {
        setForm(c => ({ ...c, aircallUserId: String(match.id) }));
        toast.success(`Matched: ${match.name} (${match.email ?? "no email"}) — ID ${match.id}`);
      } else {
        const list = users.map(u => `${u.name}: ${u.id}`).join(" | ");
        toast.info(`No auto-match found. Available users — ${list}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to fetch Aircall users.");
    } finally {
      setFetchingAircallUser(false);
    }
  };

  const hydrateForm = (setterId: string) => {
    const next = mappings.find((mapping) => mapping.profileId === setterId);
    setSelectedSetterId(setterId);
    
    const hasGlobalAircall = globalSettings.some(s => s.key === 'aircall_api_id' && s.value) && 
                            globalSettings.some(s => s.key === 'aircall_api_token' && s.value);
    const hasGlobalIclosed = globalSettings.some(s => s.key === 'iclosed_api_key' && s.value);

    setForm(next ? {
      aircallUserId: next.aircallUserId ?? "",
      aircallEmail: next.aircallEmail ?? "",
      pipedriveOwnerId: next.pipedriveOwnerId ?? "",
      pipedriveEmail: next.pipedriveEmail ?? "",
      iclosedUserId: next.iclosedUserId ?? "",
      iclosedEmail: next.iclosedEmail ?? "",
      notes: next.notes ?? "",
    } : emptyForm);
  };

  const latestRuns = syncRuns.slice(0, 4);

  const isDataLoading = isLoadingProfiles || isLoadingMappings || isLoadingSync || isLoadingSettings;

  if (isDataLoading && !selectedSetterId) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-[280px] w-full rounded-[2rem] bg-slate-900/40" />
        <div className="h-[300px] w-full rounded-[2rem] bg-muted/10" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-none rounded-[2rem] bg-gradient-to-br from-[#0d1725] via-[#13243a] to-[#1d2f43] text-white shadow-2xl shadow-slate-900/20 overflow-hidden">
        <CardContent className="p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Setter Integrations
              </div>
              <h3 className="text-2xl font-black tracking-tight">{t("settings.setterMapTitle")}</h3>
              <p className="max-w-2xl text-sm text-white/70">{t("settings.setterMapDesc")}</p>
            </div>
            <Button
              className="rounded-2xl bg-amber-400 text-slate-950 hover:bg-amber-300 font-black uppercase tracking-widest"
              onClick={() => syncDashboard.mutate(
                { source: "all" },
                {
                  onSuccess: () => toast.success(t("settings.setterSyncTriggered")),
                  onError: (error) => toast.error(error.message),
                },
              )}
              disabled={syncDashboard.isPending}
            >
              <CloudCog className="h-4 w-4 mr-2" />
              {syncDashboard.isPending ? t("settings.syncing") : t("settings.runSync")}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {latestRuns.map((run) => (
              <div key={run.id} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">{run.source}</p>
                  <Badge className="rounded-full border-none bg-white/10 text-white capitalize">{run.status}</Badge>
                </div>
                <p className="mt-4 text-2xl font-black">{run.rowsWritten}</p>
                <p className="mt-1 text-xs text-white/60">{t("settings.rowsWritten")}</p>
                <p className="mt-3 text-xs text-white/60">{new Date(run.startedAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm rounded-[2rem]">
        <CardContent className="p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="space-y-2 flex-1">
              <Label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{t("settings.chooseSetter")}</Label>
              <Select value={selectedSetterId} onValueChange={hydrateForm}>
                <SelectTrigger className="h-12 rounded-2xl">
                  <SelectValue placeholder={t("settings.chooseSetterPlaceholder")} />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {setters.map((setter) => (
                    <SelectItem key={setter.id} value={setter.id}>{setter.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-[1.5rem] border border-border/60 bg-muted/20 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{t("settings.lastUpdated")}</p>
              <p className="mt-1 text-sm font-bold">{selectedMapping?.updatedAt ? new Date(selectedMapping.updatedAt).toLocaleString() : t("settings.notConfigured")}</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Aircall */}
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/60">Aircall & iClosed Identification</p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-[10px] font-black uppercase tracking-widest ml-1">{t("settings.aircallUserId")}</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.aircallUserId}
                      onChange={(e) => setForm((c) => ({ ...c, aircallUserId: e.target.value }))}
                      className="h-12 rounded-2xl border-2 border-border/40 bg-muted/20 focus-visible:border-primary font-mono text-sm px-5 transition-all placeholder:text-muted-foreground/50"
                      placeholder="e.g. 123456"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-12 rounded-2xl px-4 shrink-0 font-black uppercase tracking-widest text-[10px] border-border/60"
                      disabled={!selectedSetterId || fetchingAircallUser}
                      onClick={handleFetchAircallUserId}
                    >
                      {fetchingAircallUser ? "..." : "Fetch"}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-[10px] font-black uppercase tracking-widest ml-1">{t("settings.iclosedUserId")}</Label>
                  <Input 
                    value={form.iclosedUserId} 
                    onChange={(e) => setForm((c) => ({ ...c, iclosedUserId: e.target.value }))} 
                    className="h-12 rounded-2xl border-2 border-border/40 bg-muted/20 focus-visible:border-primary font-mono text-sm px-5 transition-all placeholder:text-muted-foreground/50" 
                    placeholder="e.g. 987654" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-[10px] font-black uppercase tracking-widest ml-1">{t("settings.aircallEmail")}</Label>
                  <Input 
                    value={form.aircallEmail} 
                    onChange={(e) => setForm((c) => ({ ...c, aircallEmail: e.target.value }))} 
                    className="h-12 rounded-2xl border-2 border-border/40 bg-muted/20 focus-visible:border-primary text-sm px-5 transition-all placeholder:text-muted-foreground/50" 
                    placeholder="you@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-[10px] font-black uppercase tracking-widest ml-1">{t("settings.iclosedEmail")}</Label>
                  <Input 
                    value={form.iclosedEmail} 
                    onChange={(e) => setForm((c) => ({ ...c, iclosedEmail: e.target.value }))} 
                    className="h-12 rounded-2xl border-2 border-border/40 bg-muted/20 focus-visible:border-primary text-sm px-5 transition-all placeholder:text-muted-foreground/50" 
                    placeholder="you@company.com"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-[10px] font-black uppercase tracking-widest ml-1">{t("settings.mappingNotes")}</Label>
            <Input 
              value={form.notes} 
              onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} 
              className="h-12 rounded-2xl border-2 border-border/40 bg-muted/20 focus-visible:border-primary transition-all placeholder:text-muted-foreground/50" 
              placeholder="Internal notes..."
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!selectedSetterId || upsertMapping.isPending}
              className="rounded-2xl font-black uppercase tracking-widest"
              onClick={() => upsertMapping.mutate(
                {
                  profileId: selectedSetterId,
                  aircallUserId: form.aircallUserId || null,
                  aircallEmail: form.aircallEmail || null,
                  pipedriveOwnerId: form.pipedriveOwnerId || null,
                  pipedriveEmail: form.pipedriveEmail || null,
                  iclosedUserId: form.iclosedUserId || null,
                  iclosedEmail: form.iclosedEmail || null,
                  notes: form.notes || null,
                },
                {
                  onSuccess: () => toast.success(t("settings.setterMapSaved")),
                  onError: (error) => toast.error(error.message),
                },
              )}
            >
              <Save className="h-4 w-4 mr-2" />
              {t("settings.saveMapping")}
            </Button>
            <Button
              variant="outline"
              disabled={!selectedSetterId || syncDashboard.isPending}
              className="rounded-2xl font-black uppercase tracking-widest"
              onClick={() => syncDashboard.mutate(
                { source: "all", profileId: selectedSetterId },
                {
                  onSuccess: () => toast.success(t("settings.setterSyncTriggered")),
                  onError: (error) => toast.error(error.message),
                },
              )}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              {t("settings.syncSetterOnly")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm rounded-[2rem]">
        <CardContent className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">{t("settings.syncHealthTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("settings.syncHealthDesc")}</p>
            </div>
          </div>
          <div className="space-y-3">
            {syncRuns.map((run) => (
              <div key={run.id} className="flex flex-col gap-2 rounded-[1.5rem] border border-border/50 bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">{run.source}</p>
                  <p className="mt-1 text-sm font-bold">{new Date(run.startedAt).toLocaleString()}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {run.recordsSeen} {t("settings.recordsSeen")} • {run.rowsWritten} {t("settings.rowsWritten")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="rounded-full capitalize">{run.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetterIntegrationManager;
