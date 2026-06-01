import { PromptDefinition } from './prompt-definition.entity';
import { PromptVersion } from './prompt-version.entity';

/**
 * انواع مشترک PromptsModule (design §5.7).
 */

/**
 * یک تعریف prompt به‌همراه همهٔ نسخه‌های آن و شناسهٔ نسخهٔ فعال. خروجی
 * `getByKey` (design §5.7 — `PromptDefinitionWithVersions`).
 *
 * `versions` بر اساس شمارهٔ نسخه (صعودی) مرتب می‌شود و `active_version_id`
 * به نسخه‌ای اشاره می‌کند که `is_active = true` دارد (یا `null` اگر هیچ نسخهٔ
 * فعالی وجود ندارد).
 */
export interface PromptDefinitionWithVersions extends PromptDefinition {
  versions: PromptVersion[];
  /** شناسهٔ نسخهٔ فعال فعلی (یا null در نبود نسخهٔ فعال). */
  active_version_id: number | null;
}
