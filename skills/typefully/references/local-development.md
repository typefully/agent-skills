# Local Development

Use this only when testing the Typefully CLI against a non-production API.

## API base override

Pass `--api-base-url <url>` to any command to target another API base for that invocation. If the URL does not end in `/v2`, the CLI appends `/v2`.

```bash
./scripts/typefully.js me:get --api-base-url http://localhost:8000
./scripts/typefully.js drafts:list --api-base-url https://localhost:8000/v2
```

## Local TLS failures

If a local HTTPS server returns `fetch failed` or `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, use one of these development-only fixes:

- Trust the local certificate in the OS or development CA store.
- Use the local server's HTTP URL if it supports one.
- Keep any TLS bypass setting local to the current shell and remove it before running production API commands.

Do not commit local API URLs, API keys, or TLS bypass settings.
