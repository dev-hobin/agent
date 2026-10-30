# Duplicate shipping labels

Context: a label worker calls a carrier API to create one shipping label per
parcel. The HTTP client gives up after 2 seconds; the worker retries up to 3
times.

What happened: during a slow afternoon the carrier created a label on every
attempt. One parcel ended up with four billed labels.

First fix: retry only on connection errors, never on timeouts. After that,
labels went missing whenever the carrier was slow, because some timeouts
meant the label had not been created.

Open question: from a timeout alone we cannot tell whether the label exists.
