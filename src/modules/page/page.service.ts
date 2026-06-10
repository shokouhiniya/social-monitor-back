import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { Page } from './page.entity';
import { Post } from '../post/post.entity';
import { FieldReport } from '../field-report/field-report.entity';
import { ActionPlan } from '../action-plan/action-plan.entity';
import { Cluster } from '../cluster/cluster.entity';
import { CreatePageDto, UpdatePageDto, PageQueryDto } from './page.dto';
import { SettingsService } from '../settings/settings.service';
import { TranscriptionService } from '../transcription/transcription.service';
import { SourcesService } from '../../sources/sources.service';
import { startProgress, updateProgress, completeProgress, failProgress, isRunning, getAllRunning } from './page-progress';
import { TOPICAL_CLUSTERS, IDENTITY_CATEGORIES, GENDERS, AGE_RANGES, RELIGIONS } from './page.constants';

@Injectable()
export class PageService {
  constructor(
    @InjectRepository(Page)
    private pageRepository: Repository<Page>,
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(FieldReport)
    private fieldReportRepository: Repository<FieldReport>,
    @InjectRepository(ActionPlan)
    private actionPlanRepository: Repository<ActionPlan>,
    @InjectRepository(Cluster)
    private clusterRepository: Repository<Cluster>,
    private readonly settingsService: SettingsService,
    private readonly transcriptionService: TranscriptionService,
    // سازگاری دورهٔ گذار (Requirement 2.9): SourcesService مالک عملیات منبع است؛
    // PageService در عملیاتی که SourcesService آن‌ها را owns می‌کند، به آن
    // delegate می‌کند. عملیات سنگین legacy (fetch/process با fetch/LLM واقعی) تا
    // wire شدن کامل Collection/Analysis (تسک ۵.۱۱) روی مسیر legacy باقی می‌مانند
    // تا قابلیتی از دست نرود (انتقال غیرتخریبی).
    private readonly sourcesService: SourcesService,
  ) {}

