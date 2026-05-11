import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ForgotPasswordPage() {
  usePageTitle('Forgot Password');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      // Backend always returns 200 regardless of whether the email is
      // registered — avoids leaking the user list. We just show the
      // confirmation screen.
      await axios.post(`${API_URL}/api/auth/forgot-password`, { email: email.trim() });
      setSent(true);
    } catch (err) {
      // Even if the call somehow errors (network etc), surface a generic
      // confirmation. Better UX than a scary error for a public endpoint.
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md dark:border-white/10">
        <CardContent className="p-8">
          <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
            <Link to="/login">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to sign in
            </Link>
          </Button>

          {sent ? (
            <div className="text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
              <h1 className="font-heading text-2xl font-bold mb-2">Check your email</h1>
              <p className="text-muted-foreground mb-6">
                If an account exists for <strong>{email}</strong>, you'll get a reset link in
                the next minute or two. The link expires in 1 hour.
              </p>
              <p className="text-sm text-muted-foreground">
                Didn't get it? Check spam, then{' '}
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="text-primary hover:underline"
                >
                  try again
                </button>
                .
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 text-primary mb-3">
                  <Mail className="h-6 w-6" />
                </div>
                <h1 className="font-heading text-2xl font-bold">Forgot your password?</h1>
                <p className="text-muted-foreground text-sm mt-2">
                  Enter your email and we'll send you a link to reset it.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="forgot-email-input"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full rounded-full"
                  disabled={submitting || !email.trim()}
                  data-testid="forgot-submit-btn"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
