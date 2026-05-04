import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useLocation as useLocationContext } from '../context/LocationContext';
import {
  ArrowLeft,
  MapPin,
  Star,
  Clock,
  ExternalLink,
  Loader2,
  TreePine,
  Mountain,
  Landmark,
  Map,
  Waves,
  Building2,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const TYPE_ICON = {
  park: TreePine,
  hiking_trail: Mountain,
  landmark: Landmark,
  museum: Building2,
  beach: Waves,
  garden: TreePine,
  nature_reserve: TreePine,
  attraction: Map,
  playground: TreePine,
};

const TYPE_LABEL = {
  park: 'Park',
  hiking_trail: 'Hiking Trail',
  landmark: 'Landmark',
  museum: 'Museum',
  beach: 'Beach',
  garden: 'Garden',
  nature_reserve: 'Nature Reserve',
  attraction: 'Attraction',
  playground: 'Playground',
};

export default function AttractionDetailPage() {
  const { attractionId } = useParams();
  const navigate = useNavigate();
  const { location } = useLocationContext();

  const [attraction, setAttraction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttraction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attractionId]);

  const fetchAttraction = async () => {
    try {
      const params = {};
      if (location?.latitude && location?.longitude) {
        params.latitude = location.latitude;
        params.longitude = location.longitude;
      }
      const res = await axios.get(`${API_URL}/api/attractions/${attractionId}`, { params });
      setAttraction(res.data);
    } catch (e) {
      console.error('Failed to load attraction', e);
      navigate('/attractions');
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

  if (!attraction) return null;

  const Icon = TYPE_ICON[attraction.attraction_type] || Map;
  const typeLabel = TYPE_LABEL[attraction.attraction_type] || attraction.attraction_type;
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${attraction.latitude},${attraction.longitude}`;
  const hasOpeningHours = attraction.hours && (attraction.hours.text || Object.keys(attraction.hours).length > 0);

  // Three-state admission badge
  let admissionBadge = null;
  if (attraction.is_free === true) {
    admissionBadge = <Badge className="bg-emerald-500 border-0">Free</Badge>;
  } else if (attraction.is_free === false) {
    admissionBadge = <Badge variant="secondary">Admission charged</Badge>;
  } else {
    admissionBadge = <Badge variant="outline" className="text-white border-white/40">Admission varies</Badge>;
  }

  return (
    <div className="min-h-screen bg-background" data-testid="attraction-detail-page">
      {/* Hero */}
      <div className="relative h-72 md:h-96 overflow-hidden">
        <img
          src={attraction.image_url || 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=1600'}
          alt={attraction.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="absolute top-4 left-4">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full bg-white/90 dark:bg-black/70 backdrop-blur-sm"
            onClick={() => navigate('/attractions')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white">
          <div className="container mx-auto max-w-5xl">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="secondary" className="bg-white/20 text-white border-0 gap-1">
                <Icon className="h-3 w-3" />
                {typeLabel}
              </Badge>
              {admissionBadge}
              {attraction.distance !== undefined && attraction.distance !== null && (
                <Badge variant="secondary" className="bg-white/20 text-white border-0">
                  {attraction.distance} mi away
                </Badge>
              )}
            </div>
            <h1 className="font-heading text-3xl md:text-5xl font-bold">{attraction.name}</h1>
            {attraction.rating > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{attraction.rating}</span>
                {attraction.review_count > 0 && (
                  <span className="text-white/80 text-sm">({attraction.review_count} reviews)</span>
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
            {attraction.description && (
              <section>
                <h2 className="font-heading text-xl font-semibold mb-2">About</h2>
                <p className="text-muted-foreground">{attraction.description}</p>
              </section>
            )}

            <section>
              <h2 className="font-heading text-xl font-semibold mb-2 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location
              </h2>
              <p className="text-muted-foreground">
                {attraction.address || 'Address details on map'}
                {attraction.city && `, ${attraction.city}`}
                {attraction.state && `, ${attraction.state}`}
                {attraction.zip_code && ` ${attraction.zip_code}`}
              </p>
            </section>

            {hasOpeningHours && (
              <section>
                <h2 className="font-heading text-xl font-semibold mb-2 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Hours
                </h2>
                <p className="text-sm text-muted-foreground">
                  {attraction.hours.text || 'See partner site for hours'}
                </p>
              </section>
            )}

            {attraction.trail_length && (
              <section>
                <h2 className="font-heading text-xl font-semibold mb-2">Trail Info</h2>
                <p className="text-muted-foreground">
                  {attraction.trail_length} miles
                  {attraction.estimated_duration && ` · ${attraction.estimated_duration}`}
                  {attraction.difficulty_level && ` · ${attraction.difficulty_level}`}
                </p>
              </section>
            )}

            {attraction.amenities?.length > 0 && (
              <section>
                <h2 className="font-heading text-xl font-semibold mb-2">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {attraction.amenities.map((a, i) => (
                    <Badge key={i} variant="outline">
                      {a.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {attraction.mood_tags?.length > 0 && (
              <section>
                <h2 className="font-heading text-xl font-semibold mb-2">Good For</h2>
                <div className="flex flex-wrap gap-2">
                  {attraction.mood_tags.map((m, i) => (
                    <Badge key={i} variant="secondary">
                      {m.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {attraction.tips && (
              <section className="bg-muted/50 rounded-xl p-4">
                <h2 className="font-heading text-base font-semibold mb-1">Tip</h2>
                <p className="text-sm text-muted-foreground">{attraction.tips}</p>
              </section>
            )}
          </div>

          {/* Right: actions */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-card rounded-2xl p-6 shadow-lg dark:border dark:border-white/10 space-y-3">
              <Button
                className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90"
                onClick={() => window.open(directionsUrl, '_blank', 'noopener,noreferrer')}
              >
                <MapPin className="h-4 w-4 mr-2" />
                Get Directions
              </Button>

              {attraction.external_url && (
                <Button
                  variant="outline"
                  className="w-full rounded-full"
                  onClick={() => window.open(attraction.external_url, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {attraction.source === 'osm' ? 'View on OpenStreetMap' : 'View source'}
                </Button>
              )}

              {attraction.is_free === null && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Admission information not available — check the official site before visiting.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
