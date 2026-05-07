import { useEffect } from 'react';

/**
 * Set the document title for a route. Restores the default site title
 * when the component unmounts so navigating back to a page without an
 * explicit title doesn't leave the previous one stuck.
 *
 * Usage in a page component:
 *   usePageTitle('Events Near Wilmington, NC');
 *
 * For dynamic titles (event detail page, restaurant detail, etc.) pass
 * the dynamic string and it'll update when the value changes.
 */
const DEFAULT_TITLE = 'LocalDrift — Local discovery for Wilmington, NC';

export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · LocalDrift` : DEFAULT_TITLE;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}
