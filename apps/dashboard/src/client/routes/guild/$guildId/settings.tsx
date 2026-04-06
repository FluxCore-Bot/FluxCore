import { useTranslation } from "react-i18next";
import { SettingsForm } from "../../../features/settings/components/SettingsForm";
import { PageHeader } from "../../../shared/components/PageHeader";

export function SettingsPage() {
  const { t } = useTranslation("settings");

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <SettingsForm />
    </div>
  );
}
