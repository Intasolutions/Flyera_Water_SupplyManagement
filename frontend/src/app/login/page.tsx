"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Droplet, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { login, getCurrentUser } from "@/lib/api";
import { useStore, AppRole } from "@/lib/StoreContext";

export default function LoginPage() {
  const router = useRouter();
  const { setCurrentUserRole } = useStore();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const authRes = await login(username, password);
      localStorage.setItem("access_token", authRes.access_token);
      
      const user = await getCurrentUser();
      
      // Map backend roles to frontend roles if necessary
      let mappedRole: AppRole = "Owner";
      if (user.role === "ADMIN") mappedRole = "Owner";
      if (user.role === "DRIVER" || user.role === "HELPER") mappedRole = "WaterStaff";
      if (user.role === "WATER_STAFF") mappedRole = "WaterStaff";
      if (user.role === "GLASS_STAFF") mappedRole = "GlassStaff";
      if (user.role === "GLASS_DRIVER") mappedRole = "GlassStaff"; // Driver uses the same context but different view

      setCurrentUserRole(mappedRole);
      
      // Redirect based on role
      if (user.role === "DRIVER" || user.role === "HELPER") {
        router.push("/driver");
      } else if (user.role === "GLASS_DRIVER") {
        router.push("/glass/driver");
      } else if (user.role === "GLASS_STAFF") {
        router.push("/glass");
      } else {
        router.push("/");
      }
      
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
            <Droplet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-text mb-2">Welcome Back</h1>
          <p className="text-text-muted">Sign in to AquaFlow Management</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-xl border border-black/5">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-semibold border border-red-100 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-text mb-2">Username / Mobile</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-text-muted" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-text focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                  placeholder="e.g. admin or 9998887776"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-text mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-text-muted" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-text focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={loading}
            >
              {loading ? "Authenticating..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-text-muted mb-2 font-medium">Demo Credentials:</p>
            <div className="flex gap-2 justify-center text-xs text-text-muted">
              <span className="bg-gray-100 px-2 py-1 rounded">admin</span>
              <span className="bg-gray-100 px-2 py-1 rounded">rahul</span>
              <span className="bg-gray-100 px-2 py-1 rounded">password123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
