'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  Clock,
  Users,
  Video,
  Plus,
  X,
  Check,
  AlertCircle,
  Copy,
  Hash,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  Pencil,
  Sparkles,
  Zap,
  Crown,
  Search,
} from 'lucide-react';
import { User, WorkspaceMember, WorkspaceRole, Meeting } from '@/types/auth';
import { ROLE_CONFIGS, canInviteMembers } from '@/lib/roles';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface CalendarViewProps {
  workspaceId: string;
  token: string | null;
  currentUser: User | null;
  currentUserRole: WorkspaceRole;
  channels: any[];
  members: WorkspaceMember[];
  onStartInstantMeeting: (meetingTitle?: string, channelId?: string) => void;
  onJoinMeeting: (meeting: Meeting) => void;
  onClose?: () => void;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getRelativeDay(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

export function CalendarView({
  workspaceId,
  token,
  currentUser,
  currentUserRole,
  channels,
  members,
  onStartInstantMeeting,
  onJoinMeeting,
  onClose,
}: CalendarViewProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'upcoming' | 'all' | 'past'>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState(30);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedLinkMeetingId, setCopiedLinkMeetingId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  const canSchedule = canInviteMembers(currentUserRole);
  const now = new Date();

  useEffect(() => {
    loadMeetings();
  }, [workspaceId, token]);

  async function loadMeetings() {
    if (!workspaceId || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/workspaces/${workspaceId}/meetings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMeetings(await res.json());
    } catch (e) {
      console.error('Failed to load meetings:', e);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingMeeting(null);
    setTitle('');
    setDescription('');
    const d = selectedDay || new Date();
    if (d < now) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDate(tomorrow.toISOString().split('T')[0]);
    } else {
      setDate(d.toISOString().split('T')[0]);
    }
    setTime('14:00');
    setDuration(30);
    setSelectedChannelId(channels[0]?.id || '');
    setSelectedUserIds(members.filter((m) => m.user.id !== currentUser?.id).map((m) => m.user.id));
    setFormError(null);
    setMemberSearch('');
    setShowModal(true);
  }

  function openEditModal(m: Meeting) {
    setEditingMeeting(m);
    setTitle(m.title);
    setDescription(m.description || '');
    const d = new Date(m.scheduledAt);
    setDate(d.toISOString().split('T')[0]);
    setTime(d.toTimeString().slice(0, 5));
    setDuration(m.duration);
    setSelectedChannelId(m.channelId || '');
    setSelectedUserIds(m.participants?.map((p) => p.userId) || []);
    setFormError(null);
    setMemberSearch('');
    setShowModal(true);
  }

  async function handleSubmitMeeting(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date || !time || !token) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      const payload: any = {
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledAt,
        duration: Number(duration),
        channelId: selectedChannelId || undefined,
        participantIds: selectedUserIds,
      };
      let res: Response;
      if (editingMeeting) {
        res = await fetch(`${API_URL}/meetings/${editingMeeting.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API_URL}/workspaces/${workspaceId}/meetings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      }
      if (res.ok) {
        setShowModal(false);
        loadMeetings();
      } else {
        const data = await res.json();
        setFormError(data.message || 'Failed to save meeting');
      }
    } catch {
      setFormError('Failed to connect to server');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteMeeting(meetingId: string) {
    if (!confirm('Are you sure you want to cancel this meeting?')) return;
    try {
      const res = await fetch(`${API_URL}/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
    } catch (e) {
      console.error('Failed to cancel meeting:', e);
    }
  }

  function copyMeetingLink(m: Meeting) {
    const link = `${window.location.origin}/workspace/${workspaceId}?meeting=${m.id}`;
    navigator.clipboard.writeText(link);
    setCopiedLinkMeetingId(m.id);
    setTimeout(() => setCopiedLinkMeetingId(null), 2500);
  }

  // Calendar grid computation
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    return days;
  }, [calendarDate]);

  // Meetings indexed by date string "YYYY-MM-DD"
  const meetingsByDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    meetings.forEach((m) => {
      const key = new Date(m.scheduledAt).toLocaleDateString('en-CA'); // YYYY-MM-DD
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });
    return map;
  }, [meetings]);

  // Filtered list for right panel
  const filteredMeetings = useMemo(() => {
    return meetings
      .filter((m) => {
        const d = new Date(m.scheduledAt);
        const isPast = d.getTime() + m.duration * 60000 < now.getTime();
        const matchesSearch =
          m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (m.channel?.name && m.channel.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (m.host?.name && m.host.name.toLowerCase().includes(searchQuery.toLowerCase()));
        if (!matchesSearch) return false;

        // If a day is selected on calendar, filter to that day only
        if (selectedDay) {
          const selKey = selectedDay.toLocaleDateString('en-CA');
          const meetKey = d.toLocaleDateString('en-CA');
          if (selKey !== meetKey) return false;
        } else {
          if (filterTab === 'upcoming') return !isPast || m.status === 'LIVE';
          if (filterTab === 'past') return isPast && m.status !== 'LIVE';
        }
        return true;
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [meetings, filterTab, searchQuery, selectedDay]);

  function prevMonth() {
    setCalendarDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCalendarDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }
  function goToToday() {
    setCalendarDate(new Date());
    setSelectedDay(new Date());
  }

  const todayKey = now.toLocaleDateString('en-CA');
  const selectedKey = selectedDay?.toLocaleDateString('en-CA');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: 'linear-gradient(135deg, #0A0D14 0%, #0F1623 100%)', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── TOP HEADER ──────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#111827]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-600/20">
            <CalendarDays className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              Calendar & Meetings
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                currentUserRole === 'OWNER' ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' :
                currentUserRole === 'ADMIN' ? 'bg-violet-500/15 border-violet-500/30 text-violet-300' :
                'bg-slate-700/50 border-slate-600/40 text-slate-400'
              }`}>
                {currentUserRole === 'OWNER' ? '👑 Super Admin' : currentUserRole === 'ADMIN' ? '🛡 Admin' : currentUserRole === 'MANAGER' ? '⚡ Manager' : currentUserRole === 'TEAM_LEAD' ? '🎯 Team Lead' : 'Team'}
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 mt-0.5">Video calls, project syncs &amp; team conferences</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Instant meeting */}
          <button
            type="button"
            onClick={() => onStartInstantMeeting('Instant Team Meeting')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all"
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Start Now</span>
          </button>

          {canSchedule && (
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-lg shadow-violet-600/20 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Schedule</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/8 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN LAYOUT ─────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* ── LEFT: CALENDAR GRID ─────────────────────────────────── */}
        <div className="w-72 shrink-0 border-r border-white/5 flex flex-col bg-[#0D1117] hidden lg:flex">
          {/* Month nav */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
            <button onClick={prevMonth} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <div className="text-sm font-bold text-white">
                {MONTH_NAMES[calendarDate.getMonth()]}
              </div>
              <div className="text-[11px] text-slate-500">{calendarDate.getFullYear()}</div>
            </div>
            <button onClick={nextMonth} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 px-3 pt-3 pb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold text-slate-600 py-1">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 px-3 pb-3 gap-y-1">
            {calendarDays.map((day, idx) => {
              if (!day) return <div key={idx} />;
              const key = day.toLocaleDateString('en-CA');
              const dayMeetings = meetingsByDay.get(key) || [];
              const isToday = key === todayKey;
              const isSelected = key === selectedKey;
              const isLive = dayMeetings.some((m) => m.status === 'LIVE');
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedDay(null);
                    } else {
                      setSelectedDay(day);
                    }
                  }}
                  className={`relative h-8 w-8 mx-auto rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center ${
                    isSelected
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                      : isToday
                      ? 'bg-white/10 text-white font-bold border border-white/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/8'
                  }`}
                >
                  {day.getDate()}
                  {dayMeetings.length > 0 && (
                    <span className={`absolute bottom-0.5 h-1 w-1 rounded-full ${isLive ? 'bg-emerald-400' : 'bg-violet-400'} ${isSelected ? 'bg-white' : ''}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Today button */}
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={goToToday}
              className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-semibold transition-colors border border-white/5"
            >
              Go to Today
            </button>
          </div>

          {/* Mini stats */}
          <div className="mt-auto border-t border-white/5 px-4 py-4 space-y-2">
            {[
              { label: 'Upcoming', count: meetings.filter((m) => new Date(m.scheduledAt).getTime() + m.duration * 60000 >= now.getTime() && m.status !== 'LIVE').length, color: 'text-violet-400' },
              { label: 'Live Now', count: meetings.filter((m) => m.status === 'LIVE').length, color: 'text-emerald-400' },
              { label: 'Total', count: meetings.length, color: 'text-slate-400' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">{label}</span>
                <span className={`font-bold ${color}`}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: MEETINGS LIST ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Filter / Search bar */}
          <div className="px-5 py-3 border-b border-white/5 flex items-center gap-3 bg-[#0F1623]/80 backdrop-blur-sm shrink-0">
            {/* Day label */}
            {selectedDay ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold text-white">{getRelativeDay(selectedDay)}</span>
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className="text-slate-500 hover:text-white p-0.5 rounded-md"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                {(['upcoming', 'all', 'past'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilterTab(tab)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold capitalize transition-all ${
                      filterTab === tab
                        ? 'bg-violet-600 text-white'
                        : 'text-slate-500 hover:text-white hover:bg-white/8'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}

            <div className="ml-auto flex items-center gap-2 bg-white/5 rounded-xl border border-white/8 px-3 py-1.5 min-w-0 max-w-[220px]">
              <Search className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="bg-transparent text-xs text-slate-200 placeholder-slate-600 outline-none w-full"
              />
            </div>
          </div>

          {/* Meetings list */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center text-slate-600">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500 mb-3" />
                <span className="text-xs">Loading schedule...</span>
              </div>
            ) : filteredMeetings.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center">
                <div className="h-16 w-16 rounded-3xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mb-4">
                  <CalendarIcon className="h-8 w-8 text-violet-500/60" />
                </div>
                <h3 className="text-sm font-bold text-slate-400">
                  {selectedDay ? `No meetings on ${getRelativeDay(selectedDay)}` : 'No meetings found'}
                </h3>
                <p className="text-[11px] text-slate-600 mt-1 max-w-xs">
                  {searchQuery ? 'Try a different search term' : 'Plan project check-ins, sprint reviews, or team syncs'}
                </p>
                {canSchedule && (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-5 flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-lg shadow-violet-600/20 transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    Schedule Meeting
                  </button>
                )}
              </div>
            ) : (
              filteredMeetings.map((m) => {
                const meetingDate = new Date(m.scheduledAt);
                const isLive = m.status === 'LIVE';
                const isPast = meetingDate.getTime() + m.duration * 60000 < now.getTime() && !isLive;
                const isHost = m.hostId === currentUser?.id;
                const canEditThis = isHost || canSchedule;
                const minsUntil = Math.round((meetingDate.getTime() - now.getTime()) / 60000);

                return (
                  <div
                    key={m.id}
                    className={`rounded-2xl border transition-all group ${
                      isLive
                        ? 'bg-gradient-to-br from-emerald-500/10 to-[#0F1623] border-emerald-500/30 shadow-lg shadow-emerald-500/5'
                        : isPast
                        ? 'bg-[#0D1117]/80 border-white/5 opacity-60'
                        : 'bg-[#111827] border-white/8 hover:border-violet-500/30'
                    }`}
                  >
                    <div className="p-4">
                      {/* Row 1: Channel tag + status */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-lg border border-violet-500/20 truncate max-w-[160px]">
                          <Hash className="h-3 w-3 shrink-0" />
                          <span className="truncate">{m.channel?.name || 'General'}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isLive && (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500 text-white animate-pulse">
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                              LIVE
                            </span>
                          )}
                          {!isLive && !isPast && minsUntil <= 15 && minsUntil > 0 && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300">
                              Starts in {minsUntil}m
                            </span>
                          )}
                          {isPast && (
                            <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-white/5 text-slate-600 border border-white/5">
                              Ended
                            </span>
                          )}
                          {!isLive && !isPast && minsUntil > 15 && (
                            <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-white/5 text-slate-500 border border-white/5">
                              Scheduled
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Row 2: Title */}
                      <h3 className={`font-bold text-sm leading-snug line-clamp-1 ${isPast ? 'text-slate-500' : 'text-white'}`}>
                        {m.title}
                      </h3>
                      {m.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{m.description}</p>
                      )}

                      {/* Row 3: Date/time + duration */}
                      <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3 text-slate-600 shrink-0" />
                          {getRelativeDay(meetingDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-600 shrink-0" />
                          {formatTime(meetingDate)} · {formatDuration(m.duration)}
                        </span>
                      </div>

                      {/* Row 4: Host + participants + actions */}
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img
                            src={m.host?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.host?.name || 'H')}`}
                            alt={m.host?.name || 'Host'}
                            className="h-6 w-6 rounded-lg object-cover border border-white/10"
                          />
                          <div>
                            <div className="text-[10px] text-slate-600 leading-none">Scheduled by</div>
                            <div className="text-[11px] font-bold text-slate-300 leading-none mt-0.5">{m.host?.name || 'Teammate'}</div>
                          </div>

                          {/* Participant avatars */}
                          {m.participants && m.participants.length > 0 && (
                            <div className="flex -space-x-1.5 ml-2">
                              {m.participants.slice(0, 4).map((p, idx) => (
                                <img
                                  key={idx}
                                  src={p.user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=User`}
                                  alt={p.user?.name || 'User'}
                                  title={p.user?.name}
                                  className="h-5 w-5 rounded-md border border-[#111827] object-cover"
                                />
                              ))}
                              {m.participants.length > 4 && (
                                <span className="h-5 w-5 rounded-md bg-white/10 text-slate-400 text-[9px] font-bold flex items-center justify-center border border-[#111827]">
                                  +{m.participants.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1">
                          {!isPast && (
                            <button
                              type="button"
                              onClick={() => onJoinMeeting(m)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                                isLive
                                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-md shadow-emerald-500/20'
                                  : 'bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-600/20'
                              }`}
                            >
                              <Video className="h-3.5 w-3.5" />
                              <span>{isLive ? 'Join' : 'Start'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => copyMeetingLink(m)}
                            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
                            title="Copy meeting link"
                          >
                            {copiedLinkMeetingId === m.id
                              ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                              : <Copy className="h-3.5 w-3.5" />}
                          </button>

                          {canEditThis && !isPast && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(m)}
                                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-500 hover:text-violet-400 transition-colors opacity-0 group-hover:opacity-100"
                                title="Edit meeting"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMeeting(m.id)}
                                className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                                title="Cancel meeting"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── SCHEDULE / EDIT MODAL ────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-3xl shadow-2xl text-white border border-white/10 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
            style={{ background: 'linear-gradient(145deg, #131929 0%, #0F1623 100%)' }}
          >
            {/* Modal header */}
            <div className="px-6 pt-6 pb-4 border-b border-white/8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingMeeting ? 'Edit Meeting' : 'Schedule Team Meeting'}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">All participants will be notified</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-500 hover:text-white hover:bg-white/8 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitMeeting} className="px-6 py-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Meeting Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sprint Planning · Architecture Review"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Agenda / Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What will this meeting cover? Add agenda items..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors resize-none"
                />
              </div>

              {/* Date / Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Time *</label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Duration / Channel */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Duration</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-[#0F1623] px-3 py-2.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                  >
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>1 Hour</option>
                    <option value={90}>1.5 Hours</option>
                    <option value={120}>2 Hours</option>
                    <option value={180}>3 Hours</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Project / Channel</label>
                  <select
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#0F1623] px-3 py-2.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                  >
                    <option value="">General (No Channel)</option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>#{ch.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Invite teammates */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Invite Teammates ({selectedUserIds.length} / {members.length - 1})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = members.filter((m) => m.user.id !== currentUser?.id).map((m) => m.user.id);
                      setSelectedUserIds(selectedUserIds.length === allIds.length ? [] : allIds);
                    }}
                    className="text-[10px] font-bold text-violet-400 hover:text-violet-300"
                  >
                    {selectedUserIds.length === members.length - 1 ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Member search */}
                <div className="flex items-center gap-2 bg-white/5 rounded-xl border border-white/8 px-3 py-1.5 mb-2">
                  <Search className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search members..."
                    className="bg-transparent text-xs text-slate-300 placeholder-slate-600 outline-none flex-1"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto rounded-2xl border border-white/8 bg-white/3 space-y-0.5 p-1.5">
                  {members
                    .filter((m) => m.user.id !== currentUser?.id && m.user.name.toLowerCase().includes(memberSearch.toLowerCase()))
                    .map((m) => {
                      const isChecked = selectedUserIds.includes(m.user.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                            isChecked ? 'bg-violet-600/20 border border-violet-500/30' : 'hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={m.user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.user.name)}`}
                              alt={m.user.name}
                              className="h-6 w-6 rounded-md object-cover border border-white/10 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-200 truncate">{m.user.name}</div>
                              <div className="text-[10px] text-slate-500 truncate">{ROLE_CONFIGS[m.role]?.label || m.role}</div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedUserIds((prev) => [...prev, m.user.id]);
                              else setSelectedUserIds((prev) => prev.filter((id) => id !== m.user.id));
                            }}
                            className="h-4 w-4 rounded border-slate-600 text-violet-600 focus:ring-violet-600 bg-transparent"
                          />
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-2.5 pt-2 border-t border-white/8">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !title.trim()}
                  className="rounded-xl bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{submitting ? 'Saving...' : editingMeeting ? 'Update Meeting' : 'Schedule & Notify'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
