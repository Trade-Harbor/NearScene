import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Sparkles, Mail, MessageSquare, ArrowRight } from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';

/**
 * Pricing page during beta.
 *
 * The original Emergent-scaffolded version listed Free / Plus / Premium /
 * Business tiers with feature lists like "AI recommendations," "concierge
 * booking," "monthly $10 credit," etc — none of which actually exist.
 * Promising features we can't deliver risks user trust at launch.
 *
 * This stripped-down beta version is honest:
 *   1. Everything's free.
 *   2. Pricing comes after we know what users actually want.
 *   3. They can shape it by sending feedback.
 *
 * When the time comes to add real tiers, restore from git history and
 * trim feature lists to what's actually shipped.
 */
export default function PricingPage() {
  usePageTitle('Pricing');

  return (
    <div className="min-h-screen bg-background" data-testid="pricing-page">
      <div className="container mx-auto max-w-3xl px-4 md:px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            Beta · Free during launch
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4">
            Free during beta
          </h1>
          <p className="text-lg text-muted-foreground">
            Every feature is open to everyone right now. No paywalls, no upsells,
            no "premium" tier hiding the good stuff.
          </p>
        </div>

        <div className="bg-muted/30 rounded-2xl p-6 md:p-8 mb-10">
          <h2 className="font-heading text-xl font-semibold mb-3">
            Why no pricing yet?
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            LocalDrift is being built by one person and is brand new. Before
            charging anyone for anything, we want to know what's actually useful
            to you — what you'd happily pay for, what should stay free, and what
            doesn't belong in the app at all.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Once we have real signal from people using the app, we'll come back
            with a pricing model that reflects what's been built and what people
            actually value.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <div className="p-6 rounded-2xl border border-border bg-card">
            <MessageSquare className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-semibold mb-2">Have feedback?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              The Send Feedback button is on every page (bottom right). Tell us
              what's missing, what's broken, or what you'd pay for.
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-border bg-card">
            <Mail className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-semibold mb-2">Run a local business?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              We're talking with venues, restaurants, and event organizers about
              what would make LocalDrift useful to you. Reach out:{' '}
              <a href="mailto:business@localdrift.app" className="text-primary underline">
                business@localdrift.app
              </a>
            </p>
          </div>
        </div>

        <div className="text-center">
          <Button asChild size="lg" className="rounded-full px-8">
            <Link to="/">
              Start exploring
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
