"use client";

import { useEffect, useMemo, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, parseISO, startOfMonth, subMonths } from "date-fns";
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, MapPin, Users, Video } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { sendMeetingScheduledEmails } from "@/lib/emailNotifications";
import { api } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";

type UiMeeting = {
  _id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  meetingLink?: string;
  status: "scheduled" | "completed";
  attendeesCount: number;
  isPending?: boolean;
  clientId?: string;
};

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<UiMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    meetingLink: "",
  });

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const { data, error } = await supabase
          .from("meetings")
          .select("*")
          .order("scheduled_at", { ascending: true });
        if (error) throw error;

        const now = Date.now();
        const upcomingRows = (data || []).filter((meeting: any) => {
          const scheduledAt = new Date(meeting.scheduled_at).getTime();
          return Number.isFinite(scheduledAt) && scheduledAt >= now;
        });
        const completedIds = (data || [])
          .filter((meeting: any) => {
            const scheduledAt = new Date(meeting.scheduled_at).getTime();
            return Number.isFinite(scheduledAt) && scheduledAt < now;
          })
          .map((meeting: any) => meeting.id);

        if (completedIds.length > 0) {
          await supabase.from("meetings").delete().in("id", completedIds);
        }

        const mapped: UiMeeting[] = upcomingRows.map((meeting: any) => {
          const start = new Date(meeting.scheduled_at);
          const end = new Date(start.getTime() + 60 * 60 * 1000);
          return {
            _id: meeting.id,
            title: meeting.title,
            description: meeting.description || "Weekly sync to align on ongoing projects and priorities.",
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            location: "Virtual HQ",
            meetingLink: meeting.link || undefined,
            status: "scheduled",
            attendeesCount: Array.isArray(meeting.attendees) ? meeting.attendees.length : 0,
          };
        });

        let mappedMongo: UiMeeting[] = [];
        try {
          const pendingMRes = await api.get('/meetings?status=pending');
          const mongoPending = pendingMRes.data?.data || [];
          mappedMongo = mongoPending.map((m: any) => ({
            _id: m._id,
            title: `[REQUESTED] ${m.title}${m.client?.name ? ` - ${m.client.name}` : ""}`,
            description: m.description || "",
            startTime: m.startTime || new Date().toISOString(),
            endTime: m.endTime || new Date().toISOString(),
            location: m.type === 'online' ? 'Client Portal' : (m.location || 'Virtual HQ'),
            meetingLink: m.meetingLink,
            status: "scheduled" as const,
            attendeesCount: 1,
            isPending: true,
            clientId: m.client?._id || m.client,
          }));
        } catch (e) {
          console.error("Failed to fetch pending client meetings:", e);
        }

        setMeetings([...mapped, ...mappedMongo].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
      } catch {
        toast.error("Failed to load meetings");
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, []);

  const scheduleMeeting = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title || !form.startTime) return;
    const normalizedScheduledAt = new Date(form.startTime).toISOString();
    if (new Date(normalizedScheduledAt).getTime() <= Date.now()) {
      toast.error("Please schedule meetings for a future date and time.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("meetings")
        .insert({
          title: form.title,
          description: form.description || "",
          scheduled_at: normalizedScheduledAt,
          link: form.meetingLink || null,
        })
        .select("*")
        .single();
      if (error) throw error;

      let allRecipients: Array<{ id: string; full_name?: string | null; email?: string | null }> = [];
      let organizerName = "Leadership";
      try {
        const [{ data: authData }, { data: profilesData, error: profilesError }] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from("profiles")
            .select("id, full_name, email")
            .eq("is_active", true),
        ]);

        if (profilesError) throw profilesError;

        allRecipients = (profilesData || []) as Array<{ id: string; full_name?: string | null; email?: string | null }>;

        const organizerId = authData?.user?.id || "";
        if (organizerId) {
          const matchedOrganizer = allRecipients.find((profile) => profile.id === organizerId);
          organizerName = matchedOrganizer?.full_name || matchedOrganizer?.email || authData?.user?.email || organizerName;
        }
      } catch (notifyContextError) {
        console.error("Unable to build meeting email recipient context:", notifyContextError);
      }

      const start = new Date(data.scheduled_at);
      const end = form.endTime ? new Date(form.endTime) : new Date(start.getTime() + 60 * 60 * 1000);
      setMeetings((prev) =>
        [...prev, {
          _id: data.id,
          title: data.title,
          description: data.description || "New meeting scheduled.",
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          location: "Virtual HQ",
          meetingLink: data.link || undefined,
          status: "scheduled" as const,
          attendeesCount: 0,
        }].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      );

      const recipientIds = Array.from(
        new Set(allRecipients.map((recipient) => recipient.id).filter(Boolean))
      );

      if (recipientIds.length > 0) {
        await sendMeetingScheduledEmails({
          userIds: recipientIds,
          meetingId: data.id,
          meetingTitle: data.title,
          meetingDescription: data.description || "",
          scheduledAt: normalizedScheduledAt,
          meetingLink: data.link || "",
          organizerName,
          location: "Virtual HQ",
        });
      }

      setShowForm(false);
      setForm({ title: "", description: "", startTime: "", endTime: "", meetingLink: "" });
      toast.success("Meeting scheduled");
    } catch {
      toast.error("Unable to schedule meeting");
    } finally {
      setSubmitting(false);
    }
  };

  const days = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  const monthStartOffset = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const meetingDays = useMemo(() => meetings.map((meeting) => parseISO(meeting.startTime)), [meetings]);

  return (
    <div className="saas-page">
      <header className="saas-header">
        <div>
          <p className="saas-heading-eyebrow">Scheduling</p>
          <h1 className="saas-heading-title">Meetings</h1>
          <p className="saas-heading-subtitle">Strategic coordination & schedules</p>
        </div>

        <button type="button" className="saas-btn-primary" onClick={() => setShowForm((previous) => !previous)}>
          <CalendarPlus size={15} /> Schedule Meeting
        </button>
      </header>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="saas-glass saas-meeting-card"
            onSubmit={scheduleMeeting}
            style={{ display: "grid", gap: "0.62rem", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}
          >
            <input
              className="saas-settings-value"
              placeholder="Meeting title"
              value={form.title}
              onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
              required
            />
            <input
              className="saas-settings-value"
              type="datetime-local"
              value={form.startTime}
              onChange={(event) => setForm((previous) => ({ ...previous, startTime: event.target.value }))}
              required
            />
            <input
              className="saas-settings-value"
              type="datetime-local"
              value={form.endTime}
              onChange={(event) => setForm((previous) => ({ ...previous, endTime: event.target.value }))}
            />
            <input
              className="saas-settings-value"
              placeholder="Meeting link"
              value={form.meetingLink}
              onChange={(event) => setForm((previous) => ({ ...previous, meetingLink: event.target.value }))}
            />
            <textarea
              className="saas-settings-value"
              style={{ gridColumn: "1 / -1", minHeight: "82px", resize: "vertical" }}
              placeholder="Description"
              value={form.description}
              onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
            />
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="saas-btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="saas-btn-primary" disabled={submitting}>
                {submitting ? "Scheduling..." : "Save Meeting"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <section className="saas-meetings-grid">
        <div className="saas-glass saas-meeting-card">
          {loading ? (
            <p className="saas-empty">Loading meetings...</p>
          ) : meetings.length === 0 ? (
            <p className="saas-empty">No meetings scheduled yet.</p>
          ) : (
            meetings.map((meeting) => (
              <article key={meeting._id} className="saas-meeting-item">
                <div className="saas-meeting-row">
                  <div style={{ display: "flex", gap: "0.62rem", minWidth: 0 }}>
                    <div className="saas-team-icon" style={{ width: "2.2rem", height: "2.2rem" }}>
                      <div style={{ textAlign: "center", lineHeight: 1 }}>
                        <div style={{ fontSize: "0.56rem", fontWeight: 700 }}>{format(new Date(meeting.startTime), "MMM")}</div>
                        <div style={{ fontSize: "0.86rem", fontWeight: 800 }}>{format(new Date(meeting.startTime), "dd")}</div>
                      </div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p className="saas-team-title" style={{ fontSize: "1rem" }}>{meeting.title}</p>
                      <p className="saas-team-subtitle">{meeting.description}</p>
                    </div>
                  </div>
                  <span className={`saas-chip ${meeting.status === "scheduled" ? "primary" : "muted"}`}>
                    {meeting.status}
                  </span>
                </div>

                <div className="saas-pill-row" style={{ marginTop: "0.52rem" }}>
                  <span className="saas-chip muted"><Clock size={11} style={{ marginRight: "0.2rem" }} />{format(new Date(meeting.startTime), "hh:mm a")} - {format(new Date(meeting.endTime), "hh:mm a")}</span>
                  <span className="saas-chip muted"><MapPin size={11} style={{ marginRight: "0.2rem" }} />{meeting.location}</span>
                  <span className="saas-chip muted"><Users size={11} style={{ marginRight: "0.2rem" }} />{meeting.attendeesCount} attendees</span>
                </div>

                <div className="saas-pill-row" style={{ marginTop: "0.6rem" }}>
                  {meeting.isPending && meeting.clientId ? (
                    <Link href={`/dashboard/clients/${meeting.clientId}`} className="saas-btn-primary">
                      <CalendarPlus size={14} /> Accept & Add Link
                    </Link>
                  ) : (
                    <a href={meeting.meetingLink || "#"} className="saas-btn-primary" target="_blank" rel="noreferrer">
                      <Video size={14} /> Join Meeting
                    </a>
                  )}
                  <button type="button" className="saas-btn-secondary">View Details</button>
                </div>
              </article>
            ))
          )}
        </div>

        <aside className="saas-side-stack">
          <section className="saas-glass saas-calendar-card">
            <div className="saas-calendar-head">
              <h3 className="saas-card-title" style={{ fontSize: "1rem" }}>{format(currentDate, "MMMM yyyy")}</h3>
              <div className="saas-pill-row">
                <button type="button" className="saas-btn-secondary" onClick={() => setCurrentDate((previous) => subMonths(previous, 1))}>
                  <ChevronLeft size={14} />
                </button>
                <button type="button" className="saas-btn-secondary" onClick={() => setCurrentDate((previous) => addMonths(previous, 1))}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div className="saas-calendar-grid" style={{ marginBottom: "0.4rem" }}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} style={{ fontSize: "0.58rem", color: "rgba(136,145,178,0.9)", textAlign: "center" }}>{day}</div>
              ))}
            </div>

            <div className="saas-calendar-grid">
              {Array.from({ length: monthStartOffset }).map((_, index) => (
                <div key={`empty-${index}`} />
              ))}
              {days.map((day) => {
                const active = isSameDay(day, new Date());
                const hasMeeting = meetingDays.some((meetingDay) => isSameDay(day, meetingDay));
                return (
                  <div
                    key={day.toISOString()}
                    className={`saas-calendar-day ${active ? "active" : ""}`}
                    style={{ borderColor: hasMeeting && !active ? "rgba(100,107,190,0.45)" : undefined }}
                  >
                    {format(day, "d")}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="saas-glass saas-side-card">
            <h3 className="saas-card-title" style={{ fontSize: "0.95rem" }}>Meeting Notes</h3>
            <div className="saas-list">
              <article className="saas-list-item">
                <p className="saas-list-title">Response Protocol</p>
                <p className="saas-list-meta">Ensure all mission-critical items are briefed prior to commencement.</p>
              </article>
              <article className="saas-list-item">
                <p className="saas-list-title">Attendance</p>
                <p className="saas-list-meta">All team members should confirm attendance one hour before meeting.</p>
              </article>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
