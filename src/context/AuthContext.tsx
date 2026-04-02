import { createContext, useContext, useState, ReactNode } from "react";
import { User } from "@/types";
import { mockUsers } from "@/data/mock";

type AuthContextType = {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => false,
  logout: () => {},
});

/** Auth provider — currently mocked. Replace login logic with API call later. */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = (_email: string, _password: string) => {
    // TODO: Replace with real API authentication
    const admin = mockUsers.find((u) => u.role === "admin")!;
    setUser(admin);
    return true;
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
