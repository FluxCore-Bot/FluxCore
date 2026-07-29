import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '@/lib/source';

// Static mode: the search index is pre-rendered into the export instead of
// being computed by a server on each request.
// https://fumadocs.dev/docs/headless/search/orama#static-export
export const revalidate = false;

export const { staticGET: GET } = createFromSource(source, {
  language: 'english',
});
