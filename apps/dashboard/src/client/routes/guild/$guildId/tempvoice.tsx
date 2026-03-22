import { TempVoiceForm } from "../../../components/TempVoiceForm";
import { PageHeader } from "../../../components/PageHeader";

export function TempVoicePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        label="Management Hub"
        title="Temporary Voice Channels"
        subtitle="Configure hubs that allow users to create their own ephemeral voice channels upon joining."
      />
      <TempVoiceForm />
    </div>
  );
}
