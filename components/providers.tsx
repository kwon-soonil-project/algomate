"use client";

import { AuthProvider } from "@/lib/auth-context";
import { StudyProvider } from "@/lib/study-context";
import { ToastProvider } from "@/lib/toast-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <StudyProvider>{children}</StudyProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
