import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { EventCard } from '../components/Cards';
import { FlashDealsSection } from '../components/FlashDeals';
import { useLocation as useLocationContext } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Search, 
  MapPin, 
  Calendar, 
  Truck, 
  Music, 
  ShoppingBag, 
  Wine, 
  Tag, 
  ArrowRight,
  Sparkles,
  ChevronRight,
  Users
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = [
  { name: 'concert', label: 'Concerts', icon: Music, color: 'bg-purple-500' },
  { name: 'market', label: 'Markets', icon: ShoppingBag, color: 'bg-emerald-500' },
  { name: 'happy_hour', label: 'Happy Hours', icon: Wine, color: 'bg-amber-500' },
  { name: 'garage_sale', label: 'Garage Sales', icon: Tag, color: 'bg-pink-500' },
  { name: 'food_festival', label: 'Food', icon: Truck, color: 'bg-red-500' },
  { name: 'community', label: 'Community', icon: Users, color: 'bg-blue-500' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { location, radius } = useLocationContext();
  const { isAuthenticated } = useAuth();
  const [promotedEvents, setPromotedEvents] = useState([]);
  const [nearbyEvents, setNearbyEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchEvents();
  }, [location, radius]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      // Fetch promoted events
      const promotedRes = await axios.get(`${API_URL}/api/events`, {
        params: {
          latitude: location?.latitude,
          longitude: location?.longitude,
          radius: 100,
          promoted_only: true,
          limit: 6
        }
      });
      setPromotedEvents(promotedRes.data);

      // Fetch nearby events
      const nearbyRes = await axios.get(`${API_URL}/api/events`, {
        params: {
          latitude: location?.latitude,
          longitude: location?.longitude,
          radius: radius,
          limit: 12
        }
      });
      setNearbyEvents(nearbyRes.data);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/events?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleCategoryClick = (category) => {
    navigate(`/events?category=${category}`);
  };

  return (
    <div className="min-h-screen" data-testid="home-page">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background py-20 md:py-32">
        {/* Animated Blobs */}
        <div className="hero-blob hero-blob-1" />
        <div className="hero-blob hero-blob-2" />
        
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-6 bg-primary/10 text-primary hover:bg-primary/20 px-4 py-1.5" data-testid="hero-badge">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Discover Local Events Near You
            </Badge>
            
            <h1 className="font-heading text-4xl md:text-6xl font-bold tracking-tight mb-6 animate-slide-up">
              What's Happening{' '}
              <span className="gradient-brand-text">Locally</span>?
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 animate-slide-up stagger-1">
              Find concerts, markets, food trucks, happy hours, and local events 
              happening right in your neighborhood.
            </p>
            
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="relative max-w-xl mx-auto animate-slide-up stagger-2" data-testid="hero-search-form">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search events, food trucks, markets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-14 pl-12 pr-4 rounded-full text-base bg-card shadow-lg border-0 focus-visible:ring-2 focus-visible:ring-primary"
                    data-testid="hero-search-input"
                  />
                </div>
                <Button 
                  type="submit"
                  size="lg"
                  className="h-14 px-8 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 hover:opacity-90 transition-opacity"
                  data-testid="hero-search-btn"
                >
                  Search
                </Button>
              </div>
            </form>
            
            {/* Location Info */}
            <div className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground animate-slide-up stagger-3">
              <MapPin className="h-4 w-4" />
              <span>Showing events within {radius} miles of {location?.city || 'your location'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-12 bg-muted/30" data-testid="categories-section">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-heading text-2xl md:text-3xl font-semibold">Browse by Category</h2>
            <Button 
              variant="ghost" 
              onClick={() => navigate('/events')}
              className="text-muted-foreground hover:text-foreground"
              data-testid="view-all-categories-btn"
            >
              View All <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                onClick={() => handleCategoryClick(cat.name)}
                className="group flex flex-col items-center p-6 rounded-2xl bg-card hover:bg-card/80 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 dark:border dark:border-white/10"
                data-testid={`category-${cat.name}`}
              >
                <div className={`${cat.color} p-4 rounded-2xl mb-3 group-hover:scale-110 transition-transform`}>
                  <cat.icon className="h-6 w-6 text-white" />
                </div>
                <span className="font-medium text-sm">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Events */}
      {promotedEvents.length > 0 && (
        <section className="py-16" data-testid="featured-section">
          <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <Badge className="mb-2 bg-gradient-to-r from-indigo-500 to-pink-500 text-white">
                  <Sparkles className="h-3 w-3 mr-1" /> Featured
                </Badge>
                <h2 className="font-heading text-2xl md:text-3xl font-semibold">Don't Miss These Events</h2>
              </div>
              <Button 
                variant="outline" 
                onClick={() => navigate('/events?promoted=true')}
                className="rounded-full"
                data-testid="view-featured-btn"
              >
                See More <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {promotedEvents.slice(0, 3).map((event, idx) => (
                <div key={event.event_id} className={`animate-slide-up stagger-${idx + 1}`}>
                  <EventCard 
                    event={event} 
                    onClick={() => navigate(`/events/${event.event_id}`)}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Flash Deals */}
      <FlashDealsSection 
        latitude={location?.latitude} 
        longitude={location?.longitude} 
      />

      {/* Nearby Events */}
      <section className="py-16 bg-muted/30" data-testid="nearby-section">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-heading text-2xl md:text-3xl font-semibold">Events Near You</h2>
              <p className="text-muted-foreground mt-1">Within {radius} miles of your location</p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate('/events')}
              className="rounded-full"
              data-testid="view-nearby-btn"
            >
              View All <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-80 bg-card rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : nearbyEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {nearbyEvents.slice(0, 8).map((event) => (
                <EventCard 
                  key={event.event_id}
                  event={event} 
                  onClick={() => navigate(`/events/${event.event_id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No events found nearby</h3>
              <p className="text-muted-foreground mb-4">Try expanding your search radius or check back later</p>
              <Button onClick={() => navigate('/events')} className="rounded-full">
                Browse All Events
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Food Trucks CTA */}
      <section className="py-16" data-testid="food-trucks-cta">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-pink-500 to-orange-400 p-8 md:p-12">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <h2 className="font-heading text-2xl md:text-3xl font-bold text-white mb-2">
                  Hungry? Find Food Trucks Near You
                </h2>
                <p className="text-white/80 max-w-md">
                  Explore our interactive map to discover delicious food trucks in your area today.
                </p>
              </div>
              <Button 
                size="lg"
                onClick={() => navigate('/food-trucks')}
                className="bg-white text-pink-600 hover:bg-white/90 rounded-full px-8"
                data-testid="explore-food-trucks-btn"
              >
                <Truck className="h-5 w-5 mr-2" />
                Explore Food Trucks
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Explore More Sections */}
      <section className="py-16 bg-muted/30" data-testid="explore-more-section">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
          <h2 className="font-heading text-2xl md:text-3xl font-semibold mb-8 text-center">
            More to Explore
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Restaurants */}
            <div 
              className="group cursor-pointer bg-card rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 dark:border dark:border-white/10"
              onClick={() => navigate('/restaurants')}
              data-testid="explore-restaurants"
            >
              <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4 rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="font-heading font-semibold text-xl mb-2">Restaurants</h3>
              <p className="text-muted-foreground text-sm">
                Discover the best local dining spots, from cozy cafes to fine dining.
              </p>
            </div>

            {/* Parks & Trails */}
            <div 
              className="group cursor-pointer bg-card rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 dark:border dark:border-white/10"
              onClick={() => navigate('/attractions')}
              data-testid="explore-attractions"
            >
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-4 rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h3 className="font-heading font-semibold text-xl mb-2">Parks & Trails</h3>
              <p className="text-muted-foreground text-sm">
                Explore hiking trails, parks, landmarks, and outdoor spaces.
              </p>
            </div>

            {/* Community */}
            <div 
              className="group cursor-pointer bg-card rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 dark:border dark:border-white/10"
              onClick={() => navigate('/community')}
              data-testid="explore-community"
            >
              <div className="bg-gradient-to-r from-violet-500 to-purple-500 p-4 rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform">
                <Users className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-heading font-semibold text-xl mb-2">Community</h3>
              <p className="text-muted-foreground text-sm">
                Connect with neighbors, share local news, and organize meetups.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!isAuthenticated && (
        <section className="py-20 bg-muted/30" data-testid="cta-section">
          <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl text-center">
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
              Ready to Share Your Events?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Whether you're hosting a garage sale, organizing a community event, or running a business,
              NearScene helps you reach your local audience.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                onClick={() => navigate('/register')}
                className="rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 hover:opacity-90 px-8"
                data-testid="cta-get-started-btn"
              >
                Get Started Free
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => navigate('/register?type=business')}
                className="rounded-full px-8"
                data-testid="cta-business-btn"
              >
                Business Account
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
