import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { CheckCircle2 } from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function UnsubscribePage() {
  usePageTitle('Unsubscribe');
  const [params] = useSearchParams();
  const initialEmail = params.get('email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto-submit if email came from the link
  useEffect(() => {
    if (initialEmail) {
      handleSubmit(initialEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (addr) => {
    setSubmitting(true);
    setError('');
    try {
      await axios.post(`${API_URL}/api/email-signups/unsubscribe`, null, { params: { email: addr } });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not unsubscribe — try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {done ? (
          <>
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h1 className="font-heading text-2xl font-bold mb-2">You're unsubscribed</h1>
            <p className="text-muted-foreground">
              {email} won't receive LocalDrift updates anymore. Sorry to see you go!
            </p>
          </>
        ) : (
          <>
            <h1 className="font-heading text-2xl font-bold mb-2">Unsubscribe from LocalDrift</h1>
            <p className="text-muted-foreground mb-6">
              Confirm the email address to stop receiving updates.
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); if (email.trim()) handleSubmit(email.trim()); }}
              className="flex flex-col gap-3"
            >
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Unsubscribing...' : 'Unsubscribe'}
              </Button>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
