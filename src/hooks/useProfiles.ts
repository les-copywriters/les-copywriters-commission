import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { User, UserRole } from "@/types";

const fetchProfiles = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, role")
    .order("name");
  if (error) throw new Error(error.message);
  return data as User[];
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
