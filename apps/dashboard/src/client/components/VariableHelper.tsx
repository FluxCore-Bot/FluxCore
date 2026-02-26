import { useState } from "react";
import type { Constants } from "../lib/schemas";

interface VariableHelperProps {
  eventType: string;
  constants: Constants;
}

export function VariableHelper({ eventType, constants }: VariableHelperProps) {
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const variables = constants.eventTypeVariables[eventType] ?? [];

  if (variables.length === 0) return null;

  const copyVariable = async (variable: string) => {
    await navigator.clipboard.writeText(variable);
    setCopiedVar(variable);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
        Available Variables
      </p>
      <div className="flex flex-wrap gap-1.5">
        {variables.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => copyVariable(v)}
            className={`rounded-full border px-2.5 py-0.5 font-mono text-xs transition ${
              copiedVar === v
                ? "border-success/50 bg-success/15 text-success"
                : "border-border bg-bg text-accent hover:border-accent hover:bg-accent/15"
            }`}
            title={constants.templateVariables[v] ?? v}
          >
            {copiedVar === v ? "Copied!" : v}
          </button>
        ))}
      </div>
    </div>
  );
}
