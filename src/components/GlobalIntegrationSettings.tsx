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

const EXPECTED_KEYS = [
  { key: 'aircall_api_id', label: 'Global Aircall API ID', secret: false },
  { key: 'aircall_api_token', label: 'Global Aircall API Token', secret: true },
  { key: 'iclosed_api_key', label: 'Global iClosed API Key', secret: true },
  { key: 'iclosed_api_base_url', label: 'Global iClosed API Base URL', secret: false },
];

const GlobalIntegrationSettings = () => {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const { data: settings = [], isLoading } = useGlobalSettings();
  const updateSetting = useUpdateGlobalSetting();
  
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
        .select("id, service, source, status, finished_at, rows_written, started_at")
        .order("started_at", { ascending: false })
        .limit(10);
      
      const latest: Record<string, any> = {};
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
            className="h-10 rounded-xl font-black gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 text-xs uppercase tracking-widest"
            disabled={syncDashboard.isPending}
            onClick={() => syncDashboard.mutate({ source: "all" })}
          >
            <CloudCog className={cn("h-3.5 w-3.5", syncDashboard.isPending && "animate-spin")} />
            {syncDashboard.isPending ? "Syncing..." : "Run Full Sync"}
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
    </Card>
  );
};

export default GlobalIntegrationSettings;
