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
import { Pencil, UserPlus, UserCog, RefreshCw, Shield } from "lucide-react";

import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { User, UserRole } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";


const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const roleVariant: Record<UserRole, string> = {
  closer: "bg-primary/10 text-primary",
  setter: "bg-accent text-accent-foreground",
  admin:  "bg-muted text-muted-foreground",
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
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shadow-inner">
              <UserCog className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t("teamManage.title")}</h1>
              <p className="text-muted-foreground">{t("teamManage.subtitle")}</p>
            </div>
          </div>
          <Button onClick={() => setInviteOpen(true)} className="h-11 px-6 rounded-xl gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
            <UserPlus className="h-4 w-4" />
            {t("teamManage.inviteMember")}
          </Button>
        </div>

        {/* Filters & Search */}
        <Card className="border-none shadow-sm overflow-hidden bg-muted/20">
          <CardContent className="p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="relative w-full lg:max-w-md">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name..."
                className="h-11 pl-4 rounded-xl border-border/40 bg-background/50 focus-visible:ring-primary/20"
              />
            </div>
            
            <Tabs 
              value={activeTab} 
              onValueChange={(v) => setActiveTab(v as any)} 
              className="w-full lg:w-auto"
            >
              <TabsList className="bg-background/50 border border-border/40 p-1 rounded-xl h-11 w-full sm:w-auto">
                <TabsTrigger value="all" className="rounded-lg px-4 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">All</TabsTrigger>
                <TabsTrigger value="closer" className="rounded-lg px-4 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">{t("role.closer")}</TabsTrigger>
                <TabsTrigger value="setter" className="rounded-lg px-4 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">{t("role.setter")}</TabsTrigger>
                <TabsTrigger value="admin" className="rounded-lg px-4 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">{t("role.admin")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Master Table */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {profilesLoadFailed ? (
              <div className="p-8">
                <Alert variant="destructive" className="rounded-2xl bg-destructive/5">
                  <AlertTitle className="font-bold">Load Error</AlertTitle>
                  <AlertDescription className="mt-2 flex flex-col gap-4">
                    <p>{loadErrorMessage}</p>
                    <Button size="sm" variant="outline" className="w-fit" onClick={() => refetchProfiles()}>Retry</Button>
                  </AlertDescription>
                </Alert>
              </div>
            ) : isLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="text-center py-20 bg-muted/10">
                <div className="h-16 w-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserCog className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-lg font-medium text-muted-foreground/60">No members found</p>
                <p className="text-sm text-muted-foreground/40 mt-1">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30 hover:bg-muted/30">
                    <TableRow className="border-none">
                      <TableHead className="py-4 pl-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("teamManage.name")}</TableHead>
                      <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("teamManage.role")}</TableHead>
                      <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("teamManage.email")}</TableHead>
                      <TableHead className="py-4 pr-6 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProfiles.map((profile) => (
                      <TableRow key={profile.id} className="group hover:bg-muted/10 transition-colors border-border/30">
                        <TableCell className="py-4 pl-6">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-xl font-bold text-sm shadow-inner transition-transform group-hover:scale-110 duration-300",
                              profile.role === 'admin' ? "bg-amber-500/10 text-amber-600" :
                              profile.role === 'closer' ? "bg-primary/10 text-primary" :
                              "bg-emerald-500/10 text-emerald-600"
                            )}>
                              {profile.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-md leading-tight">{profile.name}</p>
                              {profile.id === currentUser?.id && <span className="text-[9px] font-black text-primary uppercase ml-0.5 mt-1 block">You</span>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-xs font-bold">
                          <Badge variant="outline" className={cn(
                            "px-3 py-1 border-none shadow-sm uppercase text-[9px] h-5",
                            roleVariant[profile.role]
                          )}>
                            {profile.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="text-sm font-medium text-muted-foreground italic flex items-center gap-2">
                             {t("teamManage.managedInSupabase")}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 pr-6 text-right">
                          {profile.id !== currentUser?.id && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                setEditing(profile);
                                setEditName(profile.name);
                                setEditRole(profile.role);
                              }}
                              className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-all overflow-hidden"
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
        
        <div className="p-4 rounded-xl border border-border/40 bg-muted/5 flex items-center gap-3">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground font-medium">{t("teamManage.addNote")}</p>
        </div>
      </div>

      {/* Modern Dialogs */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <div className="bg-gradient-to-br from-primary/10 via-background to-background p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold tracking-tight">{t("teamManage.editTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-muted-foreground ml-1">Full Name</Label>
                <Input 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)} 
                  className="h-12 rounded-xl border-2 focus-visible:ring-primary/20 px-4 font-medium"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-muted-foreground ml-1">Team Role</Label>
                <Select value={editRole} onValueChange={v => setEditRole(v as UserRole)}>
                  <SelectTrigger className="h-12 rounded-xl border-2 focus-visible:ring-primary/20 px-4 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="closer" className="rounded-lg">{t("role.closer")}</SelectItem>
                    <SelectItem value="setter" className="rounded-lg">{t("role.setter")}</SelectItem>
                    <SelectItem value="admin" className="rounded-lg">{t("role.admin")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} className="w-full h-12 rounded-xl text-md font-bold shadow-lg shadow-primary/20 mt-4" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("admin.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <div className="bg-gradient-to-br from-primary/10 via-background to-background p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold tracking-tight">{t("teamManage.inviteTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Full Name</Label>
                  <Input value={inviteName} onChange={e => setInviteName(e.target.value)} className="h-11 rounded-xl border-border/60" placeholder="Jean Dupont" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Email Address</Label>
                  <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="h-11 rounded-xl border-border/60" placeholder="jean@example.com" />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Temporary Password</Label>
                <Input type="password" value={invitePassword} onChange={e => setInvitePassword(e.target.value)} className="h-11 rounded-xl border-border/60" autoComplete="new-password" />
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Assign Role</Label>
                <Select value={inviteRole} onValueChange={v => setInviteRole(v as UserRole)}>
                  <SelectTrigger className="h-11 rounded-xl border-border/60 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="closer" className="rounded-lg">{t("role.closer")}</SelectItem>
                    <SelectItem value="setter" className="rounded-lg">{t("role.setter")}</SelectItem>
                    <SelectItem value="admin" className="rounded-lg">{t("role.admin")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button onClick={handleInvite} className="w-full h-12 rounded-xl text-md font-bold shadow-lg shadow-primary/20 mt-4" disabled={inviting}>
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
