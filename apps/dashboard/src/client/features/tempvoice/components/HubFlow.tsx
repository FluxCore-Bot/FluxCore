import type { ReactNode } from "react";
import { Label } from "../../../shared/ui/label";
import { cn } from "../../../shared/lib/utils";

export interface HubFlowProps {
  children: ReactNode;
  /** Marks this flow as the empty state's worked example rather than a real,
   *  editable hub. Exposed as `data-example` for example-scoped styling. */
  example?: boolean;
  className?: string;
}

export function HubFlow({ children, example, className }: HubFlowProps) {
  return (
    // Deliberately NOT `inert`. The example contains no focusable node — every
    // step renders a <p> plus ChannelChip <span>s — so `inert` bought nothing
    // for keyboard users while stripping the whole worked example from the
    // accessibility tree. That left screen-reader users with a caption ending
    // in a colon followed by nothing, on the very page whose purpose is to
    // teach the mechanic. Non-interactivity is signalled structurally instead:
    // dashed chips (see ChannelChip's `variant`), no controls, no focus ring.
    <ol className={cn("m-0 list-none p-0", className)} data-example={example ? "true" : undefined}>
      {children}
    </ol>
  );
}

export interface HubFlowStepProps {
  n: number;
  label: string;
  /** Id of the control this step labels. Omit for steps with no control. */
  htmlFor?: string;
  /** Suppresses the connecting rail on the final step. */
  last?: boolean;
  children?: ReactNode;
}

export function HubFlowStep({ n, label, htmlFor, last, children }: HubFlowStepProps) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && (
        <span
          aria-hidden="true"
          className="absolute top-7 bottom-0 start-3 w-px -translate-x-1/2 bg-border rtl:translate-x-1/2"
        />
      )}
      <span
        aria-hidden="true"
        className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-text-muted">
            {label}
          </Label>
        ) : (
          <p className="text-sm text-text-muted">{label}</p>
        )}
        {children ? <div className="mt-1.5">{children}</div> : null}
      </div>
    </li>
  );
}
