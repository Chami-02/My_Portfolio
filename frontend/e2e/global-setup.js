// frontend/e2e/global-setup.js
//
// Refuses to run the suite unless the backend is on an E2E database.
// PF-66.

export default async function globalSetup() {
  const api = process.env.E2E_API_URL || 'http://localhost:5055/api';

  const res = await fetch(`${api}/health`);
  if (!res.ok) {
    throw new Error(`E2E backend not reachable at ${api}`);
  }

  const { database } = await res.json();

  if (!database || !/e2e|test/i.test(database)) {
    throw new Error(
      `\n\nREFUSING TO RUN.\n` +
      `The backend is connected to "${database}".\n` +
      `E2E tests wipe and rewrite data — they must only run against a\n` +
      `database whose name contains "e2e" or "test".\n`
    );
  }

  console.log(`✓ E2E backend verified on database: ${database}`);
}
