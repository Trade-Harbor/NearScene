import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../context/AuthContext';
import { 
  Check, 
  Star, 
  Crown, 
  Building2,
  Sparkles,
  Zap,
  Shield,
  TrendingUp,
  Users,
  Calendar,
  Percent,
  ChevronRight
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PLAN_ICONS = {
  free: Star,
  basic: Zap,
  premium: Crown,
  business: Building2
};

const PLAN_COLORS = {
  free: 'from-slate-500 to-slate-600',
  basic: 'from-blue-500 to-indigo-600',
  premium: 'from-purple-500 to-pink-500',
  business: 'from-emerald-500 to-teal-600'
};

export default function PricingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
    if (isAuthenticated) {
      fetchCurrentSubscription();
    }
  }, [isAuthenticated]);

  const fetchPlans = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/subscriptions/plans`);
      setPlans(response.data.plans);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentSubscription = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/subscriptions/my-subscription`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentSubscription(response.data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  const handleSubscribe = async (planId) => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/pricing');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/subscriptions/subscribe`,
        null,
        {
          params: { plan_id: planId, billing_period: billingPeriod },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data.checkout_url) {
        window.location.href = response.data.checkout_url;
      }
    } catch (error) {
      console.error('Error subscribing:', error);
    }
  };

  const isCurrentPlan = (tier) => {
    return currentSubscription?.tier === tier;
  };

  return (
    <div className="min-h-screen bg-background" data-testid="pricing-page">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-primary/10 to-background py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/20">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Simple, Transparent Pricing
            </Badge>
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Choose Your{' '}
              <span className="gradient-brand-text">NearScene</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8">
              From casual explorers to business owners, we have a plan that fits your needs.
              Start free and upgrade anytime.
            </p>

            {/* Billing Toggle */}
            <div className="inline-flex items-center bg-muted rounded-full p-1 mb-8">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid="billing-monthly"
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  billingPeriod === 'yearly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid="billing-yearly"
              >
                Yearly
                <Badge variant="secondary" className="ml-2 bg-accent/20 text-accent">
                  Save 20%
                </Badge>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-12 -mt-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, index) => {
            const Icon = PLAN_ICONS[plan.tier] || Star;
            const colorClass = PLAN_COLORS[plan.tier] || PLAN_COLORS.free;
            const price = billingPeriod === 'yearly' ? plan.price_yearly : plan.price_monthly;
            const monthlyEquivalent = billingPeriod === 'yearly' ? (plan.price_yearly / 12).toFixed(2) : null;

            return (
              <Card
                key={plan.plan_id}
                className={`relative overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-xl ${
                  plan.tier === 'premium' ? 'border-2 border-primary ring-2 ring-primary/20' : ''
                } ${isCurrentPlan(plan.tier) ? 'ring-2 ring-accent' : ''}`}
                data-testid={`plan-${plan.tier}`}
              >
                {plan.tier === 'premium' && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-medium rounded-bl-lg">
                    Most Popular
                  </div>
                )}
                {isCurrentPlan(plan.tier) && (
                  <div className="absolute top-0 left-0 bg-accent text-white px-3 py-1 text-xs font-medium rounded-br-lg">
                    Current Plan
                  </div>
                )}
                
                <CardHeader className="pb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center mb-4`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                
                <CardContent className="pb-6">
                  <div className="mb-6">
                    {price === 0 ? (
                      <div className="text-4xl font-bold">Free</div>
                    ) : (
                      <>
                        <div className="text-4xl font-bold">
                          ${monthlyEquivalent || price}
                          <span className="text-lg font-normal text-muted-foreground">/mo</span>
                        </div>
                        {billingPeriod === 'yearly' && (
                          <p className="text-sm text-muted-foreground mt-1">
                            ${plan.price_yearly} billed annually
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                
                <CardFooter>
                  {plan.tier === 'free' ? (
                    <Button
                      variant="outline"
                      className="w-full rounded-full"
                      onClick={() => navigate('/register')}
                      disabled={isAuthenticated}
                      data-testid={`btn-${plan.tier}`}
                    >
                      {isAuthenticated ? 'Current Plan' : 'Get Started Free'}
                    </Button>
                  ) : (
                    <Button
                      className={`w-full rounded-full bg-gradient-to-r ${colorClass} hover:opacity-90`}
                      onClick={() => handleSubscribe(plan.plan_id)}
                      disabled={isCurrentPlan(plan.tier)}
                      data-testid={`btn-${plan.tier}`}
                    >
                      {isCurrentPlan(plan.tier) ? 'Current Plan' : 'Subscribe Now'}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Commission Section */}
      <section className="py-16 bg-muted/30" data-testid="commission-section">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-12">
            <Badge className="mb-4">
              <Percent className="h-3.5 w-3.5 mr-1.5" />
              Transparent Commission
            </Badge>
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
              Low Commission on Bookings
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We take a small percentage of ticket sales to keep the platform running.
              Business and Partner plans enjoy reduced rates.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="text-center p-6">
              <div className="text-4xl font-bold text-primary mb-2">5%</div>
              <div className="font-medium mb-1">Standard Commission</div>
              <p className="text-sm text-muted-foreground">For Free, Plus & Premium users</p>
            </Card>
            <Card className="text-center p-6 border-primary">
              <div className="text-4xl font-bold text-accent mb-2">3%</div>
              <div className="font-medium mb-1">Business Commission</div>
              <p className="text-sm text-muted-foreground">For Business subscribers</p>
            </Card>
            <Card className="text-center p-6">
              <div className="text-4xl font-bold text-emerald-500 mb-2">2%</div>
              <div className="font-medium mb-1">Partner Commission</div>
              <p className="text-sm text-muted-foreground">For Gold Partners</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Partnership Section */}
      <section className="py-16" data-testid="partnership-section">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-emerald-500/10 text-emerald-600">
                <Building2 className="h-3.5 w-3.5 mr-1.5" />
                For Businesses
              </Badge>
              <h2 className="font-heading text-3xl md:text-4xl font-bold mb-6">
                Partner With NearScene
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Reach thousands of local event-goers and grow your business with our partnership program.
                Get premium placement, reduced commissions, and marketing support.
              </p>
              
              <ul className="space-y-4 mb-8">
                {[
                  'Featured listings on homepage',
                  'Reduced commission rates (as low as 2%)',
                  'Dedicated account manager',
                  'Co-marketing opportunities',
                  'Advanced analytics dashboard'
                ].map((benefit, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <Check className="h-4 w-4 text-emerald-500" />
                    </div>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
              
              <Button
                size="lg"
                className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90"
                onClick={() => isAuthenticated ? navigate('/dashboard') : navigate('/register?type=business')}
                data-testid="partner-cta"
              >
                Become a Partner
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-6">
                <TrendingUp className="h-8 w-8 text-blue-500 mb-3" />
                <div className="text-2xl font-bold">50K+</div>
                <p className="text-sm text-muted-foreground">Monthly Active Users</p>
              </Card>
              <Card className="p-6">
                <Calendar className="h-8 w-8 text-purple-500 mb-3" />
                <div className="text-2xl font-bold">1,000+</div>
                <p className="text-sm text-muted-foreground">Events Monthly</p>
              </Card>
              <Card className="p-6">
                <Users className="h-8 w-8 text-pink-500 mb-3" />
                <div className="text-2xl font-bold">200+</div>
                <p className="text-sm text-muted-foreground">Business Partners</p>
              </Card>
              <Card className="p-6">
                <Shield className="h-8 w-8 text-emerald-500 mb-3" />
                <div className="text-2xl font-bold">99.9%</div>
                <p className="text-sm text-muted-foreground">Uptime SLA</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-muted/30" data-testid="faq-section">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-3xl">
          <h2 className="font-heading text-3xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-4">
            {[
              {
                q: "Can I upgrade or downgrade my plan anytime?",
                a: "Yes! You can change your plan at any time. Upgrades take effect immediately, while downgrades take effect at the start of your next billing cycle."
              },
              {
                q: "What happens to my saved events if I cancel?",
                a: "Your account and saved events remain intact. You'll simply revert to the Free plan with its feature limitations."
              },
              {
                q: "How does the commission work?",
                a: "We take a small percentage of each paid ticket sale processed through NearScene. This helps us maintain the platform and provide support. Business and Partner plans enjoy reduced rates."
              },
              {
                q: "Is there a contract or commitment?",
                a: "No long-term contracts! Monthly plans can be cancelled anytime. Yearly plans offer a discount and are billed upfront."
              }
            ].map((item, idx) => (
              <Card key={idx} className="p-6">
                <h3 className="font-semibold mb-2">{item.q}</h3>
                <p className="text-muted-foreground">{item.a}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16" data-testid="cta-section">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-4xl text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
            Ready to Discover Your Local Scene?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of users finding amazing local experiences every day.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 hover:opacity-90 px-8"
              onClick={() => navigate('/register')}
              data-testid="get-started-cta"
            >
              Get Started Free
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full px-8"
              onClick={() => navigate('/events')}
              data-testid="browse-events-cta"
            >
              Browse Events
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
