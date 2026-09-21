// Served at /robots.txt.
export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/api/'],
      },
    ],
    sitemap: 'https://rheumlens.org/sitemap.xml',
    host: 'https://rheumlens.org',
  };
}
