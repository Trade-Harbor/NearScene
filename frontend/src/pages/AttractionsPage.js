import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Star,
  TreePine,
  Mountain,
  Landmark,
  Map,
  Filter,
  X,
  Dog,
  Baby,
  Accessibility,
  Camera,
  Footprints
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ATTRACTION_TYPES = [
  { value: 'all', label: 'All Types', icon: Map },
  { value: 'park', label: 'Parks', icon: TreePine },
  { value: 'hiking_trail', label: 'Hiking Trails', icon: Mountain },
  { value: 'landmark', label: 'Landmarks', icon: Landmark },
  { value: 'nature_reserve', label: 'Nature Reserves', icon: TreePine },
  { value: 'beach', label: 'Beaches', icon: Map },
  { value: 'garden', label: 'Gardens', icon: TreePine },
  { value: 'historic_site', label: 'Historic Sites', icon: Landmark },
];

const DIFFICULTY_LEVELS = [
  { value: 'easy', label: 'Easy', color: 'bg-green-500' },
  { value: 'moderate', label: 'Moderate', color: 'bg-yellow-500' },
  { value: 'difficult', label: 'Difficult', color: 'bg-orange-500' },
  { value: 'expert', label: 'Expert', color: 'bg-red-500' },
];

const MOODS = [
  { value: 'family_friendly', label: 'Family Friendly', icon: Baby },
  { value: 'dog_friendly', label: 'Dog Friendly', icon: Dog },
  { value: 'wheelchair_accessible', label: 'Accessible', icon: Accessibility },
  { value: 'scenic', label: 'Scenic Views', icon: Camera },
  { value: 'hiking', label: 'Good for Hiking', icon: Footprints },
];

