import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { 
  Zap, 
  Clock, 
  Users, 
  MapPin,
  Calendar,
  Percent,
  ChevronRight,
  Flame
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function CountdownTimer({ endTime, onExpire }) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  function calculateTimeLeft() {
    const difference = new Date(endTime) - new Date();
    if (difference <= 0) {
      return { hours: 0, minutes: 0, seconds: 0, expired: true };
    }
    return {
      hours: Math.floor(difference / (1000 * 60 * 60)),
      minutes: Math.floor((difference / (1000 * 60)) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      expired: false
    };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
      if (newTimeLeft.expired && onExpire) {
        onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  if (timeLeft.expired) {
    return <span className="text-red-500 font-medium">Expired</span>;
  }

  const isUrgent = timeLeft.hours < 2;

  return (
    <div className={`flex items-center gap-1 font-mono ${isUrgent ? 'text-red-500' : 'text-foreground'}`}>
      <Clock className={`h-4 w-4 ${isUrgent ? 'animate-pulse' : ''}`} />
      <span className="font-bold">
        {String(timeLeft.hours).padStart(2, '0')}:
        {String(timeLeft.minutes).padStart(2, '0')}:
        {String(timeLeft.seconds).padStart(2, '0')}
      </span>
    </div>
  );
}

function FlashDealCard({ deal, onClaim }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [claiming, setClaiming] = useState(false);

  const isUrgent = deal.time_left_seconds < 7200; // Less than 2 hours
  const isLowStock = deal.spots_left !== null && deal.spots_left <= 5;

  const handleClaim = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to claim this deal');
      navigate('/login');
      return;
    }

    setClaiming(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/flash-deals/${deal.deal_id}/claim`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Deal claimed! Use it within 24 hours.');
      if (onClaim) onClaim(deal.deal_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to claim deal');
    } finally {
      setClaiming(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Card 
      className={`group relative overflow-hidden border-0 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 ${
        isUrgent ? 'ring-2 ring-red-500/50' : ''
      }`}
      data-testid={`flash-deal-${deal.deal_id}`}
    >
      {/* Urgency Banner */}
      {isUrgent && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold py-1 px-3 flex items-center justify-center gap-1 z-10">
          <Flame className="h-3 w-3 animate-pulse" />
          ENDING SOON
        </div>
      )}

      <div className="relative h-40 overflow-hidden">
        <img 
          src={deal.event_image || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800'} 
          alt={deal.event_title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        {/* Discount Badge */}
        <div className="absolute top-3 right-3">
          <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-lg font-bold px-3 py-1 shadow-lg">
            -{deal.discount_percentage}%
          </Badge>
        </div>
        
        {/* Timer */}
        <div className={`absolute bottom-3 left-3 bg-white/95 dark:bg-black/80 backdrop-blur-sm rounded-full px-3 py-1 ${isUrgent ? 'mt-6' : ''}`}>
          <CountdownTimer endTime={deal.end_time} />
        </div>
        
        {/* Spots Left */}
        {deal.spots_left !== null && (
          <div className={`absolute bottom-3 right-3 bg-white/95 dark:bg-black/80 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-medium ${
            isLowStock ? 'text-red-500' : ''
          }`}>
            <Users className="h-3 w-3 inline mr-1" />
            {deal.spots_left} left
          </div>
        )}
      </div>
      
      <CardContent className="p-4">
        <h3 
          className="font-heading font-semibold text-lg mb-1 line-clamp-1 cursor-pointer hover:text-primary transition-colors"
          onClick={() => navigate(`/events/${deal.event_id}`)}
        >
          {deal.event_title}
        </h3>
        
        <div className="flex items-center text-sm text-muted-foreground mb-2">
          <MapPin className="h-3 w-3 mr-1" />
          <span className="truncate">{deal.location_name}, {deal.city}</span>
        </div>
        
        <div className="flex items-center text-sm text-muted-foreground mb-3">
          <Calendar className="h-3 w-3 mr-1" />
          <span>{formatDate(deal.event_date)}</span>
        </div>
        
        {deal.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{deal.description}</p>
        )}
        
        {/* Pricing */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-primary">${deal.deal_price}</span>
            <span className="text-sm text-muted-foreground line-through">${deal.original_price}</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            by {deal.business_name}
          </Badge>
        </div>
        
        {/* CTA */}
        <Button 
          className="w-full rounded-full bg-gradient-to-r from-red-500 to-orange-500 hover:opacity-90"
          onClick={handleClaim}
          disabled={claiming}
          data-testid={`claim-deal-${deal.deal_id}`}
        >
          {claiming ? (
            'Claiming...'
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Claim This Deal
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export function FlashDealsSection({ latitude, longitude }) {
  const navigate = useNavigate();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeals();
    // Refresh deals every 30 seconds
    const interval = setInterval(fetchDeals, 30000);
    return () => clearInterval(interval);
  }, [latitude, longitude]);

  const fetchDeals = async () => {
    try {
      const params = { limit: 6, active_only: true };
      if (latitude && longitude) {
        params.latitude = latitude;
        params.longitude = longitude;
        params.radius = 50;
      }
      
      const response = await axios.get(`${API_URL}/api/flash-deals`, { params });
      setDeals(response.data);
    } catch (error) {
      console.error('Error fetching flash deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimSuccess = (dealId) => {
    // Remove claimed deal from list or refresh
    fetchDeals();
  };

  if (loading) {
    return (
      <section className="py-12 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/10" data-testid="flash-deals-section">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="font-heading text-2xl md:text-3xl font-bold">Flash Deals</h2>
              <p className="text-muted-foreground text-sm">Loading deals...</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-80 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (deals.length === 0) {
    return null; // Don't show section if no deals
  }

  return (
    <section className="py-12 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/10" data-testid="flash-deals-section">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl animate-pulse">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-2xl md:text-3xl font-bold">Flash Deals</h2>
                <Badge className="bg-red-500 text-white animate-pulse">LIVE</Badge>
              </div>
              <p className="text-muted-foreground text-sm">Limited time offers - grab them before they're gone!</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="rounded-full hidden md:flex"
            onClick={() => navigate('/flash-deals')}
            data-testid="view-all-deals"
          >
            View All Deals
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deals.map((deal) => (
            <FlashDealCard 
              key={deal.deal_id} 
              deal={deal} 
              onClaim={handleClaimSuccess}
            />
          ))}
        </div>
        
        <div className="mt-6 text-center md:hidden">
          <Button 
            variant="outline" 
            className="rounded-full"
            onClick={() => navigate('/flash-deals')}
          >
            View All Deals
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </section>
  );
}

export default FlashDealsSection;
