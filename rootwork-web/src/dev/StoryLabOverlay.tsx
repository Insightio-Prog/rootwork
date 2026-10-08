import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { LifeStoryArticle } from "../components/LifeStoryPage";
import { parseYear, type MediaRef } from "../data/people";
import { importMedia } from "../media/store";
import { invokeErrorMessage } from "../review/claude";
import { saveStory, storyFor, storySlug, storyToExport, useLifeStories, type LifeStory, type StoryBlock } from "../stories";
import { MarkdownText, splitMarkdownBlocks } from "../stories/render";
import "./story-lab.css";

export type StoryLabPerson = {
  id: string;
  givenName: string;
  familyName: string;
  birth: string;
  photo: MediaRef | null;
};

type StoryLabProps = {
  open: boolean;
  people: Record<string, StoryLabPerson> | StoryLabPerson[];
  personId?: string;
  onClose: () => void;
};

function personName(person: StoryLabPerson) {
  return [person.givenName, person.familyName].filter(Boolean).join(" ") || "Unnamed";
}

function personLabel(person: StoryLabPerson) {
  const name = personName(person);
  const year = parseYear(person.birth);
  return year != null ? `${name} (${year})` : name;
}

function emptyStory(person: StoryLabPerson | undefined): LifeStory {
  if (!person) {
    return { personId: "", slug: "person", title: "", blocks: [] };
  }
  return {
    personId: person.id,
    slug: storySlug(person.givenName, person.familyName),
    title: personName(person),
    blocks: [],
  };
}

