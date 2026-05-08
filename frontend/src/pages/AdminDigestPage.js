import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import usePageTitle from '../hooks/usePageTitle';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Admin-only weekly digest preview & send page.
 * Auth: admin token in URL (?token=...). Same pattern as the other
 * admin endpoints — keeps things simple, no real session needed.
 */
export default function AdminDigestPage() {
  usePageTitle('Admin · Digest');
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [testTo, setTestTo] = useState('');
  const [subjectOverride, setSubjectOverride] = useState('');
  const [sending, setSending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    // Default to next Friday 00:00 -> Sunday 23:59 (matches backend default)
    const now = new Date();
    const daysToFri = (5 - now.getDay() + 7) % 7 || 7;
    const fri = new Date(now);
    fri.setDate(now.getDate() + daysToFri);
    fri.setHours(0, 0, 0, 0);
    const sun = new Date(fri);
    sun.setDate(fri.getDate() + 2);
    sun.setHours(23, 59, 0, 0);
    setStart(fri.toISOString().slice(0, 10));
    setEnd(sun.toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    if (!token || !start || !end) { setPreviewUrl(''); return; }
    const url = `${API_URL}/api/admin/digest/preview?token=${encodeURIComponent(token)}&start=${encodeURIComponent(start + 'T00:00:00')}&end=${encodeURIComponent(end + 'T23:59:00')}`;
    setPreviewUrl(url);
  }, [token, start, end]);

  const handleSend = async (testOnly) => {
    if (!token) { toast.error('Missing admin token in URL'); return; }
    if (!testOnly && !window.confirm('Send the digest to ALL active subscribers?')) return;

    setSending(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/digest/send?token=${encodeURIComponent(token)}`,
        {
          start: `${start}T00:00:00`,
          end: `${end}T23:59:00`,
          subject_override: subjectOverride || undefined,
          test_to: testOnly ? (testTo || undefined) : undefined,
        }
      );
      const { attempted, sent, failed } = res.data;
      toast.success(`Sent: ${sent} / Attempted: ${attempted}${failed ? ` / Failed: ${failed}` : ''}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Send failed — check SMTP env vars');
    } finally {
      setSending(false);
    }
  };

  if (!token) {
    return (
      <div className="container mx-auto max-w-xl py-16 px-4">
        <h1 className="font-heading text-2xl font-bold mb-2">Admin · Digest</h1>
        <p className="text-muted-foreground">
          Append <code>?token=YOUR_ADMIN_TOKEN</code> to the URL to access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4">
      <h1 className="font-heading text-2xl font-bold mb-1">Weekly Digest</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Preview the digest, send a test to yourself, then blast to all subscribers.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Start date</label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End date</label>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Subject override (optional)</label>
          <Input
            placeholder="What's happening in Wilmington — May 9-11"
            value={subjectOverride}
            onChange={(e) => setSubjectOverride(e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Send test to (single address)</label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="you@example.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              className="flex-1"
            />
            <Button onClick={() => handleSend(true)} disabled={sending || !testTo} variant="outline">
              Send test
            </Button>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-2xl overflow-hidden mb-6">
        <div className="bg-muted px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border">
          Preview
        </div>
        {previewUrl && (
          <iframe
            title="Digest preview"
            src={previewUrl}
            className="w-full h-[700px] bg-white"
          />
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={() => handleSend(false)} disabled={sending}>
          {sending ? 'Sending...' : 'Send to all subscribers'}
        </Button>
      </div>
    </div>
  );
}
