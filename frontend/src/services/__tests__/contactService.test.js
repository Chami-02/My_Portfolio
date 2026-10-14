// frontend/src/services/__tests__/contactService.test.js
//
// MARK READ / MARK UNREAD (owner, 2026-10-14) — what actually goes on the wire.
//
// ⚠️ The server treats a MISSING `read` as `true` (so an old client keeps its
// meaning). That makes a dropped body silent in the worst direction: MARK
// UNREAD would mark the message READ, with a 200. So the body is asserted as
// axios sends it, through the real pipeline with a scripted adapter
// (aboutService.test.js's instrument), never through a mocked `api`.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import api from '../api';
import { contactService } from '../contactService';

const calls = [];
const originalAdapter = api.defaults.adapter;

beforeEach(() => {
  calls.length = 0;
  api.defaults.adapter = async (config) => {
    calls.push(config);
    return { data: { status: 'success', data: { _id: 'm1' } }, status: 200, statusText: 'OK', headers: {}, config };
  };
});
afterEach(() => { api.defaults.adapter = originalAdapter; });

describe('contactService.markRead', () => {
  it.each([
    ['unread', false, '{"read":false}'],
    ['read',   true,  '{"read":true}'],
  ])('marks a message %s with an explicit value', async (_label, read, body) => {
    await contactService.markRead('m1', read);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('patch');
    expect(calls[0].url).toBe('/contact/m1/read');
    expect(calls[0].data).toBe(body);
  });

  it('with no second argument still says read: true (never an empty body)', async () => {
    await contactService.markRead('m1');
    expect(calls[0].data).toBe('{"read":true}');
  });
});
