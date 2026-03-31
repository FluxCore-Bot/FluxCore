import { useTranslation } from "react-i18next";
import { SettingsForm } from "../../../components/SettingsForm";
import { PageHeader } from "../../../components/PageHeader";

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
