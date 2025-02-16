// astro.config.js
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import vercel from '@astrojs/vercel';

import remarkAttr from 'remark-attr';

// import { onRequest as authMiddleware } from './src/middleware.ts';
// import vercel from '@astrojs/vercel/static';
// import { getSitemapArticles } from './src/utils/utils.js';

import svelte from '@astrojs/svelte';
import markdoc from "@astrojs/markdoc";
import site from './src/data/site.json'; // for branding
import db from "@astrojs/db";
// import icon from "astro-icon";
// import minify from 'astro-min';
// import compress from "astro-compress";
// import partytown from '@astrojs/partytown';
// import react from "@astrojs/react";
const isDev = process.env.NODE_ENV === 'development';
const siteMapConfig = {
  filter: url => {
    // Define the base paths to include in the sitemap
    const includedBasePaths = ['/', '/about/', '/contact/', '/privacy/'];
    // Define the directory paths to include in the sitemap
    const includedDirectories = ['/topics/', '/categories/', '/authors/'];
    const pathname = new URL(url).pathname;
    return includedBasePaths.includes(pathname) || includedDirectories.some(dir => pathname.startsWith(dir));
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
  // this does not seem to apply markdownId attrs to our .md files
  // markdown: {
  //   remarkPlugins: [remarkAttr],
  // },
  output: 'static',
  site: site.url,
  adapter: vercel({
    imageService: false,
    webAnalytics: { enabled: true }
  }),
  integrations: [tailwind(),
    // { hooks: { 'astro:server:setup': ({ app }) => {  app.use(authMiddleware);  },}, },
  mdx(),
  sitemap(siteMapConfig),
  svelte(),
  markdoc({  allowHTML: true }),
  db(),
  //  icon(),
  //  compress(),
  // minify(minifyConfig),
  // partytown()
  // react(),
  // db()
  ],

  routes: [
    {
      src: '/(.*)',
      dest: '/index.html',
    },
  ],
  prefetch: {
    defaultStrategy: 'viewport',
    prefetchAll: !isDev,
  },
  vite: {
    optimizeDeps: {
			exclude: ["oslo", "astro:db"]
		},
    build: {
      // minify: false,
    },

    logLevel: 'info',
    server: {
      watch: {
        ignored: ['**/node_modules/**', '**/.vscode/**', '**/.vercel/**', '**/dist/**', '**/public/**', '**/.astro/**', '.env', '.git', '.DS_Store', '.aider.chat.history.md', '.aider*','src/content/topics/*', 'src/content/categories/*', 'src/content/faqs/*',
        ]
      },
      logLevel: 'info'
    }
  }
});