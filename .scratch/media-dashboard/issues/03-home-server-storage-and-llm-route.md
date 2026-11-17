# Home server, storage and LLM route

Type: grilling
Status: resolved

## Question

What role does the owner's always-on home server play, where is state stored, and how can LLM recommendations be generated without a paid API key?

## Answer

- **Home server as collector**: Vercel still renders the screen and fetches the easy sources. The home server fetches only what Vercel cannot reach (sources needing a residential IP or a logged-in session) and writes into the same Redis cache. If it is down, only those sources go stale. It can be treated as always on.
- **Storage**: MongoDB is removed entirely. Redis holds cached source data and anything that must persist, including LLM recommendations, using its non-expiring keys.
- **Admin area**: reduced to login, the manual refresh button and a source health page.
- **Recommendations**: use Catalog services where available, and also LLM picks. How the two combine is open in [How catalog and LLM recommendations combine](08-how-catalog-and-llm-recommendations-combine.md).
- **LLM route**: the Claude Code CLI runs unattended on the home server under the owner's Max subscription. `claude setup-token` gives a one-year token stored as `CLAUDE_CODE_OAUTH_TOKEN`; a daily job runs `claude -p` with `--output-format json` and `--json-schema`. The job must not use `--bare`, which ignores that token.
- **Caveats recorded**: the consumer terms bar automated access except where explicitly permitted, and reading the CLI's documented script use as that permission is an interpretation. Usage counts against the normal Max limits. The token needs yearly renewal.
- **Not used**: subscription credentials from Vercel or through the Agent SDK.
