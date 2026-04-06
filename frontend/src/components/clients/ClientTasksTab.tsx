"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Plus, 
  Calendar, 
  Flag, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Loader2, 
  Trash2,
  ExternalLink,
  Settings2
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Task, Client } from "@/lib/types";

interface Props {
  client: Client;
  onClose: () => void;
}

export default function ClientTasksTab({ client, onClose }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New task form state
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: ""
  });

  const fetchTasks = async () => {
    try {
      setLoading(true);
      // We use the admin /tasks endpoint but filter by client ID
      const res = await api.get(`/tasks?client=${client._id}`);
      setTasks(res.data.data.tasks || []);
    } catch (err: any) {
      toast.error("Failed to fetch client missions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [client._id]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) return;

    try {
      setSubmitting(true);
      await api.post("/tasks", {
        ...newTask,
        client: client._id,
        // For client tasks, we might want to default to a specific team or user
        // but for now we'll just send the raw data
        assignedTo: "65f0a0000000000000000001", // Placeholder or fetch dynamic
        team: "65f0a0000000000000000002" // Placeholder or fetch dynamic
      });
      toast.success("Mission briefing deployed");
      setNewTask({ title: "", description: "", priority: "medium", dueDate: "" });
      setShowAddForm(false);
      fetchTasks();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Tactical failure: Mission upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (task: Task) => {
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    try {
      await api.patch(`/tasks/${task._id}`, { status: nextStatus });
      fetchTasks();
    } catch (err) {
      toast.error("Status shift failed");
    }
  };

  return (
    <motion.div 
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-full max-w-2xl bg-[#0a0a0c]/80 backdrop-blur-3xl border-l border-white/10 shadow-2xl z-[60] flex flex-col"
    >
      {/* Header */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-xl">
            {client.company.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white leading-tight">{client.company}</h2>
            <p className="text-sm text-gray-400">Mission Intelligence Oversight • {client.name}</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/5 rounded-xl transition-colors text-gray-400 hover:text-white"
        >
          <X size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Active Missions</p>
            <p className="text-2xl font-mono font-bold text-white">{tasks.filter(t => t.status !== 'completed').length}</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Completed</p>
            <p className="text-2xl font-mono font-bold text-green-400">{tasks.filter(t => t.status === 'completed').length}</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Last Sync</p>
            <p className="text-xs font-mono text-gray-400 pt-2.5">Just now</p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Project Pipeline</h3>
          <button 
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={16} />
            New Mission
          </button>
        </div>

        {/* Add Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.form 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              onSubmit={handleAddTask}
              className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4 shadow-xl"
            >
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Mission Objective</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  value={newTask.title}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50"
                  placeholder="E.g. Finalize Brand Identity Guidelines"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Priority Level</label>
                  <select 
                    value={newTask.priority}
                    onChange={e => setNewTask({...newTask, priority: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Standard</option>
                    <option value="high">Urgent</option>
                    <option value="urgent">Critical</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Due Date</label>
                  <input 
                    type="date" 
                    value={newTask.dueDate}
                    onChange={e => setNewTask({...newTask, dueDate: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-primary text-white rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : "Deploy Briefing"}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Tasks List */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-4">
              <Loader2 size={32} className="animate-spin text-primary" />
              <p className="text-sm font-mono tracking-widest uppercase">Fetching Intel...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 px-6 rounded-3xl border border-dashed border-white/10">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={24} className="text-gray-600" />
              </div>
              <h4 className="text-white font-semibold mb-1">No Active Missions</h4>
              <p className="text-sm text-gray-500">Deploy a new mission briefing to begin project tracking.</p>
            </div>
          ) : (
            tasks.map(task => (
              <div 
                key={task._id}
                className={`group p-5 rounded-2xl border transition-all duration-300 ${
                  task.status === 'completed' 
                    ? 'bg-green-500/5 border-green-500/10' 
                    : 'bg-white/5 border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <button 
                      onClick={() => handleToggleStatus(task)}
                      className={`mt-1 w-6 h-6 rounded-lg border flex items-center justify-center transition-colors ${
                        task.status === 'completed'
                          ? 'bg-green-500 border-green-500 text-black'
                          : 'border-white/20 text-transparent hover:border-primary/50'
                      }`}
                    >
                      <CheckCircle2 size={14} />
                    </button>
                    <div>
                      <h4 className={`font-semibold transition-all ${
                        task.status === 'completed' ? 'text-gray-500 line-through' : 'text-white'
                      }`}>
                        {task.title}
                      </h4>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock size={12} />
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No Deadine'}
                        </div>
                        <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          task.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                          task.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-primary/20 text-primary'
                        }`}>
                          {task.priority}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-colors">
                      <Settings2 size={16} />
                    </button>
                    <button className="p-2 hover:bg-red-500/10 rounded-lg text-gray-500 hover:text-red-400 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-mono">
                    <span>Mission Progress</span>
                    <span>{task.status === 'completed' ? '100%' : '24%'}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${
                        task.status === 'completed' ? 'bg-green-500' : 'bg-primary'
                      }`}
                      style={{ width: task.status === 'completed' ? '100%' : '24%' }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer / Portal Link */}
      <div className="p-6 border-t border-white/5 bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Portal Synchronization</p>
            <p className="text-sm text-green-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live Link Operational
            </p>
          </div>
          <a 
            href={`http://localhost:5173/dashboard?client=${client._id}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-all"
          >
            Preview Portal
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </motion.div>
  );
}
