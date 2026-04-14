"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Plus, Copy, Check, Search, Mail, Building, ListTodo, ChevronRight, Settings2, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { getInitial } from "@/lib/utils";
import { AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/authStore";

type ClientType = {
  _id: string;
  name: string;
  email: string;
  company: string;
  status: "pending" | "active" | "inactive";
  createdAt: string;
};

export default function ClientsPage() {
  const router = useRouter();
  const { isAuthenticated, token, isLoading: authLoading } = useAuthStore();
  const hasFetched = useRef(false);
  const [clients, setClients] = useState<ClientType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState({ name: "", email: "", company: "" });
  const [submitting, setSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientType | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await api.get("/clients");
      setClients(res.data.data.clients || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to fetch clients");
    } finally {
      setLoading(false);
    }
  };

  // Only fetch after auth is fully hydrated — prevents error flash on browser refresh.
  // We depend on BOTH isAuthenticated AND token because on a hard refresh:
  // - `token` is rehydrated from localStorage immediately (it's in partialize)
  // - `isAuthenticated` starts as false and becomes true after fetchMe() resolves
  // By triggering on either becoming truthy, we catch both the normal flow and the
  // refresh flow. The `hasFetched` ref prevents double-fetching.
  useEffect(() => {
    if ((isAuthenticated || token) && !hasFetched.current) {
      hasFetched.current = true;
      fetchClients();
    }
  }, [isAuthenticated, token]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.company) {
      toast.error("Please fill out all fields");
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post("/clients", formData);
      toast.success("Client created successfully!");
      fetchClients();
      
      const token = res.data.data.inviteToken;
      // Default to production URL but allow override via env
      const clientPortalUrl = process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL || "https://clients.labsrebound.com";
      const link = `${clientPortalUrl}/signup?email=${encodeURIComponent(formData.email)}&token=${token}`;
      setInviteLink(link);
      setFormData({ name: "", email: "", company: "" });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create client");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      setDeleting(true);
      await api.delete(`/clients/${confirmDeleteId}`);
      toast.success("Client archived successfully");
      setConfirmDeleteId(null);
      fetchClients();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to archive client");
    } finally {
      setDeleting(false);
    }
  };

  const handleCopy = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => {
      setCopied(false);
      setIsModalOpen(false);
      setInviteLink("");
    }, 2000);
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.company.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="saas-page">
      <header className="saas-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p className="saas-heading-eyebrow">External Access</p>
          <h1 className="saas-heading-title">Clients Portal</h1>
          <p className="saas-heading-subtitle">Manage external clients and their portal access integrations</p>
        </div>

        <div style={{ display: "flex", gap: "1rem" }}>
          <label className="saas-inline-input" style={{ width: "240px" }}>
            <Search size={14} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
            />
          </label>
          <button 
            className="btn-primary" 
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={16} />
            Add Client
          </button>
        </div>
      </header>

      <section className="saas-glass saas-team-table-card">
        <div className="saas-card-head">
          <div>
            <h3 className="saas-card-title">Registered Clients</h3>
            <p className="saas-card-sub">{clients.length} external entities</p>
          </div>
        </div>

        <div className="saas-table-wrap">
          <table className="saas-table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Company</th>
                <th>Status</th>
                <th>Added On</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading || authLoading ? (
                <tr>
                  <td colSpan={4}>
                    <p className="saas-empty">Loading clients...</p>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <p className="saas-empty">No clients found.</p>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client._id}>
                    <td>
                      <div className="saas-member-left">
                        <span className="saas-member-avatar">{getInitial(client.name, client.email)}</span>
                        <div>
                          <span className="saas-member-name">{client.name}</span>
                          <span className="saas-member-mail" style={{ display: "block" }}>{client.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="font-semibold">{client.company}</td>
                    <td>
                      <span className="saas-role-pill" style={{ 
                        backgroundColor: client.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                        color: client.status === 'active' ? '#4ade80' : '#facc15'
                      }}>
                        {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                      </span>
                    </td>
                    <td className="muted">{new Date(client.createdAt).toLocaleDateString()}</td>
                    <td className="text-right">
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.25rem" }}>
                        <button 
                          onClick={() => router.push(`/dashboard/clients/${client._id}`)}
                          className="p-2 hover:bg-white/5 rounded-lg transition-colors text-primary inline-flex items-center gap-2 group"
                        >
                          <span className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Intelligence Center</span>
                          <ChevronRight size={16} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(client._id)}
                          className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-400 inline-flex items-center"
                          title="Archive client"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="saas-glass max-w-md w-full !bg-[#1c1c1e] outline outline-1 outline-white/10 rounded-2xl shadow-2xl relative overflow-hidden p-6">
            <h2 className="text-xl font-bold mb-1 text-white">Invite New Client</h2>
            <p className="text-sm text-gray-400 mb-6">Create a client record to generate their unique portal access link.</p>
            
            {!inviteLink ? (
              <form onSubmit={handleCreateClient} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300">Contact Name</label>
                  <div className="saas-inline-input w-full">
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Jane Doe"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300">Email Address</label>
                  <div className="saas-inline-input w-full">
                    <Mail size={14} className="text-gray-400" />
                    <input 
                      type="email" 
                      required
                      placeholder="jane@company.com"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300">Company Name</label>
                  <div className="saas-inline-input w-full">
                    <Building size={14} className="text-gray-400" />
                    <input 
                      type="text" 
                      required
                      placeholder="Acme Corp"
                      value={formData.company}
                      onChange={e => setFormData({...formData, company: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" className="btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Generating...' : 'Generate Invite Link'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <p className="text-sm text-green-400 font-medium mb-2">Success! Client created securely.</p>
                  <p className="text-xs text-gray-400 mb-3">Share this unique link with the client. It contains their pre-filled email and an authentication token to sync with this Admin portal.</p>
                  
                  <div className="flex items-center gap-2 bg-black/40 p-2 rounded-lg border border-white/5">
                    <input type="text" readOnly value={inviteLink} className="flex-1 bg-transparent border-none text-xs text-gray-300 focus:outline-none py-1" />
                    <button 
                      onClick={handleCopy}
                      className="p-2 bg-primary/20 hover:bg-primary/40 text-primary rounded-md transition-colors flex shrink-0"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <button type="button" className="w-full btn-ghost" onClick={() => { setIsModalOpen(false); setInviteLink(""); }}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="saas-glass max-w-sm w-full !bg-[#1c1c1e] outline outline-1 outline-white/10 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Archive Client?</h3>
                <p className="text-xs text-gray-400">All their records will be preserved but hidden.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                className="btn-ghost"
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting}
              >Cancel</button>
              <button
                className="btn-primary"
                style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                onClick={handleDelete}
                disabled={deleting}
              >{deleting ? "Archiving..." : "Yes, Archive"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
