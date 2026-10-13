"use client";

import { Toaster } from "react-hot-toast";
import { ConfirmProvider } from "@/lib/useConfirm";
import { StoreProvider } from "@/lib/StoreContext";
import { AppSplashLoader } from "@/components/ui/AppSplashLoader";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <StoreProvider>
        <AppSplashLoader />
        {children}
        <Toaster position="bottom-right" toastOptions={{
          style: {
            background: '#fff',
            color: '#334155',
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.12)',
            borderRadius: '16px',
            fontWeight: '600',
            padding: '16px 20px',
            border: '1px solid #f1f5f9'
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }} />
      </StoreProvider>
    </ConfirmProvider>
  );
}
