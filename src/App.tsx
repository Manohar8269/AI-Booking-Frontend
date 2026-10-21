import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity, AlertCircle, ArrowRight, Bot, CalendarDays, Check, CheckCircle2, ChevronLeft,
  ChevronRight, Clock3, LayoutDashboard, LogOut, Menu, Plus, Settings, ShieldCheck,
  Sparkles, Users, X,
} from "lucide-react";
import { api, dateTime, getToken, setToken } from "./api";
import type { Approval, AuditEntry, ChatReply, Meeting, User } from "./api";

type Notice = { kind: "success" | "error"; text: string };
const showDate = (date: Date) => date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
const isoLocal = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const startOfDay = (value: string) => new Date(new Date(value).toDateString()).getTime();

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(Boolean(getToken()));
  const [notice, setNotice] = useState<Notice | null>(null);
  const [mode, setMode] = useState("secure");
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useCallback((kind: Notice["kind"], text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getToken()) { setUser(null); setChecking(false); return; }
    try {
      const current = await api<User>("/api/auth/me");
      setUser(current);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { void refreshUser(); }, [refreshUser]);
  useEffect(() => {
    const handleUnauthorized = () => { setUser(null); navigate("/login", { replace: true }); };
    window.addEventListener("calendar:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("calendar:unauthorized", handleUnauthorized);
  }, [navigate]);
  useEffect(() => {
    void api<{ lab_mode?: string; mode?: string }>("/api/health").then((health) => setMode(health.lab_mode || health.mode || "secure")).catch(() => undefined);
  }, []);

  const logout = () => {
    setToken(null);
    setUser(null);
    navigate("/login");
  };
  const login = async (email: string, password: string) => {
    const result = await api<{ access_token: string; user: User }>("/api/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    });
    setToken(result.access_token);
    setUser(result.user);
    navigate("/dashboard");
  };
  const signup = async (name: string, email: string, password: string) => {
    await api("/api/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) });
    await login(email, password);
  };

  if (checking) return <div className="boot-screen"><div className="loader" />Loading your workspace…</div>;

  return (
    <>
      {notice && <div role="status" className={`toast ${notice.kind}`}><span>{notice.kind === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}{notice.text}</span><button aria-label="Dismiss" onClick={() => setNotice(null)}><X size={16} /></button></div>}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage mode="login" onLogin={login} />} />
        <Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage mode="signup" onSignup={signup} />} />
        <Route path="*" element={user ? <Shell user={user} mode={mode} logout={logout} notify={notify} /> : <Navigate to="/login" state={{ from: location }} replace />} />
      </Routes>
    </>
  );
}

function AuthPage({ mode, onLogin, onSignup }: {
  mode: "login" | "signup";
  onLogin?: (email: string, password: string) => Promise<void>;
  onSignup?: (name: string, email: string, password: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signup = mode === "signup";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (signup && password !== confirm) { setError("Passwords do not match."); return; }
    if (signup && password.length < 8) { setError("Use a password with at least 8 characters."); return; }
    setBusy(true);
    try {
      if (signup) await onSignup?.(name.trim(), email.trim(), password);
      else await onLogin?.(email.trim(), password);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to continue."); }
    finally { setBusy(false); }
  }

  return (
    <main className="auth-layout">
      <section className="auth-story">
        <div className="brand-lockup"><span className="brand-mark"><CalendarDays size={22} /></span><span>CALENDAR<span className="brand-light">LAB</span></span></div>
        <div className="story-copy">
          <div className="eyebrow"><ShieldCheck size={15} /> AI SAFETY TRAINING ENVIRONMENT</div>
          <h1>Plan with confidence.<br /><span>Learn safer AI.</span></h1>
          <p>A hands-on calendar workspace for understanding human oversight and least-privilege AI agents.</p>
        </div>
        <div className="story-foot"><div className="story-icon"><ShieldCheck size={20} /></div><span><strong>Secure by design</strong><small>Local demo mode works without an AI key</small></span></div>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-heading"><span className="eyebrow">YOUR WORKSPACE</span><h2>{signup ? "Create your account" : "Welcome back"}</h2><p>{signup ? "Start organizing your calendar securely." : "Sign in to continue to your calendar."}</p></div>
          {signup && <label>Full name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} placeholder="Alex Morgan" /></label>}
          <label>Email address<input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" /></label>
          <label>Password<span className="password-wrap"><input autoComplete={signup ? "new-password" : "current-password"} type={visible ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required placeholder={signup ? "At least 8 characters" : "Enter your password"} /><button type="button" className="text-button" onClick={() => setVisible(!visible)}>{visible ? "Hide" : "Show"}</button></span></label>
          {signup && <label>Confirm password<input autoComplete="new-password" type={visible ? "text" : "password"} value={confirm} onChange={(event) => setConfirm(event.target.value)} required placeholder="Re-enter your password" /></label>}
          {error && <div className="form-error" role="alert"><AlertCircle size={16} />{error}</div>}
          <button className="button primary full" disabled={busy}>{busy ? <><span className="button-spinner" />Working…</> : signup ? "Create account" : "Sign in"}{!busy && <ArrowRight size={17} />}</button>
          <p className="auth-switch">{signup ? "Already have an account?" : "New to Calendar Lab?"} <Link to={signup ? "/login" : "/signup"}>{signup ? "Sign in" : "Create an account"}</Link></p>
        </form>
        <footer className="auth-footer">AI Booking & Calendar Agent Security Lab · OWASP LLM06</footer>
      </section>
    </main>
  );
}

const navItems = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/meetings", label: "Meetings", icon: Users },
  { to: "/assistant", label: "AI assistant", icon: Bot },
  { to: "/approvals", label: "Approvals", icon: CheckCircle2 },
  { to: "/activity", label: "Activity log", icon: Activity },
  { to: "/settings", label: "Profile & settings", icon: Settings },
];

function Shell({ user, mode, logout, notify }: { user: User; mode: string; logout: () => void; notify: (kind: Notice["kind"], text: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <Link className="sidebar-brand" to="/dashboard"><span className="brand-mark"><CalendarDays size={21} /></span><span>CALENDAR<span className="brand-light">LAB</span><small>AI SECURITY WORKSPACE</small></span></Link>
        <div className="nav-label">WORKSPACE</div>
        <nav>{navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}><Icon size={18} /><span>{label}</span>{label === "Approvals" && <ApprovalBadge />}</NavLink>)}</nav>
        <div className="sidebar-bottom"><div className="mode-card"><div className="mode-row"><span className={`mode-dot ${mode}`} />{mode === "vulnerable" ? "Vulnerable mode" : "Secure mode"}</div><small>Backend-controlled training mode</small></div><div className="user-row"><div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div><div className="user-info"><strong>{user.name}</strong><small>{user.email}</small></div><button title="Sign out" aria-label="Sign out" className="icon-button" onClick={logout}><LogOut size={17} /></button></div></div>
      </aside>
      {open && <button aria-label="Close navigation" className="scrim" onClick={() => setOpen(false)} />}
      <main className="main-area"><header className="topbar"><button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={21} /></button><div className="breadcrumb">Workspace <ChevronRight size={14} /> <span>{navItems.find((item) => item.to === locationPath())?.label || "Page"}</span></div><div className="topbar-right"><div className="secure-indicator"><span className={`mode-dot ${mode}`} />{mode === "vulnerable" ? "Vulnerable mode" : "Secure mode"}</div><div className="top-avatar">{user.name.slice(0, 1).toUpperCase()}</div></div></header>
        <div className="page-container"><Routes>
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/meetings" element={<MeetingsPage notify={notify} />} />
          <Route path="/assistant" element={<AssistantPage notify={notify} />} />
          <Route path="/approvals" element={<ApprovalsPage notify={notify} />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/settings" element={<SettingsPage user={user} mode={mode} />} />
          <Route path="*" element={<NotFound />} />
        </Routes></div>
      </main>
    </div>
  );
}

function locationPath() { return window.location.pathname; }

function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Meeting[] | { items: Meeting[] }>("/api/meetings");
      setMeetings(Array.isArray(data) ? data : data.items);
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load meetings."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { meetings, setMeetings, loading, error, reload: load };
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

function Dashboard({ user }: { user: User }) {
  const { meetings, loading, error, reload } = useMeetings();
  const upcoming = meetings.filter((item) => item.status !== "cancelled" && new Date(item.start_time).getTime() >= Date.now()).sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
  const todayMeetings = meetings.filter((item) => item.status !== "cancelled" && startOfDay(item.start_time) === startOfDay(new Date().toISOString()));
  const recent = [...meetings].sort((a, b) => +new Date(b.updated_at || b.start_time) - +new Date(a.updated_at || a.start_time)).slice(0, 3);
  const greetingName = user.name.trim().split(/\s+/)[0];
  return <><PageTitle eyebrow="YOUR DAY, AT A GLANCE" title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${greetingName}`} description={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} action={<Link className="button primary" to="/meetings?new=1"><Plus size={17} /> New meeting</Link>} />
    {error && <ErrorPanel message={error} retry={reload} />}
    <div className="stats-grid"><Stat icon={CalendarDays} label="Total meetings" value={loading ? "—" : meetings.length} tone="blue" /><Stat icon={Clock3} label="Today" value={loading ? "—" : todayMeetings.length} tone="cyan" /><Stat icon={ArrowRight} label="Upcoming" value={loading ? "—" : upcoming.length} tone="violet" /></div>
    <div className="dashboard-grid"><section className="card"><div className="card-heading"><div><h2>Coming up</h2><p>Your next scheduled meetings</p></div><Link to="/calendar" className="subtle-link">Open calendar <ArrowRight size={14} /></Link></div>{loading ? <Loading /> : upcoming.length ? <MeetingList meetings={upcoming.slice(0, 4)} /> : <Empty icon={CalendarDays} title="Nothing on your calendar yet" detail="Create a meeting or ask the assistant to schedule one." action={<Link className="button secondary small" to="/meetings?new=1"><Plus size={15} /> Create meeting</Link>} />}</section>
      <section className="card assistant-promo"><div className="promo-icon"><Sparkles size={22} /></div><div className="eyebrow">AI CALENDAR ASSISTANT</div><h2>Make time for what matters.</h2><p>Ask in plain language to check availability, plan a meeting, or find what's coming up.</p><Link to="/assistant" className="button primary">Chat with assistant <ArrowRight size={16} /></Link><div className="promo-example">“Am I free tomorrow at 2?”</div></section></div>
    <section className="card recent-card"><div className="card-heading"><div><h2>Recently updated</h2><p>Your latest calendar changes</p></div><Link to="/meetings" className="subtle-link">All meetings <ArrowRight size={14} /></Link></div>{loading ? <Loading /> : recent.length ? <MeetingList meetings={recent} compact /> : <Empty icon={Clock3} title="No recent activity" detail="Your recent meetings will appear here." />}</section>
  </>;
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof CalendarDays; label: string; value: number | string; tone: string }) {
  return <div className="stat-card"><span className={`stat-icon ${tone}`}><Icon size={19} /></span><span className="stat-value">{value}</span><span className="stat-label">{label}</span></div>;
}

function CalendarPage() {
  const { meetings, loading, error, reload } = useMeetings();
  const [month, setMonth] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "agenda">("month");
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (start.getDay() + 6) % 7;
  const weekOffset = (month.getDay() + 6) % 7;
  const days = view === "week"
    ? Array.from({ length: 7 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), month.getDate() - weekOffset + index))
    : Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1));
  const shiftCalendar = (direction: number) => setMonth(view === "week"
    ? new Date(month.getFullYear(), month.getMonth(), month.getDate() + direction * 7)
    : new Date(month.getFullYear(), month.getMonth() + direction, 1));
  return <><PageTitle eyebrow="YOUR SCHEDULE" title="Calendar" description="Keep track of what’s happening and when." action={<Link className="button primary" to="/meetings?new=1"><Plus size={17} /> New meeting</Link>} />
    <section className="card calendar-card"><div className="calendar-toolbar"><div className="month-nav"><button className="icon-button bordered" aria-label="Previous calendar period" onClick={() => shiftCalendar(-1)}><ChevronLeft size={18} /></button><h2>{view === "week" ? `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : showDate(month)}</h2><button className="icon-button bordered" aria-label="Next calendar period" onClick={() => shiftCalendar(1)}><ChevronRight size={18} /></button><button className="button secondary small" onClick={() => setMonth(new Date())}>Today</button></div><div className="segmented"><button className={view === "month" ? "selected" : ""} onClick={() => setView("month")}>Month</button><button className={view === "week" ? "selected" : ""} onClick={() => setView("week")}>Week</button><button className={view === "agenda" ? "selected" : ""} onClick={() => setView("agenda")}>Agenda</button></div></div>
      {loading ? <Loading /> : error ? <ErrorPanel message={error} retry={reload} /> : view !== "agenda" ? <div className="calendar-grid"><div className="weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div><div className="days-grid">{days.map((day, index) => {
        const dayMeetings = meetings.filter((m) => new Date(m.start_time).toDateString() === day.toDateString());
        return <div className={`day-cell${day.getMonth() !== month.getMonth() ? " other-month" : ""}${day.toDateString() === new Date().toDateString() ? " today" : ""}`} key={index}><span className="day-number">{day.getDate()}</span>{dayMeetings.slice(0, 2).map((meeting) => <Link key={meeting.id} to={`/meetings?id=${meeting.id}`} className={`day-event ${meeting.status}`}>{new Date(meeting.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {meeting.title}</Link>)}{dayMeetings.length > 2 && <span className="more-events">+{dayMeetings.length - 2} more</span>}</div>;
      })}</div></div> : <MeetingList meetings={meetings.filter((m) => new Date(m.start_time).getMonth() === month.getMonth() && new Date(m.start_time).getFullYear() === month.getFullYear()).sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))} />}</section>
    <p className="calendar-note"><span className="legend scheduled" /> Scheduled <span className="legend cancelled" /> Cancelled · Times shown in your local timezone</p>
  </>;
}

function MeetingsPage({ notify }: { notify: (kind: Notice["kind"], text: string) => void }) {
  const { meetings, loading, error, reload } = useMeetings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [detail, setDetail] = useState<Meeting | null>(null);
  const [creating, setCreating] = useState(new URLSearchParams(window.location.search).has("new"));
  useEffect(() => {
    const id = Number(searchParams.get("id"));
    setDetail(Number.isSafeInteger(id) ? meetings.find((meeting) => meeting.id === id) || null : null);
  }, [meetings, searchParams]);
  const filtered = meetings.filter((meeting) => (filter === "all" || meeting.status === filter) && `${meeting.title} ${meeting.description || ""} ${meeting.location || ""}`.toLowerCase().includes(search.toLowerCase()));
  const saveMeeting = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title")).trim(), description: String(form.get("description") || ""),
      start_time: new Date(String(form.get("start_time"))).toISOString(), end_time: new Date(String(form.get("end_time"))).toISOString(),
      location: String(form.get("location") || ""), attendees: String(form.get("attendees") || "").split(",").map((s) => s.trim()).filter(Boolean),
    };
    if (new Date(payload.end_time) <= new Date(payload.start_time)) { notify("error", "End time must be after start time."); return; }
    try {
      if (selected) await api(`/api/meetings/${selected.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await api("/api/meetings", { method: "POST", body: JSON.stringify(payload) });
      notify("success", selected ? "Meeting updated." : "Meeting created.");
      setSelected(null); setDetail(null); setCreating(false); setSearchParams({}); await reload();
    } catch (reason) { notify("error", reason instanceof Error ? reason.message : "Could not save meeting."); }
  };
  const cancel = async (meeting: Meeting) => {
    try {
      await api(`/api/meetings/${meeting.id}`, { method: "DELETE" });
      notify("success", "Meeting cancellation was submitted.");
      await reload();
    } catch (reason) { notify("error", reason instanceof Error ? reason.message : "Could not cancel meeting."); }
  };
  return <><PageTitle eyebrow="YOUR COMMITMENTS" title="Meetings" description="Create, edit, and manage your meetings." action={<button className="button primary" onClick={() => { setSelected(null); setCreating(true); }}><Plus size={17} /> New meeting</button>} />
    <section className="card"><div className="list-toolbar"><div className="search-box"><span>⌕</span><input aria-label="Search meetings" placeholder="Search meetings…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><select aria-label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All meetings</option><option value="scheduled">Scheduled</option><option value="cancelled">Cancelled</option></select></div>
      {loading ? <Loading /> : error ? <ErrorPanel message={error} retry={reload} /> : filtered.length ? <div className="meeting-table">{filtered.map((meeting) => <div className="meeting-row" key={meeting.id}><div className="meeting-date-tile"><strong>{new Date(meeting.start_time).getDate()}</strong><small>{new Date(meeting.start_time).toLocaleDateString(undefined, { month: "short" })}</small></div><button className="meeting-row-main meeting-open" onClick={() => { setSearchParams({ id: String(meeting.id) }); setDetail(meeting); }}><strong>{meeting.title}</strong><span>{dateTime(meeting.start_time)} · {meeting.location || "No location"}</span></button><span className={`status-pill ${meeting.status}`}>{meeting.status}</span><button className="button secondary small" onClick={() => { setSelected(meeting); setCreating(true); }}>Edit</button>{meeting.status !== "cancelled" && <button className="button danger-quiet small" onClick={() => void cancel(meeting)}>Cancel</button>}</div>)}</div> : <Empty icon={CalendarDays} title="No matching meetings" detail="Adjust your filters or add a new meeting." />}</section>
    {detail && !creating && <Modal title="Meeting details" close={() => { setDetail(null); setSearchParams({}); }}><div className="details-content"><span className={`status-pill ${detail.status}`}>{detail.status}</span><h3>{detail.title}</h3><p>{detail.description || "No description provided."}</p><div className="details-grid"><div><small>STARTS</small><strong>{dateTime(detail.start_time)}</strong></div><div><small>ENDS</small><strong>{dateTime(detail.end_time)}</strong></div><div><small>LOCATION</small><strong>{detail.location || "Not specified"}</strong></div><div><small>ATTENDEES</small><strong>{Array.isArray(detail.attendees) ? detail.attendees.join(", ") || "None" : detail.attendees || "None"}</strong></div></div><div className="modal-actions"><button className="button secondary" onClick={() => { setDetail(null); setSearchParams({}); }}>Close</button><button className="button primary" disabled={detail.status === "cancelled"} onClick={() => { setSelected(detail); setCreating(true); }}>Edit meeting</button></div></div></Modal>}
    {(creating || selected) && <Modal title={selected ? "Edit meeting" : "Create a meeting"} close={() => { setCreating(false); setSelected(null); setDetail(null); setSearchParams({}); }}><form className="meeting-form" onSubmit={saveMeeting}><label>Title<input name="title" defaultValue={selected?.title} required maxLength={160} /></label><label>Description<textarea name="description" rows={3} defaultValue={selected?.description || ""} /></label><div className="form-grid"><label>Starts<input name="start_time" type="datetime-local" defaultValue={selected ? isoLocal(new Date(selected.start_time)) : isoLocal(new Date(Date.now() + 3600000))} required /></label><label>Ends<input name="end_time" type="datetime-local" defaultValue={selected ? isoLocal(new Date(selected.end_time)) : isoLocal(new Date(Date.now() + 7200000))} required /></label></div><label>Location<input name="location" defaultValue={selected?.location || ""} placeholder="Optional" /></label><label>Attendees<input name="attendees" defaultValue={Array.isArray(selected?.attendees) ? selected?.attendees.join(", ") : selected?.attendees || ""} placeholder="Comma-separated names or emails" /></label><div className="modal-actions"><button type="button" className="button secondary" onClick={() => { setCreating(false); setSelected(null); setDetail(null); setSearchParams({}); }}>Cancel</button><button className="button primary">{selected ? "Save changes" : "Create meeting"}</button></div></form></Modal>}
  </>;
}

function AssistantPage({ notify }: { notify: (kind: Notice["kind"], text: string) => void }) {
  const [messages, setMessages] = useState<{ role: "assistant" | "user"; text: string }[]>([{ role: "assistant", text: "Hi! I can help manage your calendar. Try “Show my upcoming meetings” or “Check if I’m available tomorrow at 2 PM.”" }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("Local Demo Mode");
  const send = async (event?: FormEvent, preset?: string) => {
    event?.preventDefault();
    const message = (preset || text).trim();
    if (!message || busy) return;
    setMessages((current) => [...current, { role: "user", text: message }]);
    setText(""); setBusy(true);
    try {
      const result = await api<ChatReply>("/api/chat", { method: "POST", body: JSON.stringify({ message }) });
      setMode(/connected|llm/i.test(result.mode || "") ? "Connected LLM" : "Local Demo Mode");
      setMessages((current) => [...current, { role: "assistant", text: result.reply }]);
      if (result.status === "pending_approval") notify("success", "An approval request is waiting for your review.");
    } catch (reason) {
      setMessages((current) => [...current, { role: "assistant", text: reason instanceof Error ? reason.message : "I could not process that request." }]);
      notify("error", "The assistant request could not be completed.");
    } finally { setBusy(false); }
  };
  return <><PageTitle eyebrow="YOUR AI CALENDAR COMPANION" title="AI assistant" description="Tell your assistant what you need in plain language." /><div className="assistant-layout"><section className="card chat-card"><div className="chat-header"><span className="assistant-avatar"><Bot size={20} /></span><div><strong>Calendar assistant</strong><small><span className="online-dot" />{mode}</small></div><span className="safe-chip"><ShieldCheck size={14} /> Scoped tools</span></div><div className="chat-messages">{messages.map((message, index) => <div key={index} className={`chat-message ${message.role}`}><span className="message-avatar">{message.role === "assistant" ? <Bot size={15} /> : "You"}</span><div className="bubble">{message.text}</div></div>)}{busy && <div className="chat-message assistant"><span className="message-avatar"><Bot size={15} /></span><div className="bubble typing"><i /><i /><i /></div></div>}</div><form className="chat-input" onSubmit={(event) => void send(event)}><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Ask about your calendar…" aria-label="Message assistant" /><button className="button primary" disabled={busy || !text.trim()}>Send <ArrowRight size={16} /></button></form></section><aside className="assistant-side"><div className="card"><div className="eyebrow">TRY ASKING</div><div className="suggestion-list">{["Show my upcoming meetings", "Check if I’m available tomorrow at 2 PM", "Schedule a project meeting tomorrow at 11 AM", "Cancel my project review meeting"].map((item) => <button key={item} onClick={() => void send(undefined, item)}>{item}<ArrowRight size={14} /></button>)}</div></div><div className="training-note"><ShieldCheck size={18} /><div><strong>Human oversight matters</strong><p>In secure mode, high-impact actions such as cancellation require your approval before they happen.</p><Link to="/approvals">Review pending approvals <ArrowRight size={13} /></Link></div></div></aside></div></>;
}

function useApprovals() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Approval[] | { items: Approval[] }>("/api/approvals");
      setApprovals(Array.isArray(data) ? data : data.items); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load approvals."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { approvals, loading, error, reload };
}

function ApprovalBadge() {
  const [count, setCount] = useState(0);
  useEffect(() => { void api<Approval[]>("/api/approvals").then((rows) => setCount(rows.filter((item) => item.status === "pending").length)).catch(() => undefined); }, []);
  return count > 0 ? <span className="nav-count">{count}</span> : null;
}

function ApprovalsPage({ notify }: { notify: (kind: Notice["kind"], text: string) => void }) {
  const { approvals, loading, error, reload } = useApprovals();
  const decide = async (approval: Approval, decision: "approve" | "reject") => {
    try {
      await api(`/api/approvals/${approval.id}/decision`, { method: "POST", body: JSON.stringify({ decision }) });
      notify("success", decision === "approve" ? "Approval recorded and action executed." : "Request rejected.");
      await reload();
    } catch (reason) { notify("error", reason instanceof Error ? reason.message : "Approval decision failed."); }
  };
  return <><PageTitle eyebrow="HUMAN-IN-THE-LOOP" title="Pending approvals" description="Review proposed high-impact actions before they are executed." /><section className="card approvals-card">{loading ? <Loading /> : error ? <ErrorPanel message={error} retry={reload} /> : approvals.filter((item) => item.status === "pending").length ? approvals.filter((item) => item.status === "pending").map((item) => <ApprovalCard key={item.id} approval={item} decide={decide} />) : <Empty icon={CheckCircle2} title="You’re all caught up" detail="New actions requiring your review will appear here." />}</section>{approvals.some((item) => item.status !== "pending") && <section className="card history-card"><div className="card-heading"><div><h2>Recent decisions</h2><p>Previously reviewed requests</p></div></div>{approvals.filter((item) => item.status !== "pending").map((item) => <div className="history-row" key={item.id}><span>{(item.action_type || item.action || "calendar change").replaceAll("_", " ")}</span><span className={`status-pill ${item.status}`}>{item.status}</span></div>)}</section>}</>;
}

function ApprovalCard({ approval, decide }: { approval: Approval; decide: (approval: Approval, decision: "approve" | "reject") => void }) {
  const payload = approval.payload || {};
  const expires = new Date(approval.expires_at);
  return <article className="approval-card"><div className="approval-icon"><ShieldCheck size={20} /></div><div className="approval-body"><div className="approval-title-row"><h2>Review action: {(approval.action_type || approval.action || "calendar change").replaceAll("_", " ")}</h2><span className="status-pill pending">Pending review</span></div><p>Approving will cancel this scheduled meeting. It will remain in your calendar history.</p><div className="approval-details"><div><small>MEETING</small><strong>{approval.meeting_title || String(payload.title || `Meeting #${approval.target_id ?? approval.meeting_id ?? "—"}`)}</strong></div><div><small>CURRENT STATUS</small><strong>{approval.meeting_status || "scheduled"}</strong></div><div><small>STARTS</small><strong>{approval.meeting_start_time ? dateTime(approval.meeting_start_time) : "—"}</strong></div><div><small>EXPIRES</small><strong>{dateTime(approval.expires_at)}{expires < new Date() ? " · Expired" : ""}</strong></div></div><div className="approval-actions"><button className="button secondary" onClick={() => decide(approval, "reject")}><X size={16} /> Reject</button><button className="button primary" disabled={expires < new Date()} onClick={() => decide(approval, "approve")}><Check size={16} /> Approve action</button></div></div></article>;
}

function ActivityPage() {
  const [events, setEvents] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setLoading(true);
    void api<AuditEntry[] | { items: AuditEntry[] }>("/api/audit").then((data) => setEvents(Array.isArray(data) ? data : data.items)).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load activity.")).finally(() => setLoading(false));
  }, []);
  useEffect(() => load(), [load]);
  return <><PageTitle eyebrow="TRANSPARENCY & OVERSIGHT" title="Activity log" description="A record of calendar actions and assistant activity." /><section className="card">{loading ? <Loading /> : error ? <ErrorPanel message={error} retry={load} /> : events.length ? <div className="activity-list">{events.map((event) => <div className="activity-row" key={event.id}><div className="activity-icon"><Activity size={16} /></div><div className="activity-text"><strong>{event.action.replaceAll("_", " ").replaceAll(".", " · ")}</strong><span>{event.resource_type} {event.resource_id}{event.details ? ` · ${event.details}` : ""}</span></div><time>{dateTime(event.created_at)}</time></div>)}</div> : <Empty icon={Activity} title="No activity yet" detail="Your calendar changes and approval decisions will be recorded here." />}</section></>;
}

function SettingsPage({ user, mode }: { user: User; mode: string }) {
  return <><PageTitle eyebrow="ACCOUNT" title="Profile & settings" description="Your account details and current lab configuration." /><div className="settings-grid"><section className="card settings-card"><div className="card-heading"><div><h2>Profile</h2><p>Account information used in this workspace.</p></div></div><div className="profile-large"><div className="avatar large">{user.name.slice(0, 1).toUpperCase()}</div><div><strong>{user.name}</strong><span>{user.email}</span></div></div><div className="setting-line"><span>Display name</span><strong>{user.name}</strong></div><div className="setting-line"><span>Email</span><strong>{user.email}</strong></div><div className="setting-line"><span>Account role</span><strong>{user.role || "user"}</strong></div></section><section className="card settings-card"><div className="card-heading"><div><h2>Lab configuration</h2><p>Mode is configured by the backend and cannot be changed here.</p></div></div><div className="mode-large"><span className={`mode-dot ${mode}`} /><div><strong>{mode === "vulnerable" ? "Vulnerable mode" : "Secure mode"}</strong><p>{mode === "vulnerable" ? "Synthetic training environment. No real calendar integrations." : "User-scoped access and human approval for high-impact changes."}</p></div></div><div className="setting-line"><span>Assistant availability</span><strong>Local demo available</strong></div><div className="setting-line"><span>Calendar data</span><strong>Private to your account</strong></div></section></div></>;
}

function MeetingList({ meetings, compact = false }: { meetings: Meeting[]; compact?: boolean }) {
  return <div className={`upcoming-list${compact ? " compact" : ""}`}>{meetings.map((meeting) => <Link to={`/meetings?id=${meeting.id}`} key={meeting.id} className="upcoming-row"><div className="upcoming-date"><span>{new Date(meeting.start_time).toLocaleDateString(undefined, { month: "short" })}</span><strong>{new Date(meeting.start_time).getDate()}</strong></div><div className="upcoming-info"><strong>{meeting.title}</strong><span>{new Date(meeting.start_time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – {new Date(meeting.end_time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}{meeting.location ? ` · ${meeting.location}` : ""}</span></div><span className={`status-pill ${meeting.status}`}>{meeting.status}</span></Link>)}</div>;
}

function Loading() { return <div className="loading-state"><div className="loader" />Loading…</div>; }
function ErrorPanel({ message, retry }: { message: string; retry: () => void }) { return <div className="inline-error"><AlertCircle size={18} /><span>{message}</span><button className="button secondary small" onClick={retry}>Retry</button></div>; }
function Empty({ icon: Icon, title, detail, action }: { icon: typeof CalendarDays; title: string; detail: string; action?: React.ReactNode }) { return <div className="empty-state"><span className="empty-icon"><Icon size={22} /></span><strong>{title}</strong><p>{detail}</p>{action}</div>; }
function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) close(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><h2 id="modal-title">{title}</h2><button aria-label="Close dialog" className="icon-button" onClick={close}><X size={19} /></button></div>{children}</section></div>;
}
function NotFound() { return <div className="not-found"><div className="eyebrow">404 · PAGE NOT FOUND</div><h1>We can’t find that page.</h1><p>It may have moved, or the address may be incorrect.</p><Link className="button primary" to="/dashboard">Back to overview <ArrowRight size={16} /></Link></div>; }

export default App;
