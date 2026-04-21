import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Page } from '../page/page.entity';
import { Post } from '../post/post.entity';
import { getEnabledProviders, TwitterProvider } from './twitter-providers.config';

@Injectable()
export class TwitterService {
  private currentProviderIndex = 0;
  private providers: TwitterProvider[];

  constructor(
    @InjectRepository(Page)
    private pageRepository: Repository<Page>,
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
  ) {
    this.providers = getEnabledProviders();
    if (this.providers.length === 0) {
      console.warn('⚠️  No Twitter API providers configured. Please add API keys to enable Twitter integration.');
    } else {
      console.log(`✅ Loaded ${this.providers.length} Twitter API provider(s): ${this.providers.map(p => p.name).join(', ')}`);
    }
  }

  private getCurrentProvider(): TwitterProvider {
    if (this.providers.length === 0) {
      throw new HttpException('No Twitter API providers configured', 503);
    }
    return this.providers[this.currentProviderIndex];
  }

  private switchToNextProvider(): boolean {
    if (this.providers.length <= 1) {
      return false; // No other providers available
    }
    
    this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
    const newProvider = this.getCurrentProvider();
    console.log(`🔄 Switched to Twitter provider: ${newProvider.name}`);
    return true;
  }

  private async makeTwitterRequest(endpoint: string, params: any = {}, retryCount = 0): Promise<any> {
    const maxRetries = this.providers.length; // Try all providers once
    const provider = this.getCurrentProvider();
    
    try {
      console.log(`📡 Making request to ${provider.name}: ${endpoint}`);
      
      const response = await axios.get(`https://${provider.apiHost}${endpoint}`, {
        params,
        headers: {
          'x-rapidapi-key': provider.apiKey,
          'x-rapidapi-host': provider.apiHost,
        },
        timeout: 30000,
      });
      
      return response.data;
    } catch (error) {
      const statusCode = error?.response?.status || 502;
      const apiMessage = error?.response?.data?.message || error.message;
      
      // Handle rate limiting - try next provider
      if (statusCode === 429) {
        console.warn(`⚠️  Rate limit hit on ${provider.name}`);
        
        if (retryCount < maxRetries && this.switchToNextProvider()) {
          console.log(`🔄 Retrying with next provider (attempt ${retryCount + 1}/${maxRetries})`);
          return this.makeTwitterRequest(endpoint, params, retryCount + 1);
        }
        
        // All providers exhausted
        const resetTime = error?.response?.headers?.['x-ratelimit-reset'];
        const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000).toLocaleString() : 'unknown';
        throw new HttpException(
          `All Twitter API providers have reached their rate limits. ` +
          `Primary provider (${provider.name}) resets at ${resetDate}. ` +
          `Please wait or upgrade your plans at https://rapidapi.com/developer/dashboard`,
          429
        );
      }
      
      // For other errors, try next provider if available
      if (statusCode >= 500 && retryCount < maxRetries && this.switchToNextProvider()) {
        console.log(`🔄 Provider ${provider.name} error (${statusCode}), trying next provider`);
        return this.makeTwitterRequest(endpoint, params, retryCount + 1);
      }
      
      throw new HttpException(
        `Twitter API Error from ${provider.name} (${statusCode}): ${apiMessage}`,
        statusCode
      );
    }
  }

  async fetchUserProfile(username: string) {
    return this.fetchUserProfileWithRetry(username, 0);
  }

  private async fetchUserProfileWithRetry(username: string, retryCount: number): Promise<any> {
    const maxRetries = this.providers.length;
    const provider = this.getCurrentProvider();
    const endpoint = provider.endpoints.user;
    
    try {
      console.log(`📡 Making request to ${provider.name}: ${endpoint}`);
      
      let params: any;
      // Handle different parameter patterns
      if (provider.name === 'TwitterAPI45') {
        params = { screenname: username };
      } else {
        params = { username };
      }
      
      const response = await axios.get(`https://${provider.apiHost}${endpoint}`, {
        params,
        headers: {
          'x-rapidapi-key': provider.apiKey,
          'x-rapidapi-host': provider.apiHost,
        },
        timeout: 30000,
      });
      
      return this.normalizeUserResponse(response.data, provider.name);
    } catch (error) {
      const statusCode = error?.response?.status || 502;
      const apiMessage = error?.response?.data?.message || error.message;
      
      // Handle rate limiting - try next provider
      if (statusCode === 429) {
        console.warn(`⚠️  Rate limit hit on ${provider.name}`);
        
        if (retryCount < maxRetries && this.switchToNextProvider()) {
          console.log(`🔄 Retrying with next provider (attempt ${retryCount + 1}/${maxRetries})`);
          return this.fetchUserProfileWithRetry(username, retryCount + 1);
        }
        
        // All providers exhausted
        const resetTime = error?.response?.headers?.['x-ratelimit-reset'];
        const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000).toLocaleString() : 'unknown';
        throw new HttpException(
          `All Twitter API providers have reached their rate limits. ` +
          `Primary provider (${provider.name}) resets at ${resetDate}. ` +
          `Please wait or upgrade your plans at https://rapidapi.com/developer/dashboard`,
          429
        );
      }
      
      // For other errors, try next provider if available
      if (statusCode >= 500 && retryCount < maxRetries && this.switchToNextProvider()) {
        console.log(`🔄 Provider ${provider.name} error (${statusCode}), trying next provider`);
        return this.fetchUserProfileWithRetry(username, retryCount + 1);
      }
      
      throw new HttpException(
        `Twitter API Error from ${provider.name} (${statusCode}): ${apiMessage}`,
        statusCode
      );
    }
  }

  async fetchUserTweets(username: string, count: number = 20) {
    return this.fetchUserTweetsWithRetry(username, count, 0);
  }

  private async fetchUserTweetsWithRetry(username: string, count: number, retryCount: number): Promise<any> {
    const maxRetries = this.providers.length;
    const provider = this.getCurrentProvider();
    const endpoint = provider.endpoints.userTweets;
    
    try {
      console.log(`📡 Making request to ${provider.name}: ${endpoint}`);
      
      let params: any;
      // Handle different parameter patterns
      if (provider.name === 'TwitterAPI45') {
        params = { screenname: username };
      } else if (provider.name === 'TheOldBird') {
        params = { 
          username, 
          limit: count,
          include_replies: false,
          include_pinned: false
        };
      } else {
        // Twitter241 needs user ID
        const userProfile = await this.fetchUserProfile(username);
        const userId = userProfile?.result?.rest_id || userProfile?.result?.data?.user?.result?.rest_id;
        
        if (!userId) {
          throw new HttpException('Could not get user ID from profile', 400);
        }
        
        params = { user: userId, count };
      }
      
      const response = await axios.get(`https://${provider.apiHost}${endpoint}`, {
        params,
        headers: {
          'x-rapidapi-key': provider.apiKey,
          'x-rapidapi-host': provider.apiHost,
        },
        timeout: 30000,
      });
      
      return this.normalizeTweetsResponse(response.data, provider.name);
    } catch (error) {
      const statusCode = error?.response?.status || 502;
      const apiMessage = error?.response?.data?.message || error.message;
      
      // Handle rate limiting - try next provider
      if (statusCode === 429) {
        console.warn(`⚠️  Rate limit hit on ${provider.name}`);
        
        if (retryCount < maxRetries && this.switchToNextProvider()) {
          console.log(`🔄 Retrying with next provider (attempt ${retryCount + 1}/${maxRetries})`);
          return this.fetchUserTweetsWithRetry(username, count, retryCount + 1);
        }
        
        // All providers exhausted
        throw new HttpException(
          `All Twitter API providers have reached their rate limits. Please wait or upgrade your plans.`,
          429
        );
      }
      
      // For other errors, try next provider if available
      if (statusCode >= 500 && retryCount < maxRetries && this.switchToNextProvider()) {
        console.log(`🔄 Provider ${provider.name} error (${statusCode}), trying next provider`);
        return this.fetchUserTweetsWithRetry(username, count, retryCount + 1);
      }
      
      throw new HttpException(
        `Twitter API Error from ${provider.name} (${statusCode}): ${apiMessage}`,
        statusCode
      );
    }
  }

  // Normalize different API response formats to a common structure
  private normalizeUserResponse(data: any, providerName: string): any {
    console.log(`📦 Normalizing user response from ${providerName}`);
    console.log(`📦 Raw data structure:`, JSON.stringify(data, null, 2));
    
    // Normalize to a common format
    if (providerName === 'TheOldBird') {
      // The Old Bird format
      const normalized = {
        result: {
          legacy: {
            name: data?.name || data?.user_info?.name,
            screen_name: data?.username || data?.screen_name || data?.user_info?.screen_name,
            description: data?.description || data?.user_info?.description,
            followers_count: data?.follower_count || data?.followers_count || data?.user_info?.followers_count || 0,
            friends_count: data?.following_count || data?.friends_count || data?.user_info?.friends_count || 0,
            profile_image_url_https: data?.profile_pic_url || data?.profile_image_url || data?.user_info?.profile_image_url,
          }
        }
      };
      console.log(`📦 Normalized to:`, JSON.stringify(normalized, null, 2));
      return normalized;
    } else if (providerName === 'TwitterAPI45') {
      // Twitter API45 format
      const normalized = {
        result: {
          legacy: {
            name: data?.name,
            screen_name: data?.screen_name,
            description: data?.description,
            followers_count: data?.followers_count || 0,
            friends_count: data?.friends_count || 0,
            profile_image_url_https: data?.profile_image_url_https || data?.profile_image_url,
          }
        }
      };
      console.log(`📦 Normalized to:`, JSON.stringify(normalized, null, 2));
      return normalized;
    } else if (providerName === 'Twitter241') {
      // Twitter241 format - check if it has the user object structure
      if (data?.user) {
        // This is from /user endpoint which returns user data directly
        const normalized = {
          result: {
            rest_id: data.user.rest_id || data.user.id,
            legacy: {
              name: data.user.name,
              screen_name: data.user.screen_name || data.user.id,
              description: data.user.desc || data.user.description,
              followers_count: data.user.sub_count || data.user.followers_count || 0,
              friends_count: data.user.friends || data.user.following_count || 0,
              profile_image_url_https: data.user.avatar || data.user.profile_image_url_https,
            }
          }
        };
        console.log(`📦 Normalized Twitter241 user object to:`, JSON.stringify(normalized, null, 2));
        return normalized;
      } else if (data?.result) {
        // Already in the correct format
        console.log(`📦 Twitter241 already in correct format`);
        return data;
      }
    }
    
    // Fallback - try to use data as-is
    console.log(`📦 Using data as-is (fallback)`);
    return data;
  }

  private normalizeTweetsResponse(data: any, providerName: string): any {
    console.log(`📦 Normalizing tweets response from ${providerName}`);
    console.log(`📦 Raw tweets data keys:`, Object.keys(data || {}));
    
    // Normalize to a common format
    if (providerName === 'TheOldBird') {
      // The Old Bird format - convert to Twitter241 format
      const tweets = data?.results || data?.tweets || data?.timeline || data?.data || [];
      console.log(`📦 TheOldBird found ${tweets.length} tweets`);
      if (tweets.length > 0) {
        console.log(`📦 Sample tweet structure:`, JSON.stringify(tweets[0], null, 2));
      }
      return {
        result: {
          timeline: {
            instructions: [{
              entries: tweets.map((tweet: any) => ({
                content: {
                  itemContent: {
                    tweet_results: {
                      result: {
                        rest_id: tweet.tweet_id || tweet.id_str,
                        legacy: {
                          full_text: tweet.text || tweet.full_text,
                          favorite_count: tweet.favorite_count || tweet.likes || 0,
                          retweet_count: tweet.retweet_count || tweet.retweets || 0,
                          reply_count: tweet.reply_count || tweet.replies || 0,
                          created_at: tweet.created_at || tweet.timestamp,
                          entities: {
                            media: tweet.media ? [{ 
                              media_url_https: tweet.media[0]?.url || tweet.media[0]?.media_url_https,
                              type: tweet.media[0]?.type || 'photo'
                            }] : []
                          }
                        }
                      }
                    }
                  }
                }
              }))
            }]
          }
        }
      };
    } else if (providerName === 'TwitterAPI45') {
      // Twitter API45 format
      const tweets = data?.timeline || data?.tweets || [];
      console.log(`📦 TwitterAPI45 found ${tweets.length} tweets`);
      return {
        result: {
          timeline: {
            instructions: [{
              entries: tweets.map((tweet: any) => ({
                content: {
                  itemContent: {
                    tweet_results: {
                      result: {
                        rest_id: tweet.id_str || tweet.tweet_id,
                        legacy: {
                          full_text: tweet.full_text || tweet.text,
                          favorite_count: tweet.favorite_count || 0,
                          retweet_count: tweet.retweet_count || 0,
                          reply_count: tweet.reply_count || 0,
                          created_at: tweet.created_at,
                          entities: {
                            media: tweet.entities?.media || []
                          }
                        }
                      }
                    }
                  }
                }
              }))
            }]
          }
        }
      };
    } else if (providerName === 'Twitter241') {
      // Twitter241 format - check if it's the timeline array format
      if (data?.timeline && Array.isArray(data.timeline)) {
        // This is the actual Twitter241 format from /user-tweets
        console.log(`📦 Twitter241 found ${data.timeline.length} tweets in timeline array`);
        return {
          result: {
            timeline: {
              instructions: [{
                entries: data.timeline.map((tweet: any) => ({
                  content: {
                    itemContent: {
                      tweet_results: {
                        result: {
                          rest_id: tweet.tweet_id || tweet.id_str,
                          legacy: {
                            full_text: tweet.text || tweet.full_text,
                            favorite_count: tweet.likes || tweet.favorite_count || 0,
                            retweet_count: tweet.retweets || tweet.retweet_count || 0,
                            reply_count: tweet.replies || tweet.reply_count || 0,
                            created_at: tweet.created_at,
                            entities: {
                              media: tweet.media?.photo ? [{
                                media_url_https: tweet.media.photo[0]?.media_url_https,
                                type: 'photo'
                              }] : (tweet.media?.video ? [{
                                media_url_https: tweet.media.video[0]?.media_url_https,
                                type: 'video'
                              }] : [])
                            }
                          }
                        }
                      }
                    }
                  }
                }))
              }]
            }
          }
        };
      } else if (data?.result?.timeline) {
        // Already in the correct nested format
        console.log(`📦 Twitter241 tweets already in correct format`);
        return data;
      }
    }
    
    // Fallback - try to use data as-is
    console.log(`📦 Using tweets data as-is (fallback)`);
    return data;
  }

  async syncTwitterAccount(username: string, pageCategory?: string, clientKeywords?: string[]) {
    console.log(`🔄 Starting sync for Twitter account: ${username} (category: ${pageCategory}, keywords: ${clientKeywords?.join(', ')})`);
    
    // Fetch user tweets (which also includes user profile data)
    console.log(`📥 Fetching tweets for ${username}...`);
    const tweetsData = await this.fetchUserTweets(username);
    console.log(`✅ Tweets data received`);
    
    // Extract user profile from tweets response
    let profileData: any = null;
    if (tweetsData?.user) {
      // Twitter241 format - user data is at root level
      console.log(`👤 Found user data in tweets response (Twitter241 format)`);
      profileData = {
        result: {
          rest_id: tweetsData.user.rest_id || tweetsData.user.id,
          legacy: {
            name: tweetsData.user.name,
            screen_name: tweetsData.user.screen_name || username,
            description: tweetsData.user.desc || tweetsData.user.description,
            followers_count: tweetsData.user.sub_count || tweetsData.user.followers_count || 0,
            friends_count: tweetsData.user.friends || tweetsData.user.following_count || 0,
            profile_image_url_https: tweetsData.user.avatar || tweetsData.user.profile_image_url_https,
          }
        }
      };
    } else {
      // Fallback: try to fetch profile separately
      console.log(`📡 User data not in tweets response, fetching profile separately...`);
      profileData = await this.fetchUserProfile(username);
    }
    
    console.log(`✅ Profile data extracted:`, JSON.stringify(profileData, null, 2));
    
    if (!profileData || !profileData.result) {
      console.error(`❌ Invalid profile data structure`);
      throw new HttpException('Invalid response from Twitter API', 502);
    }

    const user = profileData.result;
    console.log(`👤 User legacy data:`, JSON.stringify(user.legacy, null, 2));

    // Check if page already exists
    let page = await this.pageRepository.findOne({
      where: { username, platform: 'twitter' },
    });

    const pageData = {
      name: user.legacy?.name || username,
      username: username,
      platform: 'twitter',
      bio: user.legacy?.description || null,
      followers_count: user.legacy?.followers_count || 0,
      following_count: user.legacy?.friends_count || 0,
      profile_image_url: user.legacy?.profile_image_url_https?.replace('_normal', '_400x400') || null,
      last_fetched_at: new Date(),
      page_category: pageCategory || 'official',
      client_keywords: clientKeywords || undefined,
    };

    console.log(`💾 Page data to save:`, JSON.stringify(pageData, null, 2));

    if (page) {
      // Update existing page
      console.log(`📝 Updating existing page ID: ${page.id}`);
      Object.assign(page, pageData);
      page = await this.pageRepository.save(page);
    } else {
      // Create new page
      console.log(`➕ Creating new page`);
      page = this.pageRepository.create(pageData);
      page = await this.pageRepository.save(page);
    }

    console.log(`✅ Page saved with ID: ${page.id}`);

    // Get category and keywords for filtering
    const isOfficial = page.page_category === 'official';
    const keywords = page.client_keywords || [];

    // Process tweets
    const tweets = tweetsData?.result?.timeline?.instructions?.[0]?.entries || [];
    console.log(`📊 Found ${tweets.length} tweet entries (category: ${page.page_category}, keywords: ${keywords.join(', ')})`);
    
    let savedTweetsCount = 0;
    for (const entry of tweets) {
      if (!entry.content?.itemContent?.tweet_results?.result) {
        console.log(`⏭️  Skipping entry without tweet data`);
        continue;
      }
      
      const tweet = entry.content.itemContent.tweet_results.result;
      const legacy = tweet.legacy;
      
      if (!legacy) {
        console.log(`⏭️  Skipping tweet without legacy data`);
        continue;
      }

      const externalId = tweet.rest_id;
      
      // Skip if already exists
      const existing = await this.postRepository.findOne({
        where: { external_id: externalId },
      });
      if (existing) {
        console.log(`⏭️  Tweet ${externalId} already exists, skipping`);
        continue;
      }

      const caption = legacy.full_text || '';
      
      // Check relevance based on keywords (only for non-official pages)
      let isRelevant = true;
      if (!isOfficial && keywords.length > 0) {
        isRelevant = keywords.some(keyword => 
          caption.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (!isRelevant) {
          console.log(`⏭️  Skipping tweet ${externalId} - not relevant (no keyword match)`);
          continue;
        }
      }

      const likesCount = legacy.favorite_count || 0;
      const retweetsCount = legacy.retweet_count || 0;
      const repliesCount = legacy.reply_count || 0;
      const publishedAt = legacy.created_at ? new Date(legacy.created_at) : new Date();
      
      // Extract media URL if available
      let mediaUrl = null;
      if (legacy.entities?.media?.[0]) {
        mediaUrl = legacy.entities.media[0].media_url_https;
      }

      const post = this.postRepository.create({
        page_id: page.id,
        external_id: externalId,
        caption,
        post_type: legacy.entities?.media?.[0]?.type === 'video' ? 'video' : 'tweet',
        media_url: mediaUrl || undefined,
        likes_count: likesCount,
        comments_count: repliesCount,
        shares_count: retweetsCount,
        published_at: publishedAt,
        is_relevant: isRelevant,
      });
      
      await this.postRepository.save(post);
      console.log(`✅ Saved tweet ${externalId} (relevant: ${isRelevant})`);
      savedTweetsCount++;
    }

    console.log(`🎉 Sync complete! Saved ${savedTweetsCount} tweets`);

    return {
      page,
      status: 'synced',
      message: `Twitter account synced successfully. Fetched ${savedTweetsCount} tweets.`,
      tweets_fetched: savedTweetsCount,
    };
  }

  async fetchMoreTweets(pageId: number, count: number = 50) {
    console.log(`📥 Fetching more tweets for page ID: ${pageId}, count: ${count}`);
    
    const page = await this.pageRepository.findOne({ where: { id: pageId } });
    
    if (!page) {
      throw new HttpException('Page not found', 404);
    }

    if (page.platform !== 'twitter') {
      throw new HttpException('This page is not a Twitter account', 400);
    }

    if (!page.username) {
      throw new HttpException('Username is required', 400);
    }

    let totalNewTweets = 0;
    
    // For fetch-more, prefer providers that don't need extra API calls
    // TheOldBird and TwitterAPI45 work with username directly
    const providers = getEnabledProviders();
    const preferredProviders = providers.filter(p => 
      p.name === 'TheOldBird' || p.name === 'TwitterAPI45'
    );
    
    if (preferredProviders.length === 0) {
      throw new HttpException('No suitable providers available for fetching more tweets', 503);
    }
    
    // Try preferred providers
    for (const provider of preferredProviders) {
      try {
        // Switch to this provider
        this.currentProviderIndex = providers.indexOf(provider);
        console.log(`🔄 Using provider ${provider.name} with pagination support`);
        
        // Fetch multiple pages of tweets using pagination
        let continuationToken: string | undefined = undefined;
        let pagesFetched = 0;
        const maxPages = 3; // Fetch up to 3 pages (50-60 tweets)
        
        while (pagesFetched < maxPages) {
          console.log(`📡 Fetching page ${pagesFetched + 1}/${maxPages}...`);
          
          try {
            const tweetsData = await this.fetchUserTweetsWithPagination(
              page.username, 
              20, 
              continuationToken
            );
            
            // Save tweets
            const savedCount = await this.saveTweetsFromData(tweetsData.data, pageId);
            totalNewTweets += savedCount;
            
            console.log(`✅ Page ${pagesFetched + 1} contributed ${savedCount} new tweets`);
            
            // Check if there's a next page
            if (!tweetsData.nextToken) {
              console.log(`✅ No more pages available`);
              break;
            }
            
            // If we got 0 new tweets, no point continuing (all are duplicates)
            if (savedCount === 0 && pagesFetched > 0) {
              console.log(`⏹️  Stopping - all tweets are already in database`);
              break;
            }
            
            continuationToken = tweetsData.nextToken;
            pagesFetched++;
            
            // Add delay between requests to avoid rate limiting
            if (pagesFetched < maxPages && tweetsData.nextToken) {
              console.log(`⏳ Waiting 2 seconds before next request...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
          } catch (error) {
            // If rate limited on this provider, try next one
            if (error?.response?.status === 429) {
              console.warn(`⚠️  Rate limit hit on ${provider.name}, trying next provider...`);
              break; // Break inner loop to try next provider
            }
            throw error;
          }
        }
        
        // If we got tweets, we're done
        if (totalNewTweets > 0) {
          break;
        }
        
      } catch (error) {
        console.error(`❌ Provider ${provider.name} failed: ${error.message}`);
        // Continue to next provider
        continue;
      }
    }

    // Update last_fetched_at
    page.last_fetched_at = new Date();
    await this.pageRepository.save(page);

    console.log(`🎉 Fetch more complete! Saved ${totalNewTweets} new tweets`);

    return {
      status: 'success',
      message: totalNewTweets > 0 
        ? `Fetched ${totalNewTweets} new tweets` 
        : 'No new tweets found. All recent tweets are already in database, or rate limits reached. Try again in a few minutes.',
      tweets_fetched: totalNewTweets,
    };
  }

  private async fetchUserTweetsWithPagination(
    username: string, 
    count: number, 
    continuationToken?: string
  ): Promise<{ data: any; nextToken?: string }> {
    const provider = this.getCurrentProvider();
    const endpoint = provider.endpoints.userTweets;
    
    try {
      console.log(`📡 Making paginated request to ${provider.name}: ${endpoint}`);
      
      let params: any;
      
      // Handle different parameter patterns
      if (provider.name === 'TwitterAPI45') {
        params = { screenname: username };
        if (continuationToken) {
          params.cursor = continuationToken;
        }
      } else if (provider.name === 'TheOldBird') {
        params = { 
          username, 
          limit: count,
          include_replies: false,
          include_pinned: false
        };
        if (continuationToken) {
          params.continuation_token = continuationToken;
        }
      } else {
        // Twitter241 needs user ID
        const userProfile = await this.fetchUserProfile(username);
        const userId = userProfile?.result?.rest_id || userProfile?.result?.data?.user?.result?.rest_id;
        
        if (!userId) {
          throw new HttpException('Could not get user ID from profile', 400);
        }
        
        params = { user: userId, count };
        if (continuationToken) {
          params.cursor = continuationToken;
        }
      }
      
      const response = await axios.get(`https://${provider.apiHost}${endpoint}`, {
        params,
        headers: {
          'x-rapidapi-key': provider.apiKey,
          'x-rapidapi-host': provider.apiHost,
        },
        timeout: 30000,
      });
      
      // Extract continuation token based on provider
      let nextToken: string | undefined = undefined;
      if (provider.name === 'TheOldBird' && response.data.continuation_token) {
        nextToken = response.data.continuation_token;
      } else if (provider.name === 'TwitterAPI45' && response.data.next_cursor) {
        nextToken = response.data.next_cursor;
      } else if (provider.name === 'Twitter241' && response.data.next_cursor) {
        nextToken = response.data.next_cursor;
      }
      
      console.log(`📦 Next token available: ${nextToken ? 'Yes' : 'No'}`);
      
      return {
        data: this.normalizeTweetsResponse(response.data, provider.name),
        nextToken,
      };
    } catch (error) {
      const statusCode = error?.response?.status || 502;
      const apiMessage = error?.response?.data?.message || error.message;
      
      throw new HttpException(
        `Twitter API Error from ${provider.name} (${statusCode}): ${apiMessage}`,
        statusCode
      );
    }
  }

  private async saveTweetsFromData(tweetsData: any, pageId: number): Promise<number> {
    // Get page to check category and keywords
    const page = await this.pageRepository.findOne({ where: { id: pageId } });
    if (!page) {
      throw new HttpException('Page not found', 404);
    }

    const isOfficial = page.page_category === 'official';
    const keywords = page.client_keywords || [];

    const tweets = tweetsData?.result?.timeline?.instructions?.[0]?.entries || [];
    console.log(`📊 Processing ${tweets.length} tweet entries (category: ${page.page_category}, keywords: ${keywords.join(', ')})`);
    
    let savedTweetsCount = 0;
    for (const entry of tweets) {
      if (!entry.content?.itemContent?.tweet_results?.result) {
        continue;
      }
      
      const tweet = entry.content.itemContent.tweet_results.result;
      const legacy = tweet.legacy;
      
      if (!legacy) continue;

      const externalId = tweet.rest_id;
      
      // Skip if already exists
      const existing = await this.postRepository.findOne({
        where: { external_id: externalId },
      });
      if (existing) {
        continue;
      }

      const caption = legacy.full_text || '';
      
      // Check relevance based on keywords (only for non-official pages)
      let isRelevant = true;
      if (!isOfficial && keywords.length > 0) {
        isRelevant = keywords.some(keyword => 
          caption.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (!isRelevant) {
          console.log(`⏭️  Skipping tweet ${externalId} - not relevant (no keyword match)`);
          continue;
        }
      }

      const likesCount = legacy.favorite_count || 0;
      const retweetsCount = legacy.retweet_count || 0;
      const repliesCount = legacy.reply_count || 0;
      const publishedAt = legacy.created_at ? new Date(legacy.created_at) : new Date();
      
      // Extract media URL if available
      let mediaUrl = null;
      if (legacy.entities?.media?.[0]) {
        mediaUrl = legacy.entities.media[0].media_url_https;
      }

      const post = this.postRepository.create({
        page_id: pageId,
        external_id: externalId,
        caption,
        post_type: legacy.entities?.media?.[0]?.type === 'video' ? 'video' : 'tweet',
        media_url: mediaUrl || undefined,
        likes_count: likesCount,
        comments_count: repliesCount,
        shares_count: retweetsCount,
        published_at: publishedAt,
        is_relevant: isRelevant,
      });
      
      await this.postRepository.save(post);
      console.log(`✅ Saved new tweet ${externalId} (relevant: ${isRelevant})`);
      savedTweetsCount++;
    }

    return savedTweetsCount;
  }

  async monitorAccount(pageId: number) {
    const page = await this.pageRepository.findOne({ where: { id: pageId } });
    
    if (!page) {
      throw new HttpException('Page not found', 404);
    }

    if (page.platform !== 'twitter') {
      throw new HttpException('This page is not a Twitter account', 400);
    }

    if (!page.username) {
      throw new HttpException('Username is required', 400);
    }

    return await this.syncTwitterAccount(page.username);
  }

  async searchTweets(query: string, count: number = 20) {
    const data = await this.makeTwitterRequest('/search', { query, count });
    return data;
  }

  async getTweetDetails(tweetId: string) {
    const data = await this.makeTwitterRequest('/tweet', { id: tweetId });
    return data;
  }
}
