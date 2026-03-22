import { MusicSettingsForm } from "../../../components/MusicSettingsForm";
import { MusicLibraryManager } from "../../../components/MusicLibraryManager";

export function MusicPage() {
  return (
    <div className="space-y-6">
      <MusicSettingsForm />
      <MusicLibraryManager />
    </div>
  );
}
