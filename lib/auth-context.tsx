"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEMO_USER_ID } from "./demo-data";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "./supabase";
import type { AppUser } from "./types";

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  isDemo: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const DEMO_AUTH_KEY = "algomate-demo-user";

function mapUser(user: User): AppUser {
  return {
    id: user.id,
    email: user.email ?? "",
    name: user.user_metadata?.name || user.email?.split("@")[0] || "스터디원",
    avatarUrl: user.user_metadata?.avatar_url,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    if (!supabase) {
      try {
        const stored = window.localStorage.getItem(DEMO_AUTH_KEY);
        setUser(stored ? JSON.parse(stored) : null);
      } finally {
        setLoading(false);
      }
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? mapUser(data.user) : null);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? mapUser(session.user) : null);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      const demoUser: AppUser = { id: DEMO_USER_ID, email: email || "demo@algomate.kr", name: email.split("@")[0] || "알고" };
      window.localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify(demoUser));
      setUser(demoUser);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, [supabase]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    if (!supabase) {
      const demoUser: AppUser = { id: DEMO_USER_ID, email, name };
      window.localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify(demoUser));
      setUser(demoUser);
      return { needsConfirmation: false };
    }
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (error) throw error;
    return { needsConfirmation: !data.session };
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) {
      window.localStorage.removeItem(DEMO_AUTH_KEY);
      setUser(null);
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, loading, isDemo: !hasSupabaseConfig, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
