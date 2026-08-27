---
kind: external_dependency
name: Lovable AI Gateway (OpenAI-compatible recommendation engine)
slug: lovable-ai-gateway
category: external_dependency
category_hints:
    - vendor_identity
    - auth_protocol
scope:
    - '**'
---

### Lovable AI Gateway
- Role: OpenAI-compatible chat/completions provider used to generate personalized mix recommendations (Discover Mix, New Release Mix, Replay Mix, New Songs, Podcasts) based on user library signals.
- Integration: `ai-gateway.server.ts.createAiGatewayProvider` wraps `@ai-sdk/openai-compatible` pointing at `https://ai.gateway.lovable.dev/v1`, authenticating via a `Lovable-API-Key` header supplied by the caller.
- SDK: Uses `@ai-sdk/openai-compatible` v3 and the `ai` SDK v7 to call the gateway as if it were an OpenAI endpoint.