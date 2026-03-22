"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, User, Mail, Lock, ArrowRight, Loader2, Users } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import api from "@/lib/api";

const roles = ["CEO", "CTO", "Member"];

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Member");
  const [team, setTeam] = useState("");
  const [publicTeams, setPublicTeams] = useState<{ _id: string; name: string }[]>([]);

  const { register, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    api.get("/auth/public-teams").then((res) => {
      setPublicTeams(res.data.data.teams);
    }).catch(() => {
      // Slient fail if no teams exist or API unreachable
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          team
        })
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("FRONTEND ERROR:", data);
        alert(data.message || "Registration failed");
        return;
      }

      toast.success("Account created successfully!");
      router.push("/login");
    } catch (error) {
      console.error("FRONTEND REQUEST ERROR:", error);
      alert("Registration failed");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="glow w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Taskpholio</h1>
            <p className="text-xs text-muted-foreground">Team Management Platform</p>
          </div>
        </div>

        <div className="glass rounded-2xl p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Create account</h2>
            <p className="text-muted-foreground text-sm mt-1">Join your team on Taskpholio</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground block">Role</label>
                <select
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    if (e.target.value !== "Member") setTeam("");
                  }}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                >
                  {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="space-y-2 relative">
                <label className="text-sm font-medium text-foreground block">
                  Team <span className="text-muted-foreground">(Optional)</span>
                </label>
                <select
                  disabled={role !== "Member"}
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-50"
                  required={role === "Member"}
                >
                  <option value="">Select Team...</option>
                  {publicTeams.map((t) => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
                {/* Block overlay if CTO/CEO to explain why disabled */}
                {role !== "Member" && (
                  <div className="absolute inset-0 top-6" title="CEO/CTO do not require a team" />
                )}
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-60 mt-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Create Account <ArrowRight className="w-4 h-4" /></>
              )}
            </motion.button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
