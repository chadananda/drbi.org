/// <reference path="../.astro/db-types.d.ts" />
/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly SITE_ADMIN_EMAIL: string;
  readonly SITE_ADMIN_PASS: string;
  readonly PRIVATE_JWT_SECRET: string;
  readonly APP_ENV: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
