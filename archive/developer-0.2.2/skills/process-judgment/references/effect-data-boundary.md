# Effect Data Boundary

Use this reference when a process must decide whether to perform an effect
directly or represent intent as inspectable data before interpretation. It judges
storage, inspection, transformation, retry, batching, audit, and opacity without
requiring an effect framework.

## Accepted Judgment Context

Supply the intended external action, caller purpose, execution timing, required
inspection or transformation, retry and partial-failure behavior, serialization
or persistence needs, authority boundary, and one case where execution must be
delayed, compared, or repeated.

## Three Representations

```text
direct effect:
  perform the action now under the current operational owner

effect descriptor:
  data that states accepted intent and parameters but is not yet authority to act

opaque executable value:
  stored behavior that can run later but may hide identity, inputs, comparison,
  serialization, transformation, and audit semantics
```

Use direct execution for a local one-time effect when no independent inspection,
storage, transformation, retry, or scheduling boundary exists. Use a descriptor
when intent must survive as data. Convert to executable behavior only at the
owned interpretation edge.

## Descriptor Contract

State:

```text
operation identity and version
parameters and admitted values
authority required to interpret
idempotency or deduplication identity, if needed
expected result and failure states
sensitive-data and retention boundary
validation versus execution responsibility
unknown-version behavior
```

A descriptor is not harmless because it is data. It may carry secrets, become a
compatibility surface, or be replayed under changed authority.

## Worked Case: Notification Intent

Domain transformation determines that a customer should receive a payment
receipt. The action may be batched, inspected, retried, and audited.

Descriptor:

```text
SendReceipt {
  receiptIdentity,
  customerIdentity,
  templateIdentity,
  locale,
  paymentIdentity
}
```

Ownership:

```text
transform:
  creates an admitted descriptor without network access
inspection:
  policy may suppress or group duplicate receipt identities
push edge:
  resolves current destination and template, performs send, records outcome
retry:
  keyed by receipt identity under an explicit duplicate policy
failure:
  distinguishes rejected descriptor, unavailable destination, uncertain send,
  confirmed send, and audit-write failure
```

The descriptor supports inspection and retry. A closure capturing a client,
mutable customer record, and current locale would hide those observers and could
change meaning before execution.

## Counterexample: Immediate Local Log

A bounded diagnostic line is written once inside the operational edge, needs no
persistence, batching, retry, or business audit, and has a local failure policy.
Creating a public descriptor and registry would add versioning and dispatch costs
without independent pressure. Direct execution is sufficient.

## Interpretation Check

Test:

```text
Can two intents be compared without executing them?
Can intent be stored and later interpreted under an explicit version?
Can retry distinguish repeat from duplicate business action?
Can sensitive fields expire or be redacted?
Can partial execution be represented without rewriting history as success?
```

If none apply, an effect descriptor may be unnecessary. If they apply but the
representation is opaque, the proposed boundary loses required abilities.

## Artifact

```text
Effect and caller purpose:
Direct / descriptor / opaque alternatives:
Required observers and transformations:
Descriptor identity, version, and parameters:
Interpretation authority and timing:
Result and partial-failure states:
Retry / batch / audit / retention boundary:
Simpler direct alternative:
Decision:
```

## Stop And Separation

Stop when the chosen representation preserves all required pre-execution
observers, authority is granted only at interpretation, failure states remain
truthful, and a direct-effect alternative has been considered. Do not require
inspectable data when no consumer needs it.

This reference does not invent business intent, authorize an effect, require a
command bus, choose a library, or route unresolved work.

## Source Trace

- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Composition, public-manuscript pp. 104-112, for separating transformation from
  environmental effect, representing effects as data, and delaying conversion to
  opaque executable behavior. Versioning, sensitive-data, idempotency, and
  production audit obligations are operational extensions here.
