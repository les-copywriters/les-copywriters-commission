import { useState } from "react";
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
import { Pencil, UserPlus, UserCog } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { User, UserRole } from "@/types";
import { useAuth } from "@/context/AuthContext";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const roleVariant: Record<UserRole, string> = {
  closer: "bg-primary/10 text-primary",
  setter: "bg-accent text-accent-foreground",
  admin:  "bg-muted text-muted-foreground",
};

const TeamManagePage = () => {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const { data: profiles = [], isLoading } = useProfiles();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();

  // Edit dialog
  const [editing, setEditing] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("closer");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Invite dialog
  const [inviteOpen, setInviteOpen]       = useState(false);
  const [inviteName, setInviteName]       = useState("");
  const [inviteEmail, setInviteEmail]     = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole]       = useState<UserRole>("closer");
  const [inviting, setInviting]           = useState(false);

  const openEdit = (profile: User) => {
    setEditing(profile);
    setEditName(profile.name);
    setEditRole(profile.role);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!editing || !editName.trim()) return;
    updateProfile.mutate(
      { id: editing.id, name: editName.trim(), role: editRole },
      {
        onSuccess: () => {
          toast.success(t("teamManage.updated"));
          setDialogOpen(false);
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

    if (error || data?.error) {
      toast.error(data?.error ?? t("teamManage.inviteError"));
    } else {
      toast.success(t("teamManage.inviteSuccess"));
      setInviteOpen(false);
      setInviteName(""); setInviteEmail(""); setInvitePassword(""); setInviteRole("closer");
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    }
    setInviting(false);
  };

  const closers = profiles.filter(p => p.role === "closer");
  const setters = profiles.filter(p => p.role === "setter");
  const admins  = profiles.filter(p => p.role === "admin");

  const renderTable = (members: User[], title: string) => (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{title} ({members.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-center py-6 text-muted-foreground text-sm">{t("teamManage.noMembers")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("teamManage.name")}</TableHead>
                <TableHead>{t("teamManage.role")}</TableHead>
                <TableHead>{t("teamManage.email")}</TableHead>
                <TableHead className="text-right">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map(profile => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">
                        {profile.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                      </div>
                      <span className="font-medium">{profile.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleVariant[profile.role]}`}>
                      {profile.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {t("teamManage.managedInSupabase")}
                  </TableCell>
                  <TableCell className="text-right">
                    {/* Prevent editing yourself */}
                    {profile.id !== currentUser?.id && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(profile)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <UserCog className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t("teamManage.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("teamManage.subtitle")}</p>
            </div>
          </div>
          <Button onClick={() => setInviteOpen(true)} className="shrink-0 gap-2">
            <UserPlus className="h-4 w-4" />
            {t("teamManage.inviteMember")}
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-6">
            {renderTable(closers, t("team.closers"))}
            {renderTable(setters, t("team.setters"))}
            {renderTable(admins, t("role.admins"))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">{t("teamManage.addNote")}</p>
      </div>

      {/* Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("teamManage.editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>{t("teamManage.name")}</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1">
              <Label>{t("teamManage.role")}</Label>
              <Select value={editRole} onValueChange={v => setEditRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="closer">{t("role.closer")}</SelectItem>
                  <SelectItem value="setter">{t("role.setter")}</SelectItem>
                  <SelectItem value="admin">{t("role.admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} className="w-full" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? t("common.loading") : t("admin.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("teamManage.inviteTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>{t("teamManage.name")}</Label>
              <Input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Jean Dupont" />
            </div>
            <div className="space-y-1">
              <Label>{t("teamManage.inviteEmail")}</Label>
              <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="jean@example.com" />
            </div>
            <div className="space-y-1">
              <Label>{t("teamManage.invitePassword")}</Label>
              <Input type="password" value={invitePassword} onChange={e => setInvitePassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-1">
              <Label>{t("teamManage.role")}</Label>
              <Select value={inviteRole} onValueChange={v => setInviteRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="closer">{t("role.closer")}</SelectItem>
                  <SelectItem value="setter">{t("role.setter")}</SelectItem>
                  <SelectItem value="admin">{t("role.admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleInvite} className="w-full" disabled={inviting}>
              {inviting ? t("common.loading") : t("teamManage.inviteConfirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default TeamManagePage;
