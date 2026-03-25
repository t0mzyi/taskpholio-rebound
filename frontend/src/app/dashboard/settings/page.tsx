"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { Shield, Globe, Clock, Camera, Loader2 } from "lucide-react";
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
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

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

  const handlePasswordUpdate = async () => {
    const trimmedPassword = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedPassword || !trimmedConfirm) {
      toast.error("Please enter and confirm the new password.");
      return;
    }

    if (trimmedPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      toast.error("Password confirmation does not match.");
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: trimmedPassword });
      if (error) throw error;
      toast.success("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update password.");
    } finally {
      setChangingPassword(false);
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
              <button type="button" className="saas-quick-link" onClick={() => setShowPasswordForm((prev) => !prev)}>
                {showPasswordForm ? "Cancel Password Change" : "Change Password"}
              </button>

              {showPasswordForm && (
                <div className="saas-list-item" style={{ marginTop: "0.5rem" }}>
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    <label className="saas-settings-field">
                      <span className="saas-settings-label">New Password</span>
                      <input
                        type="password"
                        className="saas-settings-value"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="Enter new password"
                      />
                    </label>
                    <label className="saas-settings-field">
                      <span className="saas-settings-label">Confirm Password</span>
                      <input
                        type="password"
                        className="saas-settings-value"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Re-enter new password"
                      />
                    </label>

                    <button type="button" className="saas-btn-primary" onClick={handlePasswordUpdate} disabled={changingPassword}>
                      {changingPassword ? "Updating..." : "Update Password"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </article>
        </aside>

        <section style={{ display: "grid", gap: "0.9rem" }}>
          <article className="saas-glass saas-settings-card">
              <div className="saas-pill-row" style={{ justifyContent: "space-between" }}>
                <div className="saas-pill-row">
                  <Globe size={15} style={{ color: "#8f97ff" }} />
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
            </div>
          </article>
        </section>
      </section>
    </div>
  );
}
