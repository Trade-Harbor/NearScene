import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Slider } from '../components/ui/slider';
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
  Clock, 
  DollarSign, 
  Star,
  Phone,
  ExternalLink,
  Utensils,
  Filter,
  X,
  Heart,
  Users,
  Dog,
  Baby
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CUISINES = [
  { value: 'all', label: 'All Cuisines' },
  { value: 'Italian', label: 'Italian' },
  { value: 'Japanese', label: 'Japanese' },
  { value: 'Mexican', label: 'Mexican' },
  { value: 'BBQ', label: 'BBQ' },
  { value: 'Vegan', label: 'Vegan' },
  { value: 'Chinese', label: 'Chinese' },
  { value: 'Indian', label: 'Indian' },
  { value: 'Thai', label: 'Thai' },
  { value: 'American', label: 'American' },
];

const MOODS = [
  { value: 'family_friendly', label: 'Family Friendly', icon: Baby },
  { value: 'dog_friendly', label: 'Dog Friendly', icon: Dog },
  { value: 'romantic', label: 'Romantic', icon: Heart },
  { value: 'groups', label: 'Good for Groups', icon: Users },
];

const PRICE_LEVELS = ['$', '$$', '$$$', '$$$$'];

export default function RestaurantsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { location, radius, updateRadius } = useLocationContext();
  
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('all');
  const [selectedPrice, setSelectedPrice] = useState(null);
  const [selectedMood, setSelectedMood] = useState(null);
  const [openNow, setOpenNow] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [localRadius, setLocalRadius] = useState(radius);

  useEffect(() => {
    fetchRestaurants();
  }, [location, radius, selectedCuisine, selectedPrice, selectedMood, openNow]);

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const params = {
        latitude: location?.latitude,
        longitude: location?.longitude,
        radius: radius,
        limit: 500   // Bumped from 50 — Yelp ingestion seeds up to 200 restaurants
      };

      if (selectedCuisine && selectedCuisine !== 'all') {
        params.cuisine = selectedCuisine;
      }
      if (selectedPrice) {
        params.price_level = selectedPrice;
      }
      if (selectedMood) {
        params.mood = selectedMood;
      }
      if (openNow) {
        params.open_now = true;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }

      const response = await axios.get(`${API_URL}/api/restaurants`, { params });
      setRestaurants(response.data);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchRestaurants();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCuisine('all');
    setSelectedPrice(null);
    setSelectedMood(null);
    setOpenNow(false);
  };

  const applyRadius = () => {
    updateRadius(localRadius);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="restaurants-page">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Utensils className="h-6 w-6" />
            </div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold">Local Restaurants</h1>
          </div>
          <p className="text-white/80 max-w-2xl">
            Discover the best places to eat in your neighborhood. From cozy cafes to fine dining.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 min-w-[200px] max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search restaurants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-full"
                  data-testid="search-input"
                />
              </div>
            </form>

            {/* Cuisine */}
            <Select value={selectedCuisine} onValueChange={setSelectedCuisine}>
              <SelectTrigger className="w-[140px] rounded-full" data-testid="cuisine-select">
                <SelectValue placeholder="Cuisine" />
              </SelectTrigger>
              <SelectContent>
                {CUISINES.map((cuisine) => (
                  <SelectItem key={cuisine.value} value={cuisine.value}>
                    {cuisine.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Price Level */}
            <Select value={selectedPrice?.toString() || 'any'} onValueChange={(v) => setSelectedPrice(v === 'any' ? null : parseInt(v))}>
              <SelectTrigger className="w-[100px] rounded-full" data-testid="price-select">
                <SelectValue placeholder="Price" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any Price</SelectItem>
                {PRICE_LEVELS.map((price, idx) => (
                  <SelectItem key={idx} value={(idx + 1).toString()}>
                    {price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Open Now */}
            <Button
              variant={openNow ? 'default' : 'outline'}
              onClick={() => setOpenNow(!openNow)}
              className="rounded-full"
              data-testid="open-now-btn"
            >
              <Clock className="h-4 w-4 mr-2" />
              Open Now
            </Button>

            {/* Mood Filters */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="rounded-full gap-2"
              data-testid="mood-filters-btn"
            >
              <Filter className="h-4 w-4" />
              Mood
            </Button>

            {/* Clear */}
            {(selectedCuisine !== 'all' || selectedPrice || selectedMood || openNow) && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Mood Filter Expanded */}
          {showFilters && (
            <div className="mt-4 p-4 bg-muted/50 rounded-xl animate-slide-up">
              <p className="text-sm font-medium mb-3">What's the vibe?</p>
              <div className="flex flex-wrap gap-2">
                {MOODS.map((mood) => (
                  <Button
                    key={mood.value}
                    variant={selectedMood === mood.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedMood(selectedMood === mood.value ? null : mood.value)}
                    className="rounded-full gap-2"
                    data-testid={`mood-${mood.value}`}
                  >
                    <mood.icon className="h-4 w-4" />
                    {mood.label}
                  </Button>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Search Radius</span>
                  <span className="text-sm text-muted-foreground">{localRadius} miles</span>
                </div>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[localRadius]}
                    onValueChange={([value]) => setLocalRadius(value)}
                    max={50}
                    min={1}
                    step={1}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={applyRadius} className="rounded-full">
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-3 text-sm text-muted-foreground">
            {restaurants.length} restaurant{restaurants.length !== 1 ? 's' : ''} found within {radius} miles
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
        ) : restaurants.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {restaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.restaurant_id} restaurant={restaurant} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Utensils className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No restaurants found</h3>
            <p className="text-muted-foreground mb-6">
              Try adjusting your filters or expanding your search radius
            </p>
            <Button onClick={clearFilters} className="rounded-full">
              Clear All Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RestaurantCard({ restaurant }) {
  const navigate = useNavigate();

  // Click the card to view full restaurant details on NearScene.
  // Inner action buttons use stopPropagation so they don't re-trigger the card.
  const handleCardClick = () => {
    navigate(`/restaurants/${restaurant.restaurant_id}`);
  };

  return (
    <Card
      className="group cursor-pointer overflow-hidden border-0 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 dark:border dark:border-white/10"
      data-testid={`restaurant-card-${restaurant.restaurant_id}`}
      onClick={handleCardClick}
    >
      <div className="relative h-48 overflow-hidden">
        <img
          src={restaurant.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'}
          alt={restaurant.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Open/Closed Badge — only shown when we actually know the hours. */}
        {restaurant.is_open_now !== null && restaurant.is_open_now !== undefined && (
          <div className="absolute top-3 right-3">
            <Badge variant={restaurant.is_open_now ? "default" : "secondary"} className={restaurant.is_open_now ? "bg-accent" : ""}>
              {restaurant.is_open_now ? 'Open Now' : 'Closed'}
            </Badge>
          </div>
        )}

        {/* Price Level */}
        <div className="absolute top-3 left-3">
          <Badge variant="secondary" className="backdrop-blur-sm bg-white/80 dark:bg-black/60">
            {PRICE_LEVELS[restaurant.price_level - 1]}
          </Badge>
        </div>
        
        {/* Distance */}
        {restaurant.distance !== undefined && (
          <div className="absolute bottom-3 right-3 bg-white/90 dark:bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium">
            {restaurant.distance} mi
          </div>
        )}
      </div>
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-heading font-semibold text-lg group-hover:text-primary transition-colors">
              {restaurant.name}
            </h3>
            <p className="text-sm text-muted-foreground">{restaurant.cuisine_type}</p>
          </div>
          {restaurant.rating > 0 && (
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{restaurant.rating}</span>
            </div>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {restaurant.description}
        </p>
        
        <div className="flex items-center text-sm text-muted-foreground mb-2">
          <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="truncate">{restaurant.address}, {restaurant.city}</span>
        </div>
        
        {/* Features */}
        {restaurant.features?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {restaurant.features.slice(0, 3).map((feature, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {feature.replace('_', ' ')}
              </Badge>
            ))}
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-border" onClick={(e) => e.stopPropagation()}>
          {restaurant.phone && (
            <Button variant="outline" size="sm" className="flex-1 rounded-full" asChild>
              <a href={`tel:${restaurant.phone}`} onClick={(e) => e.stopPropagation()}>
                <Phone className="h-3 w-3 mr-1" />
                Call
              </a>
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            className="flex-1 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              window.open(
                `https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`,
                '_blank'
              );
            }}
          >
            <MapPin className="h-3 w-3 mr-1" />
            Directions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
