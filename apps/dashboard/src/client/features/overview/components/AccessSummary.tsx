import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card } from "../../../shared/ui/card";
import { Badge } from "../../../shared/ui/badge";
import { Icon } from "../../../shared/components/Icon";
import { navItems } from "../../../shared/lib/navigation";
import { usePermissions } from "../../permissions/hooks/usePermissions";

/**
 * Landing content for someone whose access is delegated: overview analytics are
 * permission-gated, so without them the page would otherwise be empty. Shows
 * what they can actually open, and which dashboard roles got them here.
 */
export function AccessSummary({ guildId }: { guildId: string }) {
  const { t } = useTranslation(["overview", "common"]);
  const { can, roles } = usePermissions(guildId);

  const available = navItems.filter(
    (item) => item.permission && can(item.permission),
  );

  return (
    <Card className="p-6" data-testid="access-summary">
      <h2 className="text-lg font-bold tracking-tight">{t("overview:access.title")}</h2>
      <p className="mt-1 text-sm text-text-muted">{t("overview:access.subtitle")}</p>

      {roles.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1">
          {roles.map((role) => (
            <Badge key={role.id} variant="outline">
              {role.name}
            </Badge>
          ))}
        </div>
      )}

      {available.length === 0 ? (
        <p className="mt-6 text-sm text-text-muted">{t("overview:access.empty")}</p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {available.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                params={{ guildId }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-surface-high"
              >
                <Icon name={item.icon} size={18} />
                {t(`common:${item.i18nKey}`)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
