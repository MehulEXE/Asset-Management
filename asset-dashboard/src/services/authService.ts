import { supabase } from './supabaseClient';
import { apiUrl } from './apiConfig';

export interface User {
  name: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface UserWithDevices extends User {
  device_count: number;
}

function mapSupabaseUser(sbUser: any): User {
  return {
    name: sbUser.user_metadata?.name || sbUser.email?.split('@')[0] || '',
    email: sbUser.email || '',
    role: sbUser.user_metadata?.role || 'user',
    created_at: sbUser.created_at || new Date().toISOString(),
  };
}

export const authService = {

  async register(name: string, email: string, password: string): Promise<{ user: User }> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: 'user' },
      },
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Registration failed: no user returned');
    return { user: mapSupabaseUser(data.user) };
  },

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.user || !data.session) throw new Error('Login failed');
    return {
      token: data.session.access_token,
      user: mapSupabaseUser(data.user),
    };
  },

  async logout(_token: string): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },

  async getMe(token: string): Promise<User> {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) throw new Error(error?.message || 'Session expired');
    return mapSupabaseUser(data.user);
  },

  // ---- Admin Operations (via backend) ----

  async listUsers(token: string): Promise<UserWithDevices[]> {
    const res = await fetch(apiUrl('/api/admin/users'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to list users');
    }
    const data = await res.json();
    return data.users;
  },

  async setUserRole(token: string, email: string, role: 'admin' | 'user'): Promise<User> {
    const res = await fetch(
      apiUrl(`/api/admin/users/${encodeURIComponent(email)}/role`),
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update role');
    }
    const data = await res.json();
    return data.user;
  },
};
