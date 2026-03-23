"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Users, Search, Edit3, Trash2, X, Plus, Filter,
} from "lucide-react";
import { useAdminStore } from "@/store/adminStore";
import { useAuthStore } from "@/store/authStore";
import { User, Team } from "@/lib/types";
import { cn, getRoleColor, formatDate, isAdmin } from "@/lib/utils";
import { toast } from "sonner";

type Tab = "users" | "teams";
const roles = ["CEO", "CTO", "Member"];

function UserModal({ user, allTeams, onClose }: { user?: User; allTeams: Team[]; onClose: () => void }) {
  const { createUser, updateUser } = useAdminStore();
  const isEdit = !!user;
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>(user?.role || "Member");
  const [team, setTeam] = useState<string>(user?.team?._id || "");
  const [loading, setLoading] = useState(false);

  // If role isn't Member, clear team visually
  useEffect(() => {
    if (role !== "Member") setTeam("");
  }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === "Member" && !team) return toast.error("Please select a team for the Member");

    setLoading(true);
    try {
      if (isEdit) {
        await updateUser(user!._id, { name, role, team: role === "Member" ? team : null } as any);
        toast.success("User updated");
      } else {
        await createUser({ name, email, password, role, team: role === "Member" ? team : undefined });
        toast.success("User created");
      }
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed");
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="glass rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground">{isEdit ? "Edit User" : "Create User"}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          {!isEdit && (
            <>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 6)"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </>
          )}
          <select value={role} onChange={(e) => setRole(e.target.value)}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
            {roles.map((r) => <option key={r}>{r}</option>)}
          </select>
          
          <div className="relative">
            <select value={team} onChange={(e) => setTeam(e.target.value)} required={role === "Member"} disabled={role !== "Member"}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50">
              <option value="">Select Team...</option>
              {allTeams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
            {role !== "Member" && <div className="absolute inset-0" title="CEO/CTO do not require a team" />}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60">
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function TeamModal({ team, allUsers, onClose }: { team?: Team; allUsers: User[]; onClose: () => void }) {
  const { createTeam, updateTeam } = useAdminStore();
  const isEdit = !!team;
  const [name, setName] = useState(team?.name || "");
  const [description, setDescription] = useState(team?.description || "");
  const [managerId, setManagerId] = useState(team?.manager?._id || "");
  const [memberIds, setMemberIds] = useState<string[]>(team?.members?.map((m) => typeof m === 'string' ? m : m._id) || []);
  const [loading, setLoading] = useState(false);

  const managers = allUsers.filter((u) => isAdmin(u.role));
  const members = allUsers.filter((u) => u.role === "Member");

  const toggleMember = (id: string) => {
    setMemberIds((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerId) return toast.error("Select a manager");
    setLoading(true);
    try {
      if (isEdit) {
        await updateTeam(team!._id, { name, description, manager: managerId, members: memberIds });
        toast.success("Team updated");
      } else {
        await createTeam({ name, description, managerId, memberIds });
        toast.success("Team created");
      }
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed");
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="glass rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground">{isEdit ? "Edit Team" : "Create Team"}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Manager *</label>
            <select value={managerId} onChange={(e) => setManagerId(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="">Select manager...</option>
              {managers.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Members</label>
            <div className="max-h-40 overflow-y-auto border border-border rounded-lg bg-card divide-y divide-border">
              {members.map((u) => (
                <label key={u._id} className="flex items-center gap-2 px-3 py-2 hover:bg-secondary cursor-pointer transition-colors">
                  <input type="checkbox" checked={memberIds.includes(u._id)} onChange={() => toggleMember(u._id)} className="accent-primary" />
                  <span className="text-sm text-foreground">{u.name}</span>
                </label>
              ))}
              {members.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No members registered</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60">
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default function AdminPage() {
  const { user: me } = useAuthStore();
  const { users, teams, fetchUsers, fetchTeams, deleteUser, deleteTeam, isLoading } = useAdminStore();
  const [tab, setTab] = useState<Tab>("users");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [userModal, setUserModal] = useState<{ open: boolean; user?: User }>({ open: false });
  const [teamModal, setTeamModal] = useState<{ open: boolean; team?: Team }>({ open: false });

  // Add debounced refetch mechanism to ensure sync across windows or after edits
  useEffect(() => { fetchUsers(); fetchTeams(); }, []);

  const filteredUsers = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    const matchTeam = !teamFilter || u.team?._id === teamFilter;
    return matchSearch && matchRole && matchTeam;
  });

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Delete this user?")) return;
    try { 
      await deleteUser(id); 
      // Refresh teams fully since members array might be out of date
      fetchTeams();
      toast.success("User deleted"); 
    } catch { toast.error("Failed"); }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm("Delete this team?")) return;
    try { 
      await deleteTeam(id); 
      fetchUsers();
      toast.success("Team deleted"); 
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl"><ShieldCheck className="w-5 h-5 text-primary" /></div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Admin Panel</h2>
            <p className="text-sm text-muted-foreground">Manage users, teams, and organization structure</p>
          </div>
        </div>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => tab === "users" ? setUserModal({ open: true }) : setTeamModal({ open: true })}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> {tab === "users" ? "Add User" : "Create Team"}
        </motion.button>
      </div>

      <div className="flex gap-1 p-1 bg-secondary rounded-lg w-fit">
        {(["users", "teams"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-4 py-2 text-sm font-medium rounded-md transition-colors",
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}>
            {t === "users" ? "Users" : "Teams"} ({t === "users" ? users.length : teams.length})
          </button>
        ))}
      </div>

      {tab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-secondary flex-1 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">All Roles</option>
                {roles.map((r) => <option key={r}>{r}</option>)}
              </select>
              <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
                className="bg-secondary flex-1 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">All Teams</option>
                {teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="glass rounded-xl overflow-hidden overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="grid grid-cols-[1fr_1fr_auto_1fr_auto_auto] gap-4 px-5 py-3 border-b border-border bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span>User</span><span>Email</span><span className="w-20 text-center">Role</span><span>Team</span><span>Joined</span><span className="w-16 text-right w-full">Actions</span>
              </div>
              {isLoading ? [...Array(4)].map((_, i) => <div key={i} className="h-14 animate-pulse bg-secondary/30 border-b border-border" />) :
                filteredUsers.length === 0 ? <p className="text-center text-muted-foreground text-sm py-6">No users found</p> :
                filteredUsers.map((u, i) => (
                  <motion.div key={u._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="grid grid-cols-[1fr_1fr_auto_1fr_auto_auto] gap-4 items-center px-5 py-3 border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">{u.name[0]}</div>
                      <span className="text-sm font-medium text-foreground truncate">{u.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground truncate">{u.email}</span>
                    <span className={cn("text-xs px-2 py-1 rounded font-medium w-20 text-center", getRoleColor(u.role))}>{u.role}</span>
                    <div className="flex items-center">
                      {u.team ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-secondary px-2 py-1 rounded-md border border-border">
                          <Users className="w-3 h-3 text-primary" /> {u.team.name}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground px-2 py-1 border border-border/50 rounded border-dashed">No team</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground w-20">{formatDate(u.createdAt)}</span>
                    <div className="flex items-center gap-1.5 w-16 justify-end">
                      <button onClick={() => setUserModal({ open: true, user: u })}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                      {me?.role === "CEO" && u._id !== me?._id && (
                        <button onClick={() => handleDeleteUser(u._id)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </motion.div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {tab === "teams" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {isLoading ? [...Array(3)].map((_, i) => <div key={i} className="animate-pulse bg-secondary rounded-2xl h-48" />) :
            teams.length === 0 ? <p className="col-span-full text-center text-muted-foreground text-sm py-8">No teams created yet</p> :
            teams.map((team) => (
              <motion.div key={team._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="glass rounded-2xl p-5 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0"><Users className="w-5 h-5 text-primary" /></div>
                    <div>
                      <h3 className="font-semibold text-foreground">{team.name}</h3>
                      {team.description && <p className="text-xs text-muted-foreground mt-0.5">{team.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setTeamModal({ open: true, team })}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDeleteTeam(team._id)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1.5">Manager</p>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold">{team.manager?.name?.[0]}</div>
                    <span className="text-sm font-medium text-foreground">{team.manager?.name}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", getRoleColor(team.manager?.role))}>{team.manager?.role}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">{team.members.length} members</p>
                  <div className="flex -space-x-2">
                    {team.members.slice(0, 6).map((m) => (
                      <div key={m._id} title={m.name} className="w-7 h-7 rounded-full bg-primary/20 border-2 border-card flex items-center justify-center text-primary text-xs font-bold">{m.name[0]}</div>
                    ))}
                    {team.members.length > 6 && (
                      <div className="w-7 h-7 rounded-full bg-secondary border-2 border-card flex items-center justify-center text-muted-foreground text-xs font-medium">+{team.members.length - 6}</div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          }
        </div>
      )}

      <AnimatePresence>
        {userModal.open && <UserModal user={userModal.user} allTeams={teams} onClose={() => { setUserModal({ open: false }); fetchUsers(); fetchTeams(); }} />}
        {teamModal.open && <TeamModal team={teamModal.team} allUsers={users} onClose={() => { setTeamModal({ open: false }); fetchTeams(); fetchUsers(); }} />}
      </AnimatePresence>
    </div>
  );
}
