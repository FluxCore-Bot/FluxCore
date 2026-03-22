import { MusicSettingsForm } from "../../../components/MusicSettingsForm";
import { MusicLibraryManager } from "../../../components/MusicLibraryManager";
import { PageHeader } from "../../../components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";

export function MusicPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Music System"
        subtitle="Configure global playback modes and audio library preferences."
      />
      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Playback Settings</TabsTrigger>
          <TabsTrigger value="library">Music Library</TabsTrigger>
        </TabsList>
        <TabsContent value="settings">
          <MusicSettingsForm />
        </TabsContent>
        <TabsContent value="library">
          <MusicLibraryManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
