const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { webpack }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /@react-native-async-storage\/async-storage/,
        path.resolve(__dirname, 'src/lib/mock-stub.js')
      )
    );
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /pino-pretty/,
        path.resolve(__dirname, 'src/lib/mock-stub.js')
      )
    );
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

module.exports = nextConfig;
