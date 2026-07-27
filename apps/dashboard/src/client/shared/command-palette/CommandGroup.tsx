import { useTranslation } from "react-i18next";
import { CommandRow } from "./CommandRow";
import type { Command, CommandGroup as Group } from "./types";

export function CommandGroup({
  group, query, activeId, optionId, onActivate, onHover,
}: {
  group: Group;
  query: string;
  activeId: string | null;
  optionId: (command: Command) => string;
  onActivate: (command: Command) => void;
  onHover: (command: Command) => void;
}) {
  const { t } = useTranslation();

  const hidden = group.total - group.commands.length;

  return (
    <>
      {/*
        role="presentation" keeps the header out of the option count that
        screen readers announce for the listbox, while leaving it visible.
      */}
      <li
        role="presentation"
        className="flex items-baseline justify-between px-3 pb-1 pt-3"
      >
        <span className="section-label text-text-muted">
          {t(`palette.group.${group.key}`)}
        </span>
        {hidden > 0 && (
          <span className="text-xs text-text-secondary">
            {t("palette.more", { total: hidden })}
          </span>
        )}
      </li>
      {group.commands.map((command) => (
        <CommandRow
          key={command.id}
          id={optionId(command)}
          command={command}
          query={query}
          active={optionId(command) === activeId}
          onActivate={() => onActivate(command)}
          onHover={() => onHover(command)}
        />
      ))}
    </>
  );
}
