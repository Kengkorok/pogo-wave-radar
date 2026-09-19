# Google Search indexing

The public app is https://kengkorok.github.io/pogo-wave-radar/ and GitHub Pages publishes the `docs/` folder.

The homepage contains a descriptive title, description, canonical URL, WebApplication structured data, social preview metadata and visible project context that is available without JavaScript. The app keeps the product name in both English and Bahasa Melayu page titles.

## Search Console (owner action)

1. Open https://search.google.com/search-console and select the URL-prefix property `https://kengkorok.github.io/pogo-wave-radar/`. If it is missing, add that exact URL-prefix property.
2. Verify ownership with the method shown by Google. An existing verification file, `docs/google3e23492e034fd017.html`, is already in the repository. Keep it; it may belong to an existing verified owner. Do not assume it verifies a different Google account.
3. In Sitemaps, submit `https://kengkorok.github.io/pogo-wave-radar/sitemap.xml`.
4. Inspect `https://kengkorok.github.io/pogo-wave-radar/`, run Test live URL, then Request indexing if it is eligible.
5. Check Page indexing / URL Inspection later for Google's reported status and any exclusion reason. Search results alone do not diagnose why a URL is absent.

This single-page app has one canonical URL. Tabs and language preferences are client-side state, not separate indexable pages. The sitemap therefore lists the homepage only, with no invented modification dates.

## robots.txt on GitHub Pages

Google reads `https://kengkorok.github.io/robots.txt` at the host root. A file at `/pogo-wave-radar/robots.txt` would not control crawling. Do not add a misleading project-level robots.txt. A missing host-root robots.txt (HTTP 404) does not by itself block Google. Root-level changes belong in the separate `kengkorok.github.io` repository if needed.

## Timing and limits

Requesting indexing does not guarantee inclusion or a particular ranking. Google says crawling can take a few days to a few weeks. Do not repeatedly request the same URL or use the retired sitemap ping endpoint.

- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt

The GitHub repository and the published app are separate URLs. This setup concerns the app; Google controls indexing of the github.com repository separately.
