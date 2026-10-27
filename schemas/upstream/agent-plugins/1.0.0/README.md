# Upstream Agent Plugins manifest schema

`plugin.schema.json` and `LICENSE` are unmodified, byte-for-byte copies from
[Agent Plugins v1.0.0](https://github.com/agentplugins/agent-plugins-spec/tree/bd383552095128f6effe895b9257cfd580a6d179).
`source.json` records the upstream paths, immutable commit, and SHA-256 digests.
The authoring check verifies both local files before compiling the schema.

Schemas are Apache-2.0 software material under the upstream
[licensing policy](https://github.com/agentplugins/agent-plugins-spec/blob/bd383552095128f6effe895b9257cfd580a6d179/LICENSE.md).
They are not relicensed under this repository's MIT license. No specification
text is vendored here; upstream specification and documentation are CC-BY-4.0.

This is a development-time validation dependency, not an agent runtime or an
installer. Loading a Skill never fetches or compiles this schema. Review the
normative specification as well: schema validity alone does not establish path
containment, client behavior, or complete conformance. See
[the adoption register](../../../../docs/standards.md).
