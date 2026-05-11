import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import usePageTitle from '../hooks/usePageTitle';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ResetPasswordPage() {
  usePageTitle('Reset Password');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/auth/reset-password`, {
        token,
        new_password: password,
      });
      setDone(true);
      toast.success('Password reset successfully');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not reset password. Try requesting a new link.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md dark:border-white/10">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <h1 className="font-heading text-xl font-bold mb-2">Reset link missing</h1>
            <p className="text-sm text-muted-foreground mb-4">
              This page needs a valid reset token. Use the link from the email we sent you.
            </p>
            <Button asChild className="rounded-full">
              <Link to="/forgot-password">Request a new reset link</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md dark:border-white/10">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h1 className="font-heading text-2xl font-bold mb-2">Password reset</h1>
            <p className="text-muted-foreground mb-6">
              You can now sign in with your new password. Redirecting you...
            </p>
            <Button asChild className="rounded-full">
              <Link to="/login">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md dark:border-white/10">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 text-primary mb-3">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="font-heading text-2xl font-bold">Choose a new password</h1>
            <p className="text-muted-foreground text-sm mt-2">
              Pick something at least 8 characters long.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={8}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="new-password-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                minLength={8}
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                data-testid="confirm-password-input"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full rounded-full"
              disabled={submitting || !password || !confirm}
              data-testid="reset-submit-btn"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
