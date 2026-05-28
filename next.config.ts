import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas'],
  // pdfjs-dist importa pdf.worker.mjs dinámicamente (fake worker en Node), y el
  // rastreador de archivos no lo detecta. Lo incluimos a la fuerza en la función.
  outputFileTracingIncludes: {
    '/api/analizar': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
  },
};

export default nextConfig;
