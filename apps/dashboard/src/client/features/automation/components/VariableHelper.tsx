import { useState } from "react";
import { Badge } from "../../../shared/ui/badge";
import { Card } from "../../../shared/ui/card";
import type { Constants } from "../../../shared/lib/schemas";

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
    <Card className="bg-surface-high p-3">
      <p className="mb-2 font-label text-xs font-medium uppercase tracking-wide text-text-muted">
        Available Variables
      </p>
      <div className="flex flex-wrap gap-1.5">
        {variables.map((v) => (
          <Badge
            key={v}
            variant={copiedVar === v ? "success" : "secondary"}
            className="cursor-pointer font-mono transition hover:bg-accent/15 hover:text-accent"
            onClick={() => copyVariable(v)}
            title={constants.templateVariables[v] ?? v}
          >
            {copiedVar === v ? "Copied!" : v}
          </Badge>
        ))}
      </div>
    </Card>
  );
}
