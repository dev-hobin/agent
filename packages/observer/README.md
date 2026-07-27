# @hobin/observer

A spec-first rebuild of Observer for Pi.

Observer is intended to provide a local-first observation mode that follows standing inquiry loops across materials, reconciles developing memos, and promotes mature, source-linked knowledge into Zettelkasten records.

## Status

This package is private and under spec-first implementation. Slice 7 is in progress: the package has a branch-local observation ledger, source-first candidate/read/hydrate/record staging, a deterministic Standing Inquiry index, and one sequential `observer_sidecar` Pi tool. `/observe memo` records and replay-confirms an exact request before sending a recoverable nontruth agent trigger; `memo-scope` returns only that request's read-only context. Strict `memo-prepare` now refines and replay-confirms a complete instruction before delegating to the existing prepared → applied → acknowledged Memo path, with append-free retry across instruction/install/apply/ack gaps and no Markdown write. Actual model-driven staged execution plus the complete wrap/fresh-session re-entry transcript remain deferred.

## Documentation

- [Observer v0.1 product specification (Korean)](docs/product-spec-v0.1.ko.md)
- [Observer v0.1 implementation plan and status (Korean)](docs/implementation-plan-v0.1.ko.md)

## Historical implementation

The previous implementation and its filtered history are preserved separately on the `archive/observer-v0.1` branch. It is evidence and a behavior oracle, not the baseline for this rebuild.
