import { useCallback, useEffect, useState } from "react";
import type { FormEvent, MouseEvent, ReactNode } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api, dateTime, getToken, setToken } from "./api";
import type { Approval, AuditEntry, ChatReply, Meeting, User } from "./api";

type NoticeKind = "success" | "error";
type Notify = (kind: NoticeKind, text: string) => void;

type Notice = {
  kind: NoticeKind;
  text: string;
};

type AssistantMessage = {
  role: "assistant" | "user";
  text: string;
};

type AssistantConversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: AssistantMessage[];
};

const navItems: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/meetings", label: "Meetings", icon: Users },
  { to: "/assistant", label: "AI assistant", icon: Bot },
  { to: "/approvals", label: "Approvals", icon: CheckCircle2 },
  { to: "/settings", label: "Profile & settings", icon: Settings },
];

const assistantWelcome: AssistantMessage = {
  role: "assistant",
  text: "Hi! I can help manage your calendar. Try 'Show my upcoming meetings' or 'Check if I am available tomorrow at 2 PM.'",
};

const assistantSuggestions = [
  "Show my upcoming meetings",
  "Check if I am available tomorrow at 2 PM",
  "Schedule a project meeting tomorrow at 11 AM",
  "Cancel my project review meeting",
];

function showDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function isoLocal(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function startOfDay(value: string) {
  return new Date(new Date(value).toDateString()).getTime();
}

function displayAssistantReply(text: string) {
  return text.replace(
    /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})\b/g,
    (value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;

      const day = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
      const time = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(date);

      return `${day} at ${time}`;
    },
  );
}

function readAssistantHistory(userId: number): AssistantConversation[] {
  try {
    const savedHistory = localStorage.getItem(`calendar_lab_assistant_history_${userId}`) || "[]";
    const parsed: unknown = JSON.parse(savedHistory);

    if (!Array.isArray(parsed)) return [];

    return (parsed as AssistantConversation[]).map((conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) => (
        message.role === "assistant"
          ? { ...message, text: displayAssistantReply(message.text) }
          : message
      )),
    }));
  } catch {
    return [];
  }
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(Boolean(getToken()));
  const [notice, setNotice] = useState<Notice | null>(null);
  const [mode, setMode] = useState("secure");
  const navigate = useNavigate();
  const location = useLocation();

  const notify = useCallback<Notify>((kind, text) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setChecking(false);
      return;
    }

    try {
      setUser(await api<User>("/api/auth/me"));
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      navigate("/login", { replace: true });
    };

    window.addEventListener("calendar:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("calendar:unauthorized", handleUnauthorized);
  }, [navigate]);

  useEffect(() => {
    void api<{ lab_mode?: string; mode?: string }>("/api/health")
      .then((health) => setMode(health.lab_mode || health.mode || "secure"))
      .catch(() => undefined);
  }, []);

  const logout = () => {
    setToken(null);
    setUser(null);
    navigate("/login");
  };

  const login = async (email: string, password: string) => {
    const result = await api<{ access_token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    setToken(result.access_token);
    setUser(result.user);
    navigate("/dashboard");
  };

  const signup = async (name: string, email: string, password: string) => {
    await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    navigate("/login", { replace: true, state: { signupComplete: true, email } });
  };

  if (checking) {
    return <div className="boot-screen"><div className="loader" />Loading your workspace...</div>;
  }

  return (
    <>
      {notice && <Toast notice={notice} dismiss={() => setNotice(null)} />}
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" replace /> : <AuthPage key="login" mode="login" onLogin={login} />}
        />
        <Route
          path="/signup"
          element={user ? <Navigate to="/dashboard" replace /> : <AuthPage key="signup" mode="signup" onSignup={signup} />}
        />
        <Route
          path="*"
          element={
            user
              ? <Shell user={user} mode={mode} logout={logout} notify={notify} />
              : <Navigate to="/login" state={{ from: location }} replace />
          }
        />
      </Routes>
    </>
  );
}

type AuthPageProps = {
  mode: "login" | "signup";
  onLogin?: (email: string, password: string) => Promise<void>;
  onSignup?: (name: string, email: string, password: string) => Promise<void>;
};

