"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Calendar, Tag, User as UserIcon, Flag, Briefcase, Paperclip, CheckCircle2, Trash2, Loader2, Upload } from "lucide-react";
import { useTaskStore } from "@/store/taskStore";
import { useAdminStore } from "@/store/adminStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

interface Props { onClose: () => void; }

interface Subtask {
  title: string;
  completed: boolean;
}

export default function CreateTaskModal({ onClose }: Props) {
  const { createTask } = useTaskStore();
  const { users, teams, fetchUsers, fetchTeams } = useAdminStore();
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    dueDate: "",
    assignedTo: "",
    team: "",
    estimatedHours: 0,
    tags: [] as string[],
    subtasks: [] as Subtask[],
  });

  const [currentTag, setCurrentTag] = useState("");
  const [currentSubtask, setCurrentSubtask] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUsers();
    fetchTeams();
  }, []);

  const handleAddTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, currentTag.trim()] });
      setCurrentTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  const handleAddSubtask = () => {
    if (currentSubtask.trim()) {
      setFormData({ 
        ...formData, 
        subtasks: [...formData.subtasks, { title: currentSubtask.trim(), completed: false }] 
      });
      setCurrentSubtask("");
    }
  };

  const handleRemoveSubtask = (index: number) => {
    setFormData({ 
      ...formData, 
      subtasks: formData.subtasks.filter((_, i) => i !== index) 
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedFiles = [...attachments];

    try {
      for (let i = 0; i < files.length; i++) {
        const fileData = new FormData();
        fileData.append('file', files[i]);
        
        const res = await api.post('/upload/single', fileData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        if (res.data.success) {
          uploadedFiles.push(res.data.data);
        }
      }
      setAttachments(uploadedFiles);
      toast.success("Intelligence assets uploaded.");
    } catch (error) {
      toast.error("Asset upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return toast.error("Title is required.");
    if (!formData.assignedTo) return toast.error("Please assign an operative.");
    if (!formData.team) return toast.error("Please assign a division.");
    
    setLoading(true);
    try {
      await createTask({
        ...formData,
        attachments
      });
      toast.success("Mission deployed and operatives notified!");
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Tactical Failure: Mission deployment aborted.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4" 
      onClick={onClose}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass border-primary/20 rounded-[2rem] p-8 w-full max-w-3xl max-h-[95vh] overflow-y-auto relative shadow-[0_0_50px_rgba(34,197,94,0.1)]" 
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all">
          <X className="w-5 h-5" />
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase italic">Mission Briefing</h2>
          </div>
          <p className="text-muted-foreground font-medium">Define high-priority objectives and allocate tactical resources.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Basic Intel */}
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block">Objective Designation</label>
                <input 
                  type="text" 
                  required 
                  value={formData.title} 
                  onChange={(e) => setFormData({...formData, title: e.target.value})} 
                  placeholder="CLASSIFIED NAME"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-lg font-bold text-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/30 uppercase tracking-tight" 
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block">Tactical Summary</label>
                <textarea 
                  value={formData.description} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})} 
                  rows={4} 
                  placeholder="DETAILED INTEL DEBRIEF..."
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm font-medium text-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/10 resize-none transition-all placeholder:text-muted-foreground/30" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block">Lead Operative</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <select 
                      required
                      value={formData.assignedTo} 
                      onChange={(e) => setFormData({...formData, assignedTo: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold focus:border-primary/50 transition-all appearance-none"
                    >
                      <option value="">SELECT OPERATIVE</option>
                      {users
                        .filter(u => !formData.team || (u.team as any)?._id === formData.team || (u.team as any) === formData.team)
                        .map(u => (
                          <option key={u._id} value={u._id} className="bg-neutral-900">{u.name} ({u.role})</option>
                        ))
                      }
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block">Division</label>
                  <div className="relative">
                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <select 
                      required
                      value={formData.team} 
                      onChange={(e) => setFormData({...formData, team: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold focus:border-primary/50 transition-all appearance-none"
                    >
                      <option value="">SELECT TEAM</option>
                      {teams.map(t => (
                        <option key={t._id} value={t._id} className="bg-neutral-900">{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block">Threat Level</label>
                  <div className="relative">
                    <Flag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <select 
                      value={formData.priority} 
                      onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold focus:border-primary/50 transition-all appearance-none"
                    >
                      <option value="low">ALPHA</option>
                      <option value="medium">BETA</option>
                      <option value="high">GAMMA</option>
                      <option value="urgent">OMEGA</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block">Target Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input 
                      type="date" 
                      value={formData.dueDate} 
                      onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold focus:border-primary/50 transition-all" 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Advanced Intel */}
            <div className="space-y-6">
              {/* Sub-objectives */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block">Sub-Objectives</label>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={currentSubtask}
                      onChange={(e) => setCurrentSubtask(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())}
                      placeholder="ADD SUB-TASK..."
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium focus:border-primary/50 transition-all"
                    />
                    <button 
                      type="button"
                      onClick={handleAddSubtask}
                      className="p-3 bg-primary/10 text-primary border border-primary/20 rounded-xl hover:bg-primary/20 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
                    {formData.subtasks.map((st, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3 bg-white/5 p-3 rounded-xl border border-white/5 group">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{st.title}</span>
                        </div>
                        <button onClick={() => handleRemoveSubtask(idx)} className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tactical Tags */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block">Tactical Tags</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-[10px] font-black uppercase border border-primary/20">
                      {tag}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="DEPLOY TAG..."
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium focus:border-primary/50 transition-all"
                  />
                  <button 
                    type="button"
                    onClick={handleAddTag}
                    className="p-3 bg-secondary text-foreground rounded-xl hover:bg-secondary/80 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Intelligence Assets */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block">Intelligence Assets (Attachments)</label>
                <div className="space-y-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/10 rounded-2xl p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
                  >
                    <input 
                      type="file" 
                      multiple 
                      hidden 
                      ref={fileInputRef} 
                      onChange={handleFileUpload}
                    />
                    <Upload className="w-8 h-8 text-muted-foreground mb-2 mx-auto group-hover:text-primary transition-all" />
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Upload Tactical Data</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1 uppercase">Images, PDF, DOCX (MAX 10MB)</p>
                  </div>

                  {attachments.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/5 truncate">
                          <Paperclip className="w-3 h-3 text-primary shrink-0" />
                          <span className="text-[10px] font-bold uppercase truncate">{file.fileName}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {uploading && (
                    <div className="flex items-center gap-2 text-primary">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Uploading Comms...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-8 border-t border-white/5">
            <div className="flex gap-4">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-muted-foreground uppercase">Estimated Effort</span>
                <input 
                  type="number" 
                  value={formData.estimatedHours} 
                  onChange={(e) => setFormData({...formData, estimatedHours: Number(e.target.value)})}
                  className="w-16 bg-transparent border-none p-0 text-xl font-black text-primary focus:ring-0"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                type="button" 
                onClick={onClose}
                className="px-8 py-4 text-xs font-black text-muted-foreground uppercase tracking-widest hover:text-foreground transition-all"
              >
                Cancel Mission
              </button>
              <motion.button 
                whileHover={{ scale: 1.05 }} 
                whileTap={{ scale: 0.95 }} 
                type="submit" 
                disabled={loading || uploading}
                className="relative group overflow-hidden px-10 py-4 bg-primary text-primary-foreground rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(34,197,94,0.3)] disabled:opacity-50 transition-all font-mono"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <span className="relative flex items-center gap-3">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Initialize Protocol</>}
                </span>
              </motion.button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
