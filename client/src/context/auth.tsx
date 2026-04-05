import * as React from "react";
import { enterpriseApi, type AuthUser } from "@/lib/enterprise-api";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setAuth: (token: string, user: AuthUser) => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [token, setToken] = React.useState<string | null>(() => localStorage.getItem("mp_token"));
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const stored = localStorage.getItem("mp_token");
    if (!stored) { setIsLoading(false); return; }
    enterpriseApi.auth.me().then((u) => {
      setUser(u);
      setToken(stored);
    }).catch(() => {
      localStorage.removeItem("mp_token");
      setToken(null);
    }).finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const result = await enterpriseApi.auth.login({ email, password });
    localStorage.setItem("mp_token", result.token);
    setToken(result.token);
    setUser(result.user);
  };

  const logout = () => {
    localStorage.removeItem("mp_token");
    setToken(null);
    setUser(null);
  };

  const setAuth = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem("mp_token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
