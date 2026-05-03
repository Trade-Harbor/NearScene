import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LocationProvider } from "./context/LocationContext";
import { Layout } from "./components/Layout";
import { Toaster } from "./components/ui/sonner";

// Pages
import HomePage from "./pages/HomePage";
import EventsPage from "./pages/EventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import FoodTrucksPage from "./pages/FoodTrucksPage";
import RestaurantsPage from "./pages/RestaurantsPage";
import RestaurantDetailPage from "./pages/RestaurantDetailPage";
import AttractionsPage from "./pages/AttractionsPage";
import CommunityPage from "./pages/CommunityPage";
import CreateEventPage from "./pages/CreateEventPage";
import DashboardPage from "./pages/DashboardPage";
import TicketSuccessPage from "./pages/TicketSuccessPage";
import PricingPage from "./pages/PricingPage";
import FlashDealsPage from "./pages/FlashDealsPage";
import LoginPage, { AuthCallback } from "./pages/AuthPages";

// App Router
function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/events/:eventId" element={<EventDetailPage />} />
              <Route path="/food-trucks" element={<FoodTrucksPage />} />
              <Route path="/restaurants" element={<RestaurantsPage />} />
              <Route path="/restaurants/:restaurantId" element={<RestaurantDetailPage />} />
              <Route path="/attractions" element={<AttractionsPage />} />
              <Route path="/community" element={<CommunityPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/flash-deals" element={<FlashDealsPage />} />
              <Route path="/create-event" element={<CreateEventPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/my-events" element={<DashboardPage />} />
              <Route path="/my-tickets" element={<DashboardPage />} />
              <Route path="/tickets/success" element={<TicketSuccessPage />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <LocationProvider>
              <AppRouter />
              <Toaster position="top-right" richColors />
            </LocationProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </div>
  );
}

export default App;
