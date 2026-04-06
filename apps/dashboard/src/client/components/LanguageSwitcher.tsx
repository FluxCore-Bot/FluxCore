import { useState } from "react";
import { useTranslation } from "react-i18next";
import { languages, isRtl } from "@fluxcore/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Check, ChevronDown, Search } from "lucide-react";
import { useAppDirection } from "../lib/hooks/useDirection";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const { setDir } = useAppDirection();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const currentLang = languages.find((l) => l.code === i18n.language);

  const filtered = languages.filter((lang) => {
    const q = search.toLowerCase();
    return (
      lang.name.toLowerCase().includes(q) ||
      lang.englishName.toLowerCase().includes(q) ||
      lang.code.toLowerCase().includes(q)
    );
  });

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code);
    const dir = isRtl(code) ? "rtl" : "ltr";
    setDir(dir);
    document.documentElement.lang = code;
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={currentLang?.name ?? "Language"}
          className="h-8 w-35 justify-between border-border bg-surface-container text-xs"
        >
          <span className="truncate">{currentLang?.name ?? "English"}</span>
          <ChevronDown className="ms-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-55 p-0" align="start">
        <div className="flex items-center border-b border-border px-2">
          <Search className="me-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          <input
            placeholder="Search languages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full bg-transparent ps-1 text-xs text-text outline-none placeholder:text-text-muted"
          />
        </div>
        <ScrollArea className="max-h-64">
          <div className="p-1">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-xs text-text-muted">
                No language found
              </p>
            ) : (
              filtered.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelect(lang.code)}
                  className="flex w-full cursor-pointer items-center rounded px-2 py-1.5 text-xs hover:bg-surface-container-high"
                >
                  <Check
                    className={`me-2 h-3.5 w-3.5 shrink-0 ${
                      i18n.language === lang.code ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <span className="me-2">{lang.name}</span>
                  {lang.code !== "en" && (
                    <span className="text-text-muted">({lang.englishName})</span>
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