export function StoryLab({ open, people, personId: requestedId, onClose }: StoryLabProps) {
  const stories = useLifeStories();
  const [personId, setPersonId] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [blocks, setBlocks] = useState<StoryBlock[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const sortedPeople = useMemo(() => {
    const list = Array.isArray(people) ? people : Object.values(people);
    return [...list].sort((a, b) => {
      const byName = personName(a).localeCompare(personName(b));
      if (byName !== 0) return byName;
      return (parseYear(a.birth) ?? 0) - (parseYear(b.birth) ?? 0);
    });
  }, [people]);

  useEffect(() => {
    if (!open) return;
    if (requestedId) {
      setPersonId(requestedId);
      return;
    }
    setPersonId((current) => {
      if (current && sortedPeople.some((item) => item.id === current)) return current;
      return sortedPeople[0]?.id || "";
    });
  }, [open, requestedId, sortedPeople]);

  useEffect(() => {
    if (!open) return;
    const existing = personId ? storyFor(personId) : undefined;
    setBlocks(existing?.blocks ?? []);
    setMarkdown("");
    setPendingFiles({});
  }, [personId, open]);

  useEffect(() => {
    if (!personId || blocks.length > 0) return;
    const existing = stories[personId];
    if (existing?.blocks.length) setBlocks(existing.blocks);
  }, [stories, personId, blocks.length]);

  useEffect(() => {
    return () => {
      Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  const person = sortedPeople.find((item) => item.id === personId);
  const story = useMemo(() => {
    const base = emptyStory(person);
    return { ...base, blocks };
  }, [person, blocks]);

  function importMarkdown() {
    setBlocks(splitMarkdownBlocks(markdown));
  }

  function insertPhoto(index: number) {
    const next: StoryBlock = { type: "image", file: "photo.jpg", caption: "" };
    setBlocks((current) => [...current.slice(0, index), next, ...current.slice(index)]);
  }

  function updateBlock(index: number, next: StoryBlock) {
    setBlocks((current) => current.map((block, itemIndex) => (itemIndex === index ? next : block)));
  }

  function removeBlock(index: number) {
    setBlocks((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function previewFile(fileName: string, file: File) {
    setPendingFiles((current) => ({ ...current, [fileName]: file }));
    setPreviews((current) => {
      const previous = current[fileName];
      if (previous) URL.revokeObjectURL(previous);
      return { ...current, [fileName]: URL.createObjectURL(file) };
    });
  }

  async function copyJson() {
    const text = `${JSON.stringify(storyToExport(story), null, 2)}\n`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      console.info("[story-lab]\n" + text);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function handleSave() {
    if (!story.personId || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const nextBlocks: StoryBlock[] = [];
      for (const block of blocks) {
        if (block.type === "md") {
          nextBlocks.push({ type: "md", text: block.text });
          continue;
        }
        const pending = pendingFiles[block.file];
        const media = pending ? await importMedia(pending) : block.media;
        nextBlocks.push({
          type: "image",
          file: block.file,
          ...(block.caption ? { caption: block.caption } : {}),
          ...(media ? { media } : {}),
        });
      }
      const savedStory = await saveStory({ ...story, blocks: nextBlocks });
      setBlocks(savedStory.blocks);
      setPendingFiles({});
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    } catch (error) {
      setSaveError(invokeErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="story-lab" role="dialog" aria-label="Life story editor">
      <aside className="story-lab-editor">
        <div className="story-lab-kicker">Life story</div>
        <div className="story-lab-title-row">
          <h2 className="story-lab-title">Editor</h2>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <label htmlFor="story-lab-person">Person</label>
        <select
          id="story-lab-person"
          className="input"
          value={personId}
          onChange={(event) => setPersonId(event.target.value)}
        >
          {sortedPeople.length === 0 ? <option value="">No people in the tree</option> : null}
          {sortedPeople.map((item) => (
            <option key={item.id} value={item.id}>
              {personLabel(item)}
            </option>
          ))}
        </select>
        <label htmlFor="story-lab-md">Claude markdown</label>
        <textarea
          id="story-lab-md"
          className="input"
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
          placeholder="Paste the life story markdown here"
        />
        <div className="story-lab-actions">
          <button type="button" className="btn btn-secondary" onClick={importMarkdown} disabled={!markdown.trim()}>
            Import markdown
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void handleSave()} disabled={!story.personId || saving}>
            {saved ? "Saved" : saving ? "Saving" : "Save story"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void copyJson()} disabled={!story.personId}>
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </div>
        {saveError ? <p className="story-lab-error">{saveError}</p> : null}
        <div className="story-lab-blocks">
          <InsertPhotoButton onClick={() => insertPhoto(0)} />
          {blocks.map((block, index) => (
            <div key={`${block.type}-${index}`}>
              <div
                className={`story-lab-block${block.type === "image" ? " is-photo" : ""}${
                  hoverIndex === index ? " is-hover" : ""
                }`}
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <div className="story-lab-block-head">
                  <span>{block.type === "md" ? "Text" : "Photo link"}</span>
                  <button type="button" onClick={() => removeBlock(index)}>
                    Remove
                  </button>
                </div>
                {block.type === "md" ? (
                  <div className="story-lab-block-prose">
                    <MarkdownText text={block.text} />
                  </div>
                ) : (
                  <div className="story-lab-photo-fields">
                    <input
                      className="input"
                      value={block.file}
                      onChange={(event) => updateBlock(index, { ...block, file: event.target.value.trim() })}
                      placeholder="wedding.jpg"
                    />
                    <input
                      className="input"
                      value={block.caption ?? ""}
                      onChange={(event) => updateBlock(index, { ...block, caption: event.target.value })}
                      placeholder="Link label"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const name = block.file && block.file !== "photo.jpg" ? block.file : file.name;
                        updateBlock(index, { ...block, file: name });
                        previewFile(name, file);
                      }}
                    />
                  </div>
                )}
              </div>
              <InsertPhotoButton onClick={() => insertPhoto(index + 1)} />
            </div>
          ))}
        </div>
        <p className="story-lab-hint">
          Paste markdown, add photo links, then Save story. Close when you are done.
        </p>
      </aside>
      <section className="story-lab-preview">
        <div className="story-lab-preview-bar">
          <span>Live preview</span>
        </div>
        <div className="story-lab-preview-scroll">
          <LifeStoryArticle story={story} person={person} previews={previews} highlightIndex={hoverIndex} />
        </div>
      </section>
    </div>,
    document.body,
  );
}

function InsertPhotoButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="story-lab-insert">
      <button type="button" onClick={onClick}>
        + Photo link here
      </button>
    </div>
  );
}
