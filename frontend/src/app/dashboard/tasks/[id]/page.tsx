"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Clock, CheckCircle, Send, Paperclip, Upload, Loader2, X,
  Globe, Users, MessageSquare, ListTodo, History
} from "lucide-react";
import { useTaskStore } from "@/store/taskStore";
import { useAuthStore } from "@/store/authStore";
import { cn, getPriorityColor, getStatusColor, formatDate, formatRelativeTime, getDisplayName, getInitial } from "@/lib/utils";
import TaskBriefingView from "@/components/tasks/TaskBriefingView";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/pushNotifications";
import { uploadAttachments } from "@/lib/uploadAttachments";

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: me } = useAuthStore();
  const { fetchTask, currentTask: task, updateTaskStatus, addTaskComment, toggleSubtask, isLoading } = useTaskStore();
  
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingStep, setIsUpdatingStep] = useState(false);
  const [completionNote, setCompletionNote] = useState("");
  const [completionAttachments, setCompletionAttachments] = useState<any[]>([]);
  const [completionUploading, setCompletionUploading] = useState(false);
  const [completionSubmitting, setCompletionSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "subtasks" | "activity">("details");
  const completionFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.id) fetchTask(params.id as string);
  }, [params.id, fetchTask]);

  useEffect(() => {
    if (!params.id) return;

    const taskId = params.id as string;
    const channel = supabase
      .channel(`task-detail-${taskId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: `id=eq.${taskId}` },
        () => fetchTask(taskId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.id, fetchTask]);

  const notifyLeadershipAboutComment = async (commentText: string) => {
    if (!task?._id) return;

    const { data: leaders, error } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["ceo", "cto"]);

    if (error || !leaders?.length) return;

    const senderName = me?.name || "A team member";
    const preview = commentText.trim().replace(/\s+/g, " ").slice(0, 120);
    const rows = leaders
      .filter((leader: any) => leader.id !== me?._id)
      .map((leader: any) => ({
        user_id: leader.id,
        type: "task_updated",
        title: "Task comment received",
        body: `${senderName} commented on "${task.title}": ${preview}`,
        ref_id: task._id,
      }));

    if (rows.length > 0) {
      await supabase.from("notifications").insert(rows);
      await sendPushToUsers({
        userIds: rows.map((row) => row.user_id),
        title: "Task comment received",
        body: `${senderName} commented on "${task.title}"`,
        url: `/dashboard/tasks/${task._id}`,
        tag: `task-comment-${task._id}`,
      });
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task?._id || !comment.trim()) return;
    setIsSubmitting(true);
    try {
      await addTaskComment(task._id, { text: comment.trim() });
      await notifyLeadershipAboutComment(comment);
      setComment("");
      toast.success("Comment added");
    } catch (err: any) {
      toast.error(err?.message || "Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    try {
      if (!task?._id) return;
      await toggleSubtask(task._id, subtaskId);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update subtask");
    }
  };

  const handleStepUpdate = async (status: "pending" | "in-progress" | "completed") => {
    if (!task?._id) return;
    setIsUpdatingStep(true);
    try {
      await updateTaskStatus(task._id, status);
      toast.success("Progress step updated.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update progress step.");
    } finally {
      setIsUpdatingStep(false);
    }
  };

  const handleCompletionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setCompletionUploading(true);
    try {
      const result = await uploadAttachments(files);
      if (result.uploaded.length > 0) {
        setCompletionAttachments((prev) => [...prev, ...result.uploaded]);
      }

      if (result.uploaded.length > 0 && result.failed.length === 0) {
        toast.success("Completion files uploaded.");
      } else if (result.uploaded.length > 0 && result.failed.length > 0) {
        toast.warning(`${result.uploaded.length} file(s) uploaded, ${result.failed.length} failed.`);
      } else {
        toast.error(result.failed[0]?.reason || "Failed to upload completion files.");
      }
    } finally {
      setCompletionUploading(false);
      if (completionFileInputRef.current) completionFileInputRef.current.value = "";
    }
  };

  const handleSubmitCompletionProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task?._id) return;
    if (!completionNote.trim() && completionAttachments.length === 0) {
      toast.error("Please add a completion note or attach files.");
      return;
    }

    setCompletionSubmitting(true);
    try {
      if (task.status !== "completed") {
        await updateTaskStatus(task._id, "completed");
      }

      const fileSummary = completionAttachments
        .map((file: any, idx: number) => `${idx + 1}. ${file.fileName || "Attachment"} - ${file.fileUrl || file.url || ""}`)
        .join("\n");

      const completionMessage = [
        "Task completed update:",
        completionNote.trim(),
        fileSummary ? `Evidence files:\n${fileSummary}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      await addTaskComment(task._id, {
        text: completionMessage,
        attachments: completionAttachments,
      });
      await notifyLeadershipAboutComment(`Completion proof submitted. ${completionNote.trim()}`.trim());

      setCompletionNote("");
      setCompletionAttachments([]);
      toast.success("Completion proof sent to CEO/CTO.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit completion proof.");
    } finally {
      setCompletionSubmitting(false);
    }
  };

  const statusToStepLabel = (status: string) => {
    if (status === "in-progress") return "In Progress";
    if (status === "completed") return "Completed";
    return "Started";
  };

  const normalizeProgressStep = (status: string): "pending" | "in-progress" | "completed" => {
    if (status === "completed") return "completed";
    if (status === "in-progress") return "in-progress";
    return "pending";
  };

  const stepIndex = (status: "pending" | "in-progress" | "completed"): number => {
    if (status === "completed") return 2;
    if (status === "in-progress") return 1;
    return 0;
  };

  if (isLoading && !task) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-muted-foreground font-medium animate-pulse">Decrypting mission intelligence...</p>
    </div>
  );

  if (!isLoading && !task) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-muted-foreground font-medium">Task not found or you no longer have access.</p>
        <button
          onClick={() => router.push("/dashboard/tasks")}
          className="px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-secondary/40 transition-colors"
        >
          Back to Tasks
        </button>
      </div>
    );
  }

  const isTeamTask = Boolean(task.teamId && !task.assignedToId);
  const currentUserTeamId =
    typeof me?.team === "string"
      ? me.team
      : (me?.team as { _id?: string } | null | undefined)?._id || null;
  const isDirectAssignee = Boolean(task.assignedToId && me?._id && task.assignedToId === me._id);
  const isTeamAssignee = Boolean(isTeamTask && currentUserTeamId && task.teamId === currentUserTeamId);
  const canUpdateProgress = Boolean(me?._id && (isDirectAssignee || isTeamAssignee));
  const myTeamProgressStatus =
    isTeamTask && me?._id
      ? normalizeProgressStep(task.teamProgress?.find((entry) => entry.userId === me._id)?.status || "pending")
      : normalizeProgressStep(task.status);
  const teamProgressEntries = task.teamProgress || [];
  const teamCompletedCount = teamProgressEntries.filter((entry) => entry.status === "completed").length;
  const currentProgressStep = stepIndex(myTeamProgressStatus);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.back()} 
          className="group flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-all bg-secondary/30 px-4 py-2 rounded-xl border border-border/50"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
        </button>
        <div className="flex gap-2">
           <span className={cn("text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border", getStatusColor(task.status))}>
            {task.status}
          </span>
          <span className={cn("text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border", getPriorityColor(task.priority))}>
            {task.priority} Priority
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-8 border-primary/10 shadow-xl">
            <h1 className="text-3xl font-black text-foreground tracking-tight mb-4">{task.title}</h1>
            <div className="prose prose-invert max-w-none">
              <TaskBriefingView description={task.description} />
            </div>

            {/* Progress Visualization */}
            <div className="mt-8 space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Completion Progress</span>
                <span className="text-2xl font-black text-primary">{task.progress}%</span>
              </div>
              <div className="h-3 w-full bg-secondary rounded-full overflow-hidden p-0.5 border border-border">
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: `${task.progress}%` }} 
                  className="h-full bg-gradient-to-r from-primary via-purple-500 to-blue-500 rounded-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.4)]" 
                />
              </div>
            </div>
          </motion.div>

          {canUpdateProgress && (
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 border border-primary/10">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-widest text-primary">Task Progress Update</p>
                  <h3 className="text-lg font-black text-foreground">Inform CEO / CTO about your task progress</h3>
                  <p className="text-sm text-muted-foreground">
                    Tap the current stage below so leadership gets the realtime update instantly.
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-secondary/30 px-4 py-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Current Task Step</p>
                  <p className="mt-1 text-xl font-black text-foreground">{statusToStepLabel(myTeamProgressStatus)}</p>
                  <div className="mt-4 border-t border-border/60 pt-3">
                    {isTeamTask ? (
                      <>
                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          <span>Team Completion</span>
                          <span className="text-foreground">{teamCompletedCount}/{teamProgressEntries.length || 0}</span>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full border border-border/70 bg-background/40 p-0.5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400"
                            style={{
                              width: `${teamProgressEntries.length > 0 ? (teamCompletedCount / teamProgressEntries.length) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Personal task progress is synced instantly to leadership.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                {([
                  { id: "pending", label: "Started", hint: "Let leadership know you have begun the work." },
                  { id: "in-progress", label: "In Progress", hint: "Show that the task is actively moving forward." },
                  { id: "completed", label: "Completed", hint: "Mark it done and unlock completion proof below." },
                ] as const).map((step) => (
                  (() => {
                    const isCurrentStep = myTeamProgressStatus === step.id;
                    const isPastStep = stepIndex(step.id) < currentProgressStep;
                    const isLocked = isUpdatingStep || isCurrentStep || isPastStep;

                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => handleStepUpdate(step.id)}
                        disabled={isLocked}
                        className={cn(
                          "group flex min-h-[140px] flex-col rounded-2xl border px-4 py-4 text-left transition-all",
                          isCurrentStep
                            ? "border-primary bg-primary/20 shadow-lg shadow-primary/20"
                            : isPastStep
                              ? "border-border bg-secondary/20 opacity-70 cursor-not-allowed"
                              : "border-border bg-secondary/30 hover:border-primary/40 hover:bg-secondary/50"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className={cn("text-sm font-black", isCurrentStep ? "text-primary" : "text-foreground")}>
                            {step.label}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest",
                              isCurrentStep
                                ? "bg-primary text-primary-foreground"
                                : "bg-background/60 text-muted-foreground"
                            )}
                          >
                            {isCurrentStep ? "Active" : isPastStep ? "Locked" : "Set"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.hint}</p>
                        <p className={cn(
                          "mt-auto pt-3 text-[11px] font-medium",
                          isCurrentStep ? "text-primary" : "text-muted-foreground/90"
                        )}>
                          {isCurrentStep
                            ? "Currently broadcasting this stage"
                            : isPastStep
                              ? "Locked after progress advanced"
                              : "Tap to update leadership"}
                        </p>
                      </button>
                    );
                  })()
                ))}
              </div>

              {isTeamTask && teamProgressEntries.length > 0 && (
                <div className="mt-5 rounded-2xl border border-border/60 bg-secondary/20 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Team Progress Board</p>
                    <span className="rounded-full border border-border/70 bg-background/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {teamCompletedCount}/{teamProgressEntries.length} Completed
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {teamProgressEntries.map((entry) => (
                      <div key={entry.userId} className="flex items-center justify-between rounded-xl border border-border/50 bg-background/40 px-3 py-2.5">
                        <span className="text-xs font-medium text-foreground truncate">{entry.userName}</span>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {statusToStepLabel(entry.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Interactive Tabs Section */}
          <div className="space-y-4">
            <div className="flex gap-1 bg-secondary/30 p-1.5 rounded-2xl w-fit border border-border/50">
              {[
                { id: "details", label: "Details", icon: MessageSquare },
                { id: "subtasks", label: `Subtasks (${task.subtasks?.length || 0})`, icon: ListTodo },
                { id: "activity", label: "History", icon: History }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                    activeTab === tab.id ? "bg-background shadow-lg text-primary scale-105" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "subtasks" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass rounded-2xl p-6 space-y-4">
                  {task.subtasks?.length > 0 ? (
                    task.subtasks.map((st) => (
                      <div 
                        key={st._id} 
                        onClick={() => handleToggleSubtask(st._id)}
                        className="group flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:bg-secondary/40 transition-all cursor-pointer"
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                          st.completed ? "bg-primary border-primary text-primary-foreground scale-110 shadow-lg shadow-primary/20" : "border-border group-hover:border-primary/50"
                        )}>
                          {st.completed && <CheckCircle className="w-4 h-4" />}
                        </div>
                        <span className={cn("text-sm font-bold flex-1 transition-all", st.completed ? "text-muted-foreground line-through opacity-50" : "text-foreground")}>
                          {st.title}
                        </span>
                        {st.assignedTo && (
                          <div className={cn("text-[10px] px-2 py-1 rounded bg-secondary/50 font-bold border border-border")}>
                            {st.assignedTo.name}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-sm text-muted-foreground">No subtasks defined. Break this mission down!</p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === "details" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                  {canUpdateProgress && myTeamProgressStatus === "completed" && (
                    <div className="glass rounded-2xl p-6">
                      <h3 className="text-lg font-black mb-2">Completion Proof</h3>
                      <p className="text-xs text-muted-foreground mb-5">
                        Share what was completed, with files/images if needed. This will be visible to CEO/CTO.
                      </p>
                      <form onSubmit={handleSubmitCompletionProof} className="space-y-4">
                        <textarea
                          value={completionNote}
                          onChange={(e) => setCompletionNote(e.target.value)}
                          placeholder="Explain what was completed, key output, and any blockers solved..."
                          className="w-full bg-secondary/50 border border-border rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition-all"
                          rows={4}
                        />

                        <div
                          onClick={() => completionFileInputRef.current?.click()}
                          className="border border-dashed border-border rounded-2xl p-4 cursor-pointer hover:border-primary/40 transition-colors"
                        >
                          <input
                            ref={completionFileInputRef}
                            type="file"
                            multiple
                            hidden
                            onChange={handleCompletionUpload}
                          />
                          <div className="flex items-center gap-2 text-sm text-foreground font-medium">
                            <Upload className="w-4 h-4 text-primary" />
                            <span>Add evidence files (images/docs)</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Click to upload files for completion evidence</p>
                        </div>

                        {completionAttachments.length > 0 && (
                          <div className="space-y-2">
                            {completionAttachments.map((file, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-2 rounded-xl border border-border p-2.5 bg-secondary/30">
                                <span className="text-xs text-foreground truncate">{file.fileName || `Attachment ${idx + 1}`}</span>
                                <button
                                  type="button"
                                  onClick={() => setCompletionAttachments((prev) => prev.filter((_, i) => i !== idx))}
                                  className="p-1 rounded hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={completionSubmitting || completionUploading}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-60"
                        >
                          {completionSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Submit Completion Update
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Comments System */}
                  <div className="glass rounded-2xl p-6">
                    <h3 className="text-lg font-black mb-6">Internal Intelligence (Comments)</h3>
                    <div className="space-y-6 mb-8">
                      {task.comments?.length ? (
                        task.comments.map((c) => (
                          <div key={c._id} className="rounded-2xl border border-border/50 bg-background/20 p-3">
                            <div className="flex items-start gap-3">
                              <div className="mt-1 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20 shrink-0">
                              {getInitial(c.user?.name, c.user?.email)}
                              </div>
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-xs font-black uppercase tracking-widest text-foreground">{getDisplayName(c.user?.name, c.user?.email)}</span>
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatRelativeTime(c.createdAt)}</span>
                                </div>
                                <div className="bg-secondary/40 rounded-2xl p-4 border border-border/50 space-y-3">
                                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{c.text}</p>
                                  {c.attachments?.length > 0 && (
                                    <div className="grid gap-2">
                                      {c.attachments.map((file, fileIndex) => (
                                        <a
                                          key={`${c._id}-${fileIndex}`}
                                          href={file.fileUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2 hover:border-primary/40 transition-colors"
                                        >
                                          <div className="flex min-w-0 items-center gap-2">
                                            <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
                                            <span className="truncate text-xs font-medium text-foreground">{file.fileName || `Attachment ${fileIndex + 1}`}</span>
                                          </div>
                                          <span className="text-[10px] uppercase text-muted-foreground">
                                            {(file.fileType || "file").split("/")[1] || file.fileType || "file"}
                                          </span>
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-border/50 bg-secondary/20 px-4 py-6 text-sm text-muted-foreground">
                          No comments yet. The first update here will show instantly for the team.
                        </div>
                      )}
                    </div>
                    <form onSubmit={handleAddComment} className="relative">
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Intercept and share your briefing..."
                        className="w-full bg-secondary/50 border border-border rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition-all pr-16"
                        rows={3}
                      />
                      <button 
                        type="submit" 
                        disabled={isSubmitting || !comment.trim()}
                        className="absolute right-4 bottom-4 p-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                </motion.div>
              )}

              {activeTab === "activity" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass rounded-2xl p-6">
                  <div className="relative pl-8 space-y-8">
                    <div className="absolute left-3.5 top-2 bottom-2 w-px bg-gradient-to-b from-primary via-purple-500/30 to-border" />
                    {task.activity?.map((act, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-primary border-4 border-background ring-4 ring-primary/10 shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] uppercase font-black tracking-widest text-primary">{act.action.replace('_', ' ')}</span>
                             <span className="text-[10px] text-muted-foreground">• {formatRelativeTime(act.timestamp)}</span>
                          </div>
                          <p className="text-sm font-bold text-foreground">{act.details}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Users className="w-3 h-3" /> Initiated by {act.user?.name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sidebar Intelligence */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass rounded-3xl p-6 space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-4">Mission Assets</h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center p-2.5">
                  <Globe className="w-full h-full text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Visibility</p>
                  <p className="text-sm font-bold capitalize">{task.visibility || "Standard"}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center p-2.5">
                  <Users className="w-full h-full text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Operative Assigned</p>
                  <p className="text-sm font-bold">{task.assignedTo?.name || "Unassigned"}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center p-2.5">
                  <Clock className="w-full h-full text-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Deadline</p>
                  <p className="text-sm font-bold">{task.dueDate ? formatDate(task.dueDate) : "Undetermined"}</p>
                </div>
              </div>
            </div>

            {canUpdateProgress && (
              <div className="space-y-2 pt-4 border-t border-border/50">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Progress Sync</p>
                <p className="text-sm text-foreground font-bold">{statusToStepLabel(myTeamProgressStatus)}</p>
                {isTeamTask && (
                  <p className="text-xs text-muted-foreground">
                    Team completion: <span className="text-foreground font-medium">{teamCompletedCount}/{teamProgressEntries.length || 0}</span>
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Assigned users can update progress from the main task panel.
                </p>
              </div>
            )}

            <div className="space-y-4 pt-4 border-t border-border/50">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Attachments</p>
              {task.attachments?.length > 0 ? (
                <div className="grid gap-2">
                  {task.attachments.map((file, i) => (
                    <a key={i} href={file.fileUrl} target="_blank" className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border/50 hover:border-primary/50 transition-all group">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Paperclip className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-xs font-bold text-foreground truncate">{file.fileName}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 uppercase">{file.fileType.split('/')[1]}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No assets attached to this mission.</p>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
