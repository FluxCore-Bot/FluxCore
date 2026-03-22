import { MusicSettingsForm } from "../../../components/MusicSettingsForm";
import { MusicLibraryManager } from "../../../components/MusicLibraryManager";

export function MusicPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Music System</h2>
        <p className="mt-1 text-sm text-text-muted">Configure global playback modes and audio library preferences.</p>
      </div>
      <MusicSettingsForm />
      <MusicLibraryManager />
    </div>
  );
}
