import { useMemo, useState } from "react";
import { displayName, type Person } from "../data/people";
import { IconSearch } from "../icons";
import { useMediaUrl } from "../media/useMediaUrl";
import { storyFor, useLifeStories, type LifeStory, type StoryImageBlock } from "../stories";
import { MarkdownText } from "../stories/render";
import { MediaViewer } from "./MediaThumb";
import { PersonAvatar } from "./PersonAvatar";

type LifeStoryPageProps = {
  people: Record<string, Person>;
  personId: string | null;
  onPick: (id: string) => void;
  onChangePerson: () => void;
  onCreateStory?: () => void;
  onEditStory?: (id: string) => void;
};

export function LifeStoryArticle({
  story,
  person,
  previews,
  highlightIndex,
  insetViewer,
}: {
  story: LifeStory;
  person?: Pick<Person, "givenName" | "familyName" | "photo">;
  previews?: Record<string, string>;
  highlightIndex?: number | null;
  insetViewer?: boolean;
}) {
  const [viewer, setViewer] = useState<{ title: string; src: string; caption?: string } | null>(null);

  return (
    <article className="life-story-article">
      <header className="life-story-header">
        {person?.photo ? <PersonAvatar person={person} className="life-story-portrait" /> : null}
        <div>
          <p className="life-story-kicker">Life story</p>
          <h1>{story.title || "Untitled"}</h1>
        </div>
      </header>
      {story.blocks.length === 0 ? (
        <p className="life-story-prose">Import markdown or add a photo link to see the story here.</p>
      ) : null}
      {story.blocks.map((block, index) => {
        const highlight = highlightIndex === index ? " is-highlight" : "";
        if (block.type === "md") {
          return (
            <div key={index} className={`life-story-prose${highlight}`}>
              <MarkdownText text={block.text} />
            </div>
          );
        }
        return (
          <StoryPhotoLink
            key={index}
            block={block}
            preview={previews?.[block.file]}
            highlight={highlight}
            onOpen={(image) => setViewer(image)}
          />
        );
      })}
      {viewer ? <MediaViewer image={viewer} insetMain={insetViewer} onClose={() => setViewer(null)} /> : null}
    </article>
  );
}

function StoryPhotoLink({
  block,
  preview,
  highlight,
  onOpen,
}: {
  block: StoryImageBlock;
  preview?: string;
  highlight: string;
  onOpen: (image: { title: string; src: string; caption?: string }) => void;
}) {
  const mediaUrl = useMediaUrl(block.media);
  const label = block.caption?.trim() || block.file;
  const src = block.src ?? preview ?? mediaUrl;
  return (
    <p className={`life-story-link-row${highlight}`}>
      <button
        type="button"
        className="life-story-photo-link"
        disabled={!src}
        onClick={() => {
          if (!src) return;
          onOpen({ title: label, src, caption: block.caption });
        }}
      >
        {label}
      </button>
    </p>
  );
}

export function LifeStoryPage({
  people,
  personId,
  onPick,
  onChangePerson,
  onCreateStory,
  onEditStory,
}: LifeStoryPageProps) {
  const stories = useLifeStories();
  const [query, setQuery] = useState("");
  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return Object.values(people)
      .filter((person) => Boolean(stories[person.id]))
      .filter((person) => !needle || displayName(person).toLowerCase().includes(needle))
      .sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }, [people, query, stories]);

  const story = personId ? storyFor(personId) : undefined;
  const person = personId ? people[personId] : undefined;

  if (story && person) {
    return (
      <section className="life-story-page">
        <div className="life-story-toolbar">
          <button type="button" className="btn btn-secondary" onClick={onChangePerson}>
            Choose another person
          </button>
          {onEditStory ? (
            <button type="button" className="btn btn-primary" onClick={() => onEditStory(person.id)}>
              Edit life story
            </button>
          ) : null}
        </div>
        <div className="life-story-scroll">
          <LifeStoryArticle story={story} person={person} insetViewer />
        </div>
      </section>
    );
  }

  if (candidates.length === 0 && !query.trim()) {
    return (
      <section className="life-story-page">
        <div className="life-story-empty">
          <div className="life-story-empty-kicker">Life story</div>
          <h3>No stories yet</h3>
          <p>Write one from this page. Choose the person in the editor, paste the story, and save.</p>
          {onCreateStory ? (
            <button type="button" className="btn btn-primary" onClick={onCreateStory}>
              Create life story
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="life-story-page is-picker">
      {onCreateStory ? (
        <div className="life-story-picker-bar">
          <button type="button" className="btn btn-primary" onClick={onCreateStory}>
            Create life story
          </button>
        </div>
      ) : null}
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
      {candidates.length === 0 ? (
        <div className="media-empty">No matching stories.</div>
      ) : (
        <div className="media-folders">
          {candidates.map((item) => (
            <button
              key={item.id}
              type="button"
              className="media-folder"
              onClick={() => onPick(item.id)}
            >
              <PersonAvatar person={item} className={`person-mono is-folder is-${item.gender}`} />
              <span className="media-folder-copy">
                <span className="media-folder-name">{displayName(item)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
