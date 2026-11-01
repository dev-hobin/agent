// A lookup panel's request lifecycle, without the UI. The server runs each lookup as a job;
// the panel learns about it only through the calls below. An attempt number ties each
// result to the request that produced it, so a result of an older request is dropped.
export class LookupPanel {
  constructor() {
    this.attempt = 0;
    this.busy = false; // a lookup is running
    this.recovering = false; // a recheck is running
    this.jobId = null; // the server job of the running or unresolved lookup
    this.review = null; // 'withId' or 'withoutId' while the outcome is unknown
    this.result = null;
  }

  canSubmit() {
    return !this.busy && !this.recovering && this.review === null;
  }

  submit() {
    if (!this.canSubmit()) return null;
    this.busy = true;
    this.jobId = null;
    this.result = null;
    return ++this.attempt;
  }

  jobCreated(attempt, jobId) {
    if (attempt !== this.attempt || !this.busy) return;
    this.jobId = jobId;
  }

  settle(attempt, outcome) {
    if (attempt !== this.attempt || !this.busy) return;
    this.busy = false;
    if (outcome.kind === 'completed') {
      this.result = outcome.result;
      this.jobId = null;
    } else if (outcome.kind === 'failed') {
      this.jobId = null;
    } else if (outcome.kind === 'deadline') {
      this.review = this.jobId ? 'withId' : 'withoutId';
    }
  }

  canRecheck() {
    return !this.busy && !this.recovering && this.review === 'withId';
  }

  recheck() {
    if (!this.canRecheck()) return null;
    this.recovering = true;
    return ++this.attempt;
  }

  settleRecheck(attempt, status) {
    if (attempt !== this.attempt || !this.recovering) return;
    this.recovering = false;
    if (status === 'completed' || status === 'failed') {
      this.review = null;
      this.jobId = null;
    }
  }

  canCancel() {
    return this.busy || this.recovering;
  }

  // The server job keeps running after a cancel, so its outcome stays unknown: a cancelled
  // lookup becomes a review (recheckable when the job id is known), and a cancelled recheck
  // keeps its review. The attempt moves on, so a late result of the cancelled call is dropped.
  cancel() {
    if (!this.canCancel()) return false;
    this.attempt++;
    if (this.busy) {
      this.busy = false;
      this.review = this.jobId ? 'withId' : 'withoutId';
    } else {
      this.recovering = false;
    }
    return true;
  }

  reset() {
    this.attempt++;
    this.busy = false;
    this.recovering = false;
    this.jobId = null;
    this.review = null;
    this.result = null;
  }
}
