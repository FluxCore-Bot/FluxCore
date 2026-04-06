import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Icon } from "../../../../shared/components/Icon";

function AddActionNodeComponent({ data }: NodeProps) {
  const { onAdd } = data as { onAdd?: () => void; [key: string]: unknown };

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-secondary/30 !bg-surface-high"
      />
      <div
        onClick={onAdd}
        className="flex min-w-[200px] cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-outline-variant/20 px-4 py-3 transition-all hover:border-accent/40 hover:bg-accent/5"
      >
        <Icon name="add_circle" size={20} className="text-text-muted" />
        <span className="text-sm text-text-muted">Add Action</span>
      </div>
    </>
  );
}

export const AddActionNode = memo(AddActionNodeComponent);
