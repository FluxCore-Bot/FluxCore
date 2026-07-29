'use client';

import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search';
import { useDocsSearch } from 'fumadocs-core/search/client';
import { oramaStaticClient } from 'fumadocs-core/search/client/orama-static';

/**
 * Static search client. The search index is pre-rendered at build time by
 * `app/api/search/route.ts` (`staticGET`) and downloaded by the browser, so
 * no search server is required.
 *
 * NOTE: fumadocs-core 16.13.0 exports `oramaStaticClient`. The docs site
 * currently documents this as `staticClient`, which is an unreleased rename
 * on the `dev` branch — the installed package is authoritative here.
 */
export default function StaticSearchDialog(props: SharedProps) {
  const { search, setSearch, query } = useDocsSearch({
    // Downloads the exported index from `/api/search` (StaticOptions default).
    client: oramaStaticClient(),
  });

  return (
    <SearchDialog
      search={search}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data !== 'empty' ? query.data : null} />
      </SearchDialogContent>
    </SearchDialog>
  );
}
