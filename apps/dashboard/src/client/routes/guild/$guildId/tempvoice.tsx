import { TempVoiceForm } from "../../../components/TempVoiceForm";

export function TempVoicePage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="font-label text-[10px] font-bold uppercase tracking-widest text-accent">Management Hub</p>
        <h2 className="text-3xl font-bold tracking-tight">Temporary Voice Channels</h2>
        <p className="mt-1 text-sm text-text-muted">Configure hubs that allow users to create their own ephemeral voice channels upon joining.</p>
      </div>
      <TempVoiceForm />
    </div>
  );
}
