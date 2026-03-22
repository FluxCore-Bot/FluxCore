import { SettingsForm } from "../../../components/SettingsForm";
import { PageHeader } from "../../../components/PageHeader";

export function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        subtitle="Configure global action system settings for your server."
      />
      <SettingsForm />
    </div>
  );
}
