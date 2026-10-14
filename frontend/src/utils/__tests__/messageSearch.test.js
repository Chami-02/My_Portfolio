import { describe, it, expect } from 'vitest';
import { searchWords, messageMatches, searchMessages, highlightParts, MESSAGE_TABS }
  from '../messageSearch';

const MESSAGES = Object.freeze([
  Object.freeze({ _id: '1', name: 'Asha Perera',  email: 'asha@studio.lk',  message: 'We have a Docker internship opening.', read: false, starred: true }),
  Object.freeze({ _id: '2', name: 'Ben Okafor',   email: 'ben@corp.com',    message: 'Loved the Docker article on your blog.', read: true,  starred: false }),
  Object.freeze({ _id: '3', name: 'Chen Wei',     email: 'chen@uni.edu',    message: 'Is the internship still open? (urgent) c++ welcome', read: true, starred: false }),
]);

const ids = (list) => list.map((m) => m._id);

describe('searchWords', () => {
  it('lowercases, splits on any whitespace and drops empties', () => {
    expect(searchWords('  Docker\tINTERNSHIP \n')).toEqual(['docker', 'internship']);
  });

  it('is empty for a blank query', () => {
    expect(searchWords('   ')).toEqual([]);
    expect(searchWords(undefined)).toEqual([]);
  });
});

describe('searchMessages', () => {
  it('returns everything, unchanged, for a blank query', () => {
    expect(searchMessages(MESSAGES, '')).toBe(MESSAGES);
  });

  it('is case-insensitive', () => {
    expect(ids(searchMessages(MESSAGES, 'DOCKER'))).toEqual(['1', '2']);
  });

  // ⚠️ The fixture is what makes this an AND test: message 2 has only
  // "docker" and message 3 only "internship". An OR would return all three.
  it('ANDs the words — a message must contain every one', () => {
    expect(ids(searchMessages(MESSAGES, 'docker internship'))).toEqual(['1']);
  });

  it('matches the words in any order', () => {
    expect(ids(searchMessages(MESSAGES, 'internship docker'))).toEqual(['1']);
  });

  it('searches the name, the email and the text', () => {
    expect(ids(searchMessages(MESSAGES, 'okafor'))).toEqual(['2']);
    expect(ids(searchMessages(MESSAGES, 'uni.edu'))).toEqual(['3']);
    expect(ids(searchMessages(MESSAGES, 'article'))).toEqual(['2']);
  });

  it('can AND across fields — a name word and a text word', () => {
    expect(ids(searchMessages(MESSAGES, 'chen internship'))).toEqual(['3']);
  });

  it('matches part of a word, so results narrow while typing', () => {
    expect(ids(searchMessages(MESSAGES, 'dock'))).toEqual(['1', '2']);
  });

  // ⚠️ The ZERO case. Every positive assertion above would also pass against
  // a filter that matched everything.
  it('returns nothing when nothing matches', () => {
    expect(searchMessages(MESSAGES, 'kubernetes')).toEqual([]);
  });

  it('treats regex characters as plain text — no throw, no match-everything', () => {
    expect(ids(searchMessages(MESSAGES, 'c++'))).toEqual(['3']);
    expect(ids(searchMessages(MESSAGES, '(urgent)'))).toEqual(['3']);
    expect(searchMessages(MESSAGES, '.*')).toEqual([]);
    // '[' is in no fixture message, so this must find none (a lone '(' would
    // correctly match message 3, which contains one).
    expect(searchMessages(MESSAGES, '[')).toEqual([]);
  });

  it('keeps the order it was given', () => {
    expect(ids(searchMessages([...MESSAGES].reverse(), 'docker'))).toEqual(['2', '1']);
  });

  it('survives a message with a missing field', () => {
    expect(messageMatches({ name: 'X' }, ['x'])).toBe(true);
  });
});

describe('highlightParts', () => {
  const join = (parts) => parts.map((p) => p.text).join('');

  it('marks each occurrence, keeping the original casing', () => {
    expect(highlightParts('Docker and docker', ['docker'])).toEqual([
      { text: 'Docker', match: true },
      { text: ' and ', match: false },
      { text: 'docker', match: true },
    ]);
  });

  it('always rebuilds the original text exactly', () => {
    const text = 'Is the internship still open? (urgent) c++ welcome';
    expect(join(highlightParts(text, ['intern', 'c++', '(urg', 'e']))).toBe(text);
  });

  it('merges overlapping words into one run', () => {
    expect(highlightParts('docker', ['do', 'dock'])).toEqual([
      { text: 'dock', match: true },
      { text: 'er', match: false },
    ]);
  });

  it('returns one plain run when there is nothing to mark', () => {
    expect(highlightParts('hello', [])).toEqual([{ text: 'hello', match: false }]);
    expect(highlightParts('hello', ['zzz'])).toEqual([{ text: 'hello', match: false }]);
  });

  it('handles empty text', () => {
    expect(highlightParts('', ['a'])).toEqual([{ text: '', match: false }]);
  });
});

describe('MESSAGE_TABS', () => {
  const inTab = (key) => ids(MESSAGES.filter(MESSAGE_TABS.find((t) => t.key === key).test));

  it('ALL holds every message — starred included', () => {
    expect(inTab('all')).toEqual(['1', '2', '3']);
  });

  it('UNREAD holds the unread', () => {
    expect(inTab('unread')).toEqual(['1']);
  });

  it('STARRED holds only the starred', () => {
    expect(inTab('starred')).toEqual(['1']);
  });

  it('reads a row with no starred field as unstarred', () => {
    const tab = MESSAGE_TABS.find((t) => t.key === 'starred');
    expect(tab.test({ read: false })).toBe(false);
  });
});
