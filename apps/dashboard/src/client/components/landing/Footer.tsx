import { Icon } from "../Icon";

const footerLinks = [
  { label: "Documentation", href: "#" },
  { label: "Support", href: "#" },
  { label: "Privacy Policy", href: "#" },
  { label: "API", href: "#" },
  { label: "GitHub", href: "#" },
];

export function Footer() {
  return (
    <footer className="border-t border-outline-variant/10 bg-bg px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Icon name="bolt" className="text-accent" size={16} />
            <span className="font-bold tracking-tighter text-text">FluxCore</span>
          </div>
          <p className="text-xs text-text/40">
            &copy; {new Date().getFullYear()} FluxCore Technologies. All rights reserved.
          </p>
        </div>
        <nav className="flex flex-wrap justify-center gap-4 sm:gap-8">
          {footerLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-xs text-text/40 underline-offset-4 transition-colors hover:text-text hover:underline"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
