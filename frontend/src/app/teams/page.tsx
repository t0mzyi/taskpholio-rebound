"use client";
import { useState, useEffect } from "react";
import { 
  Users, UserPlus, Shield, Mail, Phone, 
  Search, Filter, ChevronRight, Activity,
  Target, Zap, TrendingUp, MoreHorizontal
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAdminStore } from "@/store/adminStore";
import { useAuthStore } from "@/store/authStore";
import { cn, isAdmin } from "@/lib/utils";
import { toast } from "sonner";
import Image from "next/image";

export default function TeamsPage() {
  const { teams, fetchTeams, isLoading } = useAdminStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<any>(null);

  useEffect(() => {
    fetchTeams();
  }, []);


  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-foreground tracking-tight">Tactical Squads</h1>
          <p className="text-muted-foreground font-black uppercase tracking-[0.2em] text-[10px] mt-2">Personnel Management & Squad Intelligence</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Squads..."
              className="bg-secondary/50 border border-border/50 rounded-xl pl-12 pr-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 w-full md:w-64 transition-all"
            />
          </div>
          {isAdmin(user?.role || "") && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Initialize Squad
            </motion.button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="glass h-64 rounded-[2rem] animate-pulse bg-secondary/20" />
            ))
          ) : filteredTeams.map((team) => (
            <TeamCard 
              key={team._id} 
              team={team} 
              onSelect={() => setSelectedTeam(team)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Team Details (Simplified for now) */}
      {selectedTeam && (
        <TeamDetailsModal 
          team={selectedTeam} 
          isOpen={!!selectedTeam} 
          onClose={() => setSelectedTeam(null)} 
        />
      )}
    </div>
  );
}

function TeamCard({ team, onSelect }: any) {
  const completionRate = team.stats?.totalTasks > 0
    ? Math.round((team.stats.completedTasks / team.stats.totalTasks) * 100)
    : 0;

  return (
    <motion.div
      layout
      whileHover={{ y: -8 }}
      onClick={onSelect}
      className="glass rounded-[2rem] p-8 border border-white/5 cursor-pointer hover:shadow-[0_0_40px_rgba(0,0,0,0.3)] group transition-all"
    >
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div 
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner"
            style={{ backgroundColor: `${team.color || '#3b82f6'}20`, border: `1px solid ${team.color || '#3b82f6'}40` }}
          >
            <Users className="w-7 h-7" style={{ color: team.color || '#3b82f6' }} />
          </div>
          <div>
            <h3 className="text-xl font-black text-foreground">{team.name}</h3>
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{team.members?.length || 0} Operatives</p>
          </div>
        </div>
        <button className="text-muted-foreground hover:text-foreground">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2 mb-8 font-medium leading-relaxed">
        {team.description || "Operational squad dedicated to mission success and tactical excellence."}
      </p>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="text-center">
          <p className="text-lg font-black text-foreground">{team.stats?.totalTasks || 0}</p>
          <p className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter">Tasks</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-primary">{team.stats?.completedTasks || 0}</p>
          <p className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter">Done</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-blue-400">{team.stats?.activeTasks || 0}</p>
          <p className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter">Active</p>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-[0.2em]">
          <span className="text-muted-foreground">Operational Success</span>
          <span className="text-primary">{completionRate}%</span>
        </div>
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${completionRate}%` }}
            className="h-full bg-primary shadow-[0_0_10px_rgba(34,197,94,0.3)] transition-all duration-700"
          />
        </div>
      </div>
    </motion.div>
  );
}

function TeamDetailsModal({ team, isOpen, onClose }: any) {
  const { user } = useAuthStore();
  if (!isOpen) return null;

  const completionRate = team.stats?.totalTasks > 0
    ? Math.round((team.stats.completedTasks / team.stats.totalTasks) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-xl" 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-4xl glass rounded-[2.5rem] border border-white/10 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 md:p-12 border-b border-white/5 flex items-start justify-between">
            <div className="flex items-center gap-6">
                <div 
                    className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl"
                    style={{ backgroundColor: `${team.color || '#3b82f6'}20`, border: `2px solid ${team.color || '#3b82f6'}40` }}
                >
                    <Users className="w-10 h-10" style={{ color: team.color || '#3b82f6' }} />
                </div>
                <div>
                    <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tighter">{team.name}</h2>
                    <p className="text-xs font-black uppercase text-primary tracking-[0.3em] mt-2">Squad Composition & Deployment</p>
                </div>
            </div>
            <button onClick={onClose} className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all font-black text-muted-foreground">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-8">
                   <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                       <Activity className="w-4 h-4 text-primary" /> Active Personnel
                   </h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {team.members?.map((member: any) => (
                           <div key={member._id} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-4 group hover:bg-white/10 transition-all">
                               <div className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center font-black overflow-hidden relative">
                                  {member.avatar ? (
                                      <Image src={member.avatar} alt={member.name} width={48} height={48} />
                                  ) : (
                                      <span className="text-primary">{member.name[0]}</span>
                                  )}
                               </div>
                               <div className="flex-1 min-w-0">
                                   <p className="font-bold text-foreground truncate">{member.name}</p>
                                   <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{member.role}</p>
                               </div>
                               <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                               </div>
                           </div>
                       ))}
                   </div>
                </div>

                <div className="space-y-8">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                       <Target className="w-4 h-4 text-blue-400" /> Operational Metrics
                    </h4>
                    <div className="space-y-6">
                        {[
                            { label: 'Intelligence Velocity', value: '8.4', icon: <Zap className="w-4 h-4 text-yellow-400" /> },
                            { label: 'Objective Success', value: `${completionRate}%`, icon: <TrendingUp className="w-4 h-4 text-emerald-400" /> },
                            { label: 'Briefing Compliance', value: '98%', icon: <Shield className="w-4 h-4 text-blue-400" /> }
                        ].map((metric) => (
                            <div key={metric.label} className="bg-secondary/30 p-5 rounded-2xl border border-border/50">
                                <div className="flex items-center gap-3 mb-2">
                                    {metric.icon}
                                    <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{metric.label}</span>
                                </div>
                                <p className="text-2xl font-black text-foreground">{metric.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* Action Bar */}
        {isAdmin && (
          <div className="p-8 bg-black/40 border-t border-white/5 flex justify-end gap-4">
            <button className="px-8 py-3 rounded-2xl bg-white/5 hover:bg-white/10 font-black text-[10px] uppercase tracking-widest text-muted-foreground transition-all">Archive Squad</button>
            <button className="px-8 py-3 rounded-2xl bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 transition-all">Reassign Objectives</button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
