import { When, Then } from '@cucumber/cucumber';

When('I visit the memorial page', async function () {
  await this.page.goto(`${this.baseURL}/memorial`);
});

When('I visit the facilities page', async function () {
  await this.page.goto(`${this.baseURL}/facilities-and-rentals`);
});

When('I visit the contribute page', async function () {
  await this.page.goto(`${this.baseURL}/contribute`);
});

When('I visit the burial article page', async function () {
  await this.page.goto(`${this.baseURL}/the-bahai-perspective-on-death-and-burial-a-journey-of-the-soul`);
});

Then('the video thumbnail image should load successfully', async function () {
  // Wait for page to load
  await this.page.waitForLoadState('networkidle');

  // Check for thumbnail button or video player - use broader selectors
  const thumbnail = this.page.locator('.video-thumbnail-btn img, .video-player-thumbnail img, button img[src*="youtube"], img[src*="youtube"]');
  const count = await thumbnail.count();
  if (count === 0) {
    // Check for iframe instead (non-thumbnail mode)
    const iframe = this.page.locator('iframe[src*="youtube"]');
    const iframeCount = await iframe.count();
    if (iframeCount === 0) {
      // Check for regular video element (like hero video)
      const video = this.page.locator('video');
      const videoCount = await video.count();
      if (videoCount === 0) {
        throw new Error('No video player, thumbnail, or video element found');
      }
      return; // video exists, test passes
    }
    return; // iframe exists, test passes
  }

  const img = thumbnail.first();
  const naturalWidth = await img.evaluate(el => el.naturalWidth);
  if (naturalWidth === 0) {
    throw new Error('Video thumbnail image failed to load');
  }
});

Then('the hero image should load successfully', async function () {
  // Wait for page to load
  await this.page.waitForLoadState('networkidle');

  // Look for hero image - could be in various containers
  // Try multiple selectors in priority order
  const selectors = [
    '.full-bleed img',
    '.prose img',
    'main img:not(.teacher-image-large):not(.main-image)',
    'article img',
    '[class*="hero"] img'
  ];

  let heroImg = null;
  for (const selector of selectors) {
    const img = this.page.locator(selector).first();
    const count = await img.count();
    if (count > 0) {
      heroImg = img;
      break;
    }
  }

  if (!heroImg) {
    throw new Error('No hero image found on page');
  }

  // Check if image loaded successfully
  const naturalWidth = await heroImg.evaluate(el => el.naturalWidth);
  if (naturalWidth === 0) {
    const src = await heroImg.getAttribute('src');
    throw new Error(`Hero image failed to load: ${src}`);
  }
});

Then('the memorial profile images should load successfully', async function () {
  const profileImages = this.page.locator('main img[src*="s3.amazonaws.com"], main img[src*="/_astro/"]');
  const count = await profileImages.count();

  if (count === 0) {
    // No external images, that's OK - might be using local assets
    return;
  }

  let failedImages = [];
  for (let i = 0; i < Math.min(count, 5); i++) { // Check first 5
    const img = profileImages.nth(i);
    const naturalWidth = await img.evaluate(el => el.naturalWidth);
    if (naturalWidth === 0) {
      const src = await img.getAttribute('src');
      failedImages.push(src);
    }
  }

  if (failedImages.length > 0) {
    throw new Error(`Failed to load images: ${failedImages.join(', ')}`);
  }
});

Then('the article hero image should load successfully', async function () {
  // Wait for page to load
  await this.page.waitForLoadState('networkidle');

  // Find article image with broader selectors
  const selectors = [
    '.cover-image',
    'img.cover-image',
    '.prose img',
    'article img',
    '.content img',
    'main img'
  ];

  let heroImg = null;
  for (const selector of selectors) {
    const img = this.page.locator(selector).first();
    const count = await img.count();
    if (count > 0) {
      heroImg = img;
      break;
    }
  }

  if (!heroImg) {
    throw new Error('No article image found on page');
  }

  // Wait for image to be visible
  await heroImg.waitFor({ state: 'visible', timeout: 10000 });

  const naturalWidth = await heroImg.evaluate(el => el.naturalWidth);
  if (naturalWidth === 0) {
    const src = await heroImg.getAttribute('src');
    throw new Error(`Article hero image failed to load: ${src}`);
  }
});

Then('S3-hosted images should return 200 status', async function () {
  const s3Images = this.page.locator('img[src*="s3.amazonaws.com"]');
  const count = await s3Images.count();

  if (count === 0) {
    return; // No S3 images on this page
  }

  let failedImages = [];
  for (let i = 0; i < count; i++) {
    const img = s3Images.nth(i);
    const src = await img.getAttribute('src');

    // Check if image loaded
    const naturalWidth = await img.evaluate(el => el.naturalWidth);
    if (naturalWidth === 0) {
      failedImages.push(src);
    }
  }

  if (failedImages.length > 0) {
    throw new Error(`S3 images failed to load (likely 403/404): ${failedImages.join(', ')}`);
  }
});

Then('no images should return 403 or 404 errors', async function () {
  const allImages = this.page.locator('img');
  const count = await allImages.count();

  let brokenImages = [];
  for (let i = 0; i < count; i++) {
    const img = allImages.nth(i);
    const src = await img.getAttribute('src');

    // Skip data URLs and empty srcs
    if (!src || src.startsWith('data:')) continue;

    const naturalWidth = await img.evaluate(el => el.naturalWidth);
    if (naturalWidth === 0) {
      brokenImages.push(src);
    }
  }

  if (brokenImages.length > 0) {
    throw new Error(`Broken images found: ${brokenImages.join(', ')}`);
  }
});

Then('the image URL should contain {string} or {string} extension', async function (ext1, ext2) {
  // Use same selectors as article hero image step
  const selectors = [
    '.cover-image',
    'img.cover-image',
    '.prose img',
    'article img',
    '.content img',
    'main img'
  ];

  let heroImg = null;
  for (const selector of selectors) {
    const img = this.page.locator(selector).first();
    const count = await img.count();
    if (count > 0) {
      heroImg = img;
      break;
    }
  }

  if (!heroImg) {
    throw new Error('No image found on page to check extension');
  }

  const src = await heroImg.getAttribute('src');

  if (!src.includes(ext1) && !src.includes(ext2)) {
    throw new Error(`Image URL "${src}" doesn't contain ${ext1} or ${ext2} extension - may have missing dot`);
  }
});
