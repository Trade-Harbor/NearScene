import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { FoodTruckCard } from '../components/Cards';
import { FoodTruckMap } from '../components/Maps';
import { useLocation as useLocationContext } from '../context/LocationContext';
import { Slider } from '../components/ui/slider';
import { 
  Truck, 
  Grid3X3, 
  Map as MapIcon,
  SlidersHorizontal,
  X
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CUISINES = [
  { value: 'all', label: 'All Cuisines' },
  { value: 'Mexican', label: 'Mexican' },
  { value: 'Korean', label: 'Korean' },
  { value: 'Italian', label: 'Italian' },
  { value: 'American', label: 'American' },
  { value: 'Asian', label: 'Asian' },
  { value: 'BBQ', label: 'BBQ' },
  { value: 'Mediterranean', label: 'Mediterranean' },
  { value: 'Indian', label: 'Indian' },
];

export default function FoodTrucksPage() {
  const navigate = useNavigate();
  const { location, radius, updateRadius } = useLocationContext();
  
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('split'); // grid, map, or split
  const [selectedCuisine, setSelectedCuisine] = useState('all');
  const [activeOnly, setActiveOnly] = useState(true);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [localRadius, setLocalRadius] = useState(radius);

  useEffect(() => {
    fetchTrucks();
  }, [location, radius, selectedCuisine, activeOnly]);

  const fetchTrucks = async () => {
    setLoading(true);
    try {
      const params = {
        latitude: location?.latitude,
        longitude: location?.longitude,
        radius: radius,
        active_only: activeOnly
      };

      if (selectedCuisine && selectedCuisine !== 'all') {
        params.cuisine = selectedCuisine;
      }

      const response = await axios.get(`${API_URL}/api/foodtrucks`, { params });
      setTrucks(response.data);
    } catch (error) {
      console.error('Error fetching food trucks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTruckClick = (truck) => {
    setSelectedTruck(truck);
  };

  const applyRadius = () => {
    updateRadius(localRadius);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="food-trucks-page">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-orange-400 text-white">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Truck className="h-6 w-6" />
            </div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold">Food Trucks</h1>
          </div>
          <p className="text-white/80 max-w-2xl">
            Discover delicious food trucks near you. Find your next favorite meal from local vendors.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Cuisine Filter */}
            <Select value={selectedCuisine} onValueChange={setSelectedCuisine}>
              <SelectTrigger className="w-[160px] rounded-full" data-testid="cuisine-select">
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

            {/* Active Only Toggle */}
            <Button
              variant={activeOnly ? 'default' : 'outline'}
              onClick={() => setActiveOnly(!activeOnly)}
              className="rounded-full"
              data-testid="active-only-btn"
            >
              Open Now
            </Button>

            {/* Distance Filter */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="rounded-full gap-2"
              data-testid="distance-filter-btn"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Distance
            </Button>

            <div className="flex-1" />

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
                className="rounded-full"
                data-testid="view-grid-btn"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'map' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('map')}
                className="rounded-full"
                data-testid="view-map-btn"
              >
                <MapIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'split' ? 'default' : 'outline'}
                onClick={() => setViewMode('split')}
                className="rounded-full text-xs px-3"
                data-testid="view-split-btn"
              >
                Split
              </Button>
            </div>
          </div>

          {/* Distance Slider */}
          {showFilters && (
            <div className="mt-4 p-4 bg-muted/50 rounded-xl animate-slide-up">
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
                  data-testid="radius-slider"
                />
                <Button 
                  size="sm" 
                  onClick={applyRadius}
                  className="rounded-full"
                  data-testid="apply-radius-btn"
                >
                  Apply
                </Button>
              </div>
            </div>
          )}

          {/* Results Count */}
          <div className="mt-3 text-sm text-muted-foreground">
            {trucks.length} food truck{trucks.length !== 1 ? 's' : ''} found within {radius} miles
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : viewMode === 'grid' ? (
          // Grid View
          trucks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {trucks.map((truck) => (
                <FoodTruckCard
                  key={truck.truck_id}
                  truck={truck}
                  onClick={() => handleTruckClick(truck)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Truck className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No food trucks found</h3>
              <p className="text-muted-foreground mb-6">
                Try adjusting your filters or expanding your search radius
              </p>
              <Button 
                onClick={() => {
                  setSelectedCuisine('all');
                  setActiveOnly(false);
                }} 
                className="rounded-full"
              >
                Clear Filters
              </Button>
            </div>
          )
        ) : viewMode === 'map' ? (
          // Map View
          <div className="h-[700px] rounded-2xl overflow-hidden shadow-lg">
            <FoodTruckMap
              trucks={trucks}
              center={location ? [location.latitude, location.longitude] : [40.7128, -74.006]}
              zoom={12}
              onTruckClick={handleTruckClick}
              showUserLocation={true}
              userLocation={location}
              selectedTruck={selectedTruck}
            />
          </div>
        ) : (
          // Split View
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Map */}
            <div className="h-[600px] rounded-2xl overflow-hidden shadow-lg order-2 lg:order-1">
              <FoodTruckMap
                trucks={trucks}
                center={location ? [location.latitude, location.longitude] : [40.7128, -74.006]}
                zoom={12}
                onTruckClick={handleTruckClick}
                showUserLocation={true}
                userLocation={location}
                selectedTruck={selectedTruck}
              />
            </div>

            {/* List */}
            <div className="space-y-4 order-1 lg:order-2 max-h-[600px] overflow-y-auto pr-2">
              {trucks.length > 0 ? (
                trucks.map((truck) => (
                  <div
                    key={truck.truck_id}
                    className={`cursor-pointer transition-all ${
                      selectedTruck?.truck_id === truck.truck_id
                        ? 'ring-2 ring-primary rounded-2xl'
                        : ''
                    }`}
                    onClick={() => handleTruckClick(truck)}
                  >
                    <FoodTruckCard truck={truck} />
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No food trucks found nearby
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected Truck Detail Panel */}
        {selectedTruck && viewMode !== 'grid' && (
          <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-card rounded-2xl shadow-2xl p-6 z-50 border border-border animate-slide-up">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => setSelectedTruck(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            
            <div className="flex items-start gap-4">
              <img
                src={selectedTruck.image_url || 'https://images.unsplash.com/photo-1620589125156-fd5028c5e05b?w=200'}
                alt={selectedTruck.name}
                className="w-20 h-20 rounded-xl object-cover"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-heading font-semibold text-lg truncate">
                  {selectedTruck.name}
                </h3>
                <p className="text-sm text-muted-foreground">{selectedTruck.cuisine_type}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={selectedTruck.is_active_today ? "default" : "secondary"} className={selectedTruck.is_active_today ? "bg-accent" : ""}>
                    {selectedTruck.is_active_today ? 'Open' : 'Closed'}
                  </Badge>
                  {selectedTruck.distance !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {selectedTruck.distance} mi away
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mt-4 line-clamp-2">
              {selectedTruck.description}
            </p>
            
            <div className="flex gap-2 mt-4">
              <Button
                className="flex-1 rounded-full"
                onClick={() => window.open(
                  `https://www.google.com/maps/search/?api=1&query=${selectedTruck.latitude},${selectedTruck.longitude}`,
                  '_blank'
                )}
              >
                Get Directions
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
