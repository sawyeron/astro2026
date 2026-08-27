import { defineCollection, z } from "astro:content";

const topics = [
  "civil-commercial",
  "labor-social-security",
  "tort-traffic",
  "legal-practice-research",
  "lawyer-toolbox",
  "technology-digital-life",
  "notes-observations",
] as const;

const legacyMetadata = z
  .object({
    id: z.string().optional(),
    thumbnail: z.string().url().optional(),
    cover: z.union([z.boolean(), z.string()]).optional(),
    coverimg: z.union([z.boolean(), z.string()]).optional(),
    permalink: z.string().optional(),
    comment: z.union([z.boolean(), z.string()]).optional(),
  })
  .strict()
  .optional();

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string().min(1),
    description: z.string().max(320).optional(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    legacyPath: z
      .string()
      .regex(/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*\/$/)
      .optional(),
    categories: z.array(z.string().min(1)).default([]),
    tags: z.array(z.string().min(1)).default([]),
    top: z.boolean().default(false),
    draft: z.literal(false).default(false),
    topics: z.array(z.enum(topics)).default([]),
    contentKind: z
      .enum(["legal", "technical", "note", "culture", "personal", "mixed"])
      .optional(),
    timeSensitive: z.boolean().default(false),
    legalDisclaimer: z.boolean().default(false),
    legacy: legacyMetadata,
  }),
});

const drafts = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string().min(1),
    date: z.coerce.date().optional(),
    updated: z.coerce.date().optional(),
    categories: z.array(z.string().min(1)).default([]),
    tags: z.array(z.string().min(1)).default([]),
    draft: z.literal(true).default(true),
    legacy: legacyMetadata,
  }),
});

const pages = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string().min(1),
    description: z.string().max(320).optional(),
    updated: z.coerce.date().optional(),
    draft: z.literal(false).default(false),
  }),
});

export const collections = { blog, drafts, pages };
