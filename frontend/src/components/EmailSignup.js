import { useState } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Mail, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Email signup form for the launch list.
 *
 * Props:
 *   source — short string identifying where on the site this was placed
 *            (e.g. "homepage", "about", "footer"). Stored alongside the
 *            email so we can see which surface drives signups.
 *   variant — "default" | "inline". Inline is a compact horizontal layout
 *             for narrow spots; default is the larger card-style block.
 *   title — optional heading override
 *   description — optional sub-copy override
 */
export default function EmailSignup({
  source = 'unknown',
  variant = 'default',
  title = 'Get LocalDrift updates',
  description = 'Be the first to know when we expand beyond Wilmington and get early access to new features.',
}) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/api/email-signups`, {
        email: email.trim(),
        source,
      });
      if (res.data?.status === 'already_subscribed') {
        toast.success("You're already on the list!");
      } else {
        toast.success('Thanks! We\'ll keep you posted.');
      }
      setDone(true);
      setEmail('');
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Something went wrong. Try again?';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className={
        variant === 'inline'
          ? 'flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400'
          : 'flex items-center gap-3 p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900'
      }>
        <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
        <span>You&apos;re on the list. Thanks for the support!</span>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-md">
        <Input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-full"
          data-testid="email-signup-input"
        />
        <Button type="submit" disabled={submitting} className="rounded-full">
          {submitting ? '...' : 'Notify me'}
        </Button>
      </form>
    );
  }

  return (
    <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-primary/10 via-background to-background border border-border">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/15 text-primary">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-heading font-semibold text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <Input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-full flex-1"
          data-testid="email-signup-input"
        />
        <Button type="submit" disabled={submitting} className="rounded-full">
          {submitting ? 'Subscribing...' : 'Notify me'}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground mt-3">
        We&apos;ll only use this to share LocalDrift updates. Unsubscribe anytime.
      </p>
    </div>
  );
}
