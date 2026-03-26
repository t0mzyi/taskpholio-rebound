"use client";

import { useEffect, useMemo, useState } from "react";
import { Code2, Megaphone, Shield, Search, Users } from "lucide-react";
import { useAdminStore } from "@/store/adminStore";
import { getDisplayName, getInitial, normalizeUserRole } from "@/lib/utils";

type TeamSection = {
  key: "technical" | "social" | "cybersecurity";
  title: string;
  subtitle: string;
  aliases: string[];
  icon: typeof Code2;
};

const TEAM_SECTIONS: TeamSection[] = [
  {
    key: "technical",
    title: "Technical Team",
    subtitle: "Engineering & development",
    aliases: ["technical", "tech", "engineering", "developer", "development"],
    icon: Code2,
  },
  {
    key: "social",
    title: "Social Media Team",
    subtitle: "Content & growth",
    aliases: ["social", "media", "marketing", "content"],
    icon: Megaphone,
  },
  {
    key: "cybersecurity",
    title: "Cybersecurity Team",
    subtitle: "Security & compliance",
    aliases: ["cyber", "security", "infosec"],
    icon: Shield,
  },
];

const normalize = (value: string | undefined | null) => (value || "").toLowerCase().trim();

function MemberAvatar({ member }: { member: any }) {
  const [imageFailed, setImageFailed] = useState(false);
  const avatarUrl = typeof member?.avatar === "string" ? member.avatar.trim() : "";
  const hasImage = avatarUrl.length > 0 && !imageFailed;

  if (hasImage) {
    return (
      <img
        src={avatarUrl}
        alt={`${getDisplayName(member?.name, member?.email)} avatar`}
        className="saas-member-avatar saas-member-avatar-image"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return <span className="saas-member-avatar">{getInitial(member?.name, member?.email)}</span>;
}

export default function TeamsPage() {
  const { teams, fetchTeams, isLoading } = useAdminStore();
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const membersBySection = useMemo(() => {
    const result: Record<TeamSection["key"], any[]> = {
      technical: [],
      social: [],
      cybersecurity: [],
    };

    TEAM_SECTIONS.forEach((section) => {
      const matchedTeams = (teams || []).filter((team: any) => {
        const teamName = normalize(team?.name);
        return section.aliases.some((alias) => teamName.includes(alias));
      });

      const allMembers = matchedTeams.flatMap((team: any) =>
        (team?.members || []).map((member: any) => ({
          ...member,
          __teamName: team?.name || section.title,
        }))
      );

      const deduped = Array.from(
        new Map(allMembers.map((member: any) => [member?._id || member?.email, member])).values()
      );

      result[section.key] = deduped;
    });

    return result;
  }, [teams]);

  const allMembers = useMemo(() => {
    const merged = Object.values(membersBySection).flat();
    const deduped = Array.from(
      new Map(merged.map((member: any) => [member?._id || member?.email, member])).values()
    );

    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return deduped;

    return deduped.filter((member: any) => {
      const teamName = normalize(member.__teamName);
      const displayName = normalize(getDisplayName(member?.name, member?.email));
      const email = normalize(member?.email);
      return (
        displayName.includes(normalizedSearch) ||
        email.includes(normalizedSearch) ||
        teamName.includes(normalizedSearch)
      );
    });
  }, [membersBySection, search]);

  return (
    <div className="saas-page">
      <header className="saas-header">
        <div>
          <p className="saas-heading-eyebrow">Organization</p>
          <h1 className="saas-heading-title">Teams</h1>
          <p className="saas-heading-subtitle">Technical, Social, Cybersecurity team members</p>
        </div>

        <label className="saas-inline-input">
          <Search size={14} />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search teams..."
          />
        </label>
      </header>

      <section className="saas-team-grid">
        {TEAM_SECTIONS.map((section) => {
          const Icon = section.icon;
          const members = membersBySection[section.key] || [];

          return (
            <article key={section.key} className="saas-glass saas-team-card">
              <div className="saas-team-head">
                <div style={{ display: "flex", gap: "0.62rem", minWidth: 0 }}>
                  <div className="saas-team-icon">
                    <Icon size={15} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p className="saas-team-title">{section.title}</p>
                    <p className="saas-team-subtitle">{section.subtitle}</p>
                  </div>
                </div>
                <span className="saas-chip">
                  <Users size={11} style={{ marginRight: "0.25rem" }} />
                  {members.length} member{members.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="saas-team-members">
                {isLoading ? (
                  <p className="saas-empty">Loading members...</p>
                ) : members.length === 0 ? (
                  <p className="saas-empty">No members in this team yet.</p>
                ) : (
                  members.map((member: any) => (
                    <div key={member?._id || member?.email} className="saas-member-row">
                      <div className="saas-member-left">
                        <MemberAvatar member={member} />
                        <div style={{ minWidth: 0 }}>
                          <p className="saas-member-name">{getDisplayName(member?.name, member?.email)}</p>
                          <p className="saas-member-mail">{member?.email || "No email"}</p>
                        </div>
                      </div>
                      <span className="saas-role-pill">{normalizeUserRole(member?.role)}</span>
                    </div>
                  ))
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="saas-glass saas-team-table-card">
        <div className="saas-card-head">
          <div>
            <h3 className="saas-card-title">All Members</h3>
            <p className="saas-card-sub">
              {allMembers.length} people across {Object.values(membersBySection).filter((items) => items.length > 0).length} teams
            </p>
          </div>
        </div>

        <div className="saas-table-wrap">
          <table className="saas-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Team</th>
                <th>Role</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {allMembers.map((member: any) => (
                <tr key={member?._id || member?.email}>
                  <td>
                    <div className="saas-member-left">
                      <MemberAvatar member={member} />
                      <span className="saas-member-name">{getDisplayName(member?.name, member?.email)}</span>
                    </div>
                  </td>
                  <td className="muted">{member.__teamName || "No Team"}</td>
                  <td>
                    <span className="saas-role-pill">{normalizeUserRole(member?.role)}</span>
                  </td>
                  <td className="muted">{member?.email || "-"}</td>
                </tr>
              ))}
              {allMembers.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <p className="saas-empty">No team members available yet.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
