// next.config.mjs
import NodePolyfillPlugin from 'node-polyfill-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';

const nextConfig = {
    reactStrictMode: true,
    webpack: (config) => {
        config.resolve.extensions.push('.ts', '.tsx');
        config.resolve.fallback = { fs: false };

        config.plugins.push(
            new NodePolyfillPlugin(),
            new CopyPlugin({
                patterns: [
                    {
                        from: 'node_modules/onnxruntime-web/dist/ort-wasm.wasm',
                        to: 'static/chunks/',
                    },
                    {
                        from: 'node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm',
                        to: 'static/chunks/',
                    },
                    {
                        from: 'model',
                        to: 'static/chunks/pages/model',
                    },
                ],
            })
        );

        return config;
    },
};

export default nextConfig;
