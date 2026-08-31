declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ATTACHMENTS: R2Bucket;
    AI_API_KEY?: string;
    AI_API_URL?: string;
    AI_MODEL?: string;
    AI_PROVIDER?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
  }
}
