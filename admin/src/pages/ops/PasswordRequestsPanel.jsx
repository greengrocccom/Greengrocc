import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, RefreshCw } from 'lucide-react';
import opsApi from '../../api/opsApi';
import { BTN, BTN_PRIMARY, INPUT, PANEL } from '../../utils/ui';

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
};
const STATUS_LABELS = { pending: 'Pending', completed: 'Password changed', rejected: 'Rejected' };

function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const values = crypto.getRandomValues(new Uint32Array(8));
  return `${Array.from(values, (v) => chars[v % chars.length]).join('')}@1`;
}

export default function PasswordRequestsPanel({ onPendingCountChange }) {
  const [status, setStatus] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await opsApi.list('staff-management/password-requests', status ? { status } : {});
      const rows = response.data || [];
      setRequests(rows);
      if (status === 'pending') onPendingCountChange?.(rows.length);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load password requests');
    } finally {
      setLoading(false);
    }
  }, [status, onPendingCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDone = async (message) => {
    setNotice(message);
    await load();
    if (status !== 'pending') {
      const pending = await opsApi.list('staff-management/password-requests', { status: 'pending' }).catch(() => null);
      if (pending) onPendingCountChange?.((pending.data || []).length);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 text-xs text-indigo-950">
        Staff send these from Profile &gt; Change Password in the staff app. Set a new password and the staff member
        will see it, along with your reply, in the app and get a notification.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-1 text-xs font-semibold">
          {[
            ['pending', 'Pending'],
            ['completed', 'Changed'],
            ['rejected', 'Rejected'],
            ['', 'All'],
          ].map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setStatus(value)}
              className={`rounded-md px-3 py-1.5 ${status === value ? 'bg-emerald-700 text-white' : 'text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={load} className={BTN}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      )}

      {loading ? (
        <div className={`${PANEL} flex items-center justify-center py-16 text-slate-400`}>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading requests...
        </div>
      ) : requests.length === 0 ? (
        <div className={`${PANEL} py-16 text-center`}>
          <KeyRound className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-sm font-semibold text-slate-800">No password requests</h3>
          <p className="mt-1 text-xs text-slate-500">
            {status === 'pending' ? 'Nothing is waiting for a reply.' : 'No requests match this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} onDone={handleDone} onError={setError} />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({ request, onDone, onError }) {
  const [mode, setMode] = useState(null); // 'resolve' | 'reject' | null
  const [newPassword, setNewPassword] = useState('');
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    onError('');
    if (mode === 'resolve' && newPassword.trim().length < 6) {
      onError('Password must be at least 6 characters');
      return;
    }
    if (mode === 'reject' && !reply.trim()) {
      onError('Please write a reply explaining why');
      return;
    }
    setSubmitting(true);
    try {
      const path = `staff-management/password-requests/${request.id}/${mode}`;
      const body = mode === 'resolve' ? { newPassword: newPassword.trim(), reply: reply.trim() } : { reply: reply.trim() };
      const response = await opsApi.create(path, body);
      setMode(null);
      onDone(response.message || 'Reply sent');
    } catch (err) {
      onError(err.response?.data?.message || 'Could not send reply');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={`${PANEL} rounded-xl p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{request.staff?.name || 'Staff member'}</p>
          <p className="text-xs text-slate-500">
            {[request.staff?.phone, request.staff?.email, request.staff?.role?.replace(/_/g, ' ')]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Requested {formatDateTime(request.createdAt)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[request.status] || ''}`}>
          {STATUS_LABELS[request.status] || request.status}
        </span>
      </div>

      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
        {request.message || <span className="italic text-slate-400">No message</span>}
      </p>

      {request.status !== 'pending' && (
        <div className="mt-3 text-xs text-slate-600">
          {request.adminReply && <p className="text-sm text-slate-800">Reply: {request.adminReply}</p>}
          <p className="mt-1 text-[11px] text-slate-400">
            Answered {formatDateTime(request.resolvedAt)}
            {request.resolvedBy ? ` by ${request.resolvedBy}` : ''}
          </p>
        </div>
      )}

      {request.status === 'pending' && !mode && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className={BTN_PRIMARY}
            onClick={() => {
              setMode('resolve');
              setNewPassword(generatePassword());
              setReply('');
            }}
          >
            Set new password
          </button>
          <button
            type="button"
            className={BTN}
            onClick={() => {
              setMode('reject');
              setReply('');
            }}
          >
            Reject with reply
          </button>
        </div>
      )}

      {mode && (
        <form onSubmit={submit} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {mode === 'resolve' && (
            <label className="block text-xs font-semibold text-slate-600">
              New password (staff will see this in the app)
              <div className="mt-1 flex gap-2">
                <input
                  className={`${INPUT} font-mono`}
                  value={newPassword}
                  minLength={6}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Min 6 characters"
                />
                <button type="button" className={BTN} onClick={() => setNewPassword(generatePassword())}>
                  Generate
                </button>
              </div>
            </label>
          )}
          <label className="block text-xs font-semibold text-slate-600">
            {mode === 'resolve' ? 'Reply message (optional)' : 'Reply message *'}
            <textarea
              className={`${INPUT} mt-1`}
              rows={2}
              maxLength={1000}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder={
                mode === 'resolve'
                  ? 'e.g. Your password has been reset. Please keep it safe.'
                  : 'e.g. Please contact HR in person to verify your identity.'
              }
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className={BTN_PRIMARY} disabled={submitting}>
              {submitting ? 'Sending...' : mode === 'resolve' ? 'Change password & reply' : 'Send reply'}
            </button>
            <button type="button" className={BTN} onClick={() => setMode(null)} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
