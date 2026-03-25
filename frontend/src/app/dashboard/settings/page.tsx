"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { Shield, Globe, Clock, Zap, Lock, Download, Trash2, Camera, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { getDisplayName, getInitial, normalizeUserRole } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { uploadAttachments } from "@/lib/uploadAttachments";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, setAuth, token } = useAuthStore();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(getDisplayName(user?.name, user?.email));
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const teamName = useMemo(() => {
    if (!user?.team) return "No Team";
    if (typeof user.team === "string") return user.team;
    return user.team?.name || "No Team";
  }, [user?.team]);

  const saveProfile = async () => {
    if (!user?._id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user._id);
      if (error) throw error;
      setAuth({ ...user, name: fullName }, token || "");
      toast.success("Settings updated");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?._id) return;

    setUploadingAvatar(true);
    try {
      const result = await uploadAttachments([file], { imageOnly: true, maxSizeBytes: 5 * 1024 * 1024 });
      if (!result.uploaded.length) {
        throw new Error(result.failed[0]?.reason || "Avatar upload failed.");
      }

      const avatarUrl = result.uploaded[0].fileUrl;
      const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user._id);
      if (error) throw error;

      setAuth({ ...user, avatar: avatarUrl }, token || "");
      toast.success("Profile photo updated");
    } catch (error: any) {
      toast.error(error?.message || "Unable to update profile photo.");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  if (!user) {
    return <div className="saas-empty">Loading settings...</div>;
  }

  return (
    <div className="saas-page">
      <header className="saas-header">
        <div>
          <p className="saas-heading-eyebrow">Configuration</p>
          <h1 className="saas-heading-title">Settings</h1>
          <p className="saas-heading-subtitle">Manage tactical preferences & operational parameters</p>
        </div>
      </header>

      <section className="saas-settings-grid">
        <aside style={{ display: "grid", gap: "0.9rem" }}>
          <article className="saas-glass saas-settings-card">
            <div className="saas-profile-avatar" style={{ overflow: "hidden" }}>
              {user.avatar ? (
                <img src={user.avatar} alt={getDisplayName(user?.name, user?.email)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                getInitial(user?.name, user?.email)
              )}
            </div>
            <button
              type="button"
              className="saas-btn-secondary"
              style={{ position: "relative", top: "-0.8rem", left: "50%", transform: "translateX(-50%)" }}
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />} Update
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />

            <div style={{ textAlign: "center", marginTop: "-0.25rem" }}>
              <p className="saas-team-title">{getDisplayName(user?.name, user?.email)}</p>
              <p className="saas-team-subtitle">{user?.email}</p>
              <span className="saas-chip primary" style={{ marginTop: "0.45rem" }}>
                Member Status - Active
              </span>
            </div>

            <div style={{ display: "grid", gap: "0.6rem", marginTop: "0.9rem" }}>
              <label className="saas-settings-field">
                <span className="saas-settings-label">Full Name</span>
                <input className="saas-settings-value" value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </label>

              <label className="saas-settings-field">
                <span className="saas-settings-label">Email</span>
                <input className="saas-settings-value" value={user.email} disabled />
              </label>

              <label className="saas-settings-field">
                <span className="saas-settings-label">Role</span>
                <input className="saas-settings-value" value={normalizeUserRole(user.role)} disabled />
              </label>

              <label className="saas-settings-field">
                <span className="saas-settings-label">Team</span>
                <input className="saas-settings-value" value={teamName} disabled />
              </label>
            </div>

            <button type="button" className="saas-btn-primary" style={{ width: "100%", marginTop: "0.86rem" }} onClick={saveProfile} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </article>

          <article className="saas-glass saas-settings-card">
            <div className="saas-pill-row" style={{ justifyContent: "space-between" }}>
              <div className="saas-pill-row">
                <Shield size={15} style={{ color: "#34d399" }} />
                <p className="saas-card-title" style={{ fontSize: "1rem" }}>Security Clearance</p>
              </div>
            </div>
            <p className="saas-card-sub" style={{ marginTop: "0.5rem" }}>
              Your account is secured with RSA-2048 encryption and multi-factor intelligence protocols.
            </p>

            <div className="saas-list">
              <button type="button" className="saas-quick-link">Change Password</button>
              <button type="button" className="saas-quick-link">Two-Factor Auth</button>
              <button type="button" className="saas-quick-link">Active Sessions</button>
            </div>
          </article>
        </aside>

        <section style={{ display: "grid", gap: "0.9rem" }}>
          <article className="saas-glass saas-settings-card">
            <div className="saas-pill-row" style={{ justifyContent: "space-between" }}>
              <div className="saas-pill-row">
                <Zap size={15} style={{ color: "#8f97ff" }} />
                <p className="saas-card-title" style={{ fontSize: "1rem" }}>System Parameters</p>
              </div>
            </div>

            <div className="saas-list">
              <div className="saas-list-item">
                <div className="saas-pill-row" style={{ justifyContent: "space-between" }}>
                  <span className="saas-pill-row"><Globe size={13} /> <span className="saas-settings-label">Operational Language</span></span>
                  <span className="saas-team-subtitle">Standard Intelligence Format</span>
                </div>
                <p className="saas-list-title">English (Unified)</p>
              </div>

              <div className="saas-list-item">
                <div className="saas-pill-row" style={{ justifyContent: "space-between" }}>
                  <span className="saas-pill-row"><Clock size={13} /> <span className="saas-settings-label">Timezone Sync</span></span>
                  <span className="saas-team-subtitle">Automatic Tactical Sync</span>
                </div>
                <p className="saas-list-title">UTC+05:30 (IST)</p>
              </div>

              <div className="saas-list-item">
                <div className="saas-pill-row" style={{ justifyContent: "space-between" }}>
                  <span className="saas-pill-row"><Zap size={13} /> <span className="saas-settings-label">Interface Velocity</span></span>
                  <span className="saas-team-subtitle">Optimized for Mission Speed</span>
                </div>
                <p className="saas-list-title">High Performance</p>
              </div>

              <div className="saas-list-item">
                <div className="saas-pill-row" style={{ justifyContent: "space-between" }}>
                  <span className="saas-pill-row"><Lock size={13} /> <span className="saas-settings-label">Data Privacy</span></span>
                  <span className="saas-team-subtitle">Metadata Redacted by Default</span>
                </div>
                <p className="saas-list-title">Strict Encryption</p>
              </div>
            </div>
          </article>

          <article className="saas-glass saas-settings-card">
            <div className="saas-pill-row">
              <div style={{ width: "0.42rem", height: "0.42rem", borderRadius: "999px", background: "#22c55e" }} />
              <p className="saas-card-title" style={{ fontSize: "1rem" }}>Application Matrix</p>
            </div>

            <div style={{ marginTop: "0.7rem", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "0.55rem" }}>
              {[
                ["Matrix Code", "v1.4.2-PROD"],
                ["Core Protocol", "NextFS-Elite"],
                ["Build Status", "Stable"],
                ["Last Deploy", "Mar 25, 2026"],
              ].map(([label, value]) => (
                <div key={label} className="saas-list-item" style={{ marginTop: 0 }}>
                  <p className="saas-settings-label">{label}</p>
                  <p className="saas-list-title">{value}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="saas-glass saas-settings-card saas-danger-zone">
            <p className="saas-danger-title">Danger Zone</p>
            <p className="saas-card-sub">These actions are irreversible. Please proceed with caution.</p>
            <div className="saas-pill-row" style={{ marginTop: "0.7rem" }}>
              <button type="button" className="saas-btn-secondary" style={{ borderColor: "rgba(239,68,68,0.5)", color: "#fca5a5" }}>
                <Trash2 size={14} /> Delete Account
              </button>
              <button type="button" className="saas-btn-secondary">
                <Download size={14} /> Export Data
              </button>
            </div>
          </article>
        </section>
      </section>
    </div>
  );
}
