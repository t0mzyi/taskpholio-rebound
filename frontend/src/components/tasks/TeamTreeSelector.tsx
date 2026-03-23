"use client";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, Users, User as UserIcon, Check } from "lucide-react";
import { User, Team } from "@/lib/types";
import { cn, getRoleColor } from "@/lib/utils";

interface Props {
  users: User[];
  teams: Team[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export default function TeamTreeSelector({ users, teams, selected, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const ctos = users.filter((u) => u.role === "CTO");
  const unassigned = users.filter((u) => u.role === "Member" && !teams.some((t) => t.members.some((m) => (typeof m === 'string' ? m : m._id) === u._id)));

  const filteredTeams = useMemo(() => {
    if (!search) return teams;
    const q = search.toLowerCase();
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.members.some((m) => (typeof m === 'string' ? m : m.name).toLowerCase().includes(q))
    );
  }, [teams, search]);

  const filteredCTOs = useMemo(() => {
    if (!search) return ctos;
    return ctos.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()));
  }, [ctos, search]);

  const toggleUser = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const toggleTeam = (team: Team) => {
    const memberIds = team.members.map((m) => typeof m === 'string' ? m : m._id);
    const allSelected = memberIds.every((id) => selected.includes(id));
    if (allSelected) {
      onChange(selected.filter((s) => !memberIds.includes(s)));
    } else {
      onChange([...new Set([...selected, ...memberIds])]);
    }
  };

  const toggleExpand = (teamId: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      next.has(teamId) ? next.delete(teamId) : next.add(teamId);
      return next;
    });
  };

  const isAllTeamSelected = (team: Team) => team.members.every((m) => selected.includes(typeof m === 'string' ? m : m._id));
  const isSomeTeamSelected = (team: Team) => team.members.some((m) => selected.includes(typeof m === 'string' ? m : m._id));

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search users or teams..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-secondary border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Selected Tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const user = users.find((u) => u._id === id);
            if (!user) return null;
            return (
              <motion.span
                key={id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex items-center gap-1.5 text-xs px-2 py-1 bg-primary/15 text-primary border border-primary/20 rounded-full font-medium cursor-pointer hover:bg-primary/25 transition-colors"
                onClick={() => toggleUser(id)}
              >
                <span className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">
                  {user.name[0]}
                </span>
                {user.name}
                <span className="text-primary/50">×</span>
              </motion.span>
            );
          })}
        </div>
      )}

      {/* Tree */}
      <div className="max-h-64 overflow-y-auto border border-border rounded-xl divide-y divide-border bg-card">
        {/* CTOs */}
        {filteredCTOs.length > 0 && (
          <div className="p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 mb-1">CTO</p>
            {filteredCTOs.map((cto) => (
              <UserRow key={cto._id} user={cto} selected={selected.includes(cto._id)} onToggle={() => toggleUser(cto._id)} />
            ))}
          </div>
        )}

        {/* Teams */}
        {filteredTeams.map((team) => (
          <div key={team._id} className="p-2">
            {/* Team Header */}
            <div
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary cursor-pointer transition-colors"
              onClick={() => toggleExpand(team._id)}
            >
              <motion.div animate={{ rotate: expandedTeams.has(team._id) ? 90 : 0 }}>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              </motion.div>
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground flex-1">{team.name}</span>
              <span className="text-[10px] text-muted-foreground">{team.members.length} members</span>
              <button
                onClick={(e) => { e.stopPropagation(); toggleTeam(team); }}
                className={cn(
                  "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                  isAllTeamSelected(team)
                    ? "bg-primary border-primary text-primary-foreground"
                    : isSomeTeamSelected(team)
                    ? "bg-primary/30 border-primary/50"
                    : "border-border hover:border-primary/50"
                )}
              >
                {(isAllTeamSelected(team) || isSomeTeamSelected(team)) && <Check className="w-3 h-3" />}
              </button>
            </div>

            {/* Members */}
            <AnimatePresence>
              {expandedTeams.has(team._id) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden ml-5 mt-1 space-y-0.5"
                >
                  {team.members.map((member) => (
                    <UserRow
                      key={member._id}
                      user={member}
                      selected={selected.includes(member._id)}
                      onToggle={() => toggleUser(member._id)}
                    />
                  ))}
                  {team.members.length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-1">No members</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {/* Unassigned Members */}
        {unassigned.length > 0 && (
          <div className="p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 mb-1">Unassigned</p>
            {unassigned
              .filter((u) => !search || u.name.toLowerCase().includes(search.toLowerCase()))
              .map((u) => (
                <UserRow key={u._id} user={u} selected={selected.includes(u._id)} onToggle={() => toggleUser(u._id)} />
              ))}
          </div>
        )}

        {filteredTeams.length === 0 && filteredCTOs.length === 0 && unassigned.length === 0 && (
          <p className="text-center text-muted-foreground text-xs py-4">No results found</p>
        )}
      </div>
    </div>
  );
}

function UserRow({ user, selected, onToggle }: { user: User; selected: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
        selected ? "bg-primary/10" : "hover:bg-secondary"
      )}
    >
      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
        {user.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{user.name}</p>
      </div>
      <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", getRoleColor(user.role))}>{user.role}</span>
      <div className={cn(
        "w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0",
        selected ? "bg-primary border-primary text-primary-foreground" : "border-border"
      )}>
        {selected && <Check className="w-2.5 h-2.5" />}
      </div>
    </div>
  );
}
