import { useState } from "react";
import { useTranslation } from "react-i18next";
import { languages, isRtl } from "@fluxcore/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Check, ChevronDown, Search } from "lucide-react";
import { useAppDirection } from "../hooks/useDirection";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
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
          aria-label={currentLang?.name ?? t("labels.language")}
          className="h-8 w-35 justify-between border-border bg-surface-container text-xs"
        >
          <span translate="no" className="notranslate truncate">{currentLang?.name ?? t("labels.language")}</span>
          <ChevronDown className="ms-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-55 p-0" align="start">
        <div className="flex items-center border-b border-border px-2">
          <Search className="me-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          <input
            placeholder={t("language.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full bg-transparent ps-1 text-xs text-text outline-none placeholder:text-text-muted"
          />
        </div>
        <div dir="ltr" translate="no" className="notranslate max-h-[min(28rem,60vh)] overflow-y-auto p-1 [scrollbar-width:thin] [scrollbar-color:var(--color-outline-variant)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-outline-variant [&::-webkit-scrollbar-thumb:hover]:bg-outline">
          <div>
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-xs text-text-muted">
                {t("language.noResults")}
              </p>
            ) : (
              filtered.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelect(lang.code)}
                  className="group flex w-full cursor-pointer items-center rounded px-2 py-1.5 text-xs transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                >
                  <Check
                    className={`me-2 h-3.5 w-3.5 shrink-0 ${
                      i18n.language === lang.code ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <span className="me-2"><bdi>{lang.name}</bdi></span>
                  {lang.code !== "en" && (
                    <span dir="ltr" className="text-text-muted transition-colors group-hover:text-text">
                      ({lang.englishName})
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
