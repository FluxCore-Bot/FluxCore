import { SettingsForm } from "../../../components/SettingsForm";

export function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-text-muted">Configure global action system settings for your server.</p>
      </div>
      <SettingsForm />
    </div>
  );
}
