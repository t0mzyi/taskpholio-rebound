"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  LayoutDashboard, 
  ListTodo, 
  ShieldCheck, 
  FolderKanban, 
  Settings, 
  Plus, 
  Calendar, 
  Clock, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  FileText,
  Users,
  MessageSquare,
  Send,
  X,
  Minimize2,
  ChevronRight,
  Target,
  Zap,
  Activity,
  Video
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { sendMeetingScheduledEmails } from "@/lib/emailNotifications";
import { Client, Task, Project, Agreement } from "@/lib/types";
import { cn } from "@/lib/utils";

type TabType = "overview" | "projects" | "agreements" | "meetings" | "settings";

// --- Helper for Auth Token ---
const getAuthToken = () => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("taskpholio_token") || sessionStorage.getItem("taskpholio_token") || "";
};

// --- Main Page Component ---
export default function ClientIntelligencePage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [projects, setProjects] = useState<Project[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  
  // Loading states for data
  const [dataLoading, setDataLoading] = useState(false);

  const fetchClientData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/clients/${id}`);
      setClient(res.data.data.client);
    } catch (err) {
      toast.error("Handshake failed: Intelligence inaccessible");
      router.push("/dashboard/clients");
    } finally {
      setLoading(false);
    }
  };

  const fetchTabData = async () => {
    if (!id) return;
    setDataLoading(true);
    try {
      if (activeTab === "overview") {
        const [projRes, agrRes, taskRes] = await Promise.all([
          api.get(`/clients/${id}/projects`),
          api.get(`/clients/${id}/agreements`),
          api.get(`/tasks?client=${id}`)
        ]);
        setProjects(projRes?.data.data.projects || []);
        setAgreements(agrRes?.data.data.agreements || []);
        setTasks(taskRes?.data.data.tasks || []);
      } else if (activeTab === "projects") {
        const res = await api.get(`/clients/${id}/projects`);
        setProjects(res.data.data.projects || []);
      } else if (activeTab === "agreements") {
        const res = await api.get(`/clients/${id}/agreements`);
        setAgreements(res.data.data.agreements || []);
      } else if (activeTab === "meetings") {
        const res = await api.get(`/clients/${id}/meetings`);
        setMeetings(res.data.data.meetings || []);
      }
    } catch (err) {
      console.error("Intelligence synchronization error:", err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => { fetchClientData(); }, [id]);
  useEffect(() => { fetchTabData(); }, [activeTab, id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Synchronizing Intelligence...</p>
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 relative">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-white/5 flex items-center justify-center text-3xl font-black text-white">
            {client.company.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-black tracking-tight text-white">{client.company}</h1>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-widest border border-emerald-400/20">
                {client.status}
              </span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground text-sm">
              <Users size={16} className="text-primary" />
              <span>{client.name}</span>
              <span className="text-gray-700">•</span>
              <span className="font-mono text-xs">{client.email}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
            onClick={() => window.open(`${process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL || 'https://clients.labsrebound.com'}/signup?email=${encodeURIComponent(client.email)}`, '_blank')}
          >
            <ExternalLink size={14} /> Preview Portal
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <div className="glass-panel p-5 flex items-center justify-between group">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Projects</p>
            <p className="text-2xl font-black text-white">{projects.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><FolderKanban size={20} /></div>
        </div>
        <div className="glass-panel p-5 flex items-center justify-between group">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Missions</p>
            <p className="text-2xl font-black text-white">{tasks.length || 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400"><Target size={20} /></div>
        </div>
        <div className="glass-panel p-5 flex items-center justify-between group">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Vault</p>
            <p className="text-2xl font-black text-white">{agreements.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400"><ShieldCheck size={20} /></div>
        </div>
        <div className="glass-panel p-5 flex items-center justify-between group">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Sync</p>
            <p className="text-2xl font-black text-white">LIVE</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 animate-pulse"><Activity size={20} /></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 mb-8 gap-8 overflow-x-auto pb-px">
        {["overview", "projects", "agreements", "meetings", "settings"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as TabType)}
            className={cn(
              "relative py-4 text-xs font-bold uppercase tracking-widest transition-all",
              activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
            {activeTab === tab && (
              <motion.div layoutId="tab-u" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary shadow-primary/20" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            {activeTab === "overview" && <OverviewTab tasks={tasks} />}
            {activeTab === "projects" && <ProjectsTab id={id as string} projects={projects} onRefresh={fetchTabData} />}
            {activeTab === "agreements" && <AgreementsTab id={id as string} agreements={agreements} onRefresh={fetchTabData} />}
            {activeTab === "meetings" && <MeetingsTab id={id as string} meetings={meetings} onRefresh={fetchTabData} />}
            {activeTab === "settings" && <ConfigTab client={client} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating Messenger Widget */}
      <FloatingMessenger id={id as string} clientName={client.name} />
    </div>
  );
}

// --- Sub-components (Simplified & Robust) ---

function OverviewTab({ tasks }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="glass-panel p-6">
        <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-widest">Live Operations</h3>
        <div className="space-y-4">
          {tasks.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground italic">No active missions.</p>
          ) : (
            tasks.map((t: any) => (
              <div key={t._id} className="p-4 rounded-xl bg-white/5 flex items-center justify-between border border-transparent hover:border-primary/20 transition-all">
                <span className="text-sm font-medium text-white">{t.title}</span>
                <span className="text-[10px] font-mono text-muted-foreground uppercase">{t.status}</span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="glass-panel p-6">
        <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-widest">Security Protocol</h3>
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-xs text-muted-foreground leading-relaxed">
          Operational telemetry and secure handshake verified. All synchronization between Admin and Client portals is currently optimal.
        </div>
      </div>
    </div>
  );
}

function ProjectsTab({ id, projects, onRefresh }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [newProj, setNewProj] = useState({ name: "", dueDate: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editProj, setEditProj] = useState<any>(null);

  useEffect(() => {
    if (selectedId) {
      const p = projects.find((x: any) => x._id === selectedId);
      if (p) {
        setEditProj(JSON.parse(JSON.stringify(p)));
      }
    }
  }, [selectedId, projects]);

  const handleCreate = async (e: any) => {
    e.preventDefault();
    try {
      await api.post(`/clients/${id}/projects`, { ...newProj, milestones: { started: { status: true, date: new Date() } } });
      toast.success("Deployment Initiated");
      setIsAdding(false);
      onRefresh();
    } catch (err) { toast.error("Failed to start initiative"); }
  };

  const handleUpdate = async () => {
    try {
      await api.patch(`/clients/${id}/projects/${selectedId}`, {
        name: editProj.name,
        status: editProj.status,
        progress: editProj.progress,
        dueDate: editProj.dueDate,
        description: editProj.description,
        milestones: editProj.milestones
      });
      toast.success("Project synchronized");
      onRefresh();
      setSelectedId(null);
    } catch (err) { toast.error("Failed to synchronize project"); }
  };

  if (selectedId && editProj) {
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedId(null)} className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-2">
          <ArrowLeft size={16} /> Back to Deployments
        </button>
        
        <div className="glass-panel p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-white uppercase tracking-widest">Update Deployment</h3>
            <button onClick={handleUpdate} className="btn-primary py-2 px-6 text-[10px]">Synchronize</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase ml-1 mb-1">Name</label>
              <input className="input-base" value={editProj.name || ''} onChange={e => setEditProj({...editProj, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase ml-1 mb-1">Due Date</label>
              <input type="date" className="input-base text-gray-500" value={editProj.dueDate ? editProj.dueDate.split('T')[0] : ''} onChange={e => setEditProj({...editProj, dueDate: e.target.value})} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase ml-1 mb-1">Status</label>
              <select className="input-base" value={editProj.status || 'planning'} onChange={e => setEditProj({...editProj, status: e.target.value})}>
                <option value="planning">Planning</option>
                <option value="in-progress">In Progress</option>
                <option value="review">Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase ml-1 mb-1">Progress (%)</label>
              <input type="number" min="0" max="100" className="input-base" value={editProj.progress || 0} onChange={e => setEditProj({...editProj, progress: Number(e.target.value)})} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-muted-foreground uppercase ml-1 mb-1">Description</label>
              <textarea className="input-base min-h-[80px]" value={editProj.description || ''} onChange={e => setEditProj({...editProj, description: e.target.value})} />
            </div>
          </div>
          
          <div className="mt-8">
            <h4 className="text-sm font-bold text-white uppercase tracking-widest mb-4">Lifecycle Milestones</h4>
            <div className="space-y-3">
              {['started', 'discovery', 'designing', 'development', 'testing', 'finalLaunch'].map(m => (
                <div key={m} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded bg-white/10 border-white/20 text-primary focus:ring-primary focus:ring-offset-gray-900"
                      checked={editProj.milestones?.[m]?.status || false} 
                      onChange={e => setEditProj({
                        ...editProj,
                        milestones: {
                          ...editProj.milestones,
                          [m]: { ...editProj.milestones?.[m], status: e.target.checked, date: e.target.checked ? new Date() : null }
                        }
                      })}
                    />
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-300 w-32">{m}</span>
                  </div>
                  
                  {m === 'designing' && editProj.milestones?.[m]?.status && (
                    <input 
                      className="input-base py-1.5 text-xs flex-1" 
                      placeholder="Design/Figma URL" 
                      value={editProj.milestones?.[m]?.LayoutLink || editProj.milestones?.[m]?.FigmaLink || ''} 
                      onChange={e => setEditProj({
                        ...editProj,
                        milestones: { ...editProj.milestones, [m]: { ...editProj.milestones[m], LayoutLink: e.target.value, FigmaLink: e.target.value } }
                      })} 
                    />
                  )}
                  {m === 'finalLaunch' && editProj.milestones?.[m]?.status && (
                    <input 
                      className="input-base py-1.5 text-xs flex-1" 
                      placeholder="Product URL" 
                      value={editProj.milestones?.[m]?.productLink || ''} 
                      onChange={e => setEditProj({
                        ...editProj,
                        milestones: { ...editProj.milestones, [m]: { ...editProj.milestones[m], productLink: e.target.value } }
                      })} 
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white uppercase tracking-widest">Active Deployments</h3>
        <button onClick={() => setIsAdding(!isAdding)} className="btn-primary py-2 px-6 text-[10px]">Initialize Project</button>
      </div>

      {isAdding && (
        <form onSubmit={handleCreate} className="glass-panel p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className="input-base" placeholder="Project Name" value={newProj.name} onChange={e => setNewProj({...newProj, name: e.target.value})} />
          <input className="input-base text-gray-500" type="date" value={newProj.dueDate} onChange={e => setNewProj({...newProj, dueDate: e.target.value})} />
          <div className="col-span-full flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsAdding(false)} className="text-xs font-bold text-muted-foreground px-4">Cancel</button>
            <button type="submit" className="btn-primary py-2 px-8 text-xs">Authorize</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4">
        {projects.length === 0 ? (
          <div className="text-center py-10 bg-white/5 border border-dashed border-white/20 rounded-2xl">
            <p className="text-sm text-muted-foreground italic">No Active Deployments</p>
          </div>
        ) : (
          projects.map((p: any) => (
            <div 
              key={p._id} 
              onClick={() => setSelectedId(p._id)} 
              className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-6 cursor-pointer hover:bg-white/5 hover:border-primary/30 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <FolderKanban size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white group-hover:text-primary transition-colors">{p.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-[8px] font-bold uppercase tracking-widest text-gray-300">{p.status || 'planning'}</span>
                    <p className="text-[10px] text-muted-foreground uppercase font-mono">
                      DUE: {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] font-bold text-primary uppercase mb-1">Signal strength</p>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${p.progress || 0}%` }} />
                    </div>
                    <p className="text-sm font-black text-white w-8 text-right">{p.progress || 0}%</p>
                  </div>
                </div>
                <ChevronRight className="text-muted-foreground group-hover:text-white transition-colors" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AgreementsTab({ id, agreements, onRefresh }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [newAgr, setNewAgr] = useState({ name: "", fileUrl: "", category: "Document" });

  const handleCreate = async (e: any) => {
    e.preventDefault();
    try {
      await api.post(`/clients/${id}/agreements`, newAgr);
      toast.success("Document added to vault");
      setIsAdding(false);
      setNewAgr({ name: "", fileUrl: "", category: "Document" });
      onRefresh();
    } catch (err) { toast.error("Failed to add document"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-transparent">
        <h3 className="text-xl font-bold text-white uppercase tracking-widest">Vault Documents</h3>
        <button onClick={() => setIsAdding(!isAdding)} className="btn-primary py-2 px-6 text-[10px]">Add File / Link</button>
      </div>

      {isAdding && (
        <form onSubmit={handleCreate} className="glass-panel p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className="input-base" placeholder="Document Name" value={newAgr.name} onChange={e => setNewAgr({...newAgr, name: e.target.value})} required />
          <input className="input-base" placeholder="G-Drive / File Link" value={newAgr.fileUrl} onChange={e => setNewAgr({...newAgr, fileUrl: e.target.value})} required />
          <div className="md:col-span-2">
             <input className="input-base max-w-[200px]" placeholder="Category" value={newAgr.category} onChange={e => setNewAgr({...newAgr, category: e.target.value})} />
          </div>
          <div className="col-span-full flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsAdding(false)} className="text-xs font-bold text-muted-foreground px-4">Cancel</button>
            <button type="submit" className="btn-primary py-2 px-8 text-xs">Add to Vault</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {agreements.length === 0 ? (
          <div className="col-span-full text-center py-10 bg-white/5 border border-dashed border-white/20 rounded-2xl">
            <p className="text-sm text-muted-foreground italic">No Documents in Vault</p>
          </div>
        ) : (
          agreements.map((a: any) => (
             <div key={a._id} className="glass-panel p-0 overflow-hidden group flex flex-col h-64 bg-white/5 hover:border-primary/50 transition-all">
                <div className="flex-1 bg-black/40 relative flex items-center justify-center border-b border-white/10 overflow-hidden">
                   {a.fileUrl && (a.fileUrl.includes('drive.google.com') || a.fileUrl.includes('figma.com') || a.fileUrl.includes('docs.google.com')) ? (
                      <iframe src={a.fileUrl.replace('/view', '/preview')} className="w-full h-full opacity-40 group-hover:opacity-100 transition-opacity absolute inset-0 pointer-events-none" style={{ border: 'none' }} />
                   ) : (
                      <FileText size={48} className="text-muted-foreground/30 group-hover:text-primary transition-colors" />
                   )}
                   <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0a0a0f] to-transparent pointer-events-none" />
                </div>
                <div className="p-4 flex items-center justify-between z-10 bg-[#0a0a0f]/80 backdrop-blur-md">
                   <div className="min-w-0 pr-4">
                     <h4 className="text-sm font-bold text-white truncate" title={a.name}>{a.name}</h4>
                     <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-1 bg-emerald-500/10 px-2 py-0.5 rounded-sm inline-block">{a.category || 'Document'}</span>
                   </div>
                   <button onClick={() => window.open(a.fileUrl, '_blank')} className="w-8 h-8 rounded-full bg-white/10 hover:bg-primary text-white flex items-center justify-center flex-shrink-0 transition-colors group-hover:scale-110">
                     <ExternalLink size={14} />
                   </button>
                </div>
             </div>
          ))
        )}
      </div>
    </div>
  );
}

function ConfigTab({ client }: any) {
  return (
    <div className="glass-panel p-8 max-w-2xl space-y-6">
      <h3 className="text-xl font-bold text-white uppercase tracking-widest mb-6">Sector Configuration</h3>
      <div className="space-y-4">
        <label className="block text-[10px] font-bold text-muted-foreground uppercase ml-1">Entity Name</label>
        <input className="input-base" defaultValue={client.company} />
        <label className="block text-[10px] font-bold text-muted-foreground uppercase ml-1">Liaison Contact</label>
        <input className="input-base" defaultValue={client.name} />
      </div>
      <div className="pt-4"><button className="btn-primary uppercase text-[10px]">Update Metadata</button></div>
    </div>
  );
}

function MeetingsTab({ id, meetings, onRefresh }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", startTime: "", endTime: "", type: "online", meetingLink: "" });
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveLink, setApproveLink] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const handleCreate = async (e: any) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await api.post(`/clients/${id}/meetings`, form);
      toast.success("Meeting scheduled");
      setIsAdding(false);
      setForm({ title: "", description: "", startTime: "", endTime: "", type: "online", meetingLink: "" });
      onRefresh();
    } catch { toast.error("Failed to schedule meeting"); }
      finally { setActionLoading(false); }
  };

  const handleApprove = async (meeting: any) => {
    try {
      setActionLoading(true);
      // 1. Approve in MongoDB
      await api.patch(`/clients/${id}/meetings/${meeting._id}/approve`, { meetingLink: approveLink });
      
      // 2. Add to Supabase for global Admin queue
      const normalizedScheduledAt = new Date(meeting.startTime).toISOString();
      const { data: supaMeeting, error } = await supabase
        .from("meetings")
        .insert({
          title: meeting.title,
          description: meeting.description || "",
          scheduled_at: normalizedScheduledAt,
          link: approveLink || null,
        })
        .select("*")
        .single();
        
      if (error) console.error("Supabase insert error", error);
      
      // 3. Trigger Email
      let allRecipients: any[] = [];
      try {
        const { data: profilesData } = await supabase.from("profiles").select("id, email").eq("is_active", true);
        allRecipients = profilesData || [];
      } catch (e) {}

      const recipientIds = allRecipients.map(r => r.id);
      if (recipientIds.length > 0 && supaMeeting) {
        await sendMeetingScheduledEmails({
          userIds: recipientIds,
          meetingId: supaMeeting.id,
          meetingTitle: supaMeeting.title,
          meetingDescription: meeting.description || "",
          scheduledAt: normalizedScheduledAt,
          meetingLink: approveLink || "",
          organizerName: "Admin Leadership",
          location: "Virtual HQ",
        });
      }

      toast.success("Briefing Confirmed & Synced");
      setApprovingId(null);
      setApproveLink("");
      onRefresh();
    } catch {
      toast.error("Failed to approve meeting");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white uppercase tracking-widest">Scheduled Briefings</h3>
        <button onClick={() => setIsAdding(!isAdding)} className="btn-primary py-2 px-6 text-[10px]">Schedule Meeting</button>
      </div>

      {isAdding && (
        <form onSubmit={handleCreate} className="glass-panel p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className="input-base" placeholder="Meeting Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
          <input className="input-base" placeholder="Meeting Link (optional)" value={form.meetingLink} onChange={e => setForm({...form, meetingLink: e.target.value})} />
          <div className="flex flex-col">
            <label className="text-[10px] uppercase text-muted-foreground mb-1 ml-1 font-bold">Start Time</label>
            <input type="datetime-local" className="input-base text-gray-500" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} required />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] uppercase text-muted-foreground mb-1 ml-1 font-bold">End Time (Optional)</label>
            <input type="datetime-local" className="input-base text-gray-500" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} />
          </div>
          <div className="md:col-span-2">
            <textarea className="input-base min-h-[80px]" placeholder="Meeting objective / Agenda" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div className="col-span-full flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsAdding(false)} className="text-xs font-bold text-muted-foreground px-4">Cancel</button>
            <button type="submit" className="btn-primary py-2 px-8 text-xs">Confirm Schedule</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4">
        {meetings.length === 0 ? (
          <div className="text-center py-10 bg-white/5 border border-dashed border-white/20 rounded-2xl">
            <p className="text-sm text-muted-foreground italic">No Active Meetings</p>
          </div>
        ) : (
          meetings.map((m: any) => (
            <div key={m._id} className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><Calendar size={24} /></div>
                <div>
                  <h4 className="text-lg font-bold text-white">{m.title}</h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest",
                      m.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-gray-300'
                    )}>{m.status}</span>
                    <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5"><Clock size={12} /> {new Date(m.startTime).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                 {m.status === 'pending' ? (
                    approvingId === m._id ? (
                      <div className="flex items-center gap-2">
                        <input className="input-base text-xs py-1.5" placeholder="Meeting Link" value={approveLink} onChange={e => setApproveLink(e.target.value)} />
                        <button onClick={() => handleApprove(m)} disabled={actionLoading} className="btn-primary py-1.5 px-4 text-[10px]">Confirm</button>
                        <button onClick={() => setApprovingId(null)} className="text-[10px] text-muted-foreground ml-2">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setApprovingId(m._id)} className="btn-primary py-2 px-6 text-[10px] bg-amber-600 hover:bg-amber-700">Approve Request</button>
                    )
                 ) : (
                   m.meetingLink ? (
                     <a href={m.meetingLink} target="_blank" className="btn-primary py-2 px-6 text-[10px] flex items-center gap-2">
                       <Video size={14} /> Join Now
                     </a>
                   ) : (
                     <span className="text-[10px] text-muted-foreground">Scheduled Without Link</span>
                   )
                 )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// --- Floating Messenger Widget (Fixed Positioning & Class Refinement) ---

function FloatingMessenger({ id, clientName }: { id: string, clientName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      const fetchH = async () => {
        try {
          const res = await api.get(`/clients/${id}/messages`);
          setMessages(res.data.data.messages || []);
        } catch (e) {}
      };
      fetchH();
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    const s = getSocket(getAuthToken());
    if (s.connected) setIsConnected(true);
    s.on('connect', () => setIsConnected(true));
    s.on('disconnect', () => setIsConnected(false));
    s.on('new_message', (m) => setMessages(p => [...p, m]));
    s.on('user_typing', (d) => { if(d.type==='Client') setIsTyping(true); });
    s.on('user_stopped_typing', () => setIsTyping(false));
    s.emit("join_chat", id);
    return () => { s.off('new_message'); s.off('user_typing'); s.off('user_stopped_typing'); };
  }, [id]);

  const sendM = (e: any) => {
    e.preventDefault();
    if (!input.trim() || !isConnected) return;
    const s = getSocket(getAuthToken());
    s.emit("send_message", { text: input, clientId: id });
    setInput("");
    s.emit("typing_stop", id);
  };

  return (
    <div className="fixed" style={{ bottom: '2rem', right: '2rem', zIndex: 100 }}>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="glass-panel flex flex-col mb-4 overflow-hidden" 
            style={{ width: '380px', height: '540px', background: 'rgba(10, 10, 15, 0.92)' }}
          >
            <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary"><MessageSquare size={16} /></div>
                <div>
                  <h4 className="text-xs font-bold text-white">{clientName}</h4>
                  <p className="text-[8px] font-mono uppercase text-muted-foreground flex items-center gap-1">
                    <span className={cn("w-1 h-1 rounded-full", isConnected ? "bg-green-500 animate-pulse" : "bg-amber-500")} />
                    Secure Command Signal
                  </p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="btn-icon p-1"><Minimize2 size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.senderType === 'User' ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[80%] p-3 rounded-2xl text-xs",
                    m.senderType === 'User' ? "bg-primary text-white rounded-br-none" : "bg-white/5 border border-white/10 text-gray-300 rounded-bl-none"
                  )}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isTyping && <div className="text-[10px] italic text-muted-foreground ml-1">Client is typing...</div>}
              <div ref={scrollRef} />
            </div>

            <form onSubmit={sendM} className="p-4 border-t border-white/10 bg-black/20 flex gap-2">
              <input 
                className="input-base text-xs py-2 bg-white/5" placeholder="Operational command..." 
                value={input} onChange={(e) => { 
                  setInput(e.target.value); 
                  getSocket(getAuthToken()).emit("typing_start", id); 
                }} 
              />
              <button className="btn-primary p-2 flex items-center justify-center h-full aspect-square rounded-xl"><Send size={14} /></button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl hover:scale-105 transition-all relative"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        {!isOpen && isConnected && <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0a0a0f]" />}
      </button>
    </div>
  );
}