  /**
   * Download media from URL and save locally to public/media/{pageId}/
   * Returns the local static URL path, or null on failure.
   */
  private async downloadMedia(url: string, pageId: number, postId: string): Promise<string | null> {
    try {
      const mediaDir = path.join(process.cwd(), 'public', 'media', String(pageId));
      if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
      }

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000, // 60s for large video downloads
        maxContentLength: 100 * 1024 * 1024, // 100MB max for videos
      });

      const contentType = response.headers['content-type'] || 'image/jpeg';
      let ext = '.jpg';
      if (contentType.includes('png')) ext = '.png';
      else if (contentType.includes('webp')) ext = '.webp';
      else if (contentType.includes('mp4') || contentType.includes('video')) ext = '.mp4';

      const filename = `${postId}${ext}`;
      const filePath = path.join(mediaDir, filename);

      fs.writeFileSync(filePath, Buffer.from(response.data));
      console.log(`📸 Saved media: ${filename} for page ${pageId} (${(response.data.byteLength / 1024).toFixed(0)}KB)`);

      return `/static/media/${pageId}/${filename}`;
    } catch (err) {
      console.warn(`⚠️ Failed to download media for post ${postId}:`, err.message);
      return null;
    }
  }

  /**
   * Extract on-screen text from a post's image using LLM vision.
   * Only processes .jpg/.png/.webp files. Skips videos.
   * Returns the extracted text, or null if none found / not applicable.
   */
  private async extractOcrText(post: Post): Promise<string | null> {
    // Skip if already has OCR text
    if (post.ocr_text !== null && post.ocr_text !== undefined) {
      return post.ocr_text;
    }

    // Only process image files
    if (!post.media_url) return null;
    const mediaLower = post.media_url.toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.webp'].some(ext => mediaLower.endsWith(ext));
    if (!isImage) return null;

    // Resolve local path
    let filePath: string;
    if (post.media_url.startsWith('/static/')) {
      filePath = path.join(process.cwd(), 'public', post.media_url.replace('/static/', ''));
    } else {
      return null; // Remote URLs not supported for OCR
    }

    if (!fs.existsSync(filePath)) return null;

    try {
      // Read and encode image
      const imageBytes = fs.readFileSync(filePath);
      // Skip very small images (likely broken) or very large ones (>2MB, too expensive)
      if (imageBytes.length < 1000 || imageBytes.length > 2 * 1024 * 1024) return null;

      const base64 = imageBytes.toString('base64');
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

      const [apiKey, fastModel, ocrPrompt] = await Promise.all([
        this.settingsService.get('openrouter_key'),
        this.settingsService.get('llm_model_fast'),
        this.settingsService.get('prompt_ocr'),
      ]);

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          // Use Flash for OCR — faster, no reasoning overhead, excellent at text extraction
          model: fastModel || 'google/gemini-2.0-flash-001',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: ocrPrompt || 'Extract all visible text from the image exactly as it appears. Return only the extracted text. Do not add explanations. Do not describe the image. Do not translate. Do not summarize. Do not correct spelling. Do not normalize punctuation. Include all visible text from: text overlays, captions, subtitles, screenshots, watermarks, usernames, handles, hashtags, dates, numbers, signs, labels, logos with readable text, comments or chat bubbles. Preserve the original language. Preserve line breaks. Preserve reading order. If a word is unclear, write [unclear]. If a whole line is unreadable, write [unreadable line]. If there is no visible readable text in the image, return exactly: NO_TEXT' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          }],
          max_tokens: 2000,
          temperature: 0,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey || process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const choice = response.data?.choices?.[0];
      const text = (choice?.message?.content || '').trim();

      if (!text || text === 'NO_TEXT' || text.length < 2) {
        return null;
      }

      return text;
    } catch (err) {
      console.warn(`⚠️ OCR failed for post ${post.id}: ${err.message}`);
      return null;
    }
  }

  async findAll(query: PageQueryDto) {
    const { category, platform, cluster, country, search, page = 1, limit = 20 } = query;
    const identityCategory = (query as any).identity_category;
    const segment = (query as any).segment;
    const clusterId = (query as any).cluster_id;
    const isRepresentative = (query as any).is_representative;

    const qb = this.pageRepository.createQueryBuilder('page');

    if (category) qb.andWhere('page.category = :category', { category });
    if (identityCategory) qb.andWhere('page.identity_category = :identityCategory', { identityCategory });
    if (platform) qb.andWhere('page.platform = :platform', { platform });
    if (cluster) qb.andWhere('page.cluster = :cluster', { cluster });
    if (country) qb.andWhere('page.country = :country', { country });
    if (clusterId !== undefined) qb.andWhere('page.cluster_id = :clusterId', { clusterId: Number(clusterId) });
    if (isRepresentative !== undefined) {
      qb.andWhere('page.is_representative = :isRepresentative', {
        isRepresentative: isRepresentative === true || isRepresentative === 'true',
      });
    }
    if (search) qb.andWhere('page.name ILIKE :search', { search: `%${search}%` });

    // Segment filters
    if (segment === 'ghost') {
      qb.andWhere('(page.consistency_rate < 2 OR page.is_active = false)');
    } else if (segment === 'high_influence_low_credibility') {
      qb.andWhere('page.influence_score > 7 AND page.credibility_score < 4');
    } else if (segment === 'new') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      qb.andWhere('page.created_at >= :weekAgo', { weekAgo });
    }

    qb.orderBy('page.influence_score', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findById(id: number) {
    const page = await this.pageRepository.findOne({
      where: { id },
      relations: ['posts', 'field_reports'],
    });
    if (!page) throw new HttpException('Page not found', 404);
    return page;
  }

  async create(dto: CreatePageDto) {
    // Check for duplicate by username + platform
    if (dto.username && dto.platform) {
      const existing = await this.pageRepository.findOne({
        where: { username: dto.username, platform: dto.platform },
      });
      if (existing) {
        throw new HttpException(`پیج @${dto.username} (${dto.platform}) قبلاً ثبت شده است`, 409);
      }
    }
    if (dto.category) {
      (dto as any).category_source = 'manual';
    }
    const page = this.pageRepository.create(dto);
    return await this.pageRepository.save(page);
  }

  async createBulk(dtos: CreatePageDto[]) {
    const results: { created: any[]; skipped: any[] } = { created: [], skipped: [] };

    for (const dto of dtos) {
      if (dto.username && dto.platform) {
        const existing = await this.pageRepository.findOne({
          where: { username: dto.username, platform: dto.platform },
        });
        if (existing) {
          results.skipped.push({ username: dto.username, platform: dto.platform, reason: 'duplicate' });
          continue;
        }
      }
      const page = this.pageRepository.create(dto);
      const saved = await this.pageRepository.save(page);
      results.created.push(saved);
    }

    return results;
  }

  async fetchPageData(id: number) {
    // Guard: prevent duplicate fetch if already running
    if (isRunning(id, 'fetch')) {
      return { status: 'already_running', message: 'بارگیری این پیج در حال اجراست' };
    }

    const page = await this.pageRepository.findOne({ where: { id } });
    if (!page) throw new HttpException('Page not found', 404);
    if (!page.username) throw new HttpException('Username is required for fetching', 400);

    const rapidApiKey = (await this.settingsService.get('rapidapi_key')) || process.env.RAPIDAPI_KEY || '';
    const ig120Headers = {
      'Content-Type': 'application/json',
      'x-rapidapi-key': rapidApiKey,
      'x-rapidapi-host': 'instagram120.p.rapidapi.com',
    };

    try {
      // 1. Fetch profile via instagram120
      startProgress(id, 'fetch', 'واکشی پروفایل...');
      console.log(`👤 Fetching profile for @${page.username}...`);
      const profileResponse = await axios.post(
        'https://instagram120.p.rapidapi.com/api/instagram/profile',
        { username: page.username },
        { headers: ig120Headers, timeout: 20000 },
      );

      const profileData = profileResponse.data?.result;
      if (!profileData) {
        throw new Error('Invalid profile response from API');
      }

      const updateData: any = {
        name: profileData.full_name || page.name,
        bio: profileData.biography || page.bio,
        followers_count: profileData.edge_followed_by?.count ?? profileData.follower_count ?? page.followers_count,
        following_count: profileData.edge_follow?.count ?? profileData.following_count ?? page.following_count,
        profile_image_url: profileData.profile_pic_url_hd || profileData.profile_pic_url || page.profile_image_url,
      };

      Object.assign(page, updateData);
      page.last_fetched_at = new Date();
      const saved = await this.pageRepository.save(page);

      // 2. Fetch posts (includes reels with video URLs) via instagram120
      updateProgress(id, 'fetch', 'واکشی پست‌ها...', 20);
      console.log(`📥 Fetching posts for @${page.username}...`);
      let savedPostsCount = 0;
      let updatedPostsCount = 0;
      try {
        const postsResponse = await axios.post(
          'https://instagram120.p.rapidapi.com/api/instagram/posts',
          { username: page.username, maxId: '' },
          { headers: ig120Headers, timeout: 30000 },
        );

        const postsEdges = postsResponse.data?.result?.edges || [];
        console.log(`📊 Found ${postsEdges.length} posts`);

        for (let idx = 0; idx < postsEdges.length; idx++) {
          const node = postsEdges[idx].node;
          if (!node) continue;

          const externalId = String(node.pk || node.id || '').split('_')[0];
          if (!externalId) continue;

          const caption = node.caption?.text || '';
          const likesCount = node.like_count || 0;
          const commentsCount = node.comment_count || 0;
          const viewsCount = node.view_count || node.play_count || 0;
          const publishedAt = node.taken_at ? new Date(node.taken_at * 1000) : undefined;

          // Determine post type and media URL
          const mediaType = node.media_type; // 1=image, 2=video, 8=carousel
          const isClips = node.product_type === 'clips';
          let postType = 'image';
          if (mediaType === 2 || isClips) {
            postType = isClips ? 'reel' : 'video';
          } else if (mediaType === 8) {
            postType = 'carousel';
          }

          // Check if post already exists
          const existing = await this.postRepository.findOne({ where: { external_id: externalId, page_id: page.id } });

          if (existing) {
            // Update engagement metrics on existing posts
            let needsUpdate = false;
            if (likesCount !== existing.likes_count) { existing.likes_count = likesCount; needsUpdate = true; }
            if (commentsCount !== existing.comments_count) { existing.comments_count = commentsCount; needsUpdate = true; }
            if (viewsCount && viewsCount !== existing.views_count) { existing.views_count = viewsCount; needsUpdate = true; }

            // If existing reel/video only has a .jpg thumbnail, re-download the actual video
            if ((postType === 'reel' || postType === 'video') && existing.media_url?.endsWith('.jpg') && node.video_versions?.length > 0) {
              const videoUrl = node.video_versions[0].url;
              const localPath = await this.downloadMedia(videoUrl, page.id, externalId);
              if (localPath) {
                existing.media_url = localPath;
                existing.is_transcribed = false; // Reset so it gets transcribed
                needsUpdate = true;
                console.log(`  🔄 Upgraded ${externalId} thumbnail → video`);
              }
            }

            if (needsUpdate) {
              await this.postRepository.save(existing);
              updatedPostsCount++;
            }
            updateProgress(id, 'fetch', 'بروزرسانی پست‌ها...', 20 + Math.round(((idx + 1) / postsEdges.length) * 50), `${idx + 1}/${postsEdges.length}`);
            continue;
          }

          // New post — download media and save
          // For video/reel: prefer video_versions (actual video file)
          // For image: use image_versions2
          let originalMediaUrl: string | undefined;
          if ((postType === 'reel' || postType === 'video') && node.video_versions?.length > 0) {
            originalMediaUrl = node.video_versions[0].url;
          } else if (node.image_versions2?.candidates?.length > 0) {
            originalMediaUrl = node.image_versions2.candidates[0].url;
          } else if (node.carousel_media?.length > 0) {
            const firstItem = node.carousel_media[0];
            if (firstItem.video_versions?.length > 0) {
              originalMediaUrl = firstItem.video_versions[0].url;
            } else if (firstItem.image_versions2?.candidates?.length > 0) {
              originalMediaUrl = firstItem.image_versions2.candidates[0].url;
            }
          }

          // Download media locally so CDN URLs don't expire
          let mediaUrl = originalMediaUrl;
          if (originalMediaUrl) {
            const localPath = await this.downloadMedia(originalMediaUrl, page.id, externalId);
            if (localPath) {
              mediaUrl = localPath;
            }
          }

          const post = this.postRepository.create({
            page_id: page.id,
            external_id: externalId,
            shortcode: node.code || externalId,
            caption,
            post_type: postType,
            media_url: mediaUrl,
            likes_count: likesCount,
            comments_count: commentsCount,
            views_count: viewsCount,
            published_at: publishedAt,
          });
          await this.postRepository.save(post);
          savedPostsCount++;
          updateProgress(id, 'fetch', 'دانلود مدیا...', 20 + Math.round(((idx + 1) / postsEdges.length) * 50), `${idx + 1}/${postsEdges.length}`);
          console.log(`  ✅ Saved ${postType} ${externalId} ${(postType === 'reel' || postType === 'video') && mediaUrl?.endsWith('.mp4') ? '(video)' : '(image)'}`);
        }

        if (updatedPostsCount > 0) {
          console.log(`  📊 Updated engagement metrics for ${updatedPostsCount} existing posts`);
        }
      } catch (postsErr) {
        console.warn(`⚠️ Could not fetch posts: ${postsErr.message}`);
      }

      // 3. Fetch stories via instagram120
      updateProgress(id, 'fetch', 'واکشی استوری‌ها...', 75);
      let savedStoriesCount = 0;
      try {
        console.log(`📖 Fetching stories for @${page.username}...`);
        const storiesResponse = await axios.post(
          'https://instagram120.p.rapidapi.com/api/instagram/stories',
          { username: page.username },
          { headers: ig120Headers, timeout: 20000 },
        );

        const storyItems = storiesResponse.data?.result || [];

        if (storyItems.length > 0) {
          console.log(`📖 Found ${storyItems.length} active stories`);

          for (const story of storyItems) {
            const storyId = story.pk || `story_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const externalId = `story_${storyId}`;

            const isVideo = !!story.video_versions;
            const imageUrl = story.image_versions2?.candidates?.[0]?.url || null;
            const videoUrl = isVideo ? story.video_versions?.[0]?.url : null;
            const caption = story.caption?.text || story.caption || '';
            const publishedAt = story.taken_at ? new Date(story.taken_at * 1000) : new Date();

            // Check if already saved
            const existing = await this.postRepository.findOne({
              where: { external_id: externalId, page_id: page.id },
            });

            if (existing) {
              // Update view count on existing stories
              if (story.viewer_count && story.viewer_count !== existing.views_count) {
                existing.views_count = story.viewer_count;
                await this.postRepository.save(existing);
              }
              continue;
            }

            // Download media locally (stories expire after 24h!)
            let localMediaUrl: string | null = null;
            const mediaToDownload = videoUrl || imageUrl;
            if (mediaToDownload) {
              localMediaUrl = await this.downloadMedia(mediaToDownload, page.id, externalId);
            }

            const storyPost = this.postRepository.create({
              page_id: page.id,
              external_id: externalId,
              caption,
              post_type: 'story',
              media_url: localMediaUrl || mediaToDownload,
              likes_count: 0,
              comments_count: 0,
              views_count: story.viewer_count || 0,
              published_at: publishedAt,
            });
            await this.postRepository.save(storyPost);
            savedStoriesCount++;
            console.log(`  📖 Saved story ${externalId} (${isVideo ? 'video' : 'image'})`);
          }
        } else {
          console.log(`📖 No active stories for @${page.username}`);
        }
      } catch (storyErr) {
        console.warn(`⚠️ Could not fetch stories: ${storyErr.message}`);
      }

      completeProgress(id, 'fetch');

      // Recompute engagement metrics from all posts after fetch.
      await this.recomputeEngagementMetrics(page.id);

      return {
        page: saved,
        status: 'fetched',
        message: `دیتای پروفایل و ${savedPostsCount} پست جدید و ${savedStoriesCount} استوری جدید واکشی شد${updatedPostsCount > 0 ? ` (${updatedPostsCount} پست بروزرسانی شد)` : ''}`,
        posts_fetched: savedPostsCount,
        posts_updated: updatedPostsCount,
        stories_fetched: savedStoriesCount,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        failProgress(id, 'fetch', error.message);
        throw error;
      }

      const statusCode = error?.response?.status || 502;
      const apiMessage = error?.response?.data?.message || error.message;

      // If API blocked (451/403), set fallback avatar
      if (statusCode === 451 || statusCode === 403) {
        page.profile_image_url = page.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(page.name)}&background=random&size=200`;
        await this.pageRepository.save(page);
        failProgress(id, 'fetch', `API blocked (${statusCode})`);
        throw new HttpException(`API اینستاگرام از این IP مسدود است (${statusCode}). لطفاً VPN را بررسی کنید.`, 503);
      }

      failProgress(id, 'fetch', apiMessage);
      throw new HttpException(`واکشی ناموفق (${statusCode}): ${apiMessage}`, 502);
    }
  }

  async processWithLLM(id: number, timeRange?: string, services?: string[], force?: boolean) {
    // Guard: prevent duplicate process if already running
    if (isRunning(id, 'process')) {
      return { status: 'already_running', message: 'تحلیل این پیج در حال اجراست' };
    }

    const page = await this.pageRepository.findOne({
      where: { id },
      relations: ['posts'],
    });
    if (!page) throw new HttpException('Page not found', 404);

    // Determine which services to run (default: all)
    const enabledServices = services && services.length > 0
      ? new Set(services)
      : new Set(['transcription', 'ocr', 'translation', 'analysis']);

    // Only send unprocessed posts to save tokens (unless force mode)
    const allPosts = (page.posts || [])
      .sort((a, b) => new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime());

    const unprocessedPosts = force ? allPosts : allPosts.filter(p => !p.sentiment_label);
    const recentPosts = unprocessedPosts.length > 0 ? unprocessedPosts.slice(0, 50) : allPosts.slice(0, 10);

    console.log(`🤖 Processing page ${page.name}: ${allPosts.length} total, ${unprocessedPosts.length} to process, services: ${[...enabledServices].join(',')}, force: ${!!force}`);
    startProgress(id, 'process', 'شروع پردازش...');

    if (recentPosts.length === 0) {
      completeProgress(id, 'process');
      return { page, status: 'skipped', message: 'همه پست‌ها قبلاً پردازش شده‌اند' };
    }

    // Transcription
    let transcriptionStats = { transcribed: 0, skipped: 0, failed: 0 };
    if (enabledServices.has('transcription')) {
      const allVideoPostsToTranscribe = allPosts.filter(
        p => ['video', 'reel', 'story'].includes(p.post_type) && (force || !p.is_transcribed),
      );
      if (force) {
        for (const post of allVideoPostsToTranscribe) {
          post.is_transcribed = false;
          post.transcription = null;
          post.transcription_fa = null;
        }
      }
      if (allVideoPostsToTranscribe.length > 0) {
        console.log(`🎙️ Transcribing ${allVideoPostsToTranscribe.length} video posts before AI analysis...`);
        updateProgress(id, 'process', 'رونوشت‌برداری ویدیوها...', 10, `0/${allVideoPostsToTranscribe.length}`);
        let transcribeIdx = 0;
        for (const post of allVideoPostsToTranscribe) {
          await this.transcriptionService.transcribePost(post);
          transcribeIdx++;
          updateProgress(id, 'process', 'رونوشت‌برداری ویدیوها...', 10 + Math.round((transcribeIdx / allVideoPostsToTranscribe.length) * 25), `${transcribeIdx}/${allVideoPostsToTranscribe.length}`);
        }
        transcriptionStats.transcribed = allVideoPostsToTranscribe.filter(p => p.transcription).length;
        transcriptionStats.skipped = allVideoPostsToTranscribe.filter(p => p.is_transcribed && !p.transcription).length;
        console.log(`🎙️ Transcription done: ${transcriptionStats.transcribed} transcribed, ${transcriptionStats.skipped} skipped`);
      }
    }

    // OCR: Extract on-screen text from image posts
    let ocrCount = 0;
    if (enabledServices.has('ocr')) {
      const postsNeedingOcr = recentPosts.filter(
        p => (force || p.ocr_text === null || p.ocr_text === undefined) && p.media_url &&
          ['.jpg', '.jpeg', '.png', '.webp'].some(ext => (p.media_url || '').toLowerCase().endsWith(ext)),
      );
      if (force) {
        for (const post of postsNeedingOcr) { post.ocr_text = null; post.ocr_text_fa = null; }
      }
      if (postsNeedingOcr.length > 0) {
        console.log(`🔍 Running OCR on ${postsNeedingOcr.length} image posts...`);
        updateProgress(id, 'process', 'استخراج متن تصاویر...', 35, `0/${postsNeedingOcr.length}`);
        for (let i = 0; i < postsNeedingOcr.length; i++) {
          const post = postsNeedingOcr[i];
          const ocrResult = await this.extractOcrText(post);
          if (ocrResult) {
            post.ocr_text = ocrResult;
            await this.postRepository.save(post);
            ocrCount++;
          } else {
            post.ocr_text = '';
            await this.postRepository.save(post);
          }
          updateProgress(id, 'process', 'استخراج متن تصاویر...', 35 + Math.round(((i + 1) / postsNeedingOcr.length) * 5), `${i + 1}/${postsNeedingOcr.length}`);
        }
        console.log(`🔍 OCR done: ${ocrCount} posts had on-screen text`);
      }
    }

    // Build post descriptions for the LLM — include transcription and OCR text
    const postsText = recentPosts.map((p, i) => {
      let text = `پست ${i} (id=${p.id}, نوع: ${p.post_type || 'text'}): "${(p.caption || '(بدون متن)').slice(0, 200)}" (لایک: ${p.likes_count}, کامنت: ${p.comments_count}, لحن: ${p.sentiment_label || 'نامشخص'})`;
      if (p.transcription) {
        text += `\n  [رونوشت صوتی/تصویری]: "${p.transcription.slice(0, 500)}"`;
      }
      if (p.ocr_text) {
        text += `\n  [متن روی تصویر]: "${p.ocr_text.slice(0, 300)}"`;
      }
      if (p.manual_context) {
        text += `\n  [توضیح دستی]: "${p.manual_context.slice(0, 500)}"`;
      }
      return text;
    }).join('\n');

    // Load system prompt, extra instructions, model and API key from settings
    const [systemPrompt, extraInstructions, apiKey, model, alignmentCriteria] = await Promise.all([
      this.settingsService.get('prompt_page_analysis'),
      this.settingsService.get('prompt_page_analysis_extra'),
      this.settingsService.get('openrouter_key'),
      this.settingsService.get('llm_model'),
      this.settingsService.get('alignment_criteria'),
    ]);

    const alignmentList = alignmentCriteria
      ? alignmentCriteria.split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => `- ${l}`).join('\n')
      : '- مخالفت با آمریکا و اسرائیل\n- حمایت از مسئله فلسطین\n- حمایت از لبنان و حزب‌الله\n- حمایت از جمهوری اسلامی ایران';

    // Load existing managed clusters so the LLM can match the page to one of them
    const managedClusters = await this.clusterRepository.find({ order: { id: 'ASC' } });
    const clustersList = managedClusters.length > 0
      ? managedClusters.map((c) => `${c.id} = ${c.name}${c.description ? ` — ${c.description}` : ''}`).join('\n')
      : '(هیچ خوشه‌ای تعریف نشده — مقدار cluster_id را null بگذار)';

    // Build the topical/identity reference list so the LLM uses ONLY allowed keys
    const topicalList = Object.entries(TOPICAL_CLUSTERS)
      .map(([k, v]) => `${k} = ${v.label} — ${v.description}`)
      .join('\n');
    const identityList = Object.entries(IDENTITY_CATEGORIES)
      .map(([k, v]) => `${k} = ${v.label} — ${v.description}`)
      .join('\n');
    const genderKeys = Object.keys(GENDERS).join(', ');
    const ageKeys = Object.keys(AGE_RANGES).join(', ');
    const religionKeys = Object.keys(RELIGIONS).join(', ');

    const prompt = `${systemPrompt || 'تو یک تحلیل‌گر ارشد رسانه‌ای، شبکه‌های اجتماعی و عملیات روایت هستی. اطلاعات زیر مربوط به یک صفحه/کانال/اکانت اجتماعی است. این تحلیل برای سامانه پایش و هدایت راهبردی شبکه‌های اجتماعی استفاده می‌شود. خروجی تو باید دقیق، محافظه‌کارانه، قابل اتکا، قابل استفاده در داشبورد و قابل ذخیره در دیتابیس باشد. فقط و فقط JSON معتبر برگردان. هیچ متن اضافه، markdown، توضیح، کامنت یا عبارت قبل و بعد از JSON ننویس.'}

---
## اطلاعات پیج
- نام: ${page.name}
- یوزرنیم: @${page.username}
- پلتفرم: ${page.platform}
- بیو: ${page.bio || 'ندارد'}
- فالوور: ${page.followers_count}
- فالووینگ: ${page.following_count}
- میانگین لایک ۱۰ پست انتهایی: ${page.avg_likes?.toFixed(0) || 'محاسبه نشده'}
- میانگین کامنت ۱۰ پست انتهایی: ${page.avg_comments?.toFixed(0) || 'محاسبه نشده'}
- نرخ تعامل: ${page.engagement_rate ? page.engagement_rate.toFixed(2) + '%' : 'محاسبه نشده'}
- تعداد کل پست: ${page.posts_count || 0}
- دسته‌بندی موضوعی فعلی: ${page.category || 'نامشخص'}
- دسته‌بندی هویتی فعلی: ${page.identity_category || 'نامشخص'}
- کشور: ${page.country || 'نامشخص'}

آخرین پست‌ها:
${postsText || 'پستی ثبت نشده'}
${extraInstructions ? `\nدستورات اضافی:\n${extraInstructions}\n` : ''}
---
## دسته‌بندی‌های مجاز

📚 خوشه‌های موضوعی مجاز برای فیلد "category" (دقیقاً یکی از این کلیدها):
${topicalList}

🆔 دسته‌بندی هویتی مجاز برای فیلد "identity_category" (دقیقاً یکی از این کلیدها):
${identityList}

⛪ دین/مذهب مجاز برای فیلد "religion" (یکی از: ${religionKeys}). اگر مشخص نیست unknown.
👤 جنسیت مجاز برای فیلد "gender" (یکی از: ${genderKeys}). برای تیم‌ها/برندها mixed و اگر نامعلوم unknown.
🎂 رده‌سنی مجاز برای فیلد "age_range" (یکی از: ${ageKeys}). اگر تعیین دقیق ممکن نیست unknown.

🗂️ خوشه‌های مدیریتی (cluster_id — عدد id یکی از اینها یا null):
${clustersList}

🚩 معیارهای همسویی (alignment_score):
${alignmentList}
`;

    if (enabledServices.has('analysis') || enabledServices.has('translation')) {
    try {
      updateProgress(id, 'process', 'ارسال به هوش مصنوعی...', 40);
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: model || 'google/gemini-2.5-pro',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey || process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000, // 2 minutes — reasoning models need more time
        },
      );

      const choice = response.data?.choices?.[0];
      // Some models (Gemini 2.5 Pro) return reasoning in a separate field
      // and may put the actual content in `content` or only in `reasoning`
      const content = choice?.message?.content
        || choice?.message?.reasoning
        || '';

      if (!content) {
        console.error('❌ LLM returned empty response:', JSON.stringify(response.data, null, 2));
        throw new HttpException('LLM returned empty response — try again or switch to a different model in settings', 502);
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new HttpException('LLM response did not contain valid JSON', 502);
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Update page with LLM analysis
      updateProgress(id, 'process', 'ذخیره نتایج تحلیل...', 80);
      const updateData: any = {};
      if (analysis.category) { updateData.category = analysis.category; updateData.category_source = 'ai'; }
      if (analysis.identity_category) { updateData.identity_category = analysis.identity_category; updateData.identity_category_source = 'ai'; }
      if (analysis.cluster) updateData.cluster = analysis.cluster;
      // Validate cluster_id from LLM against existing clusters
      if (analysis.cluster_id !== undefined && analysis.cluster_id !== null) {
        const validClusterId = managedClusters.find((c) => c.id === Number(analysis.cluster_id))?.id;
        if (validClusterId) {
          updateData.cluster_id = validClusterId;
        }
      }
      // Fallback: if LLM didn't assign cluster_id but we have a category, match by label
      if (!updateData.cluster_id && analysis.category && managedClusters.length > 0) {
        const categoryLabel = TOPICAL_CLUSTERS[analysis.category]?.label;
        if (categoryLabel) {
          const matchedCluster = managedClusters.find((c) => c.name === categoryLabel);
          if (matchedCluster) {
            updateData.cluster_id = matchedCluster.id;
          }
        }
      }
      if (analysis.credibility_score !== undefined) updateData.credibility_score = analysis.credibility_score;
      if (analysis.influence_score !== undefined) updateData.influence_score = analysis.influence_score;
      if (analysis.consistency_rate !== undefined) updateData.consistency_rate = analysis.consistency_rate;
      if (analysis.affinity_score !== undefined) updateData.affinity_score = analysis.affinity_score;
      if (analysis.alignment_score !== undefined) updateData.alignment_score = analysis.alignment_score;
      if (analysis.persona_radar) updateData.persona_radar = analysis.persona_radar;
      if (analysis.pain_points) updateData.pain_points = analysis.pain_points;
      if (analysis.keywords) updateData.keywords = analysis.keywords;
      if (analysis.language) updateData.language = analysis.language;
      if (analysis.content_language) updateData.content_language = analysis.content_language;
      if (analysis.religion) updateData.religion = analysis.religion;
      if (analysis.gender) updateData.gender = analysis.gender;
      if (analysis.age_range) updateData.age_range = analysis.age_range;
      if (analysis.nationality) updateData.nationality = analysis.nationality;

      Object.assign(page, updateData);
      page.last_processed_at = new Date();
      page.last_processed_timeframe = timeRange || 'all';
      const saved = await this.pageRepository.save(page);

      // Refresh engagement metrics in case new posts were processed
      const fresh = await this.recomputeEngagementMetrics(page.id);
      Object.assign(saved, fresh);

      // Update posts with sentiment analysis
      if (analysis.posts_analysis && Array.isArray(analysis.posts_analysis)) {
        const postMap = new Map(recentPosts.map(p => [p.id, p]));

        for (const pa of analysis.posts_analysis) {
          // Support both post_id (new) and index (legacy) formats
          let post: Post | undefined;
          if (pa.post_id) {
            post = postMap.get(pa.post_id);
          } else if (pa.index !== undefined) {
            post = recentPosts[pa.index];
          }

          if (post) {
            // Support both new format (sentiment: string) and legacy (sentiment_score + sentiment_label)
            if (pa.sentiment !== undefined) {
              // New format: sentiment is a string like positive/negative/neutral/mixed/unknown
              const sentimentMap: Record<string, number> = { positive: 0.7, negative: -0.7, neutral: 0, mixed: 0, unknown: 0 };
              post.sentiment_score = sentimentMap[pa.sentiment] ?? 0;
              post.sentiment_label = pa.sentiment === 'positive' ? 'hopeful' : pa.sentiment === 'negative' ? 'angry' : 'neutral';
            } else {
              post.sentiment_score = pa.sentiment_score ?? 0;
              post.sentiment_label = pa.sentiment_label || 'neutral';
            }
            post.extracted_topics = pa.topics || [];
            post.extracted_keywords = pa.keywords || [];
            if (pa.caption_fa) {
              post.caption_fa = pa.caption_fa;
            }
            if (pa.transcription_fa) {
              post.transcription_fa = pa.transcription_fa;
            }
            if (pa.ocr_text_fa) {
              post.ocr_text_fa = pa.ocr_text_fa;
            }
            await this.postRepository.save(post);
          }
        }
      }

      completeProgress(id, 'process');
      return {
        page: saved,
        status: 'processed',
        message: 'تحلیل هوشمند با موفقیت انجام شد',
        analysis,
        transcription: transcriptionStats,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        failProgress(id, 'process', error.message);
        throw error;
      }
      const statusCode = error?.response?.status || 502;
      const apiMessage = error?.response?.data?.error?.message || error?.response?.data?.message || error.message;
      console.error(`❌ LLM processing failed (${statusCode}):`, apiMessage);
      failProgress(id, 'process', apiMessage);
      throw new HttpException(`خطا در پردازش LLM (${statusCode}): ${apiMessage}`, 502);
    }
    } else {
      // No analysis/translation requested — just complete
      completeProgress(id, 'process');
      page.last_processed_at = new Date();
      page.last_processed_timeframe = timeRange || 'all';
      const saved = await this.pageRepository.save(page);
      return { page: saved, status: 'processed', message: 'پردازش (بدون تحلیل AI) انجام شد', transcription: transcriptionStats };
    }
  }

  async update(id: number, dto: UpdatePageDto) {
    const page = await this.findById(id);
    // Track if category was manually changed
    if (dto.category && dto.category !== page.category) {
      (dto as any).category_source = 'manual';
    }
    if (dto.identity_category && dto.identity_category !== page.identity_category) {
      (dto as any).identity_category_source = 'manual';
    }
    Object.assign(page, dto);
    return await this.pageRepository.save(page);
  }

  /**
   * Recompute engagement metrics from the page's posts:
   * - posts_count: total non-story posts
   * - avg_likes: mean of last 10 (image/video/reel/carousel) posts
   * - avg_comments: same
   * - engagement_rate: ((avg_likes + avg_comments) / followers) × 100
   *
   * Stories are excluded from likes/comments averages because they don't have those metrics.
   */
  async recomputeEngagementMetrics(pageId: number): Promise<Partial<Page>> {
    const page = await this.pageRepository.findOne({ where: { id: pageId } });
    if (!page) return {};

    const allPosts = await this.postRepository.find({
      where: { page_id: pageId },
      order: { published_at: 'DESC' },
    });

    const nonStory = allPosts.filter((p) => p.post_type !== 'story');
    const lastTen = nonStory.slice(0, 10);

    const sum = (arr: number[]) => arr.reduce((s, n) => s + (n || 0), 0);
    const avg = (arr: number[]) => (arr.length === 0 ? 0 : sum(arr) / arr.length);

    const avgLikes = avg(lastTen.map((p) => p.likes_count));
    const avgComments = avg(lastTen.map((p) => p.comments_count));
    const followers = page.followers_count || 0;
    const engagementRate = followers > 0 ? ((avgLikes + avgComments) / followers) * 100 : 0;

    page.avg_likes = Math.round(avgLikes * 100) / 100;
    page.avg_comments = Math.round(avgComments * 100) / 100;
    page.engagement_rate = Math.round(engagementRate * 1000) / 1000;
    page.posts_count = nonStory.length;

    await this.pageRepository.save(page);
    return {
      avg_likes: page.avg_likes,
      avg_comments: page.avg_comments,
      engagement_rate: page.engagement_rate,
      posts_count: page.posts_count,
    };
  }

  /**
   * Generate the 360° insight panel content for a page.
   * Produces 5 fields in one LLM call:
   *  1. narrative_description (200-300 word free description)
   *  2. topic_distribution    (~4-8 topics with min/max percent)
   *  3. audience_description  (paragraph about followers)
   *  4. engagement_suggestion (Persian engagement strategy)
   *  5. engagement_suggestion_translations (en, ar, es, tr, ur)
   */
  async generateNarrative(pageId: number) {
    const page = await this.pageRepository.findOne({
      where: { id: pageId },
      relations: ['posts'],
    });
    if (!page) throw new HttpException('Page not found', 404);

    const posts = (page.posts || [])
      .sort(
        (a, b) =>
          new Date(b.published_at || b.created_at).getTime() -
          new Date(a.published_at || a.created_at).getTime(),
      )
      .slice(0, 30);

    if (posts.length === 0) {
      throw new HttpException('برای تولید توصیف، حداقل یک پست لازم است. ابتدا بارگیری و پردازش انجام دهید.', 400);
    }

    const postLines = posts
      .map((p, i) => {
        const text = p.caption_fa || p.caption || '(بدون متن)';
        const transcript = p.transcription_fa || p.transcription;
        const ocr = p.ocr_text_fa || p.ocr_text;
        const parts: string[] = [text.slice(0, 220)];
        if (transcript) parts.push(`[رونوشت]: ${String(transcript).slice(0, 220)}`);
        if (ocr) parts.push(`[متن تصویر]: ${String(ocr).slice(0, 150)}`);
        return `پست ${i + 1} (${p.post_type || 'text'}, لایک ${p.likes_count}, کامنت ${p.comments_count}): ${parts.join(' / ')}`;
      })
      .join('\n');

    const personaSummary = page.persona_radar
      ? Object.entries(page.persona_radar)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')
      : 'نامشخص';

    const [systemPrompt, extraInstructions, apiKey, model] = await Promise.all([
      this.settingsService.get('prompt_page_narrative'),
      this.settingsService.get('prompt_page_narrative_extra'),
      this.settingsService.get('openrouter_key'),
      this.settingsService.get('llm_model'),
    ]);

    const prompt = `${systemPrompt || 'تو یک تحلیل‌گر ارشد رسانه‌ای، شبکه‌های اجتماعی و عملیات روایت هستی. وظیفه تو تولید «پنل ۳۶۰ درجه بصیرت» برای یک صفحه/کانال/اکانت اجتماعی است. این خروجی برای نمایش در داشبورد مدیریتی استفاده می‌شود؛ بنابراین باید دقیق، خوانا، راهبردی، قابل اعتماد و قابل استفاده برای تصمیم‌گیری باشد. فقط و فقط JSON معتبر برگردان. هیچ متن اضافه، markdown، توضیح، کامنت یا عبارت قبل و بعد از JSON ننویس.'}

---
## داده ورودی

اطلاعات پیج:
- نام: ${page.name}
- یوزرنیم: @${page.username}
- پلتفرم: ${page.platform}
- بیو: ${page.bio || 'ندارد'}
- فالوور: ${page.followers_count?.toLocaleString() || 0}
- فالووینگ: ${page.following_count?.toLocaleString() || 0}
- تعداد کل پست: ${page.posts_count || posts.length}
- میانگین لایک ۱۰ پست انتهایی: ${page.avg_likes || '—'}
- میانگین کامنت ۱۰ پست انتهایی: ${page.avg_comments || '—'}
- نرخ تعامل: ${page.engagement_rate ? page.engagement_rate.toFixed(2) + '٪' : '—'}
- خوشه موضوعی: ${page.category || 'نامشخص'}
- کیستی صفحه: ${page.identity_category || 'نامشخص'}
- ملیت: ${page.nationality || 'نامشخص'}
- زبان تولیدی: ${page.content_language || page.language || 'نامشخص'}
- دین/مذهب: ${page.religion || 'نامشخص'}
- جنسیت: ${page.gender || 'نامشخص'}
- رده سنی: ${page.age_range || 'نامشخص'}
- خوشه معنایی: ${page.cluster || '—'}
- شخصیت رادار: ${personaSummary}
- دغدغه‌های اصلی: ${(page.pain_points || []).join('، ') || '—'}
- کلمات کلیدی: ${(page.keywords || []).join('، ') || '—'}

${posts.length} پست انتهایی:
${postLines}
${extraInstructions ? `\nدستورات اضافی:\n${extraInstructions}\n` : ''}
---
## ساختار خروجی الزامی

خروجی باید دقیقاً این ساختار JSON را داشته باشد:
{
  "narrative_description": "متن فارسی ۲۰۰ تا ۳۰۰ کلمه‌ای پیوسته و خوانا",
  "topic_distribution": [
    {"topic": "نام موضوع فارسی", "min_percent": 0, "max_percent": 0}
  ],
  "audience_description": "متن فارسی ۸۰ تا ۱۲۰ کلمه‌ای",
  "engagement_suggestion": "متن فارسی ۸۰ تا ۱۲۰ کلمه‌ای",
  "engagement_suggestion_translations": {
    "en": "",
    "ar": "",
    "es": "",
    "tr": "",
    "ur": ""
  }
}`;

    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: model || 'google/gemini-2.5-pro',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey || process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 180000,
        },
      );

      const choice = response.data?.choices?.[0];
      const content = choice?.message?.content || choice?.message?.reasoning || '';
      if (!content) throw new HttpException('LLM returned empty response', 502);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new HttpException('LLM response did not contain valid JSON', 502);
      const parsed = JSON.parse(jsonMatch[0]);

      page.narrative_description = parsed.narrative_description || null;
      page.topic_distribution = Array.isArray(parsed.topic_distribution)
        ? parsed.topic_distribution
            .map((t: any) => ({
              topic: String(t.topic || '').trim(),
              min_percent: Number(t.min_percent) || 0,
              max_percent: Number(t.max_percent) || 0,
            }))
            .filter((t: any) => t.topic && t.max_percent > 0)
        : null;
      page.audience_description = parsed.audience_description || null;
      page.engagement_suggestion = parsed.engagement_suggestion || null;
      page.engagement_suggestion_translations = parsed.engagement_suggestion_translations || null;
      page.narrative_generated_at = new Date();

      const saved = await this.pageRepository.save(page);

      return {
        page: saved,
        status: 'success',
        message: 'پنل ۳۶۰° بصیرت با موفقیت تولید شد',
        narrative: {
          narrative_description: saved.narrative_description,
          topic_distribution: saved.topic_distribution,
          audience_description: saved.audience_description,
          engagement_suggestion: saved.engagement_suggestion,
          engagement_suggestion_translations: saved.engagement_suggestion_translations,
          narrative_generated_at: saved.narrative_generated_at,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const statusCode = error?.response?.status || 502;
      const apiMessage =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error.message;
      console.error(`❌ Narrative generation failed (${statusCode}):`, apiMessage);
      throw new HttpException(`خطا در تولید پنل بصیرت (${statusCode}): ${apiMessage}`, 502);
    }
  }

  async remove(id: number) {
    const page = await this.findById(id);

    // Delete all related records (foreign key constraints)
    await this.actionPlanRepository.delete({ page_id: id });
    await this.fieldReportRepository.delete({ page_id: id });
    await this.postRepository.delete({ page_id: id });

    // سازگاری دورهٔ گذار (Requirement 2.9): حذف خودِ موجودیت منبع به
    // SourcesService (مالک منابع) واگذار می‌شود. پاک‌سازی رکوردهای وابسته
    // (FK) همچنان اینجا انجام می‌شود چون به repository های همین ماژول legacy
    // نیاز دارد و هنوز به SourcesService منتقل نشده است.
    await this.sourcesService.remove(id);
    return page;
  }

  // --- Analytics helpers ---

  async getCategoryDistribution(pageIds?: number[]) {
    const qb = this.pageRepository
      .createQueryBuilder('page')
      .select('page.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('page.category');
    if (pageIds) {
      if (pageIds.length === 0) return [];
      qb.where('page.id IN (:...ids)', { ids: pageIds });
    }
    return await qb.getRawMany();
  }

  async getClusterDistribution(pageIds?: number[]) {
    const qb = this.pageRepository
      .createQueryBuilder('page')
      .select('page.cluster', 'cluster')
      .addSelect('COUNT(*)', 'count')
      .groupBy('page.cluster');
    if (pageIds) {
      if (pageIds.length === 0) return [];
      qb.where('page.id IN (:...ids)', { ids: pageIds });
    }
    return await qb.getRawMany();
  }

  async getCountryDistribution(pageIds?: number[]) {
    const qb = this.pageRepository
      .createQueryBuilder('page')
      .select('page.country', 'country')
      .addSelect('COUNT(*)', 'count')
      .groupBy('page.country');
    if (pageIds) {
      if (pageIds.length === 0) return [];
      qb.where('page.id IN (:...ids)', { ids: pageIds });
    }
    return await qb.getRawMany();
  }

  async getLanguageDistribution(pageIds?: number[]) {
    const qb = this.pageRepository
      .createQueryBuilder('page')
      .select('COALESCE(page.content_language, page.language)', 'language')
      .addSelect('COUNT(*)', 'count')
      .groupBy('COALESCE(page.content_language, page.language)');
    if (pageIds) {
      if (pageIds.length === 0) return [];
      qb.where('page.id IN (:...ids)', { ids: pageIds });
    }
    return await qb.getRawMany();
  }

  async getReligionDistribution(pageIds?: number[]) {
    const qb = this.pageRepository
      .createQueryBuilder('page')
      .select('page.religion', 'religion')
      .addSelect('COUNT(*)', 'count')
      .groupBy('page.religion');
    if (pageIds) {
      if (pageIds.length === 0) return [];
      qb.where('page.id IN (:...ids)', { ids: pageIds });
    }
    return await qb.getRawMany();
  }

  async getTopInfluencers(limit = 20, pageIds?: number[]) {
    const qb = this.pageRepository
      .createQueryBuilder('page')
      .orderBy('page.influence_score', 'DESC')
      .take(limit);
    if (pageIds) {
      if (pageIds.length === 0) return [];
      qb.where('page.id IN (:...ids)', { ids: pageIds });
    }
    return await qb.getMany();
  }

  async getGhostPages(pageIds?: number[]) {
    const qb = this.pageRepository
      .createQueryBuilder('page')
      .where('(page.consistency_rate < :threshold OR page.is_active = false)', { threshold: 2 })
      .orderBy('page.consistency_rate', 'ASC')
      .limit(50);
    if (pageIds) {
      if (pageIds.length === 0) return [];
      qb.andWhere('page.id IN (:...ids)', { ids: pageIds });
    }
    return await qb.getMany();
  }

  /**
   * Resolve scope to an explicit list of page IDs to feed into analytics queries.
   * Returns `undefined` when scope is "all"/"network" so analytics cover the whole
   * network with no filter.
   *
   * Supported scopes:
   *  - all | network            → undefined (whole network)
   *  - representatives          → pages flagged is_representative
   *  - cluster (+clusterId)     → pages of a cluster
   *  - all_micromedia           → pages linked to any micro-media (تحلیل «شبکه»)
   *  - micromedia:<id>          → pages of one micro-media
   *  - platform:<name>          → pages of one platform/سکو
   *  - micromedia:<id>:platform:<name> → one micro-media on one platform
   */
  async resolveScopePageIds(
    scope?: string,
    clusterId?: number | string,
  ): Promise<number[] | undefined> {
    if (!scope || scope === 'all' || scope === 'network') return undefined;

    if (scope === 'representatives') {
      const rows = await this.pageRepository.find({
        where: { is_representative: true },
        select: ['id'],
      });
      return rows.map((r) => r.id);
    }

    if (scope === 'cluster') {
      const cid = Number(clusterId);
      if (!cid) return [];
      const rows = await this.pageRepository.find({
        where: { cluster_id: cid },
        select: ['id'],
      });
      return rows.map((r) => r.id);
    }

    // --- scopeهای میکرورسانه/سکو (micromedia-transformation) ---
    if (
      scope === 'all_micromedia' ||
      scope.startsWith('micromedia:') ||
      scope.startsWith('platform:')
    ) {
      const qb = this.pageRepository
        .createQueryBuilder('p')
        .select('p.id', 'id');

      if (scope === 'all_micromedia') {
        qb.where('p.micro_media_id IS NOT NULL');
      } else {
        // الگو: "micromedia:<id>" | "platform:<name>" | "micromedia:<id>:platform:<name>"
        const mediaMatch = scope.match(/micromedia:(\d+)/);
        const platformMatch = scope.match(/platform:([^:]+)/);
        const conditions: string[] = [];
        const params: Record<string, unknown> = {};
        if (mediaMatch) {
          conditions.push('p.micro_media_id = :mid');
          params.mid = Number(mediaMatch[1]);
        }
        if (platformMatch) {
          conditions.push('p.platform = :plat');
          params.plat = decodeURIComponent(platformMatch[1]);
        }
        if (conditions.length === 0) return [];
        qb.where(conditions.join(' AND '), params);
      }

      const rows = await qb.getRawMany<{ id: number }>();
      return rows.map((r) => Number(r.id));
    }

    return undefined;
  }

  async getSegmentCounts() {
    const [total, ghost, highInfluenceLowCred] = await Promise.all([
      this.pageRepository.count(),
      this.pageRepository.createQueryBuilder('page')
        .where('page.consistency_rate < 2 OR page.is_active = false')
        .getCount(),
      this.pageRepository.createQueryBuilder('page')
        .where('page.influence_score > 7 AND page.credibility_score < 4')
        .getCount(),
    ]);

    return { total, ghost, high_influence_low_credibility: highInfluenceLowCred };
  }

  async exportPageData(id: number) {
    const page = await this.pageRepository.findOne({
      where: { id },
      relations: ['posts', 'field_reports'],
    });
    if (!page) return { error: 'Page not found' };

    return {
      page: {
        id: page.id,
        name: page.name,
        username: page.username,
        platform: page.platform,
        category: page.category,
        identity_category: page.identity_category,
        country: page.country,
        nationality: page.nationality,
        language: page.language,
        content_language: page.content_language,
        religion: page.religion,
        gender: page.gender,
        age_range: page.age_range,
        bio: page.bio,
        followers_count: page.followers_count,
        following_count: page.following_count,
        avg_likes: page.avg_likes,
        avg_comments: page.avg_comments,
        engagement_rate: page.engagement_rate,
        posts_count: page.posts_count,
        cluster: page.cluster,
        credibility_score: page.credibility_score,
        influence_score: page.influence_score,
        consistency_rate: page.consistency_rate,
        affinity_score: page.affinity_score,
        alignment_score: page.alignment_score,
        persona_radar: page.persona_radar,
        pain_points: page.pain_points,
        keywords: page.keywords,
        is_active: page.is_active,
        last_fetched_at: page.last_fetched_at,
        last_processed_at: page.last_processed_at,
      },
      posts: (page.posts || []).map((p) => ({
        id: p.id,
        caption: p.caption,
        post_type: p.post_type,
        likes_count: p.likes_count,
        comments_count: p.comments_count,
        shares_count: p.shares_count,
        sentiment_score: p.sentiment_score,
        sentiment_label: p.sentiment_label,
        extracted_topics: p.extracted_topics,
        extracted_keywords: p.extracted_keywords,
        published_at: p.published_at,
      })),
      field_reports: (page.field_reports || []).map((r) => ({
        id: r.id,
        content: r.content,
        source_type: r.source_type,
        sentiment: r.sentiment,
        status: r.status,
        created_at: r.created_at,
      })),
    };
  }

  async getRelatedPages(pageId: number, limit = 8) {
    const page = await this.pageRepository.findOne({ where: { id: pageId } });
    if (!page) return [];

    const qb = this.pageRepository.createQueryBuilder('p')
      .where('p.id != :pageId', { pageId });

    if (page.cluster) {
      qb.andWhere('(p.cluster = :cluster OR p.category = :category)', { cluster: page.cluster, category: page.category });
    } else if (page.category) {
      qb.andWhere('p.category = :category', { category: page.category });
    }

    qb.orderBy('p.influence_score', 'DESC').limit(limit);
    let results = await qb.getMany();

    // Fallback: if no related pages found, return top pages
    if (results.length === 0) {
      results = await this.pageRepository.find({
        where: {},
        order: { influence_score: 'DESC' },
        take: limit,
      });
      results = results.filter((p) => p.id !== pageId);
    }

    return results;
  }

  /**
   * Get pages with high influence but zero field reports (blind spots).
   * These are priority targets for field research.
   */
  async getBlindSpots(limit: number = 6) {
    const pages = await this.pageRepository
      .createQueryBuilder('page')
      .leftJoin('page.field_reports', 'fr')
      .where('fr.id IS NULL')
      .andWhere('page.influence_score > 0')
      .orderBy('page.influence_score', 'DESC')
      .take(limit)
      .getMany();

    return pages.map((p) => ({
      id: p.id,
      name: p.name,
      username: p.username,
      platform: p.platform,
      influence: p.influence_score || 0,
    }));
  }
}
