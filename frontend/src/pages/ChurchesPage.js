import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { useLocation as useLocationContext } from '../context/LocationContext';
import {
  Search,
  MapPin,
  Church as ChurchIcon,
  Phone,
  Globe,
  Accessibility,
  X,
} from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const RELIGIONS = [
  { value: 'all', label: 'All faiths' },
  { value: 'christian', label: 'Christian' },
  { value: 'jewish', label: 'Jewish' },
  { value: 'muslim', label: 'Muslim' },
  { value: 'buddhist', label: 'Buddhist' },
  { value: 'hindu', label: 'Hindu' },
];

export default function ChurchesPage() {
  usePageTitle('Churches');
  const navigate = useNavigate();
  const { location, radius } = useLocationContext();

  const [churches, setChurches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReligion, setSelectedReligion] = useState('all');
  const [selectedDenomination, setSelectedDenomination] = useState('all');
  const [denominationOptions, setDenominationOptions] = useState([]);
  const [wheelchairOnly, setWheelchairOnly] = useState(false);

  useEffect(() => {
    fetchChurches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, radius, selectedReligion, selectedDenomination, wheelchairOnly]);

  useEffect(() => {
    fetchDenominations();
  }, []);

  const fetchChurches = async () => {
    setLoading(true);
    try {
      const params = {
        latitude: location?.latitude,
        longitude: location?.longitude,
        radius,
        limit: 500,
      };
      if (selectedReligion && selectedReligion !== 'all') params.religion = selectedReligion;
      if (selectedDenomination && selectedDenomination !== 'all') params.denomination = selectedDenomination;
      if (wheelchairOnly) params.wheelchair_only = true;
      if (searchQuery) params.search = searchQuery;

      const response = await axios.get(`${API_URL}/api/churches`, { params });
      setChurches(response.data);
    } catch (err) {
      console.error('Error fetching churches:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDenominations = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/churches/denominations`);
      setDenominationOptions(response.data || []);
    } catch (e) {
      // non-fatal
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchChurches();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedReligion('all');
    setSelectedDenomination('all');
    setWheelchairOnly(false);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="churches-page">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-rose-500 text-white">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <ChurchIcon className="h-6 w-6" />
            </div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold">Local Faith Communities</h1>
          </div>
          <p className="text-white/80 max-w-2xl">
            Find churches and places of worship in the Wilmington area.
            Filter by denomination, accessibility, and more.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-4">
          <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={handleSearch} className="flex-1 min-w-[200px] max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by name or denomination..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-full"
                  data-testid="search-input"
                />
              </div>
            </form>

            <Select value={selectedReligion} onValueChange={setSelectedReligion}>
              <SelectTrigger className="w-[140px] rounded-full">
                <SelectValue placeholder="Faith" />
              </SelectTrigger>
              <SelectContent>
                {RELIGIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {denominationOptions.length > 0 && (
              <Select value={selectedDenomination} onValueChange={setSelectedDenomination}>
                <SelectTrigger className="w-[180px] rounded-full">
                  <SelectValue placeholder="Denomination" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All denominations</SelectItem>
                  {denominationOptions.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.value.charAt(0).toUpperCase() + d.value.slice(1).replace(/_/g, ' ')} ({d.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              variant={wheelchairOnly ? 'default' : 'outline'}
              onClick={() => setWheelchairOnly(!wheelchairOnly)}
              className="rounded-full"
              data-testid="wheelchair-only-btn"
            >
              <Accessibility className="h-4 w-4 mr-2" />
              Accessible
            </Button>

            {(selectedReligion !== 'all' || selectedDenomination !== 'all' || wheelchairOnly || searchQuery) && (
              <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>

          <div className="mt-3 text-sm text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
            <span>
              {churches.length} {churches.length === 1 ? 'church' : 'churches'} within {radius} miles
            </span>
            <span className="text-xs">
              Data ©{' '}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                OpenStreetMap contributors
              </a>
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-72 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : churches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {churches.map((c) => (
              <ChurchCard key={c.church_id} church={c} navigate={navigate} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <ChurchIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No churches found</h3>
            <p className="text-muted-foreground mb-6">
              Try adjusting your filters or expanding your search radius.
            </p>
            <Button onClick={clearFilters} className="rounded-full">Clear all filters</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChurchCard({ church, navigate }) {
  return (
    <Card
      className="group cursor-pointer overflow-hidden border-0 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 dark:border dark:border-white/10"
      data-testid={`church-card-${church.church_id}`}
      onClick={() => navigate(`/churches/${church.church_id}`)}
    >
      <div className="relative h-44 overflow-hidden">
        <img
          src={church.image_url || 'https://images.unsplash.com/photo-1438032005730-c779502df39b?w=800'}
          alt={church.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {church.denomination && (
          <div className="absolute top-3 left-3">
            <Badge variant="secondary" className="backdrop-blur-sm bg-white/80 dark:bg-black/60 capitalize">
              {church.denomination.replace(/_/g, ' ')}
            </Badge>
          </div>
        )}
        {church.wheelchair_accessible && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-emerald-500 gap-1">
              <Accessibility className="h-3 w-3" />
              Accessible
            </Badge>
          </div>
        )}
        {church.distance !== null && church.distance !== undefined && (
          <div className="absolute bottom-3 right-3 bg-white/90 dark:bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium">
            {church.distance} mi
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <h3 className="font-heading font-semibold text-lg mb-1 line-clamp-1 group-hover:text-primary transition-colors">
          {church.name}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-1 mb-2 capitalize">
          {church.description}
        </p>

        {(church.address || church.city) && (
          <div className="flex items-start text-sm text-muted-foreground mb-2">
            <MapPin className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-1">
              {church.address}
              {church.city && `, ${church.city}`}
            </span>
          </div>
        )}

        <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
          {church.phone && (
            <Button variant="outline" size="sm" className="flex-1 rounded-full" asChild>
              <a href={`tel:${church.phone}`}>
                <Phone className="h-3 w-3 mr-1" /> Call
              </a>
            </Button>
          )}
          {church.website && (
            <Button variant="outline" size="sm" className="flex-1 rounded-full" asChild>
              <a href={church.website} target="_blank" rel="noopener noreferrer">
                <Globe className="h-3 w-3 mr-1" /> Website
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
