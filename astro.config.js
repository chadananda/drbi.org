// astro.config.js
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import cloudflare from '@astrojs/cloudflare';
import { readFileSync, writeFileSync } from 'node:fs';

import remarkAttr from 'remark-attr';

// import { onRequest as authMiddleware } from './src/middleware.ts';
// import vercel from '@astrojs/vercel/static';
// import { getSitemapArticles } from './src/utils/utils.js';

import svelte from '@astrojs/svelte';
import markdoc from "@astrojs/markdoc";
import site from './src/data/site.json'; // for branding
// import db from "@astrojs/db"; // Removed - migrated to Content Layer API
// import icon from "astro-icon";
// import minify from 'astro-min';
// import compress from "astro-compress";
// import partytown from '@astrojs/partytown';
// import react from "@astrojs/react";
const isDev = process.env.NODE_ENV === 'development';
// Workers AI has no local emulator, so *declaring* the AI binding makes the Cloudflare adapter open a
// REMOTE proxy session at `astro dev` startup — which needs a Cloudflare login and otherwise crashes
// the dev server ("exited before becoming ready"). AI is only used by admin/background features
// (media alt-text, meal summaries), all of which already no-op when the binding is absent. So for
// local dev we point platformProxy at a copy of wrangler.jsonc with the AI binding stripped, leaving
// the real config untouched for build/deploy. Lets contributors run the site with zero CF credentials.
function devPlatformConfigPath() {
  const cfg = JSON.parse(
    readFileSync('./wrangler.jsonc', 'utf8')
      .replace(/^\s*\/\/.*$/gm, '') // drop full-line // comments (jsonc → json)
      .replace(/,(\s*[}\]])/g, '$1'), // drop trailing commas
  );
  delete cfg.ai;
  const path = './.wrangler.dev.json';
  writeFileSync(path, JSON.stringify(cfg, null, 2));
  return path;
}
const siteMapConfig = {
  // Exclude admin, API, and login routes — include everything else
  filter: url => {
    const pathname = new URL(url).pathname;
    return !pathname.startsWith('/admin') && !pathname.startsWith('/api') && pathname !== '/login';
  }
  // additionalSitemaps: [ site.url + '/sitemap_articles.xml' ]
};
const minifyConfig = {
  do_not_minify_doctype: true,
  ensure_spec_compliant_unquoted_attribute_values: true,
  keep_closing_tags: true,
  keep_comments: false,
  keep_html_and_head_opening_tags: true,
  keep_input_type_text_attr: false,
  keep_spaces_between_attributes: true,
  keep_ssi_comments: false,
  minify_css: true,
  minify_js: true,
  preserve_brace_template_syntax: false,
  preserve_chevron_percent_template_syntax: false,
  remove_bangs: false,
  remove_processing_instructions: false
};


// debug test
// this works correctly
// console.log(md.render('![Test Image](/path/to/image.jpg){.test-class}'));  // Debug line



// https://astro.build/config
export default defineConfig({
  server: { port: 4850 }, // pinned dev port for drbi.org (kept clear of Astro's default 4321)
  devToolbar: {
    enabled: false
  },
  // this does not seem to apply markdownId attrs to our .md files
  // markdown: {
  //   remarkPlugins: [remarkAttr],
  // },
  output: 'server', // SSR by default (DB access at request time via D1 binding); truly static pages set prerender=true
  site: site.url,
  adapter: cloudflare({
    // local D1/R2/KV bindings during astro dev; in dev, strip the AI binding (see above)
    platformProxy: { enabled: true, configPath: isDev ? devPlatformConfigPath() : undefined },
    imageService: 'compile',
  }),
  integrations: [
    // { hooks: { 'astro:server:setup': ({ app }) => {  app.use(authMiddleware);  },}, },
    mdx(),
    sitemap(siteMapConfig),
    svelte(),
    markdoc({  allowHTML: true }),
    // db integration removed - now using Content Layer API
  ],

  routes: [
    {
      src: '/(.*)',
      dest: '/index.html',
    },
  ],
  prefetch: {
    defaultStrategy: 'hover',
    prefetchAll: false,
  },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
			exclude: ["oslo"]
		},
    build: {
      // minify: false,
    },

    logLevel: 'info',
    server: {
      watch: {
        ignored: ['**/node_modules/**', '**/.vscode/**', '**/.vercel/**', '**/dist/**', '**/public/**', '**/.astro/**', '.env', '.git', '.DS_Store', '.aider.chat.history.md', '.aider*','src/content/topics/*', 'src/content/categories/*', 'src/content/faqs/*',
        ],
        // Explicitly watch content JSON files
        include: ['src/content/events/**/*.json', 'src/content/**/*.md']
      },
      logLevel: 'info'
    }
  }
});