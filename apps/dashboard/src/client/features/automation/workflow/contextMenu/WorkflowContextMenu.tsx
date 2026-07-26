import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../../shared/ui/dropdown-menu";
import { Icon } from "../../../../shared/components/Icon";
import type { ContextMenuSection } from "./types";

export interface WorkflowContextMenuProps {
  open: boolean;
  /** Viewport coordinates of the cursor (or of the focused node, for keyboard opens). */
  x: number;
  y: number;
  ariaLabel: string;
  sections: ContextMenuSection[];
  onClose: () => void;
  /**
   * Send focus back where the menu was opened from. The caller owns which
   * element that is (and whether it still exists); this component only decides
   * when to ask, so it never has to reach into the DOM itself.
   */
  onRestoreFocus: () => void;
}

/**
 * A context menu for the workflow canvas, built on the shared DropdownMenu and
 * anchored to a zero-size element at the cursor. Radix owns keyboard
 * navigation, typeahead, and dismissal. Focus restoration is ours — see
 * `onCloseAutoFocus` below for why Radix's cannot work with this anchor.
 */
export function WorkflowContextMenu({
  open,
  x,
  y,
  ariaLabel,
  sections,
  onClose,
  onRestoreFocus,
}: WorkflowContextMenuProps) {
  const { t, i18n } = useTranslation(["rules", "common"]);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      // The canvas container is force-dir="ltr" for React Flow, so the menu
      // has to opt back into the document direction. Radix reads `dir` from
      // the root and forwards it as the actual DOM attribute on the content
      // element — Content itself doesn't accept a `dir` prop.
      dir={i18n.dir()}
    >
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden="true"
          data-testid="workflow-context-menu-anchor"
          style={{ position: "fixed", left: x, top: y, width: 0, height: 0 }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        aria-label={ariaLabel}
        // Radix defaults aria-labelledby to the trigger's id, which would win
        // over aria-label per the accname algorithm. Our trigger is an empty,
        // aria-hidden anchor span, so that default resolves to no name at
        // all — clear it so aria-label is the sole name source.
        aria-labelledby={undefined}
        // Radix's DropdownMenu restores focus to its trigger on close. Ours is
        // the zero-size, aria-hidden, non-focusable anchor span above, so that
        // restore is a no-op and focus falls to <body> — a keyboard user who
        // opened this with Shift+F10 would lose their place in the canvas.
        // Preventing the default suppresses both that trigger focus and
        // FocusScope's own restore, leaving the caller's handler in sole
        // charge (composeEventHandlers skips Radix's once we preventDefault).
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
        className="min-w-52"
      >
        {sections.map((section, sectionIndex) => (
          <Fragment key={section[0]?.id ?? sectionIndex}>
            {sectionIndex > 0 && <DropdownMenuSeparator />}
            {section.map((item) => (
              <DropdownMenuItem
                key={item.id}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={item.danger ? "text-danger focus:text-danger" : undefined}
              >
                <Icon
                  name={item.icon}
                  size={14}
                  className={item.danger ? "text-danger" : "text-text-muted"}
                />
                <span>{t(item.labelKey, item.labelParams)}</span>
                {item.shortcut && (
                  <kbd className="ms-auto rounded bg-surface-lowest px-1 py-0.5 font-mono text-[10px] text-text-muted">
                    {item.shortcut}
                  </kbd>
                )}
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
