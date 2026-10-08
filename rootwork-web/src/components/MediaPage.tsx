import { useMemo, useState } from "react";
import { albumMediaOfPerson, displayName, type MediaRef, type Person } from "../data/people";
import { IconBack, IconFolder, IconSearch, IconTrash } from "../icons";
import { storyFor, useLifeStories } from "../stories";
import { HiddenFileButton } from "./HiddenFileButton";
import { MediaThumb, MediaViewer } from "./MediaThumb";
import { PersonAvatar } from "./PersonAvatar";

type MediaPageProps = {
  people: Record<string, Person>;
  onAddMedia: (personId: string, files: File[]) => void | Promise<void>;
  onRemoveMedia: (personId: string, mediaId: string) => void;
  readOnly?: boolean;
};

function storyMedia(personId: string): MediaRef[] {
  const story = storyFor(personId);
  if (!story) return [];
  return story.blocks.flatMap((block) =>
    block.type === "image" && block.media ? [block.media] : [],
  );
}

export function MediaPage({ people, onAddMedia, onRemoveMedia, readOnly = false }: MediaPageProps) {
  const stories = useLifeStories();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<MediaRef | null>(null);
  const needle = query.trim().toLowerCase();

  const folders = useMemo(() => {
    return Object.values(people)
      .map((person) => ({
        person,
        files: albumMediaOfPerson(person, storyMedia(person.id)),
      }))
      .sort((a, b) => displayName(a.person).localeCompare(displayName(b.person)));
  }, [people, stories]);

  const visible = useMemo(() => {
    if (!needle) return folders;
    return folders.filter(({ person }) => displayName(person).toLowerCase().includes(needle));
  }, [folders, needle]);

  const open = openId ? folders.find((folder) => folder.person.id === openId) : undefined;
  const ownedIds = open
    ? new Set(
        [open.person.photo?.id, ...(open.person.media ?? []).map((file) => file.id)].filter(
          (id): id is string => Boolean(id),
        ),
      )
    : new Set<string>();

  if (open) {
    return (
      <section className="media-page">
        <div className="media-toolbar">
          <button type="button" className="btn btn-secondary media-back" onClick={() => setOpenId(null)}>
            <IconBack size={16} />
            All people
          </button>
          {!readOnly && <HiddenFileButton
            label="Add photos"
            multiple
            className="btn btn-primary"
            onFiles={(files) => void onAddMedia(open.person.id, files)}
          />}
        </div>
        <div className="media-folder-head">
          <PersonAvatar person={open.person} className={`person-mono is-folder is-${open.person.gender}`} />
          <div>
            <div className="placeholder-kicker">Media</div>
            <h3>{displayName(open.person)}</h3>
            <p>{open.files.length === 1 ? "1 file" : `${open.files.length} files`}</p>
          </div>
        </div>
        {open.files.length === 0 ? (
          <div className="media-empty">No photos or scans on this person yet.</div>
        ) : (
          <div className="media-grid">
            {open.files.map((file) => {
              const canRemove = ownedIds.has(file.id);
              return (
                <div className="media-tile-wrap" key={file.id}>
                  <button
                    type="button"
                    className="media-tile"
                    onClick={() => setViewing(file)}
                  >
                    <MediaThumb media={file} className="media-tile-thumb" />
                    <span className="media-tile-name">{file.originalName || "File"}</span>
                  </button>
                  {canRemove && !readOnly ? (
                    <button
                      type="button"
                      className="btn btn-icon media-tile-remove"
                      aria-label={`Remove ${file.originalName || "file"}`}
                      title="Remove"
                      onClick={() => {
                        if (viewing?.id === file.id) setViewing(null);
                        onRemoveMedia(open.person.id, file.id);
                      }}
                    >
                      <IconTrash size={14} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        {viewing ? (
          <MediaViewer
            media={viewing}
            onClose={() => setViewing(null)}
            onRemove={
              ownedIds.has(viewing.id)
                ? () => {
                    onRemoveMedia(open.person.id, viewing.id);
                    setViewing(null);
                  }
                : undefined
            }
          />
        ) : null}
      </section>
    );
  }

  return (
    <section className="media-page">
      <div className="media-search">
        <IconSearch size={16} />
        <input
          type="search"
          value={query}
          placeholder="Search people…"
          aria-label="Search people"
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {visible.length === 0 ? (
        <div className="media-empty">
          {needle ? "No matching people." : "Add people to the tree to collect their photos here."}
        </div>
      ) : (
        <div className="media-folders">
          {visible.map(({ person, files }) => (
            <button
              key={person.id}
              type="button"
              className="media-folder"
              onClick={() => setOpenId(person.id)}
            >
              <span className="media-folder-icon">
                <IconFolder size={22} />
              </span>
              <PersonAvatar person={person} className={`person-mono is-folder is-${person.gender}`} />
              <span className="media-folder-copy">
                <span className="media-folder-name">{displayName(person)}</span>
                <span className="media-folder-count">
                  {files.length === 1 ? "1 file" : `${files.length} files`}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
