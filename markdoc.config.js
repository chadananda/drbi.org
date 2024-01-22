import { defineMarkdocConfig, component } from '@astrojs/markdoc/config';

export default defineMarkdocConfig({
  tags: {
    'aside': {
      render: component('./src/components/article/Aside.astro'),
      attributes: {
        link: { type: String, required: false },
        linkText: { type: String, required: false },
      },
    },

    'hr': { // a few decorative hr options
      render: component('./src/components/article/HR.astro'),
      attributes: {
        type: { type: String, required: false },
      },
    },

    'related-resource': {
      render: component('./src/components/article/RelatedResource.astro'),
      attributes: {
        meta: { type: Object, required: true, default: {} },
        link: { type: String, required: false },
        type: { type: String, required: false },
        title: { type: String, required: false },
        description: { type: String, required: false }
      },
    },

    'book-quote': {
      render: component('./src/components/article/BookQuote.astro'),
      attributes: {
        meta: { type: Object, required: true, default: {} },
        bookLink: { type: String, required: true },
        bookTitle: { type: String, required: true },
        content: { type: String, required: true },
      },
    },

    'tldr': { // A summary block (TL;DR) to go at the top of the article
      render: component('./src/components/article/TLDR.astro'),
      attributes: {
        meta: { type: Object, required: true, default: {} },
      },
    },

    'author-bio': {
      render: component('./src/components/article/authorCard.astro'),
      attributes: {
        // meta: { type: Object, required: true, default: {} },
        // author: { type: Object, required: true, default: {} },
        slug: { type: String, required: true },
        size: { type: String, required: false, default: 'bio' },
      },
    },

    'video-player': {
      render: component('./src/components/article/VideoPlayer.astro'),
      attributes: {
        meta: { type: Object, required: true, default: {} },
        video: { type: Object, required: true, default: {} },
      },
    },

    'toc': {
      render: component('./src/components/article/TOC.astro'),
      attributes: {
        meta: { type: Object, required: false, default: {} },
        headings: { type: Array, required: true, default: [] },
      },
    },


    // the following generate structured data
    // structured data has more requirements:
    'podcast-player': {
      render: component('./src/components/article/PodcastPlayer.astro'),
      attributes: {
        meta: { type: Object, required: true, default: {} }, // contains article frontmatter
        podcast: { type: Object, required: true, default: {} }, // contains podcast frontmatter (in case the page has several)
      },
    },
  },
});
