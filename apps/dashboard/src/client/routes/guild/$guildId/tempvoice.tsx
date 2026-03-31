import { useTranslation } from "react-i18next";
import { TempVoiceForm } from "../../../components/TempVoiceForm";
import { PageHeader } from "../../../components/PageHeader";

export function TempVoicePage() {
  const { t } = useTranslation("tempvoice");

  return (
    <div className="space-y-8">
      <PageHeader
        label={t("label")}
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <TempVoiceForm />
    </div>
  );
}
