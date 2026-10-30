[P0] Migration scrubs the stored footer from every v1 template; per-template footer text is lost — src/templates.js:15
  Scenario: a stored v1 template has footer "Reply STOP to opt out" → migrateStoredTemplates drops it and writes the record back, and the opt-out text is gone for good.
  Evidence: `const { footer, ...payload } = record.payload;` followed by store.put without the footer; nothing copies it elsewhere.
  Direction: keep the stored footer (or move it to a field the renderer reads) and treat removal as an owner decision.
[P0] parseRows returns an empty list for a missing envelope, so sync deletes every local template — src/upstream.js:4
  Scenario: upstream answers { error: 'maintenance' } → parseRows returns [] → syncTemplates removes every local template as no longer in the catalog.
  Evidence: `Array.isArray(body?.rows) ? body.rows : []` maps missing, null, and error bodies to the empty catalog.
  Direction: reject a body without a rows array; only an explicit empty list means an empty catalog.

Checked without findings: async-flow, structure
Not checked: real upstream responses
