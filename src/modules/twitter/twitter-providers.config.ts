// Twitter API Providers Configuration
// Add multiple Twitter API providers here for automatic fallback

export interface TwitterProvider {
  name: string;
  apiKey: string;
  apiHost: string;
  enabled: boolean;
  priority: number; // Lower number = higher priority
  endpoints: {
    user: string;
    userTweets: string;
    search?: string;
    tweet?: string;
  };
}

export const TWITTER_PROVIDERS: TwitterProvider[] = [
  // Provider 1: Twitter241 (Primary)
  {
    name: 'Twitter241',
    apiKey: process.env.TWITTER_API_KEY_1 || '76427d58b0msha0507832ac9c4edp17b03bjsnd2483950ce47',
    apiHost: process.env.TWITTER_API_HOST_1 || 'twitter241.p.rapidapi.com',
    enabled: true,
    priority: 1,
    endpoints: {
      user: '/user',
      userTweets: '/user-tweets',
      search: '/search',
      tweet: '/tweet',
    },
  },
  
  // Provider 2: The Old Bird (twitter154)
  {
    name: 'TheOldBird',
    apiKey: process.env.TWITTER_API_KEY_2 || '76427d58b0msha0507832ac9c4edp17b03bjsnd2483950ce47',
    apiHost: process.env.TWITTER_API_HOST_2 || 'twitter154.p.rapidapi.com',
    enabled: true,
    priority: 2,
    endpoints: {
      user: '/user/details',
      userTweets: '/user/tweets',
      search: '/search',
      tweet: '/tweet/details',
    },
  },
  
  // Provider 3: Twitter API45
  {
    name: 'TwitterAPI45',
    apiKey: process.env.TWITTER_API_KEY_3 || '76427d58b0msha0507832ac9c4edp17b03bjsnd2483950ce47',
    apiHost: process.env.TWITTER_API_HOST_3 || 'twitter-api45.p.rapidapi.com',
    enabled: true,
    priority: 3,
    endpoints: {
      user: '/screenname.php',
      userTweets: '/timeline.php',
      search: '/search.php',
      tweet: '/tweet.php',
    },
  },
];

// Get enabled providers sorted by priority
export function getEnabledProviders(): TwitterProvider[] {
  return TWITTER_PROVIDERS
    .filter(p => p.enabled && p.apiKey)
    .sort((a, b) => a.priority - b.priority);
}

// Get provider by name
export function getProviderByName(name: string): TwitterProvider | undefined {
  return TWITTER_PROVIDERS.find(p => p.name === name);
}
