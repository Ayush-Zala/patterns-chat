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
  ListFilter,
  Menu,
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
  onToggleSidebar?: () => void;
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
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
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
  onToggleSidebar,
}: CalendarViewProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'upcoming' | 'all' | 'past'>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileTab, setMobileTab] = useState<'calendar' | 'agenda'>('agenda');

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
  const [memberSearch, setMemberSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedLinkMeetingId, setCopiedLinkMeetingId] = useState<string | null>(null);

  const canSchedule = canInviteMembers(currentUserRole);

  const fetchMeetings = async () => {
    if (!workspaceId || !token) return;
    try {
      let res = await fetch(`${API_URL}/workspaces/${workspaceId}/meetings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        res = await fetch(`${API_URL}/meetings/workspace/${workspaceId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
      }
    } catch (err) {
      console.warn('Failed to load meetings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
    const interval = setInterval(fetchMeetings, 15000);
    return () => clearInterval(interval);
  }, [workspaceId, token]);

  const openCreateModal = () => {
    setEditingMeeting(null);
    setTitle('');
    setDescription('');
    const d = selectedDay || new Date();
    setDate(d.toLocaleDateString('en-CA'));
    setTime('10:00');
    setDuration(30);
    setSelectedChannelId(channels[0]?.id || '');
    setSelectedUserIds([]);
    setMemberSearch('');
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setTitle(meeting.title);
    setDescription(meeting.description || '');
    const mDate = new Date(meeting.scheduledAt);
    setDate(mDate.toLocaleDateString('en-CA'));
    setTime(
      `${String(mDate.getHours()).padStart(2, '0')}:${String(mDate.getMinutes()).padStart(2, '0')}`,
    );
    setDuration(meeting.duration);
    setSelectedChannelId(meeting.channelId || '');
    setSelectedUserIds(meeting.participants?.map((p) => p.userId) || []);
    setMemberSearch('');
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmitMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !time) {
      setFormError('Please fill in title, date, and time');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();

    try {
      const url = editingMeeting
        ? `${API_URL}/meetings/${editingMeeting.id}`
        : `${API_URL}/workspaces/${workspaceId}/meetings`;
      const method = editingMeeting ? 'PATCH' : 'POST';

      const payload: any = {
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledAt,
        duration: Number(duration),
        channelId: selectedChannelId || undefined,
        participantIds: selectedUserIds,
        workspaceId,
      };

      let res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      // Fallback to /meetings if /workspaces/:workspaceId/meetings fails with 404
      if (!res.ok && res.status === 404 && !editingMeeting) {
        res = await fetch(`${API_URL}/meetings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        let errMessage = 'Failed to save meeting';
        try {
          const err = await res.json();
          errMessage = err.message || errMessage;
        } catch (_) {
          errMessage = `Request failed (${res.status} ${res.statusText})`;
        }
        throw new Error(errMessage);
      }

      await fetchMeetings();
      setShowModal(false);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving the meeting');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!confirm('Are you sure you want to cancel this meeting?')) return;
    try {
      const res = await fetch(`${API_URL}/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      }
    } catch (err) {
      console.warn('Failed to delete meeting:', err);
    }
  };

  const copyMeetingLink = (m: Meeting) => {
    const link = `${window.location.origin}/workspace/${workspaceId}?meetingId=${m.id}`;
    navigator.clipboard.writeText(link);
    setCopiedLinkMeetingId(m.id);
    setTimeout(() => setCopiedLinkMeetingId(null), 2000);
  };

  // Calendar math
  const now = new Date();
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays = useMemo(() => {
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [year, month, firstDayOfWeek, daysInMonth]);

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    meetings.forEach((m) => {
      const d = new Date(m.scheduledAt);
      const key = d.toLocaleDateString('en-CA');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });
    return map;
  }, [meetings]);

  const filteredMeetings = useMemo(() => {
    return meetings
      .filter((m) => {
        const mDate = new Date(m.scheduledAt);
        const isLive = m.status === 'LIVE';
        const isPast = mDate.getTime() + m.duration * 60000 < now.getTime() && !isLive;

        if (selectedDay) {
          const selKey = selectedDay.toLocaleDateString('en-CA');
          const mKey = mDate.toLocaleDateString('en-CA');
          if (selKey !== mKey) return false;
        } else {
          if (filterTab === 'upcoming' && isPast) return false;
          if (filterTab === 'past' && !isPast) return false;
        }

        const matchesSearch =
          m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (m.channel && m.channel.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (m.host && m.host.name.toLowerCase().includes(searchQuery.toLowerCase()));
        if (!matchesSearch) return false;

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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white text-slate-900 select-none">
      {/* ── TOP HEADER ──────────────────────────────────────────────── */}
      <div className="h-16 px-4 sm:px-6 border-b border-slate-200/90 flex items-center justify-between shrink-0 bg-white shadow-2xs">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 md:hidden transition-colors shrink-0"
              title="Open channels & messages"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-black text-slate-900 flex items-center gap-2 truncate">
              <span className="truncate">Calendar & Meetings</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-indigo-50 border-indigo-200 text-indigo-700 shrink-0">
                {currentUserRole === 'OWNER'
                  ? '👑 Super Admin'
                  : currentUserRole === 'ADMIN'
                  ? '🛡 Admin'
                  : currentUserRole === 'MANAGER'
                  ? '⚡ Manager'
                  : currentUserRole === 'TEAM_LEAD'
                  ? '🎯 Team Lead'
                  : 'Team'}
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium truncate hidden sm:block">
              Schedule, organize team video meetings, and manage participants
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Instant meeting */}
          <button
            type="button"
            onClick={() => onStartInstantMeeting('Instant Team Meeting')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 text-emerald-700 text-xs font-bold transition-all shadow-2xs"
            title="Start an instant call"
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Start Now</span>
          </button>

          {canSchedule && (
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Schedule</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
              title="Back to chat"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* ── MOBILE VIEW TOGGLER (< lg) ────────────────────────────── */}
      <div className="lg:hidden px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center p-1 bg-white rounded-xl border border-slate-200 w-full shadow-2xs">
          <button
            type="button"
            onClick={() => setMobileTab('agenda')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mobileTab === 'agenda'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 Meetings & Agenda
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('calendar')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mobileTab === 'calendar'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📅 Monthly Calendar
          </button>
        </div>
      </div>

      {/* ── MAIN LAYOUT: PURE WHITE & RESPONSIVE ──────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden bg-white">
        {/* ── LEFT COLUMN: PURE WHITE MONTHLY CALENDAR GRID ───────── */}
        <div
          className={`w-full lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200/90 flex flex-col bg-slate-50/70 p-4 ${
            mobileTab === 'calendar' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Month Navigation */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs"
              title="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <div className="text-sm font-extrabold text-slate-900">
                {MONTH_NAMES[calendarDate.getMonth()]} {calendarDate.getFullYear()}
              </div>
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs"
              title="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 pt-3 pb-1 text-center">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-[11px] font-bold text-slate-400 py-1 uppercase">
                {d}
              </div>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-1 pt-1 pb-3">
            {calendarDays.map((day, idx) => {
              if (!day) return <div key={idx} className="h-8 w-8 mx-auto" />;
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
                      setMobileTab('agenda');
                    }
                  }}
                  className={`relative h-8 w-8 mx-auto rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : isToday
                      ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-400 font-black'
                      : 'text-slate-700 hover:bg-white hover:text-indigo-600 hover:shadow-2xs'
                  }`}
                >
                  {day.getDate()}
                  {dayMeetings.length > 0 && (
                    <span
                      className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
                        isLive ? 'bg-emerald-500' : isSelected ? 'bg-white' : 'bg-indigo-600'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Go to Today button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={goToToday}
              className="w-full py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-indigo-600 font-bold text-xs transition-colors border border-slate-200 shadow-2xs"
            >
              Go to Today
            </button>
          </div>

          {/* Mini Stats Summary */}
          <div className="mt-auto pt-4 border-t border-slate-200/80 space-y-2">
            {[
              {
                label: 'Upcoming Meetings',
                count: meetings.filter(
                  (m) =>
                    new Date(m.scheduledAt).getTime() + m.duration * 60000 >= now.getTime() &&
                    m.status !== 'LIVE',
                ).length,
                color: 'text-indigo-600',
              },
              {
                label: 'Live Now',
                count: meetings.filter((m) => m.status === 'LIVE').length,
                color: 'text-emerald-600 font-bold',
              },
              {
                label: 'Total Scheduled',
                count: meetings.length,
                color: 'text-slate-800',
              },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">{label}</span>
                <span className={`font-bold ${color}`}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT COLUMN: PURE WHITE AGENDA & MEETINGS LIST ─────── */}
        <div
          className={`flex-1 flex flex-col min-w-0 overflow-hidden bg-white ${
            mobileTab === 'agenda' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Subheader: Selected day label, filter tabs, and search */}
          <div className="px-4 sm:px-6 py-3 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
            {/* Day label or filter switcher */}
            {selectedDay ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm sm:text-base font-black text-slate-900">
                  {getRelativeDay(selectedDay)}
                </span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  ({selectedDay.toLocaleDateString()})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="View all upcoming"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 shrink-0">
                {(['upcoming', 'all', 'past'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilterTab(tab)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                      filterTab === tab
                        ? 'bg-white text-indigo-600 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}

            {/* Search Input */}
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 px-3 py-1.5 w-full sm:w-60 shadow-2xs">
              <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search meetings..."
                className="bg-transparent text-xs text-slate-900 placeholder:text-slate-400 outline-none w-full"
              />
            </div>
          </div>

          {/* Meeting cards container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 bg-slate-50/30">
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
                <span className="text-xs font-medium">Loading schedule...</span>
              </div>
            ) : filteredMeetings.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center px-4">
                <div className="h-16 w-16 rounded-3xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 mb-3 shadow-2xs">
                  <CalendarIcon className="h-8 w-8" />
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  {selectedDay
                    ? `No meetings scheduled for ${getRelativeDay(selectedDay)}`
                    : 'No meetings found'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
                  {searchQuery
                    ? 'No meetings match your search query. Try searching with a different term.'
                    : 'Plan team standups, sprint reviews, client demos, or one-on-ones.'}
                </p>
                {canSchedule && (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-5 flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Schedule Meeting</span>
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
                    className={`rounded-2xl border transition-all p-4 bg-white ${
                      isLive
                        ? 'border-emerald-300 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-400'
                        : isPast
                        ? 'border-slate-200/60 opacity-70 bg-slate-50/50'
                        : 'border-slate-200 hover:border-indigo-300 hover:shadow-sm'
                    }`}
                  >
                    {/* Top Row: Channel Badge & Status Tag */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 rounded-lg truncate max-w-[180px]">
                        <Hash className="h-3 w-3 shrink-0" />
                        <span className="truncate">{m.channel?.name || 'General'}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isLive && (
                          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500 text-white animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            LIVE NOW
                          </span>
                        )}
                        {!isLive && !isPast && minsUntil <= 15 && minsUntil > 0 && (
                          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 border border-amber-300 text-amber-700">
                            Starts in {minsUntil}m
                          </span>
                        )}
                        {isPast && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                            Ended
                          </span>
                        )}
                        {!isLive && !isPast && minsUntil > 15 && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Scheduled
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Title & Description */}
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug line-clamp-1">
                      {m.title}
                    </h3>
                    {m.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {m.description}
                      </p>
                    )}

                    {/* Time & Duration Row */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                        <span className="text-slate-800 font-semibold">{getRelativeDay(meetingDate)}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                        <span>{formatTime(meetingDate)}</span>
                        <span>•</span>
                        <span>{formatDuration(m.duration)}</span>
                      </span>
                    </div>

                    {/* Bottom Row: Host info & Action buttons */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={
                            m.host?.avatarUrl ||
                            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                              m.host?.name || 'User',
                            )}`
                          }
                          alt={m.host?.name || 'Host'}
                          className="h-6 w-6 rounded-full object-cover border border-slate-200"
                        />
                        <div className="min-w-0">
                          <span className="text-[11px] text-slate-400 block leading-none">
                            Host
                          </span>
                          <span className="text-xs font-bold text-slate-800 truncate block leading-tight mt-0.5">
                            {m.host?.name || 'Teammate'}
                          </span>
                        </div>

                        {/* Attendees Avatars */}
                        {m.participants && m.participants.length > 0 && (
                          <div className="flex -space-x-1.5 ml-3">
                            {m.participants.slice(0, 4).map((p, idx) => (
                              <img
                                key={idx}
                                src={
                                  p.user?.avatarUrl ||
                                  `https://api.dicebear.com/7.x/initials/svg?seed=User`
                                }
                                alt={p.user?.name || 'User'}
                                title={p.user?.name}
                                className="h-5 w-5 rounded-full border-2 border-white object-cover"
                              />
                            ))}
                            {m.participants.length > 4 && (
                              <span className="h-5 w-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center border-2 border-white">
                                +{m.participants.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isPast && (
                          <button
                            type="button"
                            onClick={() => onJoinMeeting(m)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                              isLive
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                          >
                            <Video className="h-3.5 w-3.5" />
                            <span>{isLive ? 'Join Meeting' : 'Start'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => copyMeetingLink(m)}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                          title="Copy meeting link"
                        >
                          {copiedLinkMeetingId === m.id ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>

                        {canEditThis && !isPast && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(m)}
                              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-indigo-600 transition-colors"
                              title="Edit meeting"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMeeting(m.id)}
                              className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                              title="Cancel meeting"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── SCHEDULE / EDIT MEETING MODAL (PURE WHITE) ─────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl shadow-2xl bg-white text-slate-900 border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    {editingMeeting ? 'Edit Meeting' : 'Schedule Team Meeting'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    All participants will be notified in the workspace
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitMeeting} className="px-6 py-4 space-y-3.5">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Meeting Title <span className="text-indigo-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sprint Planning · Architecture Review"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-2xs"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Agenda / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What will this meeting cover? Add agenda items..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none shadow-2xs"
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Date <span className="text-indigo-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:outline-none shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Time <span className="text-indigo-600">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:outline-none shadow-2xs"
                  />
                </div>
              </div>

              {/* Duration & Channel */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duration</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:outline-none shadow-2xs"
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Project / Channel
                  </label>
                  <select
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-indigo-500 focus:outline-none shadow-2xs"
                  >
                    <option value="">General (No Channel)</option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        #{ch.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Invite teammates */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Invite Teammates ({selectedUserIds.length} / {members.length - 1})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = members
                        .filter((m) => m.user.id !== currentUser?.id)
                        .map((m) => m.user.id);
                      setSelectedUserIds(selectedUserIds.length === allIds.length ? [] : allIds);
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    {selectedUserIds.length === members.length - 1 ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Member search */}
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 px-3 py-1.5 mb-2 shadow-2xs">
                  <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search teammates..."
                    className="bg-transparent text-xs text-slate-900 placeholder:text-slate-400 outline-none flex-1"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 space-y-0.5 p-1.5">
                  {members
                    .filter(
                      (m) =>
                        m.user.id !== currentUser?.id &&
                        m.user.name.toLowerCase().includes(memberSearch.toLowerCase()),
                    )
                    .map((m) => {
                      const isChecked = selectedUserIds.includes(m.user.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-indigo-50 border border-indigo-200'
                              : 'hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={
                                m.user.avatarUrl ||
                                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                  m.user.name,
                                )}`
                              }
                              alt={m.user.name}
                              className="h-6 w-6 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-800 truncate">
                                {m.user.name}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {ROLE_CONFIGS[m.role]?.label || m.role}
                              </div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked)
                                setSelectedUserIds((prev) => [...prev, m.user.id]);
                              else
                                setSelectedUserIds((prev) =>
                                  prev.filter((id) => id !== m.user.id),
                                );
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Submit buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !title.trim()}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] px-5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>
                    {submitting
                      ? 'Saving...'
                      : editingMeeting
                      ? 'Update Meeting'
                      : 'Schedule & Notify'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
