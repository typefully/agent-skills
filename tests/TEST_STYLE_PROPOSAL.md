# Test Style Proposal (Local Draft)

Goal: make behavior obvious at a glance and remove setup noise.

## Proposed format

1. Group by command with `describe(...)`.
2. Use `withCliHarness(...)` for sandbox/server/env lifecycle.
3. Keep each test in three blocks:
   - HTTP expectations (Arrange)
   - one CLI call (Act)
   - result assertions (Assert)
4. Use helper assertions:
   - `expectCliOk(result, expectedJson?)`
   - `expectCliError(result, expectedErrorJson, expectedCode?)`
5. Use table-driven loops for flag/validation variants.

## Example (pilot)

Pilot file: `tests/queue.test.js`

Pattern used:

```js
describe('queue:get', () => {
  it('sends start_date and end_date query params', withCliHarness(async ({ server, apiKey, run }) => {
    server.expect('GET', '/v2/social-sets/9/queue', { ... });

    const result = await run(['queue:get', '9', '--start-date', '2026-02-01', '--end-date', '2026-02-29']);
    expectCliOk(result, { ... });
  }));
});
```

## Why this format

1. Boilerplate is centralized; test bodies only show behavior.
2. `describe` sections create a predictable scan order by command.
3. Table-driven sections reduce copy/paste for equivalent validations.
4. Assertion helpers keep "what failed" focused on intent instead of plumbing.

## Migration plan (if approved)

1. Migrate `tests/media.test.js`.
2. Migrate `tests/config.test.js` and `tests/social-sets.test.js`.
3. Migrate `tests/drafts.test.js` last (and split by subcommand in same pass).
