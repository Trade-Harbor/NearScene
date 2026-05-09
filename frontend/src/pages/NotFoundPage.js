import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Compass, ArrowLeft } from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';

export default function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-primary/10 text-primary mb-6">
          <Compass className="h-10 w-10" />
        </div>
        <h1 className="font-heading text-5xl font-bold mb-3">404</h1>
        <h2 className="font-heading text-xl font-semibold mb-3">
          Drifted off the map
        </h2>
        <p className="text-muted-foreground mb-8">
          We couldn't find that page. It may have moved, or the link might be
          mistyped.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to LocalDrift
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full">
            <Link to="/events">Browse events</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
