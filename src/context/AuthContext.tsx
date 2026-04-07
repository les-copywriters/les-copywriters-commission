import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { initTheme } from "@/lib/theme";
import { User } from "@/types";
import { toast } from "sonner";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  login: async () => ({ error: null }),
  logout: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore saved theme on first render
  useEffect(() => { initTheme(); }, []);

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, role")
      .eq("id", userId)
      .single();

    if (error) {
      // Profile row doesn't exist yet — this happens when a Supabase Auth user
      // was created but no profile was inserted (e.g. via the dashboard).
      // We don't log the user out; we show a clear message so they can contact admin.
      if (error.code === "PGRST116") {
        toast.error("Your account has no profile yet. Please contact an administrator.");
      } else {
        toast.error("Failed to load your profile. Please refresh or contact support.");
      }
      setUser(null);
      return;
    }

    if (!data?.name || !data?.role) {
      toast.error("Your profile is incomplete. Please contact an administrator.");
      setUser(null);
      return;
    }

    setUser({ id: data.id, name: data.name, role: data.role });
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setLoading(true);
        loadProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const refreshProfile = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s?.user) await loadProfile(s.user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
