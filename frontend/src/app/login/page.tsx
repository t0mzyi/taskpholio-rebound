"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import "../auth.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staySignedIn, setStaySignedIn] = useState(true);
  const { login, isLoading, fetchMe } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted || !session?.access_token) return;
        await fetchMe().catch(() => undefined);
        router.replace("/dashboard");
      } catch {
        // ignore and keep login form visible
      }
    };

    restoreSession();
    return () => {
      mounted = false;
    };
  }, [fetchMe, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    try {
      await login(email, password, staySignedIn);
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err?.message || err?.response?.data?.message || "Login failed. Please try again.");
    }
  };

  return (
    <div className="auth-container">
      {/* Background glow */}
      <div className="auth-glow-bg" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="auth-card-wrapper"
      >
        {/* Logo */}
        <div className="auth-logo-header">
          <div className="auth-logo-icon glow">
            <Zap size={20} />
          </div>
          <div>
            <h1 className="auth-logo-title">Taskpholio</h1>
            <p className="auth-logo-subtitle">Team Management Platform</p>
          </div>
        </div>

        {/* Card */}
        <div className="auth-card glass">
          <div>
            <h2 className="auth-card-title">Welcome back</h2>
            <p className="auth-card-subtitle">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-input-group">
              <label className="auth-label">Email</label>
              <div className="auth-input-wrapper">
                <Mail className="auth-input-icon" size={16} />
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="auth-input"
                />
              </div>
            </div>

            <div className="auth-input-group">
              <label className="auth-label">Password</label>
              <div className="auth-input-wrapper">
                <Lock className="auth-input-icon" size={16} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="auth-input"
                />
              </div>
            </div>

            <div className="auth-options">
              <label className="auth-checkbox-label group">
                <input
                  type="checkbox"
                  checked={staySignedIn}
                  onChange={(e) => setStaySignedIn(e.target.checked)}
                  className="auth-checkbox"
                />
                <span>Stay signed in</span>
              </label>
              <Link href="/forgot-password" title="forgot-password" className="auth-link">
                Forgot password?
              </Link>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isLoading}
              className="auth-submit-btn"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>Sign In <ArrowRight size={16} /></>
              )}
            </motion.button>
          </form>

          <p className="auth-footer">
            Accounts are created by CEO/CTO from the Admin Panel.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
