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
  ChevronRight,
  Loader2,
  Trash2,
  Pencil,
  Crown,
  Sparkles,
  CheckCircle2,
  ExternalLink,
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

  // Modal State for Schedule/Edit Meeting
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

  // Authority check: Super Admin, Admin, Manager, Team Lead can schedule & manage for team
  const canSchedule = canInviteMembers(currentUserRole);

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
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
      }
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
    // Default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow.toISOString().split('T')[0]);
    setTime('14:00');
    setDuration(30);
    setSelectedChannelId(channels[0]?.id || '');
    setSelectedUserIds(members.filter((m) => m.user.id !== currentUser?.id).map((m) => m.user.id));
    setFormError(null);
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
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API_URL}/workspaces/${workspaceId}/meetings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
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
    } catch (err) {
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
      if (res.ok) {
        setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      }
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

  // Filtered lists
  const now = new Date();
  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      const d = new Date(m.scheduledAt);
      const isPast = d.getTime() + m.duration * 60000 < now.getTime();
      const matchesSearch =
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.channel?.name && m.channel.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.host?.name && m.host.name.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterTab === 'upcoming') {
        return !isPast || m.status === 'LIVE';
      }
      if (filterTab === 'past') {
        return isPast && m.status !== 'LIVE';
      }
      return true;
    });
  }, [meetings, filterTab, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50 overflow-hidden text-slate-800">
      {/* Top Header */}
      <div className="px-6 py-5 bg-white border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Calendar & Team Meetings</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
                  {currentUserRole === 'OWNER'
                    ? 'Super Admin Hub'
                    : currentUserRole === 'ADMIN'
                    ? 'Admin View'
                    : currentUserRole === 'MANAGER'
                    ? 'Manager View'
                    : currentUserRole === 'TEAM_LEAD'
                    ? 'Team Lead View'
                    : 'Team Schedule'}
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Schedule video calls, view project meetings, and join live team conferences
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => onStartInstantMeeting('Instant Team Meeting')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs"
            title="Start an instant group meeting right now"
          >
            <Video className="h-4 w-4 text-emerald-600" />
            <span>Start Instant Call</span>
          </button>

          {canSchedule && (
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all hover:scale-102 active:scale-98"
            >
              <Plus className="h-4 w-4" />
              <span>Schedule Meeting</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Close Calendar"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Control / Filter Bar */}
      <div className="px-6 py-3 bg-white/70 border-b border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterTab('upcoming')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterTab === 'upcoming'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Upcoming & Live ({meetings.filter((m) => new Date(m.scheduledAt).getTime() + m.duration * 60000 >= now.getTime() || m.status === 'LIVE').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterTab === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            All Meetings ({meetings.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('past')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterTab === 'past'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Past Completed
          </button>
        </div>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search meetings by title, project, host..."
            className="w-full sm:w-64 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Meetings Content List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
            <span className="text-xs font-medium">Loading schedule...</span>
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs">
            <div className="h-16 w-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 shadow-sm">
              <CalendarIcon className="h-8 w-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Scheduled Meetings Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-5">
              {searchQuery
                ? 'No meetings matched your search criteria.'
                : 'Plan project check-ins, sprint reviews, or team syncs. Teammates will receive calendar invites & notifications.'}
            </p>
            {canSchedule && (
              <button
                type="button"
                onClick={openCreateModal}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Schedule First Meeting</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMeetings.map((m) => {
              const meetingDate = new Date(m.scheduledAt);
              const isLive = m.status === 'LIVE';
              const isHost = m.hostId === currentUser?.id;
              const canEditThis = isHost || canSchedule;

              return (
                <div
                  key={m.id}
                  className={`rounded-3xl p-5 border transition-all flex flex-col justify-between shadow-xs ${
                    isLive
                      ? 'bg-gradient-to-br from-emerald-50/80 via-white to-white border-emerald-300 ring-2 ring-emerald-400/20'
                      : 'bg-white hover:border-indigo-200 border-slate-200/80 hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Header: Project tag + Status */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-100/80 truncate">
                        <Hash className="h-3 w-3 shrink-0" />
                        <span className="truncate">{m.channel?.name || 'General Workspace'}</span>
                      </div>

                      {isLive ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500 text-white shadow-xs flex items-center gap-1.5 animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          <span>LIVE NOW</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          Scheduled
                        </span>
                      )}
                    </div>

                    {/* Title & Description */}
                    <h3 className="font-bold text-base text-slate-900 leading-snug line-clamp-1" title={m.title}>
                      {m.title}
                    </h3>
                    {m.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {m.description}
                      </p>
                    )}

                    {/* Date, Time & Duration */}
                    <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                        <CalendarIcon className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                        <span>
                          {meetingDate.toLocaleDateString([], {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>
                          {meetingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                          {m.duration} mins
                        </span>
                      </div>
                    </div>

                    {/* Host & Participants Details */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={m.host?.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                          alt={m.host?.name || 'Host'}
                          className="h-6 w-6 rounded-lg border border-slate-200 object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="text-[11px] text-slate-400 block leading-none">Scheduled by</span>
                          <span className="text-xs font-bold text-slate-800 truncate block mt-0.5">
                            {m.host?.name || 'Teammate'}
                          </span>
                        </div>
                      </div>

                      {/* Participant Avatars */}
                      {m.participants && m.participants.length > 0 && (
                        <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                          {m.participants.slice(0, 4).map((p, idx) => (
                            <img
                              key={idx}
                              src={p.user?.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                              alt={p.user?.name || 'User'}
                              title={p.user?.name}
                              className="h-6 w-6 rounded-lg border-2 border-white object-cover"
                            />
                          ))}
                          {m.participants.length > 4 && (
                            <span className="h-6 w-6 rounded-lg bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center border-2 border-white">
                              +{m.participants.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onJoinMeeting(m)}
                      className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs ${
                        isLive
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 animate-pulse'
                          : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white'
                      }`}
                    >
                      <Video className="h-3.5 w-3.5" />
                      <span>{isLive ? 'Join Live Meeting' : 'Start / Join Call'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => copyMeetingLink(m)}
                      className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors shrink-0"
                      title="Copy meeting link"
                    >
                      {copiedLinkMeetingId === m.id ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>

                    {canEditThis && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditModal(m)}
                          className="p-2 rounded-xl border border-slate-200 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-colors shrink-0"
                          title="Edit meeting details"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMeeting(m.id)}
                          className="p-2 rounded-xl border border-slate-200 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors shrink-0"
                          title="Cancel meeting"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule / Edit Meeting Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl text-slate-900 border border-slate-200 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-2xs">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingMeeting ? 'Edit Team Meeting' : 'Schedule Team Meeting'}
                  </h3>
                  <p className="text-xs text-slate-500">Plan a video meeting with your team</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3.5 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitMeeting} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Meeting Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sprint Planning & Architecture Review"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Description / Agenda (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What will this meeting cover? Add notes or agenda items..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Duration
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                  >
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>1 Hour</option>
                    <option value={90}>1.5 Hours</option>
                    <option value={120}>2 Hours</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Project / Channel
                  </label>
                  <select
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                  >
                    <option value="">No Channel (General Meeting)</option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        #{ch.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Invite Teammates */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider">
                    Invite Teammates ({selectedUserIds.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedUserIds.length === members.length - 1) {
                        setSelectedUserIds([]);
                      } else {
                        setSelectedUserIds(
                          members.filter((m) => m.user.id !== currentUser?.id).map((m) => m.user.id)
                        );
                      }
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    {selectedUserIds.length === members.length - 1 ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="max-h-36 overflow-y-auto rounded-2xl border border-slate-200 p-2 space-y-1 bg-slate-50/50">
                  {members
                    .filter((m) => m.user.id !== currentUser?.id)
                    .map((m) => {
                      const isChecked = selectedUserIds.includes(m.user.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                            isChecked ? 'bg-indigo-50 border border-indigo-200 shadow-2xs' : 'hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={m.user.avatarUrl || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                              alt={m.user.name}
                              className="h-6 w-6 rounded-md object-cover border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-800 truncate block">
                                {m.user.name}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate block">
                                {ROLE_CONFIGS[m.role]?.label || m.role} • {m.user.email}
                              </span>
                            </div>
                          </div>

                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUserIds((prev) => [...prev, m.user.id]);
                              } else {
                                setSelectedUserIds((prev) => prev.filter((id) => id !== m.user.id));
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                          />
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !title.trim()}
                  className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:opacity-95 disabled:opacity-50 transition-all flex items-center gap-1.5"
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
