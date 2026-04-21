import { HttpException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Page } from '../page/page.entity';
import { Post } from '../post/post.entity';

@Injectable()
export class TelegramService implements OnModuleInit {
  private client: TelegramClient;
  private session: StringSession;
  private isConnecting: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(
    @InjectRepository(Page)
    private pageRepository: Repository<Page>,
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
  ) {}

  async onModuleInit() {
    // Don't connect on startup - use lazy connection instead
    console.log('📱 Telegram service initialized (lazy connection mode)');
    console.log('💡 Telegram will connect only when needed');
  }

  private async ensureConnected(): Promise<void> {
    // If already connected, return immediately
    if (this.client && this.client.connected) {
      return;
    }

    // If currently connecting, wait for that connection
    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    // Start new connection
    this.isConnecting = true;
    this.connectionPromise = this._connect();
    
    try {
      await this.connectionPromise;
    } finally {
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }

  private async _connect(): Promise<void> {
    const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
    const apiHash = process.env.TELEGRAM_API_HASH || '';
    const sessionString = process.env.TELEGRAM_SESSION || '';

    if (!sessionString) {
      throw new HttpException(
        'Telegram session not configured. Run "node telegram-auth.js" to authenticate.',
        503
      );
    }

    this.session = new StringSession(sessionString);
    this.client = new TelegramClient(this.session, apiId, apiHash, {
      connectionRetries: 3,
      timeout: 10000, // 10 second timeout
    });

    try {
      console.log('🔌 Connecting to Telegram... (make sure VPN is OFF)');
      await this.client.connect();
      console.log('✅ Telegram client connected');
    } catch (error) {
      console.error('❌ Failed to connect to Telegram:', error.message);
      throw new HttpException(
        `Failed to connect to Telegram: ${error.message}. Make sure your VPN is OFF for Telegram connections.`,
        503
      );
    }
  }

  async syncTelegramChannel(username: string, messageLimit: number = 50, pageCategory?: string, clientKeywords?: string[]) {
    console.log(`🔄 Starting sync for Telegram channel: ${username} (category: ${pageCategory}, keywords: ${clientKeywords?.join(', ')})`);

    // Ensure connected before using
    await this.ensureConnected();

    try {
      // Get channel entity
      const entity: any = await this.client.getEntity(username);
      
      console.log(`✅ Found channel: ${entity.title}`);

      // Get full channel info to get subscribers count and bio
      let participantsCount = 0;
      let about = '';
      let profileImageUrl: string | undefined = undefined;
      
      try {
        const fullChannel: any = await this.client.invoke(
          new (require('telegram/tl').Api.channels.GetFullChannel)({
            channel: entity,
          })
        );
        
        participantsCount = fullChannel.fullChat?.participantsCount || 0;
        about = fullChannel.fullChat?.about || '';
        
        console.log(`📊 Full channel data:`, {
          participantsCount,
          about: about.substring(0, 100),
        });

        // Download profile photo if available
        if (entity.photo) {
          try {
            console.log(`📸 Downloading profile photo...`);
            const photo = await this.client.downloadProfilePhoto(entity, {
              isBig: true,
            });
            
            if (photo) {
              // Convert buffer to base64 data URL
              const base64 = Buffer.from(photo).toString('base64');
              profileImageUrl = `data:image/jpeg;base64,${base64}`;
              console.log(`✅ Profile photo downloaded (${base64.length} chars)`);
            }
          } catch (photoErr) {
            console.warn(`⚠️  Could not download profile photo:`, photoErr.message);
          }
        }
      } catch (err) {
        console.warn(`⚠️  Could not fetch full channel info:`, err.message);
      }

      // Check if page already exists
      let page = await this.pageRepository.findOne({
        where: { username, platform: 'telegram' },
      });

      const pageData = {
        name: entity.title || username,
        username: username.replace('t.me/', '').replace('@', ''),
        platform: 'telegram',
        bio: about || undefined,
        followers_count: participantsCount || 0,
        following_count: 0,
        profile_image_url: profileImageUrl,
        last_fetched_at: new Date(),
        page_category: pageCategory || 'official',
        client_keywords: clientKeywords || undefined,
      };

      console.log(`💾 Saving page data (with photo: ${!!profileImageUrl})`);

      if (page) {
        console.log(`📝 Updating existing page ID: ${page.id}`);
        Object.assign(page, pageData);
        page = await this.pageRepository.save(page);
      } else {
        console.log(`➕ Creating new page`);
        page = this.pageRepository.create(pageData);
        page = await this.pageRepository.save(page);
      }

      console.log(`✅ Page saved with ID: ${page.id}`);

      // Get category and keywords for filtering
      const isOfficial = page.page_category === 'official';
      const keywords = page.client_keywords || [];

      // For non-official pages, fetch enough messages to cover 30 days
      // Estimate: ~200 messages per day for news agencies
      let targetMessageCount = messageLimit;
      if (!isOfficial) {
        targetMessageCount = Math.max(messageLimit, 6000); // 30 days * 200 messages/day
        console.log(`📊 Non-official page detected. Will fetch up to ${targetMessageCount} messages to cover 30 days`);
      }

      // Fetch messages in batches
      console.log(`📥 Fetching messages (target: ${targetMessageCount})...`);
      const allMessages: any[] = [];
      let offsetId = 0;
      const batchSize = 100;
      
      while (allMessages.length < targetMessageCount) {
        const batch = await this.client.getMessages(entity, {
          limit: batchSize,
          offsetId: offsetId > 0 ? offsetId : undefined,
        });
        
        if (batch.length === 0) {
          console.log(`✅ No more messages available`);
          break;
        }
        
        allMessages.push(...batch);
        offsetId = batch[batch.length - 1].id;
        
        console.log(`📥 Fetched ${allMessages.length} messages so far...`);
        
        // Check if we've covered 30 days
        if (allMessages.length > 100) {
          const oldestMsg = allMessages[allMessages.length - 1];
          const oldestDate = new Date(oldestMsg.date * 1000);
          const daysCovered = Math.floor((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysCovered >= 30) {
            console.log(`✅ Covered ${daysCovered} days, stopping fetch`);
            break;
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`📊 Found ${allMessages.length} messages (category: ${page.page_category}, keywords: ${keywords.join(', ')})`);

      let savedMessagesCount = 0;
      for (const message of allMessages) {
        if (!message.message && !message.media) {
          continue;
        }

        const externalId = `${message.id}`;

        // Skip if already exists
        const existing = await this.postRepository.findOne({
          where: { external_id: externalId, page_id: page.id },
        });
        if (existing) {
          continue;
        }

        const caption = message.message || '';
        
        // Check relevance based on keywords (only for non-official pages)
        let isRelevant = true;
        if (!isOfficial && keywords.length > 0) {
          isRelevant = keywords.some(keyword => 
            caption.toLowerCase().includes(keyword.toLowerCase())
          );
          
          if (!isRelevant) {
            continue;
          }
        }

        const views = message.views || 0;
        const forwards = message.forwards || 0;
        const publishedAt = message.date ? new Date(message.date * 1000) : new Date();

        // Determine post type
        let postType = 'text';
        let mediaUrl: string | undefined = undefined;

        if (message.media) {
          if (message.media.className === 'MessageMediaPhoto') {
            postType = 'photo';
          } else if (message.media.className === 'MessageMediaDocument') {
            const doc = message.media.document as any;
            if (doc?.mimeType?.startsWith('video/')) {
              postType = 'video';
            }
          }
        }

        const post = this.postRepository.create({
          page: { id: page.id } as Page,
          external_id: externalId,
          caption,
          post_type: postType,
          media_url: mediaUrl,
          likes_count: 0, // Telegram doesn't have likes
          comments_count: 0, // We'd need to fetch replies separately
          shares_count: forwards,
          views_count: views,
          published_at: publishedAt,
          is_relevant: isRelevant,
        });

        await this.postRepository.save(post);
        savedMessagesCount++;
      }

      console.log(`🎉 Sync complete! Saved ${savedMessagesCount} messages out of ${allMessages.length} fetched`);

      return {
        page,
        status: 'synced',
        message: `Telegram channel synced successfully. Fetched ${savedMessagesCount} relevant messages out of ${allMessages.length} total.`,
        messages_fetched: savedMessagesCount,
      };
    } catch (error) {
      console.error(`❌ Error syncing Telegram channel:`, error);
      throw new HttpException(
        `Failed to sync Telegram channel: ${error.message}`,
        500,
      );
    }
  }

  async fetchMoreMessages(pageId: number, messageLimit: number = 50) {
    console.log(`📥 Fetching more messages for page ID: ${pageId}`);

    const page = await this.pageRepository.findOne({ where: { id: pageId } });

    if (!page) {
      throw new HttpException('Page not found', 404);
    }

    if (page.platform !== 'telegram') {
      throw new HttpException('This page is not a Telegram channel', 400);
    }

    if (!page.username) {
      throw new HttpException('Username is required', 400);
    }

    // Ensure connected before using
    await this.ensureConnected();

    try {
      // Get channel entity
      const entity: any = await this.client.getEntity(page.username);

      // Get the oldest message ID we have
      const oldestPost = await this.postRepository.findOne({
        where: { page_id: pageId },
        order: { external_id: 'ASC' },
      });

      const offsetId = oldestPost ? parseInt(oldestPost.external_id) : 0;

      console.log(`📥 Fetching messages older than ID: ${offsetId}`);

      // Get category and keywords for filtering
      const isOfficial = page.page_category === 'official';
      const keywords = page.client_keywords || [];

      // Fetch older messages
      const messages = await this.client.getMessages(entity, {
        limit: messageLimit,
        offsetId: offsetId,
      });

      console.log(`📊 Found ${messages.length} messages (category: ${page.page_category}, keywords: ${keywords.join(', ')})`);

      let savedMessagesCount = 0;
      for (const message of messages) {
        if (!message.message && !message.media) {
          continue;
        }

        const externalId = `${message.id}`;

        // Skip if already exists
        const existing = await this.postRepository.findOne({
          where: { external_id: externalId, page_id: pageId },
        });
        if (existing) {
          continue;
        }

        const caption = message.message || '';
        
        // Check relevance based on keywords (only for non-official pages)
        let isRelevant = true;
        if (!isOfficial && keywords.length > 0) {
          isRelevant = keywords.some(keyword => 
            caption.toLowerCase().includes(keyword.toLowerCase())
          );
          
          if (!isRelevant) {
            console.log(`⏭️  Skipping message ${externalId} - not relevant (no keyword match)`);
            continue;
          }
        }

        const views = message.views || 0;
        const forwards = message.forwards || 0;
        const publishedAt = message.date ? new Date(message.date * 1000) : new Date();

        let postType = 'text';
        let mediaUrl: string | undefined = undefined;

        if (message.media) {
          if (message.media.className === 'MessageMediaPhoto') {
            postType = 'photo';
          } else if (message.media.className === 'MessageMediaDocument') {
            const doc = message.media.document as any;
            if (doc?.mimeType?.startsWith('video/')) {
              postType = 'video';
            }
          }
        }

        const post = this.postRepository.create({
          page: { id: pageId } as Page,
          external_id: externalId,
          caption,
          post_type: postType,
          media_url: mediaUrl,
          likes_count: 0,
          comments_count: 0,
          shares_count: forwards,
          views_count: views,
          published_at: publishedAt,
          is_relevant: isRelevant,
        });

        await this.postRepository.save(post);
        savedMessagesCount++;
      }

      // Update last_fetched_at
      page.last_fetched_at = new Date();
      await this.pageRepository.save(page);

      console.log(`🎉 Fetch more complete! Saved ${savedMessagesCount} new messages`);

      return {
        status: 'success',
        message: `Fetched ${savedMessagesCount} new messages`,
        messages_fetched: savedMessagesCount,
      };
    } catch (error) {
      console.error(`❌ Error fetching more messages:`, error);
      throw new HttpException(
        `Failed to fetch more messages: ${error.message}`,
        500,
      );
    }
  }

  async monitorChannel(pageId: number) {
    const page = await this.pageRepository.findOne({ where: { id: pageId } });

    if (!page) {
      throw new HttpException('Page not found', 404);
    }

    if (page.platform !== 'telegram') {
      throw new HttpException('This page is not a Telegram channel', 400);
    }

    if (!page.username) {
      throw new HttpException('Username is required', 400);
    }

    return await this.syncTelegramChannel(page.username);
  }
}
