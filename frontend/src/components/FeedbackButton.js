import { useState } from 'react';
import axios from 'axios';
import { MessageSquare, X, Loader2, Send } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const FEEDBACK_TYPES = [
  { value: 'bug', label: 'Bug / something broken' },
  { value: 'idea', label: 'Idea / feature request' },
  { value: 'data', label: 'Missing or wrong data' },
  { value: 'business', label: 'Business / partnership inquiry' },
  { value: 'other', label: 'Other' },
];

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackType, setFeedbackType] = useState('idea');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Please add a message');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/feedback`, {
        feedback_type: feedbackType,
        name: name.trim() || null,
        email: email.trim() || null,
        message: message.trim(),
        page_url: window.location.href,
      });
      toast.success("Thanks — we read every message.");
      setName('');
      setEmail('');
      setMessage('');
      setFeedbackType('idea');
      setOpen(false);
    } catch (err) {
      console.error('Feedback submit error', err);
      toast.error('Could not send — try again or email steinackerr@gmail.com');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating trigger */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          aria-label="Send feedback"
          data-testid="feedback-button"
        >
          <MessageSquare className="h-5 w-5" />
          <span className="hidden sm:inline text-sm font-medium">Send Feedback</span>
        </button>
      )}

      {/* Form panel */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 w-[calc(100vw-3rem)] sm:w-96 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden"
          data-testid="feedback-panel"
        >
          <div className="bg-gradient-to-r from-indigo-500 to-pink-500 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <h3 className="font-semibold">Send Feedback</h3>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Close feedback form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              NearScene is in beta — your feedback shapes what gets built next.
            </p>

            <div>
              <Label htmlFor="fb-type" className="text-xs">What kind of feedback?</Label>
              <Select value={feedbackType} onValueChange={setFeedbackType}>
                <SelectTrigger id="fb-type" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="fb-message" className="text-xs">Message *</Label>
              <Textarea
                id="fb-message"
                placeholder="What's on your mind?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1 min-h-[100px] resize-none"
                required
                data-testid="feedback-message"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="fb-name" className="text-xs">Name (optional)</Label>
                <Input
                  id="fb-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="fb-email" className="text-xs">Email (optional)</Label>
                <Input
                  id="fb-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="So we can reply"
                  className="mt-1"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 hover:opacity-90"
              disabled={submitting}
              data-testid="feedback-submit"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
