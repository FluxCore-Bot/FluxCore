import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';

// Docs are served at the site root so that the static export emits
// `out/index.html`. See https://fumadocs.dev/docs/headless/source-api
export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
});
