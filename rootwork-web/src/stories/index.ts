import type { MediaRef } from "../data/people";

export type StoryMdBlock = {
  type: "md";
  text: string;
};

export type StoryImageBlock = {
  type: "image";
  file: string;
  caption?: string;
  src?: string;
  media?: MediaRef;
};

export type StoryBlock = StoryMdBlock | StoryImageBlock;

export type LifeStory = {
  /** The person this story is about, or a generated key for a family story. */
  personId: string;
  /** "family" stories are about a line or topic rather than one person. */
  kind?: "family";
  slug: string;
  title: string;
  blocks: StoryBlock[];
};

export function storySlug(givenName: string, familyName: string): string {
  const slug = `${givenName} ${familyName}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-");
  return slug || "person";
}

export function storyToStored(story: LifeStory): LifeStory {
  return {
    personId: story.personId,
    ...(story.kind ? { kind: story.kind } : {}),
    slug: story.slug,
    title: story.title,
    blocks: story.blocks.map((block) =>
      block.type === "md"
        ? { type: "md" as const, text: block.text }
        : {
            type: "image" as const,
            file: block.file,
            ...(block.caption ? { caption: block.caption } : {}),
            ...(block.media ? { media: block.media } : {}),
          },
    ),
  };
}

export function newFamilyStoryKey(): string {
  return `family-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function storyToExport(story: LifeStory) {
  return storyToStored(story);
}

export {
  hydrateStories,
  flushStories,
  hasLifeStory,
  initStories,
  reloadStories,
  remapStoryPerson,
  saveStory,
  deleteStory,
  familyStories,
  storyFor,
  useLifeStories,
} from "./store";
