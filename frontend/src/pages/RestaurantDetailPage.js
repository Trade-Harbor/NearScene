import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useLocation as useLocationContext } from '../context/LocationContext';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Star,
  Clock,
  ExternalLink,
  Utensils,
  Loader2,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const PRICE_LEVELS = ['$', '$$', '$$$', '$$$$'];

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABEL = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

export default function RestaurantDetailPage() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const { location } = useLocationContext();

  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRestaurant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const fetchRestaurant = async () => {
    try {
      const params = {};
      if (location?.latitude && location?.longitude) {
        params.latitude = location.latitude;
        params.longitude = location.longitude;
      }
      const res = await axios.get(`${API_URL}/api/restaurants/${restaurantId}`, { params });
      setRestaurant(res.data);
    } catch (e) {
      console.error('Failed to load restaurant', e);
      navigate('/restaurants');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!restaurant) return null;

  const hasHours = restaurant.hours && Object.keys(restaurant.hours).length > 0;
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`;

  return (
    <div className="min-h-screen bg-background" data-testid="restaurant-detail-page">
      {/* Hero */}
      <div className="relative h-72 md:h-96 overflow-hidden">
        <img
          src={restaurant.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600'}
          alt={restaurant.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="absolute top-4 left-4">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full bg-white/90 dark:bg-black/70 backdrop-blur-sm"
            onClick={() => navigate('/restaurants')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white">
          <div className="container mx-auto max-w-5xl">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {restaurant.price_level && (
                <Badge variant="secondary" className="bg-white/20 text-white border-0">
                  {PRICE_LEVELS[restaurant.price_level - 1]}
                </Badge>
              )}
              <Badge variant="secondary" className="bg-white/20 text-white border-0">
                {restaurant.cuisine_type}
              </Badge>
              {restaurant.is_open_now === true && (
                <Badge className="bg-emerald-500 border-0">Open Now</Badge>
              )}
              {restaurant.is_open_now === false && (
                <Badge className="bg-red-500/80 border-0">Closed</Badge>
              )}
            </div>
            <h1 className="font-heading text-3xl md:text-5xl font-bold">{restaurant.name}</h1>
            {restaurant.rating > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{restaurant.rating}</span>
                {restaurant.review_count > 0 && (
                  <span className="text-white/80 text-sm">({restaurant.review_count} reviews)</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-5xl px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: details */}
          <div className="lg:col-span-2 space-y-6">
            {restaurant.description && (
              <section>
                <h2 className="font-heading text-xl font-semibold mb-2">About</h2>
                <p className="text-muted-foreground">{restaurant.description}</p>
              </section>
            )}

            <section>
              <h2 className="font-heading text-xl font-semibold mb-2 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location
              </h2>
              <p className="text-muted-foreground">
                {restaurant.address}
                {restaurant.city && `, ${restaurant.city}`}
                {restaurant.state && `, ${restaurant.state}`}
                {restaurant.zip_code && ` ${restaurant.zip_code}`}
              </p>
              {restaurant.distance !== undefined && restaurant.distance !== null && (
                <p className="text-sm text-muted-foreground mt-1">{restaurant.distance} miles from you</p>
              )}
            </section>

            {hasHours && (
              <section>
                <h2 className="font-heading text-xl font-semibold mb-2 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Hours
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  {DAY_ORDER.map((day) => {
                    const h = restaurant.hours[day];
                    return (
                      <div key={day} className="bg-muted/50 rounded-lg px-3 py-2">
                        <div className="font-medium">{DAY_LABEL[day]}</div>
                        <div className="text-muted-foreground">
                          {h && !h.closed ? `${h.open} – ${h.close}` : 'Closed'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {!hasHours && (
              <section>
                <p className="text-sm text-muted-foreground italic">
                  Hours not available — see {restaurant.source === 'yelp' ? 'Yelp' : 'partner site'} for current hours.
                </p>
              </section>
            )}

            {restaurant.features?.length > 0 && (
              <section>
                <h2 className="font-heading text-xl font-semibold mb-2">Features</h2>
                <div className="flex flex-wrap gap-2">
                  {restaurant.features.map((f, i) => (
                    <Badge key={i} variant="outline">
                      {f.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {restaurant.tags?.length > 0 && (
              <section>
                <h2 className="font-heading text-xl font-semibold mb-2">Categories</h2>
                <div className="flex flex-wrap gap-2">
                  {restaurant.tags.map((t, i) => (
                    <Badge key={i} variant="secondary">
                      {t.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right: actions */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-card rounded-2xl p-6 shadow-lg dark:border dark:border-white/10 space-y-3">
              {restaurant.phone && (
                <Button variant="outline" className="w-full rounded-full" asChild>
                  <a href={`tel:${restaurant.phone}`}>
                    <Phone className="h-4 w-4 mr-2" />
                    {restaurant.phone}
                  </a>
                </Button>
              )}

              <Button
                className="w-full rounded-full bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90"
                onClick={() => window.open(directionsUrl, '_blank', 'noopener,noreferrer')}
              >
                <MapPin className="h-4 w-4 mr-2" />
                Get Directions
              </Button>

              {restaurant.external_url && (
                <Button
                  variant="outline"
                  className="w-full rounded-full"
                  onClick={() => window.open(restaurant.external_url, '_blank', 'noopener,noreferrer')}
                >
                  <Utensils className="h-4 w-4 mr-2" />
                  View on {restaurant.source === 'yelp' ? 'Yelp' : 'partner site'}
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
