import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { User, UserRole } from "@/types";

type ProfileRow = { id: string; name: string; role: UserRole; is_active: boolean | null };

const fetchProfiles = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, role, is_active")
    .order("name");
  if (error) throw new Error(error.message);
  return (data as ProfileRow[]).map(r => ({
    id: r.id,
    name: r.name,
    role: r.role,
    isActive: r.is_active ?? true,
  }));
};

export const useProfiles = () =>
  useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });

export const useUpdateProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, role }: { id: string; name: string; role: UserRole }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ name, role })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
  });
};

export const useToggleProfileActive = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }),
  });
};
