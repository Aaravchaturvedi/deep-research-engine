import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ChevronsLeft,
  Loader2,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { type RootState } from "../app/store";
import {
  fetchSessions,
  fetchSessionMessages,
  renameSession,
  deleteSession,
} from "../features/chat/sessionApi";
import {
  setSessions,
  loadSession,
  startNewChat,
  closeSidebar,
  toggleSidebarCollapsed,
  dropSession,
  applySessionTitle,
} from "../features/chat/chatSlice";
import { logout } from "../features/auth/authSlice";
import { logoutUser } from "../features/auth/authApi";
import { disconnectSocket } from "../lib/socket";
import { useToast } from "./Toasts";
import Logo from "./Logo";

type GroupKey = "Today" | "Yesterday" | "Previous 7 days" | "Older";

function groupOf(iso: string): GroupKey {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const day = startOf(d);
  const today = startOf(now);
  const diffDays = Math.round((today - day) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "Previous 7 days";
  return "Older";
}

const GROUP_ORDER: GroupKey[] = ["Today", "Yesterday", "Previous 7 days", "Older"];

export default function Sidebar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { push } = useToast();
  const { sessions, sessionId, isSidebarOpen, sidebarCollapsed } = useSelector(
    (state: RootState) => state.chat
  );
  const user = useSelector((state: RootState) => state.auth.user);
  const [query, setQuery] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchSessions();
        dispatch(setSessions(data));
      } catch {
        // Sidebar stays usable (empty); the error surfaces where it matters.
      } finally {
        setLoadingList(false);
      }
    })();
  }, [dispatch]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? sessions.filter((s) => s.title.toLowerCase().includes(q))
      : sessions;
    const groups = new Map<GroupKey, typeof list>();
    for (const s of list) {
      const g = groupOf(s.updatedAt);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(s);
    }
    return GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({
      label: g,
      items: groups.get(g)!,
    }));
  }, [sessions, query]);

  const handleSelect = async (id: string) => {
    try {
      const data = await fetchSessionMessages(id);
      dispatch(loadSession({ sessionId: data.session.id, messages: data.messages }));
    } catch {
      push("error", "Couldn’t open that chat. Try again.");
    }
    dispatch(closeSidebar());
  };

  const handleNewChat = () => {
    dispatch(startNewChat());
    dispatch(closeSidebar());
  };

  const commitRename = async (id: string) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title) return;
    setBusyId(id);
    try {
      await renameSession(id, title);
      dispatch(applySessionTitle({ id, title }));
    } catch {
      push("error", "Rename failed. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      window.setTimeout(() => {
        setConfirmDeleteId((cur) => (cur === id ? null : cur));
      }, 4000);
      return;
    }
    setConfirmDeleteId(null);
    setBusyId(id);
    try {
      await deleteSession(id);
      dispatch(dropSession(id));
      push("success", "Chat deleted.");
    } catch {
      push("error", "Delete failed. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    disconnectSocket();
    dispatch(logout());
    navigate("/login");
  };

  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <>
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 md:hidden"
          onClick={() => dispatch(closeSidebar())}
          aria-hidden
        />
      )}

      <div
        className={`fixed z-40 flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out md:relative ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${sidebarCollapsed ? "md:w-0 md:overflow-hidden md:border-r-0" : "md:w-72"} w-72`}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <Logo size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">Deep Research Engine</p>
            <p className="text-xs text-slate-400">Cited answers, fast</p>
          </div>
          <button
            onClick={() => dispatch(toggleSidebarCollapsed())}
            className="hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 md:block"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 pb-2">
          <button
            onClick={handleNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            New chat
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 hover:border-slate-300"
              aria-label="Search chats"
            />
          </div>
        </div>

        {/* List */}
        <div className="nice-scroll flex-1 space-y-4 overflow-y-auto px-3 pb-3 pt-1">
          {loadingList ? (
            <div className="space-y-2 px-1 pt-2" aria-label="Loading chats">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-2 pt-4 text-center text-sm text-slate-400">
              {query ? "No chats match your search." : "No chats yet — start a new one above."}
            </p>
          ) : (
            filtered.map((group) => (
              <div key={group.label}>
                <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((s) => {
                    const active = s.id === sessionId;
                    const busy = busyId === s.id;
                    if (renamingId === s.id) {
                      return (
                        <div key={s.id} className="flex items-center gap-1 rounded-lg bg-brand-50 p-1 ring-1 ring-brand-200">
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(s.id);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            onBlur={() => commitRename(s.id)}
                            className="min-w-0 flex-1 rounded-md border border-brand-300 bg-white px-2 py-1.5 text-sm"
                            aria-label="Rename chat"
                          />
                          <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => commitRename(s.id)}
                            className="rounded-md p-1.5 text-brand-600 hover:bg-brand-100"
                            aria-label="Save name"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={s.id}
                        className={`group flex items-center gap-0.5 rounded-lg px-1 py-0.5 ${
                          active ? "bg-brand-50 ring-1 ring-brand-100" : "hover:bg-slate-100"
                        }`}
                      >
                        <button
                          onClick={() => handleSelect(s.id)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-2 text-left"
                          title={s.title}
                        >
                          <MessageSquare
                            className={`h-4 w-4 shrink-0 ${active ? "text-brand-600" : "text-slate-400"}`}
                          />
                          <span className={`truncate text-sm ${active ? "font-medium text-slate-900" : "text-slate-600"}`}>
                            {confirmDeleteId === s.id ? "Delete this chat?" : s.title}
                          </span>
                        </button>
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                        ) : confirmDeleteId === s.id ? (
                          <span className="flex shrink-0 items-center">
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="rounded-md px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200"
                              aria-label="Cancel delete"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ) : (
                          <span className="hidden shrink-0 items-center group-hover:flex">
                            <button
                              onClick={() => {
                                setRenameValue(s.title);
                                setRenamingId(s.id);
                              }}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                              title="Rename"
                              aria-label={`Rename ${s.title}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="Delete"
                              aria-label={`Delete ${s.title}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* User footer */}
        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              {initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {user?.name || "Researcher"}
              </span>
              <span className="block truncate text-xs text-slate-400">{user?.email || ""}</span>
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
