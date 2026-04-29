import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import { useLocation as useLocationContext } from '../context/LocationContext';
import { toast } from 'sonner';
import { 
  Zap, 
  Clock, 
  Users, 
  MapPin,
  Calendar,
  Search,
  Flame,
  SlidersHorizontal
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

export default function FlashDealsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { location } = useLocationContext();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [claimingId, setClaimingId] = useState(null);

  useEffect(() => {
    fetchDeals();
    // Refresh deals every 30 seconds
    const interval = setInterval(fetchDeals, 30000);
    return () => clearInterval(interval);
  }, [location]);

  const fetchDeals = async () => {
    try {
      const params = { limit: 50, active_only: true };
      if (location?.latitude && location?.longitude) {
        params.latitude = location.latitude;
        params.longitude = location.longitude;
        params.radius = 100;
      }
      
      const response = await axios.get(`${API_URL}/api/flash-deals`, { params });
      setDeals(response.data);
    } catch (error) {
      console.error('Error fetching flash deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (dealId) => {
    if (!isAuthenticated) {
      toast.error('Please sign in to claim this deal');
      navigate('/login?redirect=/flash-deals');
      return;
    }

    setClaimingId(dealId);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/flash-deals/${dealId}/claim`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Deal claimed! Use it within 24 hours when purchasing tickets.');
      fetchDeals();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to claim deal');
    } finally {
      setClaimingId(null);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const filteredDeals = deals.filter(deal => 
    deal.event_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deal.location_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deal.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background" data-testid="flash-deals-page">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-red-500/20 via-orange-500/20 to-yellow-500/20 py-12 md:py-16">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl animate-pulse">
                  <Zap className="h-8 w-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="font-heading text-3xl md:text-4xl font-bold">Flash Deals</h1>
                    <Badge className="bg-red-500 text-white animate-pulse">LIVE</Badge>
                  </div>
                  <p className="text-muted-foreground">Limited time offers on amazing local events</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search deals..."
                  className="pl-10 w-64 rounded-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="search-deals"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deals Grid */}
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-96 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="text-center py-16">
            <Flame className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-heading text-2xl font-bold mb-2">No Active Deals</h2>
            <p className="text-muted-foreground mb-6">
              {searchQuery 
                ? "No deals match your search. Try different keywords."
                : "Check back soon for exciting flash deals on local events!"
              }
            </p>
            <Button onClick={() => navigate('/events')} className="rounded-full">
              Browse All Events
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">{filteredDeals.length}</span> active deals
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDeals.map((deal) => {
                const isUrgent = deal.time_left_seconds < 7200;
                const isLowStock = deal.spots_left !== null && deal.spots_left <= 5;
                
                return (
                  <Card 
                    key={deal.deal_id}
                    className={`group relative overflow-hidden border-0 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 ${
                      isUrgent ? 'ring-2 ring-red-500/50' : ''
                    }`}
                    data-testid={`deal-card-${deal.deal_id}`}
                  >
                    {isUrgent && (
                      <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold py-1 px-3 flex items-center justify-center gap-1 z-10">
                        <Flame className="h-3 w-3 animate-pulse" />
                        ENDING SOON
                      </div>
                    )}

                    <div className="relative h-48 overflow-hidden">
                      <img 
                        src={deal.event_image || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800'} 
                        alt={deal.event_title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                      
                      <div className="absolute top-3 right-3">
                        <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-lg font-bold px-3 py-1 shadow-lg">
                          -{deal.discount_percentage}%
                        </Badge>
                      </div>
                      
                      <div className={`absolute bottom-3 left-3 bg-white/95 dark:bg-black/80 backdrop-blur-sm rounded-full px-3 py-1 ${isUrgent ? 'mt-6' : ''}`}>
                        <CountdownTimer endTime={deal.end_time} onExpire={fetchDeals} />
                      </div>
                      
                      {deal.spots_left !== null && (
                        <div className={`absolute bottom-3 right-3 bg-white/95 dark:bg-black/80 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-medium ${
                          isLowStock ? 'text-red-500' : ''
                        }`}>
                          <Users className="h-3 w-3 inline mr-1" />
                          {deal.spots_left} left
                        </div>
                      )}
                    </div>
                    
                    <CardContent className="p-5">
                      <h3 
                        className="font-heading font-semibold text-xl mb-2 line-clamp-1 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => navigate(`/events/${deal.event_id}`)}
                      >
                        {deal.event_title}
                      </h3>
                      
                      <div className="flex items-center text-sm text-muted-foreground mb-2">
                        <MapPin className="h-4 w-4 mr-1" />
                        <span className="truncate">{deal.location_name}, {deal.city}</span>
                      </div>
                      
                      <div className="flex items-center text-sm text-muted-foreground mb-3">
                        <Calendar className="h-4 w-4 mr-1" />
                        <span>{formatDate(deal.event_date)}</span>
                      </div>
                      
                      {deal.description && (
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{deal.description}</p>
                      )}
                      
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-primary">${deal.deal_price}</span>
                          <span className="text-sm text-muted-foreground line-through">${deal.original_price}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          by {deal.business_name}
                        </Badge>
                      </div>
                      
                      <Button 
                        className="w-full rounded-full bg-gradient-to-r from-red-500 to-orange-500 hover:opacity-90"
                        onClick={() => handleClaim(deal.deal_id)}
                        disabled={claimingId === deal.deal_id}
                        data-testid={`claim-${deal.deal_id}`}
                      >
                        {claimingId === deal.deal_id ? (
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
              })}
            </div>
          </>
        )}
      </div>

      {/* How It Works */}
      <div className="bg-muted/30 py-12">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-5xl">
          <h2 className="font-heading text-2xl font-bold text-center mb-8">How Flash Deals Work</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="font-semibold mb-2">1. Find a Deal</h3>
              <p className="text-sm text-muted-foreground">Browse time-limited discounts on local events. The clock is ticking!</p>
            </Card>
            <Card className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
                <Clock className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="font-semibold mb-2">2. Claim It</h3>
              <p className="text-sm text-muted-foreground">Reserve your discount. Your claim is valid for 24 hours.</p>
            </Card>
            <Card className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-6 w-6 text-yellow-500" />
              </div>
              <h3 className="font-semibold mb-2">3. Buy Tickets</h3>
              <p className="text-sm text-muted-foreground">Purchase tickets at the discounted price and enjoy the event!</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
