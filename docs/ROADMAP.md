# InstaStore Roadmap

One developer builds InstaStore with coding-agent support. Each task is small
and independently reviewable.

## Status

| Status   | ID   | Task                              |
| -------- | ---- | --------------------------------- |
| Complete | T00  | Repository baseline               |
| Complete | T00B | Cloudflare hosting migration      |
| Complete | T01A | Tenant data foundation            |
| Complete | T01B | Tenant security and commerce RPCs |
| Complete | T01C | Tenant-aware admin and storage    |
| Complete | T02  | Store-scoped storefront           |
| Complete | T03  | Abuja and Lagos delivery zones    |
| Complete | T04  | Product merchandising             |
| Complete | T05  | Search and catalog discovery      |
| Complete | T06  | Store branding                    |
| Complete | T07  | Merchant operations               |
| Complete | T08  | Measurement foundation            |
| In Progress | T09  | Launch hardening                  |
| Next        | T10  | First merchant cohort             |
| Later    | T11  | Self-service merchant signup      |
| Later    | T12  | Meta Pixel and CAPI               |
| Later    | T13  | Merchant intelligence             |
| Later    | T14  | Product variants                  |
| Later    | T15  | Promotions and coupons            |

## Rules

- One developer is building the product with coding-agent support.
- Keep each task small and independently reviewable.
- Do not implement future tasks early.
- Prefer simple solutions over infrastructure complexity.
- Preserve working commerce behavior.
- T10 represents the first commercial MVP launch.
- T09 is Complete only after real Supabase/Auth/PostgREST/Storage, commerce, consent/analytics (when used), and Cloudflare runtime verification gates pass. Local SQL shims do not satisfy this gate.
- T10 is Complete only after an authorized launch environment and at least one real merchant passes and confirms acceptance. Until then, record “Launch Ready — Awaiting First Merchant” when preparation is complete.
- Detailed implementation instructions come from the active task prompt.
- Update this roadmap when a task is completed.
