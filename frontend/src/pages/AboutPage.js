import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Utensils, Truck, TreePine, Newspaper, Users, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background" data-testid="about-page">
      <div className="container mx-auto max-w-3xl px-4 md:px-6 py-12">
        <Button variant="ghost" size="sm" className="mb-6" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to NearScene
          </Link>
        </Button>

        <h1 className="font-heading text-4xl font-bold mb-2">About NearScene</h1>
        <p className="text-muted-foreground mb-8">
          A local-discovery app for Wilmington, NC — currently in beta.
        </p>

        <section className="mb-8">
          <h2 className="font-heading text-2xl font-semibold mb-3">What it is</h2>
          <p className="text-muted-foreground leading-relaxed">
            NearScene pulls together everything happening near you into one place — concerts
            and sporting events, restaurants and food trucks, beaches and parks, local news
            and a community forum — instead of jumping between Ticketmaster, Yelp, Facebook
            events, and a dozen other places.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-heading text-2xl font-semibold mb-3">What's in it today</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl">
              <Calendar className="h-5 w-5 mt-0.5 text-indigo-500 shrink-0" />
              <div>
                <p className="font-medium">~170 events</p>
                <p className="text-muted-foreground text-xs">Concerts, sports, theater, festivals, farmer markets</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl">
              <Utensils className="h-5 w-5 mt-0.5 text-orange-500 shrink-0" />
              <div>
                <p className="font-medium">~310 restaurants</p>
                <p className="text-muted-foreground text-xs">Local favorites + chains, with a toggle to choose</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl">
              <Truck className="h-5 w-5 mt-0.5 text-amber-500 shrink-0" />
              <div>
                <p className="font-medium">Local food trucks</p>
                <p className="text-muted-foreground text-xs">Pulled in by category from Yelp</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl">
              <TreePine className="h-5 w-5 mt-0.5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-medium">~300 attractions</p>
                <p className="text-muted-foreground text-xs">Parks, beaches, museums, landmarks, trails</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl">
              <Newspaper className="h-5 w-5 mt-0.5 text-violet-500 shrink-0" />
              <div>
                <p className="font-medium">Local news</p>
                <p className="text-muted-foreground text-xs">Aggregated daily from area outlets</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl">
              <Users className="h-5 w-5 mt-0.5 text-pink-500 shrink-0" />
              <div>
                <p className="font-medium">Community forum</p>
                <p className="text-muted-foreground text-xs">Recommendations, questions, meetups</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="font-heading text-2xl font-semibold mb-3">Why beta</h2>
          <p className="text-muted-foreground leading-relaxed">
            NearScene is being built by one person and is genuinely new — this is the
            first time it's been shared publicly. Everything is free during the beta
            because the goal is to figure out whether real people in Wilmington find it
            useful before adding any monetization. Your feedback shapes what gets built next.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-heading text-2xl font-semibold mb-3">How feedback works</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            There's a <strong>Send Feedback</strong> button on every page (look in the
            bottom-right corner). Things that help most:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Bugs you ran into — even tiny ones</li>
            <li>Things you wish were here that aren't</li>
            <li>Local events, food trucks, or venues we're missing</li>
            <li>What confused you the first time you opened the site</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-heading text-2xl font-semibold mb-3">Where the data comes from</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            NearScene aggregates publicly available data from:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground text-sm">
            <li><strong>Ticketmaster Discovery API</strong> — concerts, sports, theater</li>
            <li><strong>SeatGeek API</strong> — additional ticketed events</li>
            <li><strong>Yelp Fusion API</strong> — restaurants, food trucks, businesses</li>
            <li><strong>OpenStreetMap (Overpass API)</strong> — parks, beaches, museums, landmarks</li>
            <li><strong>Google News RSS</strong> — local news headlines</li>
            <li><strong>Users like you</strong> — community posts and submitted events</li>
          </ul>
        </section>

        <section className="mb-8 p-6 bg-muted/30 rounded-xl">
          <h2 className="font-heading text-xl font-semibold mb-2 flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Got feedback or want to chat?
          </h2>
          <p className="text-muted-foreground text-sm mb-3">
            Click the floating Send Feedback button on any page, or email{' '}
            <a href="mailto:steinackerr@gmail.com" className="text-primary underline">
              steinackerr@gmail.com
            </a>.
          </p>
          <p className="text-xs text-muted-foreground">
            Built by Rob Steinacker · Wilmington, NC · 2026
          </p>
        </section>
      </div>
    </div>
  );
}
