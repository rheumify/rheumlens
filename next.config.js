/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'dl.airtable.com' },
      { protocol: 'https', hostname: 'v5.airtableusercontent.com' },
    ],
  },
};
module.exports = nextConfig;