export default function AttractionsPage() {
  const navigate = useNavigate();
  const { location, radius, updateRadius } = useLocationContext();
  
  const [attractions, setAttractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('any');
  const [selectedMood, setSelectedMood] = useState(null);
  const [freeOnly, setFreeOnly] = useState(false);
  const [openNow, setOpenNow] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [localRadius, setLocalRadius] = useState(radius);

  useEffect(() => {
    fetchAttractions();
  }, [location, radius, selectedType, selectedDifficulty, selectedMood, freeOnly, openNow]);

  const fetchAttractions = async () => {
    setLoading(true);
    try {
      const params = {
        latitude: location?.latitude,
        longitude: location?.longitude,
        radius: radius,
        limit: 500
      };

      if (selectedType && selectedType !== 'all') {
        params.attraction_type = selectedType;
      }
      if (selectedDifficulty && selectedDifficulty !== 'any') {
        params.difficulty = selectedDifficulty;
      }
      if (selectedMood) {
        params.mood = selectedMood;
      }
      if (freeOnly) {
        params.free_only = true;
      }
      if (openNow) {
        params.open_now = true;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }

      const response = await axios.get(`${API_URL}/api/attractions`, { params });
      setAttractions(response.data);
    } catch (error) {
      console.error('Error fetching attractions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchAttractions();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedType('all');
    setSelectedDifficulty('any');
    setSelectedMood(null);
    setFreeOnly(false);
    setOpenNow(false);
  };

  const applyRadius = () => {
    updateRadius(localRadius);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="attractions-page">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <TreePine className="h-6 w-6" />
            </div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold">Parks & Attractions</h1>
          </div>
          <p className="text-white/80 max-w-2xl">
            Explore hiking trails, parks, landmarks, and outdoor spaces near you.
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
                  placeholder="Search parks & trails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-full"
                  data-testid="search-input"
                />
              </div>
            </form>

            {/* Type */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[160px] rounded-full" data-testid="type-select">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {ATTRACTION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Difficulty (for trails) */}
            <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
              <SelectTrigger className="w-[130px] rounded-full" data-testid="difficulty-select">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any Level</SelectItem>
                {DIFFICULTY_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Free Only */}
            <Button
              variant={freeOnly ? 'default' : 'outline'}
              onClick={() => setFreeOnly(!freeOnly)}
              className="rounded-full"
              data-testid="free-only-btn"
            >
              Free Entry
            </Button>

            {/* Mood Filters */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="rounded-full gap-2"
              data-testid="filters-btn"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>

            {/* Clear */}
            {(selectedType !== 'all' || selectedDifficulty !== 'any' || selectedMood || freeOnly || openNow) && (
              <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 p-4 bg-muted/50 rounded-xl animate-slide-up">
              <p className="text-sm font-medium mb-3">What are you looking for?</p>
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
                    max={100}
                    min={5}
                    step={5}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={applyRadius} className="rounded-full">
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-3 text-sm text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
            <span>
              {attractions.length} attraction{attractions.length !== 1 ? 's' : ''} found within {radius} miles
            </span>
            <span className="text-xs">
              Map data ©{' '}
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
              <div key={i} className="h-80 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : attractions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {attractions.map((attraction) => (
              <AttractionCard key={attraction.attraction_id} attraction={attraction} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <TreePine className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No attractions found</h3>
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

function AttractionCard({ attraction }) {
  const navigate = useNavigate();
  const typeIcons = {
    park: TreePine,
    hiking_trail: Mountain,
    landmark: Landmark,
    nature_reserve: TreePine,
    beach: Map,
    garden: TreePine,
    historic_site: Landmark,
  };

  const TypeIcon = typeIcons[attraction.attraction_type] || Map;
  const difficultyLevel = DIFFICULTY_LEVELS.find(d => d.value === attraction.difficulty_level);

  return (
    <Card
      className="group cursor-pointer overflow-hidden border-0 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 dark:border dark:border-white/10"
      data-testid={`attraction-card-${attraction.attraction_id}`}
      onClick={() => navigate(`/attractions/${attraction.attraction_id}`)}
    >
      <div className="relative h-52 overflow-hidden">
        <img
          src={attraction.image_url || 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800'}
          alt={attraction.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Type Badge */}
        <div className="absolute top-3 left-3">
          <Badge variant="secondary" className="backdrop-blur-sm bg-white/80 dark:bg-black/60 gap-1">
            <TypeIcon className="h-3 w-3" />
            {attraction.attraction_type.replace('_', ' ')}
          </Badge>
        </div>

        {/* Admission Badge — three-state: free, paid, unknown */}
        <div className="absolute top-3 right-3">
          {attraction.is_free === true && <Badge className="bg-accent">Free</Badge>}
          {attraction.is_free === false && <Badge variant="secondary">Admission</Badge>}
          {/* Unknown → no badge to avoid misinforming */}
        </div>
        
        {/* Difficulty Badge for Trails */}
        {difficultyLevel && (
          <div className="absolute bottom-3 left-3">
            <Badge className={`${difficultyLevel.color} text-white`}>
              {difficultyLevel.label}
            </Badge>
          </div>
        )}
        
        {/* Distance */}
        {attraction.distance !== undefined && (
          <div className="absolute bottom-3 right-3 bg-white/90 dark:bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium">
            {attraction.distance} mi
          </div>
        )}
      </div>
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-heading font-semibold text-lg group-hover:text-primary transition-colors">
            {attraction.name}
          </h3>
          {attraction.rating > 0 && (
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{attraction.rating}</span>
            </div>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {attraction.description}
        </p>
        
        <div className="flex items-center text-sm text-muted-foreground mb-2">
          <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="truncate">{attraction.city}, {attraction.state}</span>
        </div>
        
        {/* Trail Info */}
        {attraction.trail_length && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
            <span>{attraction.trail_length} miles</span>
            {attraction.estimated_duration && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {attraction.estimated_duration}
              </span>
            )}
          </div>
        )}
        
        {/* Amenities */}
        {attraction.amenities?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {attraction.amenities.slice(0, 4).map((amenity, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {amenity.replace('_', ' ')}
              </Badge>
            ))}
          </div>
        )}
        
        {/* Tips */}
        {attraction.tips && (
          <div className="mt-3 p-2 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Tip:</span> {attraction.tips.substring(0, 100)}...
            </p>
          </div>
        )}
        
        {/* Action */}
        <Button
          variant="default"
          size="sm"
          className="w-full mt-4 rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            window.open(
              `https://www.google.com/maps/search/?api=1&query=${attraction.latitude},${attraction.longitude}`,
              '_blank'
            );
          }}
        >
          <MapPin className="h-4 w-4 mr-2" />
          Get Directions
        </Button>
      </CardContent>
    </Card>
  );
}
