# Coverage Type Feature for Non-Official Pages

## Overview
Added a new `coverage_type` field to track how non-official sources (news agencies, fan pages, etc.) cover the client. This helps analyze media perception and coverage patterns.

## Coverage Types

The system now categorizes posts from non-official sources into these types:

1. **نقل قول (quote)** - Direct quotes from the client
   - Color: Blue (info)
   - Icon: Quote icon
   
2. **انتقاد (criticism)** - Criticism or negative commentary
   - Color: Red (error)
   - Icon: Warning triangle
   
3. **تمجید (praise)** - Praise or positive commentary
   - Color: Green (success)
   - Icon: Star
   
4. **ذکر خنثی (neutral_mention)** - Neutral, factual mention
   - Color: Gray (default)
   - Icon: Document
   
5. **تحلیل (analysis)** - Analysis or commentary
   - Color: Orange (warning)
   - Icon: Chart
   
6. **مصاحبه (interview)** - Interview or conversation
   - Color: Purple (secondary)
   - Icon: Microphone
   
7. **گزارش (report)** - News report
   - Color: Blue (primary)
   - Icon: Document

## Database Changes

### Migration Applied
```sql
ALTER TABLE posts ADD COLUMN coverage_type VARCHAR(50);
CREATE INDEX idx_posts_coverage_type ON posts(coverage_type);
```

### Entity Updated
- `Post.coverage_type`: String field for coverage classification

## AI Analysis Updates

### Prompt Adjustments

**For Official Pages:**
- Perspective: "تحلیل کن که کلاینت چگونه خودش را معرفی می‌کند"
- No coverage_type analysis (not applicable)

**For Non-Official Pages:**
- Perspective: "تحلیل کن که این منبع چگونه به کلاینت نگاه می‌کند"
- Includes coverage_type in analysis
- AI categorizes each post based on how it covers the client

### Example AI Output for Non-Official Page
```json
{
  "posts_analysis": [
    {
      "index": 0,
      "sentiment_score": 0.3,
      "sentiment_label": "hopeful",
      "coverage_type": "quote",
      "topics": ["سیاست", "مجلس"],
      "keywords": ["قالیباف", "رئیس مجلس"]
    },
    {
      "index": 1,
      "sentiment_score": -0.5,
      "sentiment_label": "sad",
      "coverage_type": "criticism",
      "topics": ["اقتصاد"],
      "keywords": ["تورم", "انتقاد"]
    }
  ]
}
```

## Frontend Display

### Narrative Timeline (تایم‌لاین یکپارچه)

Coverage type badges now appear on posts from non-official sources:

- Small colored chips with icons
- Positioned next to sentiment labels
- Visible in both timeline view and detail dialog
- Color-coded for quick visual identification

### Example Display
```
[پست] [tweet] [hopeful] [نقل قول 📝]
```

## Usage

### 1. Add Non-Official Page
```javascript
{
  name: "خبرگزاری فارس",
  username: "farsna",
  platform: "telegram",
  page_category: "news_agency",  // Not "official"
  client_keywords: ["قالیباف"]
}
```

### 2. Run AI Analysis
- Go to page profile
- Click "پردازش مجدد" button
- AI will analyze posts and assign coverage_type

### 3. View Results
- Check تایم‌لاین یکپارچه
- See coverage type badges on each post
- Filter by coverage type (future enhancement)

## Benefits

1. **Media Perception Analysis**: Understand how different sources portray the client
2. **Coverage Pattern Detection**: Identify if coverage is mostly quotes, criticism, or praise
3. **Source Credibility**: Compare coverage types across different news sources
4. **Trend Analysis**: Track how coverage type changes over time
5. **Strategic Insights**: Identify which sources are supportive vs critical

## Next Steps

### Immediate
1. Turn VPN ON
2. Run sentiment analysis: `node analyze-missing-sentiments.js`
3. Process Fars News page with AI to get coverage_type tags

### Future Enhancements
1. Add coverage_type filter to timeline
2. Create coverage distribution chart (pie chart showing % of each type)
3. Add coverage_type to analytics dashboard
4. Track coverage_type trends over time
5. Compare coverage_type across different sources

## Testing

### Test Case: Fars News
- Page category: news_agency
- Keywords: قالیباف
- Expected: Posts categorized as quote, criticism, praise, neutral_mention, etc.
- Verify: Coverage type badges appear in timeline

### Verification Query
```sql
SELECT 
  coverage_type,
  COUNT(*) as count,
  ROUND(AVG(sentiment_score), 2) as avg_sentiment
FROM posts
WHERE page_id = 12  -- Fars News
GROUP BY coverage_type
ORDER BY count DESC;
```

This will show distribution of coverage types and their average sentiment.