function AuthPage({ mode, onLogin, onSignup }: AuthPageProps) {
  const location = useLocation();
  const registration = location.state as { signupComplete?: boolean; email?: string } | null;
  const [name, setName] = useState("");
  const [email, setEmail] = useState(registration?.email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isSignup = mode === "signup";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (isSignup && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (isSignup && password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      if (isSignup) await onSignup?.(name.trim(), email.trim(), password);
      else await onLogin?.(email.trim(), password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-layout">
      <section className="auth-story">
        <div className="brand-lockup">
          <span className="brand-mark"><CalendarDays size={22} /></span>
          <span>CALENDAR<span className="brand-light">LAB</span></span>
        </div>
        <div className="story-copy">
          <div className="eyebrow"><ShieldCheck size={15} /> AI SAFETY TRAINING ENVIRONMENT</div>
          <h1>Plan with confidence.<br /><span>Learn safer AI.</span></h1>
          <p>A hands-on calendar workspace for understanding human oversight and least-privilege AI agents.</p>
        </div>
        <div className="story-foot">
          <div className="story-icon"><ShieldCheck size={20} /></div>
          <span><strong>Secure by design</strong><small>Local demo mode works without an AI key</small></span>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-heading">
            <span className="eyebrow">YOUR WORKSPACE</span>
            <h2>{isSignup ? "Create your account" : "Welcome back"}</h2>
            <p>{isSignup ? "Start organizing your calendar securely." : "Sign in to continue to your calendar."}</p>
          </div>

          {!isSignup && registration?.signupComplete && (
            <div className="form-success" role="status"><CheckCircle2 size={16} />Account created. Sign in to continue.</div>
          )}

          {isSignup && (
            <label>
              Full name
              <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} placeholder="Alex Morgan" />
            </label>
          )}

          <label>
            Email address
            <input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" />
          </label>
          <label>
            Password
            <span className="password-wrap">
              <input
                autoComplete={isSignup ? "new-password" : "current-password"}
                type={passwordVisible ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder={isSignup ? "At least 8 characters" : "Enter your password"}
              />
              <button type="button" className="text-button" onClick={() => setPasswordVisible((visible) => !visible)}>
                {passwordVisible ? "Hide" : "Show"}
              </button>
            </span>
          </label>

          {isSignup && (
            <label>
              Confirm password
              <input
                autoComplete="new-password"
                type={passwordVisible ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                placeholder="Re-enter your password"
              />
            </label>
          )}

          {error && <div className="form-error" role="alert"><AlertCircle size={16} />{error}</div>}

          <button className="button primary full" disabled={busy}>
            {busy ? <><span className="button-spinner" />Working...</> : isSignup ? "Create account" : "Sign in"}
            {!busy && <ArrowRight size={17} />}
          </button>
          <p className="auth-switch">
            {isSignup ? "Already have an account?" : "New to Calendar Lab?"}{" "}
            <Link to={isSignup ? "/login" : "/signup"}>{isSignup ? "Sign in" : "Create an account"}</Link>
          </p>
        </form>
        <footer className="auth-footer">AI Booking & Calendar Agent Security Lab - OWASP LLM06</footer>
      </section>
    </main>
  );
}

type ShellProps = {
  user: User;
  mode: string;
  logout: () => void;
  notify: Notify;
};

function Shell({ user, mode, logout, notify }: ShellProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const location = useLocation();
  const currentPage = navItems.find((item) => item.to === location.pathname)?.label || "Page";
  const initial = user.name.slice(0, 1).toUpperCase();
  const modeLabel = mode === "vulnerable" ? "Vulnerable mode" : "Secure mode";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${navigationOpen ? "sidebar-open" : ""}`}>
        <Link className="sidebar-brand" to="/dashboard">
          <span className="brand-mark"><CalendarDays size={21} /></span>
          <span>CALENDAR<span className="brand-light">LAB</span><small>AI SECURITY WORKSPACE</small></span>
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setNavigationOpen(false)}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Approvals" && <ApprovalBadge />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-row">
            <div className="avatar">{initial}</div>
            <div className="user-info"><strong>{user.name}</strong><small>{user.email}</small></div>
            <button title="Sign out" aria-label="Sign out" className="icon-button" onClick={logout}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      {navigationOpen && <button aria-label="Close navigation" className="scrim" onClick={() => setNavigationOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setNavigationOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumb">Workspace <ChevronRight size={14} /> <span>{currentPage}</span></div>
          <div className="topbar-right">
            <div className="secure-indicator"><span className={`mode-dot ${mode}`} />{modeLabel}</div>
            <div className="top-avatar">{initial}</div>
          </div>
        </header>

        <div className="page-container">
          <Routes>
            <Route path="/dashboard" element={<Dashboard user={user} />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/meetings" element={<MeetingsPage notify={notify} />} />
            <Route path="/assistant" element={<AssistantPage user={user} notify={notify} />} />
            <Route path="/approvals" element={<ApprovalsPage notify={notify} />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/settings" element={<SettingsPage user={user} mode={mode} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Meeting[] | { items: Meeting[] }>("/api/meetings");
      setMeetings(Array.isArray(data) ? data : data.items);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load meetings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { meetings, loading, error, reload };
}

type PageTitleProps = {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

function PageTitle({ eyebrow, title, description, action }: PageTitleProps) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function Dashboard({ user }: { user: User }) {
  const { meetings, loading, error, reload } = useMeetings();
  const upcoming = meetings
    .filter((meeting) => meeting.status !== "cancelled" && new Date(meeting.start_time).getTime() >= Date.now())
    .sort((first, second) => +new Date(first.start_time) - +new Date(second.start_time));
  const todayMeetings = meetings.filter(
    (meeting) => meeting.status !== "cancelled" && startOfDay(meeting.start_time) === startOfDay(new Date().toISOString()),
  );
  const recent = [...meetings]
    .sort((first, second) => +new Date(second.updated_at || second.start_time) - +new Date(first.updated_at || first.start_time))
    .slice(0, 3);
  const firstName = user.name.trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

  return (
    <>
      <PageTitle
        eyebrow="YOUR DAY, AT A GLANCE"
        title={`Good ${greeting}, ${firstName}`}
        description={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        action={<Link className="button primary" to="/meetings?new=1"><Plus size={17} /> New meeting</Link>}
      />

      {error && <ErrorPanel message={error} retry={reload} />}

      <div className="stats-grid">
        <Stat icon={CalendarDays} label="Total meetings" value={loading ? "-" : meetings.length} tone="blue" />
        <Stat icon={Clock3} label="Today" value={loading ? "-" : todayMeetings.length} tone="cyan" />
        <Stat icon={ArrowRight} label="Upcoming" value={loading ? "-" : upcoming.length} tone="violet" />
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <div className="card-heading">
            <div><h2>Coming up</h2><p>Your next scheduled meetings</p></div>
            <Link to="/calendar" className="subtle-link">Open calendar <ArrowRight size={14} /></Link>
          </div>
          {loading ? <Loading /> : upcoming.length ? (
            <MeetingList meetings={upcoming.slice(0, 4)} />
          ) : (
            <Empty
              icon={CalendarDays}
              title="Nothing on your calendar yet"
              detail="Create a meeting or ask the assistant to schedule one."
              action={<Link className="button secondary small" to="/meetings?new=1"><Plus size={15} /> Create meeting</Link>}
            />
          )}
        </section>

        <section className="card assistant-promo">
          <div className="promo-icon"><Sparkles size={22} /></div>
          <div className="eyebrow">AI CALENDAR ASSISTANT</div>
          <h2>Make time for what matters.</h2>
          <p>Ask in plain language to check availability, plan a meeting, or find what is coming up.</p>
          <Link to="/assistant" className="button primary">Chat with assistant <ArrowRight size={16} /></Link>
          <div className="promo-example">"Am I free tomorrow at 2?"</div>
        </section>
      </div>

      <section className="card recent-card">
        <div className="card-heading">
          <div><h2>Recently updated</h2><p>Your latest calendar changes</p></div>
          <Link to="/meetings" className="subtle-link">All meetings <ArrowRight size={14} /></Link>
        </div>
        {loading ? <Loading /> : recent.length ? <MeetingList meetings={recent} compact /> : (
          <Empty icon={Clock3} title="No recent activity" detail="Your recent meetings will appear here." />
        )}
      </section>
    </>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number | string; tone: string }) {
  return (
    <div className="stat-card">
      <span className={`stat-icon ${tone}`}><Icon size={19} /></span>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function CalendarPage() {
  const { meetings, loading, error, reload } = useMeetings();
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "agenda">("month");
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthOffset = (monthStart.getDay() + 6) % 7;
  const weekOffset = (date.getDay() + 6) % 7;
  const days = view === "week"
    ? Array.from({ length: 7 }, (_, index) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - weekOffset + index))
    : Array.from({ length: 42 }, (_, index) => new Date(date.getFullYear(), date.getMonth(), index - monthOffset + 1));

  const moveCalendar = (direction: number) => {
    setDate(view === "week"
      ? new Date(date.getFullYear(), date.getMonth(), date.getDate() + direction * 7)
      : new Date(date.getFullYear(), date.getMonth() + direction, 1));
  };

  const agendaMeetings = meetings
    .filter((meeting) => {
      const start = new Date(meeting.start_time);
      return start.getMonth() === date.getMonth() && start.getFullYear() === date.getFullYear();
    })
    .sort((first, second) => +new Date(first.start_time) - +new Date(second.start_time));

  return (
    <>
      <PageTitle
        eyebrow="YOUR SCHEDULE"
        title="Calendar"
        description="Keep track of what's happening and when."
        action={<Link className="button primary" to="/meetings?new=1"><Plus size={17} /> New meeting</Link>}
      />

      <section className="card calendar-card">
        <div className="calendar-toolbar">
          <div className="month-nav">
            <button className="icon-button bordered" aria-label="Previous calendar period" onClick={() => moveCalendar(-1)}><ChevronLeft size={18} /></button>
            <h2>
              {view === "week"
                ? `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                : showDate(date)}
            </h2>
            <button className="icon-button bordered" aria-label="Next calendar period" onClick={() => moveCalendar(1)}><ChevronRight size={18} /></button>
            <button className="button secondary small" onClick={() => setDate(new Date())}>Today</button>
          </div>

          <div className="segmented">
            {(["month", "week", "agenda"] as const).map((option) => (
              <button key={option} className={view === option ? "selected" : ""} onClick={() => setView(option)}>
                {option[0].toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? <Loading /> : error ? <ErrorPanel message={error} retry={reload} /> : view !== "agenda" ? (
          <div className="calendar-grid">
            <div className="weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="days-grid">
              {days.map((day, index) => {
                const dayMeetings = meetings.filter((meeting) => new Date(meeting.start_time).toDateString() === day.toDateString());
                const isOtherMonth = day.getMonth() !== date.getMonth();
                const isToday = day.toDateString() === new Date().toDateString();

                return (
                  <div className={`day-cell${isOtherMonth ? " other-month" : ""}${isToday ? " today" : ""}`} key={index}>
                    <span className="day-number">{day.getDate()}</span>
                    {dayMeetings.slice(0, 2).map((meeting) => (
                      <Link key={meeting.id} to={`/meetings?id=${meeting.id}`} className={`day-event ${meeting.status}`}>
                        {new Date(meeting.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - {meeting.title}
                      </Link>
                    ))}
                    {dayMeetings.length > 2 && <span className="more-events">+{dayMeetings.length - 2} more</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ) : <MeetingList meetings={agendaMeetings} />}
      </section>

      <p className="calendar-note"><span className="legend scheduled" /> Scheduled | <span className="legend cancelled" /> Cancelled | Times shown in your local timezone</p>
    </>
  );
}

function MeetingsPage({ notify }: { notify: Notify }) {
  const { meetings, loading, error, reload } = useMeetings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [detail, setDetail] = useState<Meeting | null>(null);
  const [creating, setCreating] = useState(() => searchParams.has("new"));

  useEffect(() => {
    const id = Number(searchParams.get("id"));
    setDetail(Number.isSafeInteger(id) ? meetings.find((meeting) => meeting.id === id) || null : null);
  }, [meetings, searchParams]);

  const filteredMeetings = meetings.filter((meeting) => {
    const matchesStatus = filter === "all" || meeting.status === filter;
    const content = `${meeting.title} ${meeting.description || ""} ${meeting.location || ""}`.toLowerCase();
    return matchesStatus && content.includes(search.toLowerCase());
  });

  const closeModal = () => {
    setCreating(false);
    setSelected(null);
    setDetail(null);
    setSearchParams({});
  };

  const saveMeeting = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title")).trim(),
      description: String(form.get("description") || ""),
      start_time: new Date(String(form.get("start_time"))).toISOString(),
      end_time: new Date(String(form.get("end_time"))).toISOString(),
      location: String(form.get("location") || ""),
      attendees: String(form.get("attendees") || "").split(",").map((value) => value.trim()).filter(Boolean),
    };

    if (new Date(payload.end_time) <= new Date(payload.start_time)) {
      notify("error", "End time must be after start time.");
      return;
    }

    try {
      if (selected) {
        await api(`/api/meetings/${selected.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api("/api/meetings", { method: "POST", body: JSON.stringify(payload) });
      }
      notify("success", selected ? "Meeting updated." : "Meeting created.");
      closeModal();
      await reload();
    } catch (reason) {
      notify("error", reason instanceof Error ? reason.message : "Could not save meeting.");
    }
  };

  const cancelMeeting = async (meeting: Meeting) => {
    try {
      await api(`/api/meetings/${meeting.id}`, { method: "DELETE" });
      notify("success", "Meeting cancellation was submitted.");
      await reload();
    } catch (reason) {
      notify("error", reason instanceof Error ? reason.message : "Could not cancel meeting.");
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="YOUR COMMITMENTS"
        title="Meetings"
        description="Create, edit, and manage your meetings."
        action={<button className="button primary" onClick={() => { setSelected(null); setCreating(true); }}><Plus size={17} /> New meeting</button>}
      />

      <section className="card">
        <div className="list-toolbar">
          <div className="search-box">
            <span aria-hidden="true"><Search size={16} /></span>
            <input aria-label="Search meetings" placeholder="Search meetings..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <select aria-label="Filter by status" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All meetings</option>
            <option value="scheduled">Scheduled</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? <Loading /> : error ? <ErrorPanel message={error} retry={reload} /> : filteredMeetings.length ? (
          <div className="meeting-table">
            {filteredMeetings.map((meeting) => (
              <div className="meeting-row" key={meeting.id}>
                <div className="meeting-date-tile"><strong>{new Date(meeting.start_time).getDate()}</strong><small>{new Date(meeting.start_time).toLocaleDateString(undefined, { month: "short" })}</small></div>
                <button className="meeting-row-main meeting-open" onClick={() => { setSearchParams({ id: String(meeting.id) }); setDetail(meeting); }}>
                  <strong>{meeting.title}</strong>
                  <span>{dateTime(meeting.start_time)} - {meeting.location || "No location"}</span>
                </button>
                <span className={`status-pill ${meeting.status}`}>{meeting.status}</span>
                <button className="button secondary small" onClick={() => { setSelected(meeting); setCreating(true); }}>Edit</button>
                {meeting.status !== "cancelled" && <button className="button danger-quiet small" onClick={() => void cancelMeeting(meeting)}>Cancel</button>}
              </div>
            ))}
          </div>
        ) : <Empty icon={CalendarDays} title="No matching meetings" detail="Adjust your filters or add a new meeting." />}
      </section>

      {detail && !creating && (
        <Modal title="Meeting details" close={closeModal}>
          <div className="details-content">
            <span className={`status-pill ${detail.status}`}>{detail.status}</span>
            <h3>{detail.title}</h3>
            <p>{detail.description || "No description provided."}</p>
            <div className="details-grid">
              <div><small>STARTS</small><strong>{dateTime(detail.start_time)}</strong></div>
              <div><small>ENDS</small><strong>{dateTime(detail.end_time)}</strong></div>
              <div><small>LOCATION</small><strong>{detail.location || "Not specified"}</strong></div>
              <div><small>ATTENDEES</small><strong>{Array.isArray(detail.attendees) ? detail.attendees.join(", ") || "None" : detail.attendees || "None"}</strong></div>
            </div>
            <div className="modal-actions">
              <button className="button secondary" onClick={closeModal}>Close</button>
              <button className="button primary" disabled={detail.status === "cancelled"} onClick={() => { setSelected(detail); setCreating(true); }}>Edit meeting</button>
            </div>
          </div>
        </Modal>
      )}

      {(creating || selected) && (
        <Modal title={selected ? "Edit meeting" : "Create a meeting"} close={closeModal}>
          <form className="meeting-form" onSubmit={saveMeeting}>
            <label>Title<input name="title" defaultValue={selected?.title} required maxLength={160} /></label>
            <label>Description<textarea name="description" rows={3} defaultValue={selected?.description || ""} /></label>
            <div className="form-grid">
              <label>Starts<input name="start_time" type="datetime-local" defaultValue={selected ? isoLocal(new Date(selected.start_time)) : isoLocal(new Date(Date.now() + 3600000))} required /></label>
              <label>Ends<input name="end_time" type="datetime-local" defaultValue={selected ? isoLocal(new Date(selected.end_time)) : isoLocal(new Date(Date.now() + 7200000))} required /></label>
            </div>
            <label>Location<input name="location" defaultValue={selected?.location || ""} placeholder="Optional" /></label>
            <label>Attendees<input name="attendees" defaultValue={Array.isArray(selected?.attendees) ? selected.attendees.join(", ") : selected?.attendees || ""} placeholder="Comma-separated names or emails" /></label>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={closeModal}>Cancel</button>
              <button className="button primary">{selected ? "Save changes" : "Create meeting"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function AssistantPage({ user, notify }: { user: User; notify: Notify }) {
  const [history, setHistory] = useState<AssistantConversation[]>(() => readAssistantHistory(user.id));
  const [activeId, setActiveId] = useState<string | null>(() => readAssistantHistory(user.id)[0]?.id ?? null);
  const [messages, setMessages] = useState<AssistantMessage[]>(() => readAssistantHistory(user.id)[0]?.messages ?? [assistantWelcome]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [assistantMode, setAssistantMode] = useState("Local Demo Mode");

  useEffect(() => {
    localStorage.setItem(`calendar_lab_assistant_history_${user.id}`, JSON.stringify(history));
  }, [history, user.id]);

  const rememberConversation = (id: string, nextMessages: AssistantMessage[], title: string) => {
    setHistory((currentHistory) => {
      const existing = currentHistory.find((conversation) => conversation.id === id);
      const conversation = {
        id,
        title: existing?.title || title.slice(0, 54),
        updatedAt: new Date().toISOString(),
        messages: nextMessages,
      };
      return [conversation, ...currentHistory.filter((item) => item.id !== id)].slice(0, 30);
    });
  };

  const sendMessage = async (event?: FormEvent, preset?: string) => {
    event?.preventDefault();
    const message = (preset || text).trim();
    if (!message || busy) return;

    const conversationId = activeId || (globalThis.crypto?.randomUUID?.() ?? `chat-${Date.now()}`);
    const title = messages.find((item) => item.role === "user")?.text || message;
    const userMessages = [...messages, { role: "user" as const, text: message }];

    setActiveId(conversationId);
    setMessages(userMessages);
    rememberConversation(conversationId, userMessages, title);
    setText("");
    setBusy(true);

    try {
      const result = await api<ChatReply>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      setAssistantMode(/connected|llm/i.test(result.mode || "") ? "Connected LLM" : "Local Demo Mode");

      const replyMessages = [...userMessages, { role: "assistant" as const, text: displayAssistantReply(result.reply) }];
      setMessages(replyMessages);
      rememberConversation(conversationId, replyMessages, title);

      if (result.status === "pending_approval") {
        notify("success", "An approval request is waiting for your review.");
      }
    } catch (reason) {
      const failedMessages = [...userMessages, {
        role: "assistant" as const,
        text: reason instanceof Error ? reason.message : "I could not process that request.",
      }];
      setMessages(failedMessages);
      rememberConversation(conversationId, failedMessages, title);
      notify("error", "The assistant request could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const startNewChat = () => {
    setActiveId(null);
    setMessages([assistantWelcome]);
    setText("");
  };

  return (
    <>
      <PageTitle eyebrow="YOUR AI CALENDAR COMPANION" title="AI assistant" description="Tell your assistant what you need in plain language." />

      <div className="assistant-layout">
        <section className="card chat-card">
          <div className="chat-header">
            <span className="assistant-avatar"><Bot size={20} /></span>
            <div><strong>Calendar assistant</strong><small><span className="online-dot" />{assistantMode}</small></div>
            <span className="safe-chip"><ShieldCheck size={14} /> Scoped tools</span>
            <button className="button secondary small new-chat" onClick={startNewChat}><Plus size={14} /> New chat</button>
          </div>

          <div className="chat-messages">
            {messages.map((message, index) => (
              <div key={index} className={`chat-message ${message.role}`}>
                <span className="message-avatar">{message.role === "assistant" ? <Bot size={15} /> : "You"}</span>
                <div className="bubble">{message.text}</div>
              </div>
            ))}
            {busy && <div className="chat-message assistant"><span className="message-avatar"><Bot size={15} /></span><div className="bubble typing"><i /><i /><i /></div></div>}
          </div>

          <form className="chat-input" onSubmit={(event) => void sendMessage(event)}>
            <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Ask about your calendar..." aria-label="Message assistant" />
            <button className="button primary" disabled={busy || !text.trim()}>Send <ArrowRight size={16} /></button>
          </form>
        </section>

        <aside className="assistant-side">
          <div className="card assistant-history">
            <div className="history-heading"><div className="eyebrow"><MessageSquare size={13} /> CHAT HISTORY</div></div>
            {history.length ? (
              <div className="assistant-history-list">
                {history.map((conversation) => (
                  <button
                    key={conversation.id}
                    className={`assistant-history-item${activeId === conversation.id ? " selected" : ""}`}
                    onClick={() => { setActiveId(conversation.id); setMessages(conversation.messages); setText(""); }}
                  >
                    <span>{conversation.title}</span>
                    <small>{new Date(conversation.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>
                  </button>
                ))}
              </div>
            ) : <p className="history-empty">Your conversations will appear here.</p>}
          </div>

          <div className="card">
            <div className="eyebrow">TRY ASKING</div>
            <div className="suggestion-list">
              {assistantSuggestions.map((suggestion) => (
                <button key={suggestion} onClick={() => void sendMessage(undefined, suggestion)}>{suggestion}<ArrowRight size={14} /></button>
              ))}
            </div>
          </div>

          <div className="training-note">
            <ShieldCheck size={18} />
            <div>
              <strong>Human oversight matters</strong>
              <p>In secure mode, high-impact actions such as cancellation require your approval before they happen.</p>
              <Link to="/approvals">Review pending approvals <ArrowRight size={13} /></Link>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function useApprovals() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Approval[] | { items: Approval[] }>("/api/approvals");
      setApprovals(Array.isArray(data) ? data : data.items);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load approvals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { approvals, loading, error, reload };
}

function ApprovalBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    void api<Approval[]>("/api/approvals")
      .then((approvals) => setCount(approvals.filter((approval) => approval.status === "pending").length))
      .catch(() => undefined);
  }, []);

  return count > 0 ? <span className="nav-count">{count}</span> : null;
}

function ApprovalsPage({ notify }: { notify: Notify }) {
  const { approvals, loading, error, reload } = useApprovals();
  const pendingApprovals = approvals.filter((approval) => approval.status === "pending");
  const reviewedApprovals = approvals.filter((approval) => approval.status !== "pending");

  const decide = async (approval: Approval, decision: "approve" | "reject") => {
    try {
      await api(`/api/approvals/${approval.id}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      notify("success", decision === "approve" ? "Approval recorded and action executed." : "Request rejected.");
      await reload();
    } catch (reason) {
      notify("error", reason instanceof Error ? reason.message : "Approval decision failed.");
    }
  };

  return (
    <>
      <PageTitle eyebrow="HUMAN-IN-THE-LOOP" title="Pending approvals" description="Review proposed high-impact actions before they are executed." />
      <section className="card approvals-card">
        {loading ? <Loading /> : error ? <ErrorPanel message={error} retry={reload} /> : pendingApprovals.length ? (
          pendingApprovals.map((approval) => <ApprovalCard key={approval.id} approval={approval} decide={decide} />)
        ) : <Empty icon={CheckCircle2} title="You are all caught up" detail="New actions requiring your review will appear here." />}
      </section>

      {reviewedApprovals.length > 0 && (
        <section className="card history-card">
          <div className="card-heading"><div><h2>Recent decisions</h2><p>Previously reviewed requests</p></div></div>
          {reviewedApprovals.map((approval) => (
            <div className="history-row" key={approval.id}>
              <span>{(approval.action_type || approval.action || "calendar change").replaceAll("_", " ")}</span>
              <span className={`status-pill ${approval.status}`}>{approval.status}</span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function ApprovalCard({ approval, decide }: { approval: Approval; decide: (approval: Approval, decision: "approve" | "reject") => void }) {
  const payload = approval.payload || {};
  const expiresAt = new Date(approval.expires_at);
  const action = (approval.action_type || approval.action || "calendar change").replaceAll("_", " ");
  const meetingTitle = approval.meeting_title || String(payload.title || `Meeting #${approval.target_id ?? approval.meeting_id ?? "-"}`);

  return (
    <article className="approval-card">
      <div className="approval-icon"><ShieldCheck size={20} /></div>
      <div className="approval-body">
        <div className="approval-title-row"><h2>Review action: {action}</h2><span className="status-pill pending">Pending review</span></div>
        <p>Approving will cancel this scheduled meeting. It will remain in your calendar history.</p>
        <div className="approval-details">
          <div><small>MEETING</small><strong>{meetingTitle}</strong></div>
          <div><small>CURRENT STATUS</small><strong>{approval.meeting_status || "scheduled"}</strong></div>
          <div><small>STARTS</small><strong>{approval.meeting_start_time ? dateTime(approval.meeting_start_time) : "-"}</strong></div>
          <div><small>EXPIRES</small><strong>{dateTime(approval.expires_at)}{expiresAt < new Date() ? " - Expired" : ""}</strong></div>
        </div>
        <div className="approval-actions">
          <button className="button secondary" onClick={() => decide(approval, "reject")}><X size={16} /> Reject</button>
          <button className="button primary" disabled={expiresAt < new Date()} onClick={() => decide(approval, "approve")}><Check size={16} /> Approve action</button>
        </div>
      </div>
    </article>
  );
}

function ActivityPage() {
  const [events, setEvents] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<AuditEntry[] | { items: AuditEntry[] }>("/api/audit");
      setEvents(Array.isArray(data) ? data : data.items);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <>
      <PageTitle eyebrow="TRANSPARENCY & OVERSIGHT" title="Activity log" description="A record of calendar actions and assistant activity." />
      <section className="card">
        {loading ? <Loading /> : error ? <ErrorPanel message={error} retry={reload} /> : events.length ? (
          <div className="activity-list">
            {events.map((event) => (
              <div className="activity-row" key={event.id}>
                <div className="activity-icon"><Activity size={16} /></div>
                <div className="activity-text">
                  <strong>{event.action.replaceAll("_", " ").replaceAll(".", " - ")}</strong>
                  <span>{event.resource_type} {event.resource_id}{event.details ? ` - ${event.details}` : ""}</span>
                </div>
                <time>{dateTime(event.created_at)}</time>
              </div>
            ))}
          </div>
        ) : <Empty icon={Activity} title="No activity yet" detail="Your calendar changes and approval decisions will be recorded here." />}
      </section>
    </>
  );
}

function SettingsPage({ user, mode }: { user: User; mode: string }) {
  const modeLabel = mode === "vulnerable" ? "Vulnerable mode" : "Secure mode";
  const modeDescription = mode === "vulnerable"
    ? "Synthetic training environment. No real calendar integrations."
    : "User-scoped access and human approval for high-impact changes.";

  return (
    <>
      <PageTitle eyebrow="ACCOUNT" title="Profile & settings" description="Your account details and current lab configuration." />
      <div className="settings-grid">
        <section className="card settings-card">
          <div className="card-heading"><div><h2>Profile</h2><p>Account information used in this workspace.</p></div></div>
          <div className="profile-large"><div className="avatar large">{user.name.slice(0, 1).toUpperCase()}</div><div><strong>{user.name}</strong><span>{user.email}</span></div></div>
          <div className="setting-line"><span>Display name</span><strong>{user.name}</strong></div>
          <div className="setting-line"><span>Email</span><strong>{user.email}</strong></div>
          <div className="setting-line"><span>Account role</span><strong>{user.role || "user"}</strong></div>
        </section>

        <section className="card settings-card">
          <div className="card-heading"><div><h2>Lab configuration</h2><p>Mode is configured by the backend and cannot be changed here.</p></div></div>
          <div className="mode-large"><span className={`mode-dot ${mode}`} /><div><strong>{modeLabel}</strong><p>{modeDescription}</p></div></div>
          <div className="setting-line"><span>Assistant availability</span><strong>Local demo available</strong></div>
          <div className="setting-line"><span>Calendar data</span><strong>Private to your account</strong></div>
        </section>
      </div>
    </>
  );
}

function MeetingList({ meetings, compact = false }: { meetings: Meeting[]; compact?: boolean }) {
  return (
    <div className={`upcoming-list${compact ? " compact" : ""}`}>
      {meetings.map((meeting) => (
        <Link to={`/meetings?id=${meeting.id}`} key={meeting.id} className="upcoming-row">
          <div className="upcoming-date"><span>{new Date(meeting.start_time).toLocaleDateString(undefined, { month: "short" })}</span><strong>{new Date(meeting.start_time).getDate()}</strong></div>
          <div className="upcoming-info">
            <strong>{meeting.title}</strong>
            <span>
              {new Date(meeting.start_time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              {" - "}
              {new Date(meeting.end_time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              {meeting.location ? ` - ${meeting.location}` : ""}
            </span>
          </div>
          <span className={`status-pill ${meeting.status}`}>{meeting.status}</span>
        </Link>
      ))}
    </div>
  );
}

function Toast({ notice, dismiss }: { notice: Notice; dismiss: () => void }) {
  return (
    <div role="status" className={`toast ${notice.kind}`}>
      <span>{notice.kind === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}{notice.text}</span>
      <button aria-label="Dismiss" onClick={dismiss}><X size={16} /></button>
    </div>
  );
}

function Loading() {
  return <div className="loading-state"><div className="loader" />Loading...</div>;
}

function ErrorPanel({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="inline-error">
      <AlertCircle size={18} />
      <span>{message}</span>
      <button className="button secondary small" onClick={retry}>Retry</button>
    </div>
  );
}

function Empty({ icon: Icon, title, detail, action }: { icon: LucideIcon; title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon size={22} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
      {action}
    </div>
  );
}

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const closeOnBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close();
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={closeOnBackdrop}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button aria-label="Close dialog" className="icon-button" onClick={close}><X size={19} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function NotFound() {
  return (
    <div className="not-found">
      <div className="eyebrow">404 - PAGE NOT FOUND</div>
      <h1>We cannot find that page.</h1>
      <p>It may have moved, or the address may be incorrect.</p>
      <Link className="button primary" to="/dashboard">Back to overview <ArrowRight size={16} /></Link>
    </div>
  );
}

export default App;
