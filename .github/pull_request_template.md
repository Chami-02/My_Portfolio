<!--
  This template appears automatically in the description box of every new pull
  request. It exists for one reason: the questions below are the ones that are
  expensive to answer AFTER a release, and cheap to answer now.
-->

## What this changes

<!-- One or two sentences. What is different for a visitor or an operator? -->

## Ticket

<!-- PF-NNN, and a link to the report in `new mds/E<N>/` if one exists. -->

---

## Database migrations

- [ ] **This PR adds no migration.**
- [ ] **This PR adds a migration.** If so, fill in the rest of this section.

**Which one:** <!-- e.g. 009-something.js -->

**Type** — ⚠️ this decides *when* it is safe to run, and getting it wrong is
the classic cause of a deploy outage:

- [ ] **EXPAND** — adds a field, adds an index, backfills values.
      Safe to run *before* the new code goes live, because code that does not
      know about a field simply ignores it. This is the normal case and the
      pipeline runs it automatically.
- [ ] **CONTRACT** — renames, `$unset`s, drops or restructures something.
      ⚠️ **Must NOT ship in the same release as the code change.** Release one
      stops reading the old field; release two removes it. Shipping both
      together means that during the rollout, old code is still running against
      a database where the field is already gone.

- [ ] I have run it with `--dry-run` against a non-production database
- [ ] It is idempotent — running it twice changes nothing
      *(the `migrations` CI job proves this automatically)*

## Checks

- [ ] `all-checks-pass` is green
- [ ] No new `eslint-disable` without a comment explaining why
- [ ] No credential, token or connection string in the diff or in the tests

## Anything reviewers should look at closely

<!--
  The part you are least sure about. Saying "I could not decide between X and
  Y" gets a better review than silence, and it is not an admission of anything.
-->
