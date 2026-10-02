# Phase 8 Experiment: Naive vs. Grounded-Prose vs. Grounded-Structured LLM Hallucination Rate

Generated 2026-10-02T06:29:13.463Z

## Fetch/API Failures (excluded)

- expressjs/express: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent: [401 Unauthorized] Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential. See https://developers.google.com/identity/sign-in/web/devconsole-project. [{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"ACCESS_TOKEN_TYPE_UNSUPPORTED","metadata":{"method":"google.ai.generativelanguage.v1beta.GenerativeService.GenerateContent","service":"generativelanguage.googleapis.com"}}]
- axios/axios: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent: [401 Unauthorized] Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential. See https://developers.google.com/identity/sign-in/web/devconsole-project. [{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"ACCESS_TOKEN_TYPE_UNSUPPORTED","metadata":{"method":"google.ai.generativelanguage.v1beta.GenerativeService.GenerateContent","service":"generativelanguage.googleapis.com"}}]
- lodash/lodash: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent: [401 Unauthorized] Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential. See https://developers.google.com/identity/sign-in/web/devconsole-project. [{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"ACCESS_TOKEN_TYPE_UNSUPPORTED","metadata":{"method":"google.ai.generativelanguage.v1beta.GenerativeService.GenerateContent","service":"generativelanguage.googleapis.com"}}]
- pallets/flask: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent: [401 Unauthorized] Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential. See https://developers.google.com/identity/sign-in/web/devconsole-project. [{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"ACCESS_TOKEN_TYPE_UNSUPPORTED","metadata":{"service":"generativelanguage.googleapis.com","method":"google.ai.generativelanguage.v1beta.GenerativeService.GenerateContent"}}]
- psf/requests: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent: [401 Unauthorized] Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential. See https://developers.google.com/identity/sign-in/web/devconsole-project. [{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"ACCESS_TOKEN_TYPE_UNSUPPORTED","metadata":{"service":"generativelanguage.googleapis.com","method":"google.ai.generativelanguage.v1beta.GenerativeService.GenerateContent"}}]
- octocat/Hello-World: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent: [401 Unauthorized] Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential. See https://developers.google.com/identity/sign-in/web/devconsole-project. [{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"ACCESS_TOKEN_TYPE_UNSUPPORTED","metadata":{"method":"google.ai.generativelanguage.v1beta.GenerativeService.GenerateContent","service":"generativelanguage.googleapis.com"}}]
- octocat/Spoon-Knife: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent: [401 Unauthorized] Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential. See https://developers.google.com/identity/sign-in/web/devconsole-project. [{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"ACCESS_TOKEN_TYPE_UNSUPPORTED","metadata":{"method":"google.ai.generativelanguage.v1beta.GenerativeService.GenerateContent","service":"generativelanguage.googleapis.com"}}]

## Summary

| Condition | n | Mean Contradiction Rate | Verification method |
|---|---|---|---|
| A: Naive | 0 | N/A — no successful calls | Free prose, regex topic + polarity detection |
| B: Grounded-Prose | 0 | N/A — no successful calls | Facts given, free prose, same regex detection |
| C: Grounded-Structured | 0 | N/A — no successful calls | Facts given, schema-constrained JSON, direct field comparison |

**No repos completed successfully — see Fetch/API Failures above.** The rates above are placeholders, not real measurements; re-run once the underlying failures (rate limit, model availability) are resolved.

**Research question:** Does grounding the LLM in pre-computed facts reduce factual contradictions vs. naive generation — and does moving from free prose to schema-constrained structured output reduce it further?

> Note: "Contradiction" = a claim (a sentence for A/B, a single labeled note for C) that asserts a signal is present/absent when the rubric found the opposite. Conditions A and B use the SAME free-text checker (checkGrounding) and so are directly comparable to each other; Condition C uses a structurally different, deterministic checker (checkStructuredSummary) since it has no topic-detection step to perform — see groundingChecker.ts for why that distinction matters.

## Per-repo Results

| Repo | Group | Score | A: Naive | B: Grounded-Prose | C: Grounded-Structured |
|---|---|---|---|---|---|

## Example Summaries (first repo)

## Limitations

- Small dataset (0 repos) — expand to 15-20 before paper-ready conclusions.
- Conditions A/B's checker only detects contradictions about the 11 rubric signals — it cannot detect fabricated general claims (e.g. "this project uses microservices architecture" when no such signal exists in the rubric). Condition C has the same limit, scoped per-signal instead.
- Rate of NaN (no checkable claims) would indicate the LLM made no claims the checker could verify either way — itself informative, but it reduces the number of checkable outputs for that repo.
- The A/B free-text checker uses a fixed-width proximity window as a heuristic for "which clause is this negation about" — empirically, the safe window width for real LLM output observed in this project was only about 13 characters wide (76-89 chars) between two real, conflicting test cases. This is not a tunable-away limitation; it is evidence that free-text grounding verification has a hard reliability ceiling, which is the motivation for Condition C.
