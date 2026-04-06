# Code convensions

- NEVER use `Date` APIs, we use `Temporal` polyfill instead
- changes can't be considered ready until `bun run validate` and `bun test` are successful (no warnings acceptable)
