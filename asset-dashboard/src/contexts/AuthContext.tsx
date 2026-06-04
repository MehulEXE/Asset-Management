import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';
import { authService, type User } from '../services/authService';

interface AuthContextType {
  currentUser: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapUser(sbUser: any): User {
  return {
    name: sbUser.user_metadata?.name || sbUser.email?.split('@')[0] || '',
    email: sbUser.email || '',
    role: sbUser.user_metadata?.role || 'user',
    created_at: sbUser.created_at || new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setToken(session.access_token);
        setCurrentUser(mapUser(session.user));
      }
      setIsLoading(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setToken(session.access_token);
        setCurrentUser(mapUser(session.user));
      } else {
        setToken(null);
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await authService.login(email, password);
    // Session handled by onAuthStateChange
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    await authService.register(name, email, password);
    // Auto-login happens via onAuthStateChange after signUp
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    // State cleared by onAuthStateChange
  }, []);

  const value: AuthContextType = {
    currentUser,
    token,
    isAuthenticated: !!currentUser,
    isAdmin: currentUser?.role === 'admin',
    isLoading,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return context;
}
