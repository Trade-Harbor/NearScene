import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Search, MapPin, Calendar, Utensils, TreePine, Truck, Church as ChurchIcon,
  Dumbbell, Gamepad2, ArrowRight,
} from 'lucide-react';
import { useLocation as useLocationContext } from '../context/LocationContext';
import usePageTitle from '../hooks/usePageTitle';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SECTIONS = [
  { key: 'events', label: 'Events', icon: Calendar, route: '/events', color: 'from-indigo-500 to-purple-500' },
  { key: 'restaurants', label: 'Restaurants', icon: Utensils, route: '/restaurants', color: 'from-orange-500 to-red-500' },
  { key: 'attractions', label: 'Parks & Outdoors', icon: TreePine, route: '/attractions', color: 'from-emerald-500 to-teal-500' },
  { key: 'fitness', label: 'Fitness', icon: Dumbbell, route: '/fitness', color: 'from-cyan-500 to-blue-500' },
  { key: 'activities', label: 'Activities', icon: Gamepad2, route: '/activities', color: 'from-fuchsia-500 to-pink-500' },
  { key: 'food_trucks', label: 'Food Trucks', icon: Truck, route: '/food-trucks', color: 'from-amber-500 to-orange-500' },
  { key: 'churches', label: 'Churches', icon: ChurchIcon, route: '/churches', color: 'from-rose-500 to-pink-500' },
];

const DETAIL_ROUTE = {
  events: (item) => `/events/${item.event_id}`,
  restaurants: (item) => `/restaurants/${item.restaurant_id}`,
  attractions: (item) => `/attractions/${item.attraction_id}`,
  fitness: (item) => `/fitness/${item.attraction_id}`,
  activities: (item) => `/activities/${item.attraction_id}`,
  food_trucks: (item) => `/food-trucks`, // food trucks index for now
  churches: (item) => `/churches/${item.church_id}`,
};

const ITEM_NAME = {
  events: (i) => i.title,
  restaurants: (i) => i.name,
  attractions: (i) => i.name,
  fitness: (i) => i.name,
  activities: (i) => i.name,
  food_trucks: (i) => i.name,
  churches: (i) => i.name,
};

const ITEM_SUB = {
  events: (i) => i.location_name || i.city,
  restaurants: (i) => (i.categories || []).slice(0, 2).join(', ') || i.city,
  attractions: (i) => (i.attraction_type || i.category || i.city || '').replace(/_/g, ' '),
  fitness: (i) => (i.attraction_type || i.category || i.city || '').replace(/_/g, ' '),
  activities: (i) => (i.attraction_type || i.category || i.city || '').replace(/_/g, ' '),
  food_trucks: (i) => i.cuisine || i.city,
  churches: (i) => i.denomination || i.religion || i.city,
};

export default function SearchResultsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { location } = useLocationContext();
  const q = params.get('q') || '';
  usePageTitle(q ? `Search: ${q}` : 'Search');

  const [input, setInput] = useState(q);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setInput(q);
    if (!q.trim()) { setData(null); return; }
    setLoading(true);
    const controller = new AbortController();
    axios
      .get(`${API_URL}/api/search`, {
        params: {
          q,
          latitude: location?.latitude,
          longitude: location?.longitude,
          limit_per_type: 8,
        },
        signal: controller.signal,
      })
      .then((res) => setData(res.data))
      .catch((err) => { if (!axios.isCancel(err)) console.error(err); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [q, location?.latitude, location?.longitude]);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Blur the input so the mobile keyboard collapses; otherwise pressing
    // the keyboard's down-arrow on Android is interpreted as a back nav.
    if (typeof document !== 'undefined' && document.activeElement?.blur) {
      document.activeElement.blur();
    }
    if (input.trim()) setParams({ q: input.trim() });
  };

  const groups = data?.groups || {};
  const total = data?.total || 0;
  const sectionsWithHits = SECTIONS.filter((s) => (groups[s.key] || []).length > 0);

  return (
    <div className="min-h-screen bg-background" data-testid="search-page">
      {/* Search header */}
      <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-10">
          <h1 className="font-heading text-2xl md:text-3xl font-bold mb-4">Search LocalDrift</h1>
          <form onSubmit={handleSubmit} className="max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Try 'parks', 'gym', 'sushi', 'concert tonight'..."
                className="pl-12 h-12 text-base rounded-full bg-background text-foreground border-0"
                data-testid="search-input"
              />
              <Button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full h-9 px-5"
              >
                Search
              </Button>
            </div>
          </form>
          {q && !loading && (
            <p className="text-white/90 mt-3 text-sm">
              {total === 0 ? `No results for "${q}"` : `${total} result${total === 1 ? '' : 's'} for "${q}"`}
            </p>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-8">
        {!q.trim() && (
          <div className="text-center py-16">
            <Search className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">What are you looking for?</h2>
            <p className="text-muted-foreground">
              Search across events, restaurants, parks, food trucks, and more.
            </p>
          </div>
        )}

        {loading && (
          <div className="space-y-8">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="h-6 w-40 bg-muted rounded mb-4 animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="h-32 bg-muted rounded-2xl animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && q.trim() && total === 0 && (
          <div className="text-center py-16">
            <Search className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nothing matched "{q}"</h2>
            <p className="text-muted-foreground mb-6">
              Try a broader term, or browse a category directly.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SECTIONS.map((s) => (
                <Button key={s.key} variant="outline" className="rounded-full" onClick={() => navigate(s.route)}>
                  <s.icon className="h-4 w-4 mr-2" /> {s.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {!loading && sectionsWithHits.length > 0 && (
          <div className="space-y-10">
            {sectionsWithHits.map((section) => {
              const items = groups[section.key] || [];
              const Icon = section.icon;
              return (
                <section key={section.key} data-testid={`results-${section.key}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
                      <span className={`p-1.5 rounded-lg bg-gradient-to-br ${section.color} text-white`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      {section.label}
                      <span className="text-sm font-normal text-muted-foreground">
                        ({items.length})
                      </span>
                    </h2>
                    <Button variant="ghost" size="sm" onClick={() => navigate(section.route)}>
                      See all <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {items.map((item, idx) => (
                      <Link
                        key={idx}
                        to={DETAIL_ROUTE[section.key](item)}
                        className="block"
                      >
                        <Card className="h-full cursor-pointer hover:shadow-card-hover transition-all hover:-translate-y-0.5 dark:border dark:border-white/10">
                          <CardContent className="p-4">
                            <h3 className="font-semibold line-clamp-2 mb-1">
                              {ITEM_NAME[section.key](item)}
                            </h3>
                            {ITEM_SUB[section.key](item) && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mb-2 capitalize">
                                {ITEM_SUB[section.key](item)}
                              </p>
                            )}
                            {(item.address || item.city) && (
                              <div className="flex items-center text-xs text-muted-foreground gap-1">
                                <MapPin className="h-3 w-3" />
                                <span className="line-clamp-1">{item.city || item.address}</span>
                                {item.distance != null && (
                                  <Badge variant="secondary" className="ml-auto text-xs">
                                    {item.distance} mi
                                  </Badge>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
