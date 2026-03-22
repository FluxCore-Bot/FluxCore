import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import {
  useMusicLibrary,
  useCreateAlbum,
  useDeleteAlbum,
  useAlbumTracks,
  useAddTrack,
  useDeleteTrack,
} from "../lib/hooks/useMusic";
import { toast } from "sonner";
import { ApiError } from "../lib/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Alert } from "./ui/alert";
import { Card } from "./ui/card";

const MAX_ALBUMS = 50;
const MAX_TRACKS = 100;

function AlbumTracks({ guildId, albumId }: { guildId: string; albumId: number }) {
  const { data: tracks = [], isLoading } = useAlbumTracks(guildId, albumId);
  const addTrack = useAddTrack(guildId, albumId);
  const deleteTrack = useDeleteTrack(guildId, albumId);


  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState("");

  if (isLoading) return <p className="py-2 text-xs text-text-muted">Loading tracks...</p>;

  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim() || !sourceUrl.trim()) {
      setError("Title and URL are required");
      return;
    }

    try {
      await addTrack.mutateAsync({ title: title.trim(), sourceUrl: sourceUrl.trim() });
      toast.success("Track added");
      setTitle("");
      setSourceUrl("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    }
  };

  const handleDeleteTrack = async (trackId: number) => {
    try {
      await deleteTrack.mutateAsync(trackId);
      toast.success("Track removed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    }
  };

  const isPending = addTrack.isPending || deleteTrack.isPending;

  return (
    <div className="mt-2 space-y-2 border-l-2 border-outline-variant/30 pl-4">
      {tracks.map((track) => (
        <div
          key={track.id}
          className="flex items-center justify-between rounded-md bg-surface-lowest px-3 py-2"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{track.title}</p>
            <p className="truncate text-xs text-text-muted">{track.sourceUrl}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 shrink-0 text-danger hover:text-danger"
            onClick={() => handleDeleteTrack(track.id)}
            disabled={isPending}
          >
            Remove
          </Button>
        </div>
      ))}

      {tracks.length === 0 && !showForm && (
        <p className="text-xs text-text-muted">No tracks in this album.</p>
      )}

      {error && (
        <Alert variant="destructive" className="text-xs">{error}</Alert>
      )}

      {showForm ? (
        <form onSubmit={handleAddTrack} className="space-y-2 rounded-md bg-surface-high p-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Track title"
          />
          <Input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Source URL (YouTube, etc.)"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {addTrack.isPending ? "Adding..." : "Add Track"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setShowForm(false); setError(""); }}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        tracks.length < MAX_TRACKS && (
          <Button variant="link" size="sm" onClick={() => setShowForm(true)}>
            + Add Track
          </Button>
        )
      )}
    </div>
  );
}

export function MusicLibraryManager() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: albums = [], isLoading } = useMusicLibrary(guildId);
  const createAlbum = useCreateAlbum(guildId);
  const deleteAlbum = useDeleteAlbum(guildId);


  const [expandedAlbum, setExpandedAlbum] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [error, setError] = useState("");

  if (isLoading) return <p className="text-text-muted">Loading...</p>;

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newAlbumName.trim()) {
      setError("Album name is required");
      return;
    }

    try {
      await createAlbum.mutateAsync(newAlbumName.trim());
      toast.success("Album created");
      setNewAlbumName("");
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    }
  };

  const handleDeleteAlbum = async (albumId: number) => {
    try {
      await deleteAlbum.mutateAsync(albumId);
      toast.success("Album deleted");
      if (expandedAlbum === albumId) setExpandedAlbum(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    }
  };

  const isPending = createAlbum.isPending || deleteAlbum.isPending;

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Music Library</h3>
          <p className="text-sm text-text-muted">
            Manage albums and tracks for library mode.
          </p>
        </div>
        {!showCreateForm && albums.length < MAX_ALBUMS && (
          <Button onClick={() => setShowCreateForm(true)}>
            Add Album
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">{error}</Alert>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreateAlbum} className="mb-4 rounded-md bg-surface-high p-4">
          <Label>Album Name</Label>
          <Input
            value={newAlbumName}
            onChange={(e) => setNewAlbumName(e.target.value)}
            placeholder="My Playlist"
            className="mb-3"
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {createAlbum.isPending ? "Creating..." : "Create"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setShowCreateForm(false); setError(""); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {albums.length > 0 ? (
        <div className="space-y-3">
          {albums.map((album) => (
            <Card key={album.id} className="bg-surface-high p-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`${expandedAlbum === album.id ? "Collapse" : "Expand"} ${album.name}`}
                  onClick={() =>
                    setExpandedAlbum(expandedAlbum === album.id ? null : album.id)
                  }
                >
                  {expandedAlbum === album.id ? "▼" : "▶"} {album.name}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:text-danger"
                  onClick={() => handleDeleteAlbum(album.id)}
                  disabled={isPending}
                >
                  Delete
                </Button>
              </div>

              {expandedAlbum === album.id && (
                <AlbumTracks guildId={guildId} albumId={album.id} />
              )}
            </Card>
          ))}
        </div>
      ) : (
        !showCreateForm && (
          <p className="text-sm text-text-muted">
            No albums yet. Click "Add Album" to get started.
          </p>
        )
      )}
    </Card>
  );
}
