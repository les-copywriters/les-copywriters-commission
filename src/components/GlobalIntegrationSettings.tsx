import { useState } from "react";
import { useGlobalSettings, useUpdateGlobalSetting } from "@/hooks/useGlobalSettings";
import { useLanguage } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Save, GlobeLock, CheckCircle2, XCircle, RefreshCw, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase as supabaseClient } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const GlobalIntegrationSettings = () => {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const { data: settings = [], isLoading } = useGlobalSettings();
  const updateSetting = useUpdateGlobalSetting();
  
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; status?: number; error?: string }> | null>(null);

  const handleToggleShow = (key: string) => {
    setShowValues(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Fetch last sync status for global services
  const { data: syncStatus, refetch: refetchSyncStatus } = useQuery({
    queryKey: ["global_sync_status"],
    queryFn: async () => {
      const { data } = await supabaseClient
        .from("integration_sync_runs")
        .select("service, status, finished_at")
        .in("service", ["aircall", "iclosed"])
        .order("finished_at", { ascending: false });
      
      const latest: Record<string, any> = {};
      data?.forEach(run => {
        if (!latest[run.service]) latest[run.service] = run;
      });
      return latest;
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
    updateSetting.mutate(
      { key, value: value === "" ? null : value },
      {
        onSuccess: () => {
          toast.success(`Global setting "${key}" updated`);
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

  const handleInitialize = async () => {
    try {
      const defaults = [
        { key: 'aircall_api_id', description: 'Global Aircall API ID', is_secret: false },
        { key: 'aircall_api_token', description: 'Global Aircall API Token', is_secret: true },
        { key: 'iclosed_api_key', description: 'Global iClosed API Key', is_secret: true },
        { key: 'iclosed_api_base_url', description: 'Global iClosed API Base URL', is_secret: false, value: 'https://api.iclosed.io/v1' }
      ];

      for (const item of defaults) {
        await supabaseClient.from('global_settings').insert(item);
      }
      
      toast.success("Default settings initialized");
      qc.invalidateQueries({ queryKey: ["global_settings"] });
    } catch (err) {
      toast.error("Failed to initialize: " + (err instanceof Error ? err.message : String(err)));
    }
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
        <Button 
          variant="outline" 
          size="sm" 
          className="h-10 rounded-xl font-bold gap-2 border-border/40 hover:bg-primary/5 transition-all text-xs"
          disabled={testing}
          onClick={handleTestConnections}
        >
          <Activity className={cn("h-3.5 w-3.5", testing && "animate-pulse")} />
          {testing ? "Testing..." : "Test Connections"}
        </Button>
      </div>

      <CardContent className="p-8 space-y-6">
        {settings.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {settings.map((setting) => (
              <div key={setting.key} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor={setting.key} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                    {setting.description || setting.key}
                  </Label>
                  {setting.isSecret && (
                    <button 
                      type="button" 
                      onClick={() => handleToggleShow(setting.key)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showValues[setting.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    id={setting.key}
                    type={setting.isSecret && !showValues[setting.key] ? "password" : "text"}
                    value={localValues[setting.key] ?? setting.value ?? ""}
                    onChange={(e) => setLocalValues((prev) => ({ ...prev, [setting.key]: e.target.value }))}
                    placeholder={setting.isSecret ? "••••••••••••••••" : `Enter ${setting.key.split('_').join(' ')}...`}
                    className="h-12 rounded-2xl border-2 border-border/40 bg-muted/20 focus-visible:ring-primary/20 focus-visible:border-primary font-mono text-sm px-5 transition-all placeholder:text-muted-foreground/50"
                  />
                  <Button 
                    size="icon" 
                    className="h-12 w-12 rounded-2xl shrink-0 shadow-lg shadow-primary/20"
                    disabled={localValues[setting.key] === undefined || updateSetting.isPending}
                    onClick={() => handleSave(setting.key)}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 px-4 rounded-[2rem] bg-muted/20 border-2 border-dashed border-border/60 text-center">
            <GlobeLock className="h-8 w-8 text-muted-foreground/30 mb-4" />
            <h4 className="font-black text-sm uppercase tracking-widest mb-2">No Settings Found</h4>
            <p className="text-xs text-muted-foreground max-w-xs mb-6">Initialize the default API placeholders to start configuring your global integrations.</p>
            <Button onClick={handleInitialize} className="rounded-xl font-black uppercase tracking-widest text-[10px] px-8 h-10">
              Initialize Settings
            </Button>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 pt-2">
          {/* Status Aircall */}
          <div className="flex items-center justify-between p-5 rounded-3xl bg-muted/30 border border-border/40">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Aircall Status</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {testResults?.aircall ? (
                    testResults.aircall.ok ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-500"><CheckCircle2 className="h-3 w-3" /> Connected</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-rose-500"><XCircle className="h-3 w-3" /> Error</span>
                    )
                  ) : (
                    <span className="text-[11px] font-bold text-muted-foreground/60">Not tested</span>
                  )}
                </div>
              </div>
            </div>
            {syncStatus?.aircall && (
              <div className="text-right">
                <p className="text-[9px] font-black text-muted-foreground/40 uppercase">Last Sync</p>
                <p className="text-[10px] font-black text-muted-foreground/60 mt-0.5">
                  {new Date(syncStatus.aircall.finished_at).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Status iClosed */}
          <div className="flex items-center justify-between p-5 rounded-3xl bg-muted/30 border border-border/40">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">iClosed Status</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {testResults?.iclosed ? (
                    testResults.iclosed.ok ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-500"><CheckCircle2 className="h-3 w-3" /> Connected</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-rose-500"><XCircle className="h-3 w-3" /> Error</span>
                    )
                  ) : (
                    <span className="text-[11px] font-bold text-muted-foreground/60">Not tested</span>
                  )}
                </div>
              </div>
            </div>
            {syncStatus?.iclosed && (
              <div className="text-right">
                <p className="text-[9px] font-black text-muted-foreground/40 uppercase">Last Sync</p>
                <p className="text-[10px] font-black text-muted-foreground/60 mt-0.5">
                  {new Date(syncStatus.iclosed.finished_at).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="rounded-2xl bg-amber-500/5 border border-amber-500/10 p-4">
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium leading-relaxed">
            <strong>Pro Tip:</strong> These credentials are used for background automation. Individual setters only need to provide their specific User IDs to receive attribution.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default GlobalIntegrationSettings;
