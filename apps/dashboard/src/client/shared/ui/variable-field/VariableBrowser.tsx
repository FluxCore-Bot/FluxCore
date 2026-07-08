import * as React from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverTrigger, PopoverContent } from "../popover";
import { Button } from "../button";
import { Input } from "../input";
import { ScrollArea } from "../scroll-area";
import { Icon } from "../../components/Icon";
import type { VariableDescriptor } from "./types";
import { filterByQuery } from "./filterVariables";

interface VariableBrowserProps {
  variables: VariableDescriptor[];
  onInsert: (token: string) => void;
  label?: string;
}

export default function VariableBrowser({ variables, onInsert, label }: VariableBrowserProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const matches = React.useMemo(() => filterByQuery(variables, query), [variables, query]);

  function pick(token: string) {
    onInsert(token);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="gap-1 text-xs">
          <Icon name="add" className="size-3.5" />
          {label ?? t("variableField.insert")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <Input
          type="search"
          role="searchbox"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("variableField.search")}
          className="mb-2"
        />
        <ScrollArea className="max-h-64">
          <ul className="space-y-0.5">
            {matches.length === 0 && (
              <li className="px-2 py-3 text-center text-xs text-text-muted">
                {t("variableField.noMatches")}
              </li>
            )}
            {matches.map((m) => (
              <li key={m.token}>
                <button
                  type="button"
                  onClick={() => pick(m.token)}
                  className="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent/10"
                >
                  <span className="font-mono text-accent">{m.token}</span>
                  <span className="truncate text-xs text-text-muted">
                    {m.description ?? (m.labelKey ? t(m.labelKey) : "")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
