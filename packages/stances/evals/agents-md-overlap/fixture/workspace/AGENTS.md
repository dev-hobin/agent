# Agent instructions

- Use Node 22 built-ins only; do not add npm dependencies.
- Keep logic in `src/` pure; I/O lives in `src/io/`.
- Before saying a task is done, run `npm test` and `npm run lint` and report
  the results. Do not claim completion from reading the code alone.
