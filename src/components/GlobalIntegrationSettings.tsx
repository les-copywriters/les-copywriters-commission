import { useState } from "react";
import { useGlobalSettings, useUpdateGlobalSetting } from "@/hooks/useGlobalSettings";
import { useLanguage } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Save, GlobeLock, CheckCircle2, XCircle, RefreshCw, Activity, CloudCog, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase as supabaseClient } from "@/lib/supabase";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useSyncJotform } from "@/hooks/useSyncJotform";
import { useCommissionHealthReport } from "@/hooks/useCommissionHealthReport";

const EXPECTED_KEYS = [
  { key: 'aircall_api_id', label: 'Global Aircall API ID', secret: false },
  { key: 'aircall_api_token', label: 'Global Aircall API Token', secret: true },
  { key: 'iclosed_api_key', label: 'Global iClosed API Key', secret: true },
  { key: 'iclosed_api_base_url', label: 'Global iClosed API Base URL', secret: false },
  { key: 'jotform_api_key', label: 'Global Jotform API Key', secret: true },
  { key: 'jotform_form_id', label: 'Global Jotform Form ID', secret: false },
  { key: 'closer_commission_rate', label: 'Closer Commission Rate (default 0.088 = 8.8%)', secret: false },
  { key: 'setter_commission_rate', label: 'Setter Commission Rate (default 0.01 = 1.0%)', secret: false },
];

