'use server';

import { prisma } from '@/lib/prisma';
import { recomputeAnalytics } from '@/lib/analytics';
import { revalidatePath } from 'next/cache';

export type ImportFieldKey =
  | 'postId'
  | 'text'
  | 'createdAt'
  | 'likes'
  | 'reposts'
  | 'replies'
  | 'quotes'
  | 'impressions'
  | 'engagementRate'
  | 'clicks';

export type ImportMapping = Record<ImportFieldKey, string>;

export type ImportedPostRow = {
  postId: string | null;
  text: string | null;
  createdAt: string | null;
  likes: number | null;
  reposts: number | null;
  replies: number | null;
  quotes: number | null;
  impressions: number | null;
  engagementRate: number | null;
  clicks: number | null;
};

export async function saveImportedPosts(data: {
  fileName: string | null;
  mapping: ImportMapping;
  rows: ImportedPostRow[];
}) {
  try {
    const { fileName, rows } = data;
    console.log(`[Import] Starting import of ${rows.length} rows from ${fileName}`);

    // No auth is wired up yet; ensure we always have a user to attach imports/posts to.
    const user = await prisma.user.upsert({
      where: { username: 'default' },
      update: {},
      create: { username: 'default', timezone: 'America/Chicago' },
    });

    // 1. Create the Import record
    const importRecord = await prisma.import.create({
      data: {
        user_id: user.id,
        filename: fileName || 'import.csv',
        row_count: rows.length,
        source_label: 'X Analytics Export',
      },
    });

    // 2. Process posts in batches for speed and to avoid timeouts
    const snapshotsToCreate: {
      post_id: string;
      import_id: string;
      captured_at: Date;
      like_count: number;
      repost_count: number;
      reply_count: number;
      quote_count: number;
      impression_count: number;
      engagement_rate: number;
      clicks: number;
    }[] = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (row) => {
        const xPostId = row.postId?.trim();
        const text = row.text ?? '';
        const createdAtRaw = row.createdAt;

        if (!xPostId || !createdAtRaw) return;
        const createdAt = new Date(createdAtRaw);
        if (Number.isNaN(createdAt.getTime())) return;

        // Derived features
        const charCount = text.length;
        const wordCount = text.split(/\s+/).length;
        const hasLink = text.includes('http');
        const hashtagCount = (text.match(/#/g) || []).length;
        const mentionCount = (text.match(/@/g) || []).length;

        // Heuristic Classifier
        let formatTag = 'standard';
        const lowerText = text.toLowerCase();
        if (lowerText.includes('vs') || lowerText.includes('compared to')) formatTag = 'comparison';
        if (lowerText.includes('milestone') || lowerText.includes('followers')) formatTag = 'milestone';
        if (text.includes('?')) formatTag = 'question';
        if (lowerText.includes('1.') || lowerText.includes('- ')) formatTag = 'list';
        if (lowerText.includes('how to') || lowerText.includes('tip:')) formatTag = 'tip';
        if (lowerText.includes('thread')) formatTag = 'story';
        if (lowerText.includes('click') || lowerText.includes('link in')) formatTag = 'cta';

        // Upsert the post
        const post = await prisma.post.upsert({
          where: { x_post_id: xPostId },
          update: {
            text,
            created_at: createdAt,
            char_count: charCount,
            word_count: wordCount,
            has_link: hasLink,
            hashtag_count: hashtagCount,
            mention_count: mentionCount,
            format_tag: formatTag,
          },
          create: {
            user_id: user.id,
            x_post_id: xPostId,
            text,
            created_at: createdAt,
            char_count: charCount,
            word_count: wordCount,
            has_link: hasLink,
            has_media: false,
            hashtag_count: hashtagCount,
            mention_count: mentionCount,
            format_tag: formatTag,
          },
        });

        // Store snapshot data for bulk creation later
        snapshotsToCreate.push({
          post_id: post.id,
          import_id: importRecord.id,
          captured_at: importRecord.imported_at,
          like_count: row.likes ?? 0,
          repost_count: row.reposts ?? 0,
          reply_count: row.replies ?? 0,
          quote_count: row.quotes ?? 0,
          impression_count: row.impressions ?? 0,
          engagement_rate: row.engagementRate ?? 0,
          clicks: row.clicks ?? 0,
        });
      }));
    }

    // 3. Create all snapshots in one batch
    if (snapshotsToCreate.length > 0) {
      await prisma.metricsSnapshot.createMany({
        data: snapshotsToCreate,
      });
    }

    // 4. Trigger Intelligence Recompute
    await recomputeAnalytics();

    revalidatePath('/');
    revalidatePath('/analytics');
    
    console.log(`[Import] Successfully imported ${snapshotsToCreate.length} posts.`);
    return { success: true, importId: importRecord.id };
  } catch (error: unknown) {
    console.error('Import error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}
