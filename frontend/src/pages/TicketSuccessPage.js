import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function TicketSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [paymentData, setPaymentData] = useState(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      pollPaymentStatus(sessionId);
    } else {
      setStatus('error');
    }
  }, [searchParams]);

  const pollPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 10;
    const pollInterval = 2000;

    if (attempts >= maxAttempts) {
      setStatus('error');
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/api/payments/checkout/status/${sessionId}`);
      
      if (response.data.payment_status === 'paid') {
        setPaymentData(response.data);
        setStatus('success');
        return;
      } else if (response.data.status === 'expired') {
        setStatus('error');
        return;
      }

      // Continue polling
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), pollInterval);
    } catch (error) {
      console.error('Error checking payment status:', error);
      if (attempts < maxAttempts - 1) {
        setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), pollInterval);
      } else {
        setStatus('error');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="ticket-success-page">
      <div className="max-w-md w-full text-center">
        {status === 'loading' && (
          <div className="animate-fade-in">
            <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin mb-6" />
            <h1 className="font-heading text-2xl font-bold mb-2">Processing Your Order</h1>
            <p className="text-muted-foreground">Please wait while we confirm your payment...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="animate-fade-in">
            <div className="w-20 h-20 mx-auto bg-accent/10 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="h-10 w-10 text-accent" />
            </div>
            <h1 className="font-heading text-2xl font-bold mb-2">Payment Successful!</h1>
            <p className="text-muted-foreground mb-6">
              Your tickets have been confirmed. Check your email for details.
            </p>
            
            {paymentData && (
              <div className="bg-card rounded-2xl p-6 mb-6 text-left border dark:border-white/10">
                <h3 className="font-semibold mb-4">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span className="font-medium">${(paymentData.amount_total / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Currency</span>
                    <span className="font-medium uppercase">{paymentData.currency}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => navigate('/dashboard')}
                className="flex-1 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 hover:opacity-90"
                data-testid="view-tickets-btn"
              >
                View My Tickets
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/events')}
                className="flex-1 rounded-full"
                data-testid="browse-events-btn"
              >
                Browse More Events
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="animate-fade-in">
            <div className="w-20 h-20 mx-auto bg-destructive/10 rounded-full flex items-center justify-center mb-6">
              <XCircle className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="font-heading text-2xl font-bold mb-2">Payment Issue</h1>
            <p className="text-muted-foreground mb-6">
              We couldn't confirm your payment. Please check your email or try again.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => navigate(-1)}
                className="flex-1 rounded-full"
                data-testid="try-again-btn"
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/events')}
                className="flex-1 rounded-full"
                data-testid="back-to-events-btn"
              >
                Back to Events
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
