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
  Mail,
  Globe,
  Clock,
  Accessibility,
  Loader2,
  Church as ChurchIcon,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ChurchDetailPage() {
  const { churchId } = useParams();
  const navigate = useNavigate();
  const { location } = useLocationContext();
  const [church, setChurch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChurch = async () => {
      try {
        const params = {};
        if (location?.latitude && location?.longitude) {
          params.latitude = location.latitude;
          params.longitude = location.longitude;
        }
        const res = await axios.get(`${API_URL}/api/churches/${churchId}`, { params });
        setChurch(res.data);
      } catch (e) {
        console.error('Failed to load church', e);
        navigate('/churches');
      } finally {
        setLoading(false);
      }
    };
    fetchChurch();
  }, [churchId, location, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!church) return null;

  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${church.latitude},${church.longitude}`;

  return (
    <div className="min-h-screen bg-background" data-testid="church-detail-page">
      {/* Hero */}
      <div className="relative h-72 md:h-96 overflow-hidden">
        <img
          src={church.image_url || 'https://images.unsplash.com/photo-1438032005730-c779502df39b?w=1600'}
          alt={church.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="absolute top-4 left-4">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full bg-white/90 dark:bg-black/70 backdrop-blur-sm"
            onClick={() => navigate('/churches')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white">
          <div className="container mx-auto max-w-5xl">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="secondary" className="bg-white/20 text-white border-0 gap-1">
                <ChurchIcon className="h-3 w-3" />
                {church.denomination
                  ? church.denomination.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                  : (church.religion || 'Place of Worship').replace(/\b\w/g, l => l.toUpperCase())}
              </Badge>
              {church.wheelchair_accessible && (
                <Badge className="bg-emerald-500 border-0 gap-1">
                  <Accessibility className="h-3 w-3" />
                  Wheelchair Accessible
                </Badge>
              )}
              {church.distance !== undefined && church.distance !== null && (
                <Badge variant="secondary" className="bg-white/20 text-white border-0">
                  {church.distance} mi away
                </Badge>
              )}
            </div>
            <h1 className="font-heading text-3xl md:text-5xl font-bold">{church.name}</h1>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="container mx-auto max-w-5xl px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {church.description && (
              <section>
                <h2 className="font-heading text-xl font-semibold mb-2">About</h2>
                <p className="text-muted-foreground capitalize">{church.description}</p>
              </section>
            )}

            <section>
              <h2 className="font-heading text-xl font-semibold mb-2 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location
              </h2>
              <p className="text-muted-foreground">
                {church.address || 'Address details on map'}
                {church.city && `, ${church.city}`}
                {church.state && `, ${church.state}`}
                {church.zip_code && ` ${church.zip_code}`}
              </p>
            </section>

            {church.service_times && (
              <section>
                <h2 className="font-heading text-xl font-semibold mb-2 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Service Times
                </h2>
                <p className="text-muted-foreground">{church.service_times}</p>
              </section>
            )}

            {church.opening_hours && (
              <section>
                <h2 className="font-heading text-xl font-semibold mb-2 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Hours
                </h2>
                <p className="text-muted-foreground text-sm">{church.opening_hours}</p>
              </section>
            )}
          </div>

          {/* Right action panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-card rounded-2xl p-6 shadow-lg dark:border dark:border-white/10 space-y-3">
              <Button
                className="w-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500 hover:opacity-90"
                onClick={() => window.open(directionsUrl, '_blank', 'noopener,noreferrer')}
              >
                <MapPin className="h-4 w-4 mr-2" />
                Get Directions
              </Button>

              {church.phone && (
                <Button variant="outline" className="w-full rounded-full" asChild>
                  <a href={`tel:${church.phone}`}>
                    <Phone className="h-4 w-4 mr-2" />
                    {church.phone}
                  </a>
                </Button>
              )}

              {church.email && (
                <Button variant="outline" className="w-full rounded-full" asChild>
                  <a href={`mailto:${church.email}`}>
                    <Mail className="h-4 w-4 mr-2" />
                    {church.email}
                  </a>
                </Button>
              )}

              {church.website && (
                <Button variant="outline" className="w-full rounded-full" asChild>
                  <a href={church.website} target="_blank" rel="noopener noreferrer">
                    <Globe className="h-4 w-4 mr-2" />
                    Visit website
                  </a>
                </Button>
              )}

              <p className="text-xs text-muted-foreground text-center pt-2">
                Information sourced from OpenStreetMap. Verify service times directly with the church before visiting.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
