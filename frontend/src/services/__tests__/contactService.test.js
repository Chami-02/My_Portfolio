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

// PF-153 — the route takes 200 ids, the most that sits well inside the 10 kb body limit.
describe('contactService.bulk', () => {
  const idsOf = (n) => Array.from({ length: n }, (_, i) => `id${i}`);
  const sent = () => calls.map((c) => JSON.parse(c.data));

  it('sends a short list once', async () => {
    await contactService.bulk('delete', idsOf(3));
    expect(calls.map((c) => [c.method, c.url])).toEqual([['post', '/contact/bulk']]);
    expect(sent()[0]).toEqual({ action: 'delete', ids: idsOf(3) });
  });

  it('sends exactly 200 as one batch', async () => {
    await contactService.bulk('read', idsOf(200));
    expect(sent()).toHaveLength(1);
  });

  it('splits a longer list, in order, losing none', async () => {
    await contactService.bulk('read', idsOf(201));
    expect(sent().map((b) => b.ids.length)).toEqual([200, 1]);
    expect(sent().flatMap((b) => b.ids)).toEqual(idsOf(201));
  });

  it('a failed batch stops the rest', async () => {
    api.defaults.adapter = async (config) => {
      calls.push(config);
      throw new Error('down');
    };
    await expect(contactService.bulk('delete', idsOf(201))).rejects.toThrow('down');
    expect(calls).toHaveLength(1);
  });
});
