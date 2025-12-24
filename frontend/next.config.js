/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Optimizations removed - SWC is default in Next.js 16
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  
  // Experimental features for better performance
  experimental: {
    // Removed lucide-react from optimizePackageImports to fix module resolution
    optimizePackageImports: ['framer-motion'],
  },
  
  // Webpack config for better bundle size
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    // Fix for lucide-react ES module resolution
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
    };
    
    // Ensure proper resolution of ES modules with .js extension
    if (!config.resolve.fullySpecified) {
      config.resolve.fullySpecified = false;
    }
    
    return config;
  },
  
  // Turbopack config to silence error when using webpack config
  turbopack: {},
};

module.exports = nextConfig;

