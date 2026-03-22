import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface-low group-[.toaster]:text-text group-[.toaster]:shadow-2xl group-[.toaster]:glass-edge",
          description: "group-[.toast]:text-text-muted",
          actionButton:
            "group-[.toast]:bg-accent group-[.toast]:text-accent-hover",
          cancelButton:
            "group-[.toast]:bg-surface-high group-[.toast]:text-text-muted",
          success: "group-[.toaster]:text-success",
          error: "group-[.toaster]:text-danger",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
