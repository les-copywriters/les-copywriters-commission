import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

import { useProfiles, useUpdateProfile, useToggleProfileActive } from "@/hooks/useProfiles";
import { useLanguage } from "@/i18n";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Archive, ArchiveRestore, Pencil, UserPlus, UserCog, RefreshCw, Shield, Search, Trash2, AlertTriangle } from "lucide-react";

import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { User, UserRole } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  const toggleActive  = useToggleProfileActive();
  const queryClient = useQueryClient();

  // Dialog states
  const [editing, setEditing] = useState<User | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | UserRole | "archived">("all");

  // Form states
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("closer");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("closer");
  const [inviting, setInviting]     = useState(false);
  const [removing, setRemoving]     = useState(false);
  const [removeTarget, setRemoveTarget] = useState<User | null>(null);

  const loadErrorMessage = profilesError instanceof Error ? profilesError.message : "Failed to load team members.";

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (activeTab === "archived") return !profile.isActive && profile.name.toLowerCase().includes(q || "");
      if (activeTab !== "all" && profile.role !== activeTab) return false;
      if (!q) return true;
      return profile.name.toLowerCase().includes(q);
    }).sort((a, b) => {
      // Active members first, then archived
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.name.localeCompare(b.name);
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

    setInviting(true);
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: { name: inviteName.trim(), email: inviteEmail.trim().toLowerCase(), role: inviteRole },
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
      setInviteName(""); setInviteEmail(""); setInviteRole("closer");
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    }
    setInviting(false);
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    const { data, error } = await supabase.functions.invoke("deactivate-user", {
      body: { userId: removeTarget.id },
    });
    const errMsg = error
      ? ((await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.().catch(() => null))?.error ?? error.message)
      : (data?.error as string | undefined);
    if (errMsg) {
      toast.error(errMsg);
    } else {
      toast.success(`${removeTarget.name} has been removed. Their commission history is preserved.`);
      setRemoveTarget(null);
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    }
    setRemoving(false);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("teamManage.subtitle")}</p>
            <h1 className="text-xl font-semibold">{t("teamManage.title")}</h1>
          </div>
          <Button onClick={() => setInviteOpen(true)} className="rounded-lg h-9 px-4 text-xs font-medium gap-2">
            <UserPlus className="h-4 w-4" />
            {t("teamManage.inviteMember")}
          </Button>
        </div>

        {/* Filters & Search */}
        <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
          <div className="px-4 py-3 bg-muted/30 border-b border-border/40">
            <p className="text-sm font-medium">Filters</p>
          </div>
          <div className="p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name..."
                className="h-9 pl-9 rounded-lg border-border/50 bg-muted/20 text-sm"
              />
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "all" | UserRole | "archived")}
              className="w-full lg:w-auto"
            >
              <TabsList className="bg-muted/30 border border-border/40 p-0.5 rounded-lg h-9 w-full sm:w-auto">
                <TabsTrigger value="all" className="rounded-md px-4 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  All <span className="ml-1 text-[10px] text-muted-foreground">({profiles.filter(p => p.isActive).length})</span>
                </TabsTrigger>
                <TabsTrigger value="closer" className="rounded-md px-4 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">{t("role.closer")}</TabsTrigger>
                <TabsTrigger value="setter" className="rounded-md px-4 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">{t("role.setter")}</TabsTrigger>
                <TabsTrigger value="admin" className="rounded-md px-4 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">{t("role.admin")}</TabsTrigger>
                <TabsTrigger value="archived" className="rounded-md px-4 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm text-muted-foreground">
                  Archived <span className="ml-1 text-[10px]">({profiles.filter(p => !p.isActive).length})</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Master Table */}
        <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
          {profilesLoadFailed ? (
            <div className="p-6">
              <Alert variant="destructive" className="rounded-lg border-destructive/20 bg-destructive/5">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="font-medium">Load Error</AlertTitle>
                <AlertDescription className="mt-2 flex flex-col gap-3">
                  <p className="text-sm">{loadErrorMessage}</p>
                  <Button size="sm" variant="outline" className="w-fit rounded-lg border-destructive/20 text-destructive text-xs" onClick={() => refetchProfiles()}>Retry</Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm font-medium text-muted-foreground">No members found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-none">
                    <TableHead className="py-2.5 pl-4 text-[11px] font-medium text-muted-foreground">{t("teamManage.name")}</TableHead>
                    <TableHead className="py-2.5 text-[11px] font-medium text-muted-foreground">{t("teamManage.role")}</TableHead>
                    <TableHead className="py-2.5 text-[11px] font-medium text-muted-foreground">{t("teamManage.email")}</TableHead>
                    <TableHead className="py-2.5 pr-4 text-right text-[11px] font-medium text-muted-foreground">{t("table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map((profile) => (
                    <TableRow key={profile.id} className={cn(
                      "border-border/20 transition-colors",
                      profile.isActive ? "hover:bg-muted/20" : "opacity-50 bg-muted/10 hover:bg-muted/20"
                    )}>
                      <TableCell className="py-3 pl-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full font-medium text-sm",
                            profile.isActive
                              ? profile.role === 'admin' ? "bg-amber-500/10 text-amber-600" :
                                profile.role === 'closer' ? "bg-primary/10 text-primary" :
                                "bg-emerald-500/10 text-emerald-600"
                              : "bg-muted text-muted-foreground"
                          )}>
                            {profile.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{profile.name}</p>
                            {profile.id === currentUser?.id && <span className="text-[10px] text-primary">You</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={cn(
                            "px-2 py-0.5 border rounded-md text-[10px]",
                            roleVariant[profile.role]
                          )}>
                            {profile.role}
                          </Badge>
                          {!profile.isActive && (
                            <Badge variant="outline" className="px-2 py-0.5 border rounded-md text-[10px] border-border/40 text-muted-foreground bg-muted/20">
                              archived
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-xs text-muted-foreground/60">
                          Cloud Managed · SSO Active
                        </span>
                      </TableCell>
                      <TableCell className="py-3 pr-4 text-right">
                        {profile.id !== currentUser?.id && (
                          <div className="flex items-center justify-end gap-1.5">
                            {profile.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setEditing(profile); setEditName(profile.name); setEditRole(profile.role); }}
                                className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-all"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title={profile.isActive ? "Archive (mark as legacy)" : "Restore to active team"}
                              onClick={() => toggleActive.mutate(
                                { id: profile.id, isActive: !profile.isActive },
                                {
                                  onSuccess: () => toast.success(profile.isActive
                                    ? `${profile.name} archived — historical data preserved`
                                    : `${profile.name} restored to active team`),
                                  onError: (e) => toast.error(e.message),
                                }
                              )}
                              className={cn(
                                "h-8 w-8 rounded-lg transition-all",
                                profile.isActive
                                  ? "hover:bg-amber-500/10 hover:text-amber-600"
                                  : "hover:bg-emerald-500/10 hover:text-emerald-600"
                              )}
                            >
                              {profile.isActive
                                ? <Archive className="h-3.5 w-3.5" />
                                : <ArchiveRestore className="h-3.5 w-3.5" />}
                            </Button>
                            {profile.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setRemoveTarget(profile)}
                                className="h-8 w-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-all"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="px-4 py-3 rounded-lg border border-dashed border-border/60 flex items-center gap-3">
          <Shield className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          <p className="text-xs text-muted-foreground/60">{t("teamManage.addNote")}</p>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md rounded-xl border border-border/40 bg-background p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-base font-semibold">{t("teamManage.editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Full Name</Label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Role</Label>
              <Select value={editRole} onValueChange={v => setEditRole(v as UserRole)}>
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="closer">{t("role.closer")}</SelectItem>
                  <SelectItem value="setter">{t("role.setter")}</SelectItem>
                  <SelectItem value="admin">{t("role.admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} className="w-full rounded-lg h-9 text-xs font-medium" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("admin.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-lg rounded-xl border border-border/40 bg-background p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-base font-semibold">{t("teamManage.inviteTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              An invitation email will be sent automatically. The user clicks the link and sets their own password.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Full Name</Label>
                <Input value={inviteName} onChange={e => setInviteName(e.target.value)} className="h-9 rounded-lg text-sm" placeholder="Jean Dupont" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email Address</Label>
                <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="h-9 rounded-lg text-sm" placeholder="jean@example.com" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Role</Label>
              <Select value={inviteRole} onValueChange={v => setInviteRole(v as UserRole)}>
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="closer">{t("role.closer")}</SelectItem>
                  <SelectItem value="setter">{t("role.setter")}</SelectItem>
                  <SelectItem value="admin">{t("role.admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleInvite} className="w-full rounded-lg h-9 text-xs font-medium" disabled={inviting}>
              {inviting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              {inviting ? "Sending..." : t("teamManage.inviteConfirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent className="rounded-xl border border-border/40 bg-background p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Remove {removeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground mt-1">
              Their login will be revoked immediately. All historical commission data is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-4">
            <AlertDialogCancel className="rounded-lg h-9 border-border/60 text-sm">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={removing}
              className="rounded-lg h-9 bg-rose-500 hover:bg-rose-600 text-sm"
            >
              {removing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              {removing ? "Removing..." : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AppLayout>
  );
};

export default TeamManagePage;
