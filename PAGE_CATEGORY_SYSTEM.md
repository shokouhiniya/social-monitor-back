# Page Category System with Keyword Filtering

## Overview
The page category system allows you to organize pages into different source types and automatically filter posts based on relevance to your client using keyword matching.

## Page Categories

The system supports 7 page categories (in order of display):

1. **رسمی (official)** - Official client pages
2. **خبرگزاری‌ها (news_agency)** - News agencies
3. **پیج‌های هواداری (fan_pages)** - Fan pages
4. **پیج‌های خبری (news_pages)** - News pages
5. **منابع محلی (local_sources)** - Local sources
6. **منابع ضدنظام (opposition_sources)** - Opposition sources
7. **منابع خارجی (foreign_sources)** - Foreign sources

## How It Works

### Official Pages (رسمی)
- **Behavior**: Load ALL content unfiltered
- **Use Case**: Client's own official social media accounts
- **Example**: @mb_ghalibaf (Twitter), @ghalibaf (Telegram)

### Non-Official Pages
- **Behavior**: Only load posts that contain client keywords
- **Use Case**: Third-party pages that mention the client
- **Keyword Matching**: Case-insensitive search in post caption/text
- **Example**: A news agency page that occasionally mentions "قالیباف"

## Database Schema

### Pages Table
```sql
ALTER TABLE pages ADD COLUMN page_category VARCHAR(50);
ALTER TABLE pages ADD COLUMN client_keywords TEXT[];
```

### Posts Table
```sql
ALTER TABLE posts ADD COLUMN is_relevant BOOLEAN DEFAULT true;
```

## Implementation Details

### Backend

#### Entities
- `Page.page_category`: String field for category
- `Page.client_keywords`: Array of keywords for filtering
- `Post.is_relevant`: Boolean flag indicating relevance

#### Services
Both Twitter and Telegram services implement keyword filtering:

```typescript
// Check relevance based on keywords (only for non-official pages)
let isRelevant = true;
if (!isOfficial && keywords.length > 0) {
  isRelevant = keywords.some(keyword => 
    caption.toLowerCase().includes(keyword.toLowerCase())
  );
  
  if (!isRelevant) {
    console.log(`⏭️  Skipping post - not relevant (no keyword match)`);
    continue;
  }
}
```

#### API Endpoints

**Twitter Sync**
```
POST /twitter/sync
Body: {
  username: string,
  page_category?: string,
  client_keywords?: string[]
}
```

**Telegram Sync**
```
POST /telegram/sync
Body: {
  username: string,
  messageLimit?: number,
  page_category?: string,
  client_keywords?: string[]
}
```

### Frontend

#### Add Page Dialog
- Category selector dropdown
- Keywords input field (comma-separated)
- Keywords field only shown for non-official categories
- Helper text: "فقط پست‌هایی که حاوی این کلمات هستند ذخیره می‌شوند"

#### Twitter Sync Dialog
- Category selector
- Keywords input (shown only for non-official)
- Passes category and keywords to API

#### Page List Display
- Shows category badge for non-official pages
- Color-coded: info (blue) for non-official categories

## Usage Example

### Adding a Non-Official Page

1. Click "افزودن پیج" (Add Page)
2. Fill in page details
3. Select "نوع منبع" (Source Type): e.g., "خبرگزاری‌ها"
4. Enter keywords: "قالیباف, شهردار" (comma-separated)
5. Click "ثبت" (Submit)

### Result
- System fetches posts from the page
- Only posts containing "قالیباف" OR "شهردار" are saved
- Other posts are skipped with log: "Skipping post - not relevant"

## Testing

### Test Case 1: Official Page
```javascript
// Add official page
page_category: 'official'
client_keywords: []

// Result: All posts are saved
```

### Test Case 2: News Agency
```javascript
// Add news agency page
page_category: 'news_agency'
client_keywords: ['قالیباف']

// Result: Only posts mentioning "قالیباف" are saved
```

## Migration

The migration has been successfully applied:
- ✅ Added `page_category` column to pages table
- ✅ Added `client_keywords` column to pages table
- ✅ Added `is_relevant` column to posts table
- ✅ Updated existing pages to 'official' category
- ✅ Created indexes for performance

## Current Status

### Existing Pages
- محمدباقر قالیباف | MB Ghalibaf (@mb_ghalibaf) [twitter] - Category: official
- محمدباقر قالیباف (@ghalibaf) [telegram] - Category: official

### Next Steps
1. Test adding a non-official Telegram channel
2. Verify keyword filtering works correctly
3. Add more pages from different categories
4. Monitor post relevance in analytics

## Notes

- Keywords are case-insensitive
- Multiple keywords work with OR logic (any match = relevant)
- Empty keywords array for official pages = all posts saved
- The `is_relevant` flag can be used in analytics to filter data
- Future enhancement: Support for AND logic, regex patterns, or AI-based relevance scoring
