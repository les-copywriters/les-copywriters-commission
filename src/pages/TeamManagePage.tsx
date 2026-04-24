import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

import { useProfiles, useUpdateProfile } from "@/hooks/useProfiles";
import { useLanguage } from "@/i18n";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, UserPlus, UserCog, RefreshCw, Shield, Search, Filter } from "lucide-react";

import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { User, UserRole } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const roleVariant: Record<UserRole, string> = {
  closer: "bg-primary/10 text-primary border-primary/20",
  setter: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  admin:  "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

const TeamManagePage = () => {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const {
    data: profiles = [],
    isLoading,
    isError: profilesLoadFailed,
    error: profilesError,
    refetch: refetchProfiles,
  } = useProfiles();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();

  // Dialog states
  const [editing, setEditing] = useState<User | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | UserRole>("all");
  
  // Form states
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("closer");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("closer");
  const [inviting, setInviting]           = useState(false);

  const loadErrorMessage = profilesError instanceof Error ? profilesError.message : "Failed to load team members.";

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (activeTab !== "all" && profile.role !== activeTab) return false;
      if (!q) return true;
      return profile.name.toLowerCase().includes(q);
    });
  }, [profiles, search, activeTab]);

  const handleSave = () => {
    if (!editing || !editName.trim()) return;
    updateProfile.mutate(
      { id: editing.id, name: editName.trim(), role: editRole },
      {
        onSuccess: () => {
          toast.success("Profile updated successfully");
          setEditing(null);
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const handleInvite = async () => {
    if (!inviteName.trim()) { toast.error(t("teamManage.validation.name")); return; }
    if (!EMAIL_REGEX.test(inviteEmail)) { toast.error(t("teamManage.validation.email")); return; }
    if (invitePassword.length < 8) { toast.error(t("teamManage.validation.password")); return; }

    setInviting(true);
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: { name: inviteName.trim(), email: inviteEmail.trim().toLowerCase(), password: invitePassword, role: inviteRole },
    });

    let inviteErrorMessage: string | null = null;
    if (error) {
      const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.().catch?.(() => null);
      inviteErrorMessage = body?.error ?? error.message;
    } else if (data && typeof data === "object" && "error" in data && data.error) {
      inviteErrorMessage = String(data.error);
    }

    if (inviteErrorMessage) {
      toast.error(inviteErrorMessage || t("teamManage.inviteError"));
    } else {
      toast.success(t("teamManage.inviteSuccess"));
      setInviteOpen(false);
      setInviteName(""); setInviteEmail(""); setInvitePassword(""); setInviteRole("closer");
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    }
    setInviting(false);
  };

  return (
    <AppLayout>
      <div className="space-y-10 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-primary/10 shadow-inner">
              <UserCog className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">{t("teamManage.title")}</h1>
              <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px] mt-1">{t("teamManage.subtitle")}</p>
            </div>
          </div>
          <Button onClick={() => setInviteOpen(true)} className="h-12 px-6 rounded-2xl gap-2 shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.95] font-black uppercase tracking-widest text-xs">
            <UserPlus className="h-4 w-4" />
            {t("teamManage.inviteMember")}
          </Button>
        </div>

        {/* Filters & Search */}
        <Card className="border-none shadow-premium rounded-[2rem] overflow-hidden bg-background/50 backdrop-blur-sm">
          <CardContent className="p-6 flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="relative w-full lg:max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name..."
                className="h-12 pl-12 rounded-xl border-2 bg-muted/20 focus-visible:ring-primary/20 focus-visible:border-primary transition-all font-medium"
              />
            </div>
            
            <Tabs 
              value={activeTab} 
              onValueChange={(v) => setActiveTab(v as any)} 
              className="w-full lg:w-auto"
            >
              <TabsList className="bg-muted/30 border border-border/40 p-1 rounded-xl h-12 w-full sm:w-auto gap-1">
                <TabsTrigger value="all" className="rounded-lg px-6 font-black uppercase tracking-widest text-[10px] transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg shadow-primary/20">All</TabsTrigger>
                <TabsTrigger value="closer" className="rounded-lg px-6 font-black uppercase tracking-widest text-[10px] transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg shadow-primary/20">{t("role.closer")}</TabsTrigger>
                <TabsTrigger value="setter" className="rounded-lg px-6 font-black uppercase tracking-widest text-[10px] transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg shadow-primary/20">{t("role.setter")}</TabsTrigger>
                <TabsTrigger value="admin" className="rounded-lg px-6 font-black uppercase tracking-widest text-[10px] transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg shadow-primary/20">{t("role.admin")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Master Table */}
        <Card className="border-none shadow-premium rounded-[2.5rem] overflow-hidden bg-background">
          <CardContent className="p-0">
            {profilesLoadFailed ? (
              <div className="p-10">
                <Alert variant="destructive" className="rounded-[2rem] border-none shadow-lg bg-rose-500/10 p-6">
                  <AlertTriangle className="h-5 w-5 text-rose-500" />
                  <AlertTitle className="font-black uppercase tracking-widest text-rose-500">Load Error</AlertTitle>
                  <AlertDescription className="mt-4 flex flex-col gap-6">
                    <p className="font-medium opacity-90">{loadErrorMessage}</p>
                    <Button size="sm" variant="outline" className="w-fit rounded-xl border-rose-500/20 text-rose-500 font-bold hover:bg-rose-500/10" onClick={() => refetchProfiles()}>Retry</Button>
                  </AlertDescription>
                </Alert>
              </div>
            ) : isLoading ? (
              <div className="p-10 space-y-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="text-center py-32 grayscale opacity-40">
                <div className="h-20 w-20 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <UserCog className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <p className="text-xl font-black tracking-tight text-muted-foreground/60">No members found</p>
                <p className="text-sm text-muted-foreground/40 mt-1">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-none">
                      <TableHead className="py-5 pl-10 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("teamManage.name")}</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("teamManage.role")}</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("teamManage.email")}</TableHead>
                      <TableHead className="py-5 pr-10 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProfiles.map((profile) => (
                      <TableRow key={profile.id} className="group hover:bg-muted/10 transition-all border-border/30">
                        <TableCell className="py-6 pl-10">
                          <div className="flex items-center gap-5">
                            <div className={cn(
                              "flex h-12 w-12 items-center justify-center rounded-2xl font-black text-sm shadow-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3",
                              profile.role === 'admin' ? "bg-amber-500/10 text-amber-600 shadow-amber-500/10" :
                              profile.role === 'closer' ? "bg-primary/10 text-primary shadow-primary/10" :
                              "bg-emerald-500/10 text-emerald-600 shadow-emerald-500/10"
                            )}>
                              {profile.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                            </div>
                            <div>
                              <p className="font-black text-base tracking-tight leading-none">{profile.name}</p>
                              {profile.id === currentUser?.id && <span className="text-[9px] font-black text-primary uppercase tracking-widest mt-1.5 block opacity-70">Authenticated Profile</span>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-6">
                          <Badge variant="outline" className={cn(
                            "px-4 py-1 border font-black uppercase tracking-widest text-[9px] h-6 rounded-full shadow-sm",
                            roleVariant[profile.role]
                          )}>
                            {profile.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-6">
                          <span className="text-xs font-bold text-muted-foreground/60 italic flex items-center gap-2">
                             Cloud Managed • SSO Active
                          </span>
                        </TableCell>
                        <TableCell className="py-6 pr-10 text-right">
                          {profile.id !== currentUser?.id && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                setEditing(profile);
                                setEditName(profile.name);
                                setEditRole(profile.role);
                              }}
                              className="h-10 w-10 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all active:scale-90"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="p-6 rounded-[1.5rem] border border-dashed border-border/60 bg-muted/5 flex items-center gap-4 group hover:bg-muted/10 transition-colors">
          <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center border border-border/40 shadow-sm transition-transform group-hover:rotate-12">
            <Shield className="h-5 w-5 text-muted-foreground/60" />
          </div>
          <p className="text-xs text-muted-foreground font-black uppercase tracking-widest opacity-60">{t("teamManage.addNote")}</p>
        </div>
      </div>

      {/* Modern Dialogs */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem]">
          <div className="bg-gradient-to-br from-primary/10 via-background to-background p-10">
            <DialogHeader className="mb-8 text-center">
              <DialogTitle className="text-2xl font-black tracking-tight">{t("teamManage.editTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Full Identity Name</Label>
                <Input 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)} 
                  className="h-14 rounded-2xl border-2 bg-muted/20 focus-visible:ring-primary/20 focus-visible:border-primary px-5 font-black transition-all"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">System Privilege Level</Label>
                <Select value={editRole} onValueChange={v => setEditRole(v as UserRole)}>
                  <SelectTrigger className="h-14 rounded-2xl border-2 bg-muted/20 focus-visible:ring-primary/20 focus-visible:border-primary px-5 font-black transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    <SelectItem value="closer" className="rounded-xl font-bold py-3">{t("role.closer")}</SelectItem>
                    <SelectItem value="setter" className="rounded-xl font-bold py-3">{t("role.setter")}</SelectItem>
                    <SelectItem value="admin" className="rounded-xl font-bold py-3">{t("role.admin")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} className="w-full h-14 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 mt-4" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("admin.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem]">
          <div className="bg-gradient-to-br from-primary/10 via-background to-background p-10">
            <DialogHeader className="mb-8 text-center">
              <DialogTitle className="text-2xl font-black tracking-tight">{t("teamManage.inviteTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Identity Name</Label>
                  <Input value={inviteName} onChange={e => setInviteName(e.target.value)} className="h-12 rounded-2xl border-2 bg-muted/20" placeholder="Jean Dupont" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Work Email</Label>
                  <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="h-12 rounded-2xl border-2 bg-muted/20" placeholder="jean@example.com" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Temporary Security Key</Label>
                <Input type="password" value={invitePassword} onChange={e => setInvitePassword(e.target.value)} className="h-12 rounded-2xl border-2 bg-muted/20" autoComplete="new-password" />
              </div>
              
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">System Role Access</Label>
                <Select value={inviteRole} onValueChange={v => setInviteRole(v as UserRole)}>
                  <SelectTrigger className="h-12 rounded-2xl border-2 bg-muted/20 font-black uppercase tracking-widest text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    <SelectItem value="closer" className="rounded-xl font-bold py-3">{t("role.closer")}</SelectItem>
                    <SelectItem value="setter" className="rounded-xl font-bold py-3">{t("role.setter")}</SelectItem>
                    <SelectItem value="admin" className="rounded-xl font-bold py-3">{t("role.admin")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button onClick={handleInvite} className="w-full h-14 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 mt-6" disabled={inviting}>
                {inviting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : t("teamManage.inviteConfirm")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default TeamManagePage;