const GlobalIntegrationSettings = () => {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const { data: settings = [], isLoading } = useGlobalSettings();
  const updateSetting = useUpdateGlobalSetting();
  const syncJotform = useSyncJotform();
  
  const syncDashboard = useMutation({
    mutationFn: async (payload: { source: string }) => {
      const { data, error } = await supabaseClient.functions.invoke("sync-setter-dashboard", {
        body: payload
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(t("settings.setterSyncTriggered"));
      refetchSyncStatus();
    },
    onError: (err) => toast.error(err.message),
  });
  
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; status?: number; error?: string }> | null>(null);

  const handleToggleShow = (key: string) => {
    setShowValues(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Fetch last sync runs
  const { data: syncStatus, refetch: refetchSyncStatus } = useQuery({
    queryKey: ["global_sync_status"],
    queryFn: async () => {
      const { data } = await supabaseClient
        .from("integration_sync_runs")
        .select("id, service, source, status, finished_at, rows_written, started_at, errors")
        .order("started_at", { ascending: false })
        .limit(10);

      type SyncRun = NonNullable<typeof data>[number];
      const latest: Record<string, SyncRun> = {};
      data?.forEach(run => {
        const key = run.service || run.source;
        if (!latest[key]) latest[key] = run;
      });
      return { latest, all: data ?? [] };
    }
  });

  const handleTestConnections = async () => {
    setTesting(true);
    setTestResults(null);
    try {
      const { data, error } = await supabaseClient.functions.invoke("sync-setter-dashboard", {
        body: { validate_only: true }
      });
      if (error) throw error;
      setTestResults(data.results);
      if (data.ok) toast.success("Connection test completed");
    } catch (err) {
      toast.error("Failed to test connections: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = (key: string) => {
    const value = localValues[key] ?? settings.find(s => s.key === key)?.value;
    const config = EXPECTED_KEYS.find(k => k.key === key);

    // Validation for commission rates
    if (key === 'closer_commission_rate' || key === 'setter_commission_rate') {
      const numValue = parseFloat(value ?? "0");
      if (numValue > 1) {
        toast.error(`Invalid rate for ${config?.label}`, { 
          description: "Commission rates must be decimals (e.g., 0.088 for 8.8%). Values > 1 are not allowed." 
        });
        return;
      }
    }
    
    updateSetting.mutate(
      { 
        key, 
        value: value === "" ? null : value,
        description: config?.label,
        is_secret: config?.secret
      },
      {
        onSuccess: () => {
          toast.success(`Global setting updated`);
          setLocalValues((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };


  if (isLoading) {
    return (
      <div className="mt-6 h-[400px] w-full rounded-[2.5rem] bg-muted/10 animate-pulse border border-border/20 flex flex-col p-8 space-y-8">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-2xl bg-muted/20" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-muted/20 rounded" />
            <div className="h-3 w-48 bg-muted/20 rounded" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-24 rounded-[2rem] bg-muted/10" />
          <div className="h-24 rounded-[2rem] bg-muted/10" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-20 rounded-3xl bg-muted/10" />
          <div className="h-20 rounded-3xl bg-muted/10" />
        </div>
      </div>
    );
  }

  return (
    <Card className="border-none shadow-premium rounded-[2.5rem] bg-background overflow-hidden mt-6">
      <div className="p-8 border-b border-border/40 bg-muted/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GlobeLock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight">Global Integrations</h3>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Master API Credentials</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-10 rounded-xl font-bold gap-2 border-border/40 hover:bg-primary/5 transition-all text-xs"
            disabled={testing}
            onClick={handleTestConnections}
          >
            <Activity className={cn("h-3.5 w-3.5", testing && "animate-pulse")} />
            {testing ? "Test API Keys" : "Test API Keys"}
          </Button>
          <Button 
            size="sm" 
            variant="secondary"
            className="h-10 rounded-xl font-black gap-2 shadow-lg shadow-secondary/20 transition-all hover:scale-[1.02] active:scale-95 text-xs uppercase tracking-widest"
            disabled={syncJotform.isPending}
            onClick={() => syncJotform.mutate(undefined, {
              onSuccess: (res) => {
                toast.success(`Jotform Sync Success`, { description: `Imported ${res.imported} sales, updated ${res.updated}.` });
              },
              onError: (err) => toast.error(`Jotform Sync Error: ${err.message}`)
            })}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncJotform.isPending && "animate-spin")} />
            {syncJotform.isPending ? "Syncing..." : "Sync Jotform"}
          </Button>
          <Button 
            size="sm" 
            className="h-10 rounded-xl font-black gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 text-xs uppercase tracking-widest"
            disabled={syncDashboard.isPending}
            onClick={() => syncDashboard.mutate({ source: "all" })}
          >
            <CloudCog className={cn("h-3.5 w-3.5", syncDashboard.isPending && "animate-spin")} />
            {syncDashboard.isPending ? "Syncing..." : "Sync Aircall + iClosed"}
          </Button>
        </div>
      </div>

      <CardContent className="p-8 space-y-8">
        <div className="grid gap-8 md:grid-cols-2">
          {EXPECTED_KEYS.map((config) => {
            const dbSetting = settings.find(s => s.key === config.key);
            const value = localValues[config.key] ?? dbSetting?.value ?? (config.key === 'iclosed_api_base_url' && !dbSetting?.value ? 'https://api.iclosed.io/v1' : '');
            
            return (
              <div key={config.key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor={config.key} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                    {config.label}
                  </Label>
                  {config.secret && (
                    <button 
                      type="button" 
                      onClick={() => handleToggleShow(config.key)}
                      className="text-muted-foreground hover:text-primary transition-colors p-1"
                    >
                      {showValues[config.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    id={config.key}
                    type={config.secret && !showValues[config.key] ? "password" : "text"}
                    value={value}
                    onChange={(e) => setLocalValues((prev) => ({ ...prev, [config.key]: e.target.value }))}
                    placeholder={config.secret ? "••••••••••••••••" : `Enter ${config.label.toLowerCase()}...`}
                    className="h-12 rounded-2xl border-2 border-border/40 bg-muted/20 focus-visible:ring-primary/20 focus-visible:border-primary font-mono text-sm px-5 transition-all placeholder:text-muted-foreground/50"
                  />
                  <Button 
                    size="icon" 
                    className="h-12 w-12 rounded-2xl shrink-0 shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                    disabled={localValues[config.key] === undefined || updateSetting.isPending}
                    onClick={() => handleSave(config.key)}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Connection test results */}
      {testResults && (
        <div className="px-8 pb-4 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" /> Connection Test Results
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(testResults).map(([source, result]) => (
              <div
                key={source}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border px-4 py-3",
                  result.ok
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-rose-500/20 bg-rose-500/5",
                )}
              >
                {result.ok
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  : <XCircle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-black uppercase tracking-widest">{source}</p>
                  {result.error && (
                    <p className="text-[11px] text-rose-500 font-medium mt-0.5 line-clamp-2">{result.error}</p>
                  )}
                  {result.status && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">HTTP {result.status}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sync run history */}
      {syncStatus && Object.keys(syncStatus.latest).length > 0 && (
        <div className="px-8 pb-8 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <History className="h-3.5 w-3.5" /> Last Sync Run Per Integration
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {["jotform", "aircall", "iclosed"].map((src) => {
              const run = syncStatus.latest[src];
              if (!run) return (
                <div key={src} className="rounded-2xl border border-border/30 bg-muted/10 px-4 py-3">
                  <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/50">{src}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 italic">No run recorded</p>
                </div>
              );

              const ageMs = run.started_at ? Date.now() - new Date(run.started_at).getTime() : null;
              const ageMin = ageMs !== null ? Math.floor(ageMs / 60000) : null;
              const ageLabel = ageMin === null ? "—"
                : ageMin < 1 ? "just now"
                : ageMin < 60 ? `${ageMin}m ago`
                : ageMin < 1440 ? `${Math.floor(ageMin / 60)}h ago`
                : `${Math.floor(ageMin / 1440)}d ago`;

              const isStale = ageMin !== null && ageMin > 360;
              const isError = run.status === "error" || run.status === "partial";
              const tone = isError || isStale ? "rose" : "emerald";
              const firstError = Array.isArray(run.errors) ? (run.errors as string[])[0] : null;

              return (
                <div
                  key={src}
                  className={cn(
                    "rounded-2xl border px-4 py-3 space-y-2",
                    tone === "rose" ? "border-rose-500/20 bg-rose-500/5" : "border-emerald-500/20 bg-emerald-500/5",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black uppercase tracking-widest">{src}</p>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                      tone === "rose" ? "border-rose-500/30 text-rose-600 bg-rose-500/10" : "border-emerald-500/30 text-emerald-600 bg-emerald-500/10",
                    )}>
                      {run.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {ageLabel} · {run.rows_written ?? 0} rows written
                  </p>
                  {firstError && (
                    <p className="text-[11px] text-rose-500 font-medium leading-tight line-clamp-2">{firstError}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};

export default GlobalIntegrationSettings;
