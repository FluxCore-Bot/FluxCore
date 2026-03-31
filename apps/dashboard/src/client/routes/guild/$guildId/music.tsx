import { useTranslation } from "react-i18next";
import { MusicSettingsForm } from "../../../components/MusicSettingsForm";
import { MusicLibraryManager } from "../../../components/MusicLibraryManager";
import { PageHeader } from "../../../components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";

export function MusicPage() {
  const { t } = useTranslation("music");

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">{t("tabs.settings")}</TabsTrigger>
          <TabsTrigger value="library">{t("tabs.library")}</TabsTrigger>
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
