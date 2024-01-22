// astro.config.js
import { defineConfig, sharpImageService, passthroughImageService } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import vercel from '@astrojs/vercel/serverless';
import svelte from '@astrojs/svelte';
import markdoc from "@astrojs/markdoc";
import brand from './src/data/branding.json'; // for branding
import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
  site: brand.url,
  output: 'hybrid',
  adapter: vercel(),
  integrations: [tailwind(), mdx(), sitemap(), svelte(), markdoc({ allowHTML: true }), icon()],
  experimental: {
    // contentCollectionCache: true,
  },
});