import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as FormData from 'form-data';
import { Post } from '../post/post.entity';

const SONIOX_API_BASE = 'https://api.soniox.com';

// Video post types that should be transcribed
const TRANSCRIBABLE_TYPES = ['video', 'reel', 'story'];

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
  ) {}

  private get apiKey(): string {
    return process.env.SONIOX_API_KEY || '';
  }

  /**
   * Make an authenticated request to the Soniox API.
   */
  private async sonioxFetch(
    endpoint: string,
    options: { method?: string; body?: any; headers?: Record<string, string>; isFormData?: boolean } = {},
  ): Promise<any> {
    const { method = 'GET', body, headers = {}, isFormData = false } = options;

    if (!this.apiKey) {
      throw new Error('SONIOX_API_KEY is not configured');
    }

    const config: any = {
      method,
      url: `${SONIOX_API_BASE}${endpoint}`,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...headers,
      },
      timeout: 30000,
    };

    if (body) {
      if (isFormData) {
        config.data = body;
        // Let axios set the content-type with boundary for FormData
      } else {
        config.data = body;
        config.headers['Content-Type'] = 'application/json';
      }
    }

    const response = await axios(config);
    return response.data;
  }

  /**
   * Upload a local file to Soniox and return the file ID.
   */
  private async uploadFile(filePath: string): Promise<string> {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    const response = await axios.post(`${SONIOX_API_BASE}/v1/files`, form, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...form.getHeaders(),
      },
      timeout: 120000, // 2 min for large video uploads
      maxContentLength: 100 * 1024 * 1024, // 100MB
    });

    return response.data.id;
  }

  /**
   * Create a transcription job on Soniox.
   */
  private async createTranscription(audioUrl?: string, fileId?: string): Promise<string> {
    const config: any = {
      model: 'stt-async-v4',
      // Farsi + Arabic + English — covers the main languages in this project
      language_hints: ['fa', 'ar', 'en'],
      enable_language_identification: true,
    };

    if (audioUrl) {
      config.audio_url = audioUrl;
    } else if (fileId) {
      config.file_id = fileId;
    } else {
      throw new Error('Either audio_url or file_id must be provided');
    }

    const result = await this.sonioxFetch('/v1/transcriptions', {
      method: 'POST',
      body: config,
    });

    return result.id;
  }

  /**
   * Poll until transcription is completed or errored.
   */
  private async waitForCompletion(transcriptionId: string, maxWaitMs = 300000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.sonioxFetch(`/v1/transcriptions/${transcriptionId}`);

      if (result.status === 'completed') return;
      if (result.status === 'error') {
        throw new Error(`Soniox transcription error: ${result.error_message}`);
      }

      // Poll every 2 seconds
      await new Promise((r) => setTimeout(r, 2000));
    }

    throw new Error(`Transcription timed out after ${maxWaitMs / 1000}s`);
  }

  /**
   * Get the transcript text from a completed transcription.
   */
  private async getTranscriptText(transcriptionId: string): Promise<string> {
    const result = await this.sonioxFetch(`/v1/transcriptions/${transcriptionId}/transcript`);

    if (!result.tokens || result.tokens.length === 0) {
      return '';
    }

    // Render tokens into plain text (simplified — no speaker tags needed for analysis)
    const parts: string[] = [];
    for (const token of result.tokens) {
      parts.push(token.text || '');
    }

    return parts.join('').trim();
  }

  /**
   * Clean up Soniox resources after transcription.
   */
  private async cleanup(transcriptionId: string, fileId?: string): Promise<void> {
    try {
      await this.sonioxFetch(`/v1/transcriptions/${transcriptionId}`, { method: 'DELETE' });
    } catch (e) {
      this.logger.warn(`Failed to delete transcription ${transcriptionId}: ${e.message}`);
    }

    if (fileId) {
      try {
        await this.sonioxFetch(`/v1/files/${fileId}`, { method: 'DELETE' });
      } catch (e) {
        this.logger.warn(`Failed to delete file ${fileId}: ${e.message}`);
      }
    }
  }

  /**
   * Resolve a media_url to something Soniox can access.
   * - Local files (/static/media/...) → upload to Soniox, return fileId
   * - Remote URLs → return audioUrl directly
   * Returns { audioUrl?, fileId? }
   */
  private async resolveMediaSource(mediaUrl: string): Promise<{ audioUrl?: string; fileId?: string }> {
    if (mediaUrl.startsWith('/static/')) {
      // Local file — resolve to absolute path and upload
      const localPath = path.join(process.cwd(), 'public', mediaUrl.replace('/static/', ''));

      if (!fs.existsSync(localPath)) {
        throw new Error(`Local media file not found: ${localPath}`);
      }

      const fileId = await this.uploadFile(localPath);
      return { fileId };
    }

    // Remote URL — pass directly
    return { audioUrl: mediaUrl };
  }

  /**
   * Transcribe a single post's video/audio.
   * Returns the transcription text, or null if not applicable/failed.
   * Saves the result to the database so it's never re-transcribed.
   */
  async transcribePost(post: Post): Promise<string | null> {
    // Skip if already transcribed
    if (post.is_transcribed) {
      return post.transcription || null;
    }

    // Skip non-video posts
    if (!TRANSCRIBABLE_TYPES.includes(post.post_type)) {
      post.is_transcribed = true;
      post.transcription = null;
      await this.postRepository.save(post);
      return null;
    }

    // Skip if no media URL
    if (!post.media_url) {
      this.logger.warn(`Post ${post.id} is a ${post.post_type} but has no media_url`);
      post.is_transcribed = true;
      post.transcription = null;
      await this.postRepository.save(post);
      return null;
    }

    // Skip if media is not an audio/video file (e.g. thumbnail .jpg for reels)
    const mediaLower = post.media_url.toLowerCase();
    const isAudioVideo = ['.mp4', '.webm', '.ogg', '.m4a', '.wav', '.mp3', '.aac', '.flac', '.mov', '.mkv'].some(ext => mediaLower.endsWith(ext));
    if (!isAudioVideo) {
      this.logger.warn(`Post ${post.id} (${post.post_type}) has non-audio media: ${post.media_url.slice(-20)} — skipping transcription`);
      post.is_transcribed = true;
      post.transcription = null;
      await this.postRepository.save(post);
      return null;
    }

    let fileId: string | undefined;
    let transcriptionId: string | undefined;

    try {
      this.logger.log(`🎙️ Transcribing post ${post.id} (${post.post_type})...`);

      // 1. Resolve media source
      const source = await this.resolveMediaSource(post.media_url);
      fileId = source.fileId;

      // 2. Create transcription
      transcriptionId = await this.createTranscription(source.audioUrl, source.fileId);
      this.logger.log(`📝 Transcription job created: ${transcriptionId}`);

      // 3. Wait for completion
      await this.waitForCompletion(transcriptionId);

      // 4. Get transcript text
      const text = await this.getTranscriptText(transcriptionId);
      this.logger.log(`✅ Transcription complete for post ${post.id}: ${text.length} chars`);

      // 5. Save to database (never transcribe again)
      post.transcription = text || null;
      post.is_transcribed = true;
      await this.postRepository.save(post);

      // 6. Cleanup Soniox resources
      await this.cleanup(transcriptionId, fileId);

      return text || null;
    } catch (error) {
      this.logger.error(`❌ Transcription failed for post ${post.id}: ${error.message}`);

      // Mark as attempted so we don't retry endlessly
      post.is_transcribed = true;
      post.transcription = null;
      await this.postRepository.save(post);

      // Cleanup on error
      if (transcriptionId) {
        await this.cleanup(transcriptionId, fileId);
      }

      return null;
    }
  }

  /**
   * Transcribe all un-transcribed video posts for a page.
   * Token-conscious: only transcribes posts that haven't been transcribed yet.
   * Returns count of newly transcribed posts.
   */
  async transcribePageVideos(pageId: number): Promise<{ transcribed: number; skipped: number; failed: number }> {
    if (!this.apiKey) {
      this.logger.warn('SONIOX_API_KEY not configured — skipping transcription');
      return { transcribed: 0, skipped: 0, failed: 0 };
    }

    const videoPosts = await this.postRepository.find({
      where: [
        { page_id: pageId, post_type: 'video', is_transcribed: false },
        { page_id: pageId, post_type: 'reel', is_transcribed: false },
        { page_id: pageId, post_type: 'story', is_transcribed: false },
      ],
    });

    if (videoPosts.length === 0) {
      return { transcribed: 0, skipped: 0, failed: 0 };
    }

    this.logger.log(`🎬 Found ${videoPosts.length} un-transcribed video posts for page ${pageId}`);

    let transcribed = 0;
    let skipped = 0;
    let failed = 0;

    for (const post of videoPosts) {
      try {
        const text = await this.transcribePost(post);
        if (text) {
          transcribed++;
        } else {
          skipped++;
        }
      } catch {
        failed++;
      }

      // Small delay between transcriptions to be nice to the API
      if (videoPosts.indexOf(post) < videoPosts.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    this.logger.log(`🎙️ Transcription batch done: ${transcribed} transcribed, ${skipped} skipped, ${failed} failed`);
    return { transcribed, skipped, failed };
  }
}
