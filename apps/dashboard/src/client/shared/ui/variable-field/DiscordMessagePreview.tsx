import * as React from "react";
import type { PreviewRealData, VariableDescriptor } from "./types";
import { buildTokenValues } from "./registry";
import { resolveTemplatePreview } from "./resolvePreview";

interface DiscordEmbedInput {
  title?: string;
  description?: string;
  footer?: string;
  thumbnail?: string;
  color?: number;
}
interface DiscordMessagePreviewProps {
  variables: VariableDescriptor[];
  real: PreviewRealData;
  content?: string;
  embed?: DiscordEmbedInput;
}

function hexColor(color: number | undefined): string {
  if (color === undefined) return "#a3a6ff";
  return "#" + color.toString(16).padStart(6, "0");
}

export default function DiscordMessagePreview({ variables, real, content, embed }: DiscordMessagePreviewProps) {
  const values = React.useMemo(() => buildTokenValues(variables, real), [variables, real]);
  const resolve = React.useCallback((s?: string) => (s ? resolveTemplatePreview(s, values) : ""), [values]);

  const hasEmbed = !!(embed && (embed.title || embed.description || embed.footer || embed.thumbnail));
  const resolvedContent = resolve(content);
  const thumb = resolve(embed?.thumbnail);

  return (
    <div className="rounded-md bg-surface-container p-3 text-sm">
      <div className="flex gap-3">
        <img src={real.userAvatar} alt="" className="size-10 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-text">{real.userName}</span>
            <span className="text-[10px] text-text-muted">today</span>
          </div>
          {resolvedContent && <p className="whitespace-pre-wrap wrap-break-word text-text">{resolvedContent}</p>}
          {hasEmbed && (
            <div
              className="mt-1 flex gap-3 rounded-sm bg-surface-lowest p-3"
              style={{ borderInlineStart: `4px solid ${hexColor(embed?.color)}` }}
            >
              <div className="min-w-0 flex-1">
                {embed?.title && <div className="font-semibold text-text">{resolve(embed.title)}</div>}
                {embed?.description && (
                  <div className="whitespace-pre-wrap wrap-break-word text-text-muted">{resolve(embed.description)}</div>
                )}
                {embed?.footer && <div className="mt-2 text-[10px] text-text-muted">{resolve(embed.footer)}</div>}
              </div>
              {thumb && /^https?:\/\//.test(thumb) && <img src={thumb} alt="" className="size-16 rounded-sm object-cover" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
