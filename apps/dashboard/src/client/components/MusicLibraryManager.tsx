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
import { useUiStore } from "../stores/uiStore";
import { ApiError } from "../lib/client";

const MAX_ALBUMS = 50;
const MAX_TRACKS = 100;

function AlbumTracks({ guildId, albumId }: { guildId: string; albumId: number }) {
  const { data: tracks = [], isLoading } = useAlbumTracks(guildId, albumId);
  const addTrack = useAddTrack(guildId, albumId);
  const deleteTrack = useDeleteTrack(guildId, albumId);
  const addToast = useUiStore((s) => s.addToast);

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
      addToast("Track added", "success");
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
      addToast("Track removed", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    }
  };

  const isPending = addTrack.isPending || deleteTrack.isPending;

  return (
    <div className="mt-2 space-y-2 border-l-2 border-border pl-4">
      {tracks.map((track) => (
        <div
          key={track.id}
          className="flex items-center justify-between rounded-md bg-background px-3 py-2"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{track.title}</p>
            <p className="truncate text-xs text-text-muted">{track.sourceUrl}</p>
          </div>
          <button
            onClick={() => handleDeleteTrack(track.id)}
            disabled={isPending}
            className="ml-2 shrink-0 rounded-md bg-danger/10 px-2 py-1 text-xs font-medium text-danger transition hover:bg-danger/20 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ))}

      {tracks.length === 0 && !showForm && (
        <p className="text-xs text-text-muted">No tracks in this album.</p>
      )}

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-danger">
          {error}
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleAddTrack} className="space-y-2 rounded-md border border-border bg-background p-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Track title"
            className="w-full"
          />
          <input
            type="text"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Source URL (YouTube, etc.)"
            className="w-full"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
            >
              {addTrack.isPending ? "Adding..." : "Add Track"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(""); }}
              className="rounded-md bg-surface px-3 py-1.5 text-xs font-medium text-text-muted transition hover:bg-border"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        tracks.length < MAX_TRACKS && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-medium text-accent transition hover:text-accent-hover"
          >
            + Add Track
          </button>
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
  const addToast = useUiStore((s) => s.addToast);

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
      addToast("Album created", "success");
      setNewAlbumName("");
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    }
  };

  const handleDeleteAlbum = async (albumId: number) => {
    try {
      await deleteAlbum.mutateAsync(albumId);
      addToast("Album deleted", "success");
      if (expandedAlbum === albumId) setExpandedAlbum(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    }
  };

  const isPending = createAlbum.isPending || deleteAlbum.isPending;

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Music Library</h3>
          <p className="text-sm text-text-muted">
            Manage albums and tracks for library mode.
          </p>
        </div>
        {!showCreateForm && albums.length < MAX_ALBUMS && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            Add Album
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreateAlbum} className="mb-4 rounded-md border border-border bg-background p-4">
          <label className="mb-1 block text-xs text-text-muted">Album Name</label>
          <input
            type="text"
            value={newAlbumName}
            onChange={(e) => setNewAlbumName(e.target.value)}
            placeholder="My Playlist"
            className="mb-3 w-full"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
            >
              {createAlbum.isPending ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreateForm(false); setError(""); }}
              className="rounded-md bg-surface px-4 py-2 text-sm font-medium text-text-muted transition hover:bg-border"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {albums.length > 0 ? (
        <div className="space-y-3">
          {albums.map((album) => (
            <div key={album.id} className="rounded-md border border-border bg-background p-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() =>
                    setExpandedAlbum(expandedAlbum === album.id ? null : album.id)
                  }
                  className="text-sm font-medium transition hover:text-accent"
                >
                  {expandedAlbum === album.id ? "▼" : "▶"} {album.name}
                </button>
                <button
                  onClick={() => handleDeleteAlbum(album.id)}
                  disabled={isPending}
                  className="rounded-md bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/20 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>

              {expandedAlbum === album.id && (
                <AlbumTracks guildId={guildId} albumId={album.id} />
              )}
            </div>
          ))}
        </div>
      ) : (
        !showCreateForm && (
          <p className="text-sm text-text-muted">
            No albums yet. Click "Add Album" to get started.
          </p>
        )
      )}
    </div>
  );
}
