// frontend/src/test/leadsWithIcon.js
/**
 * Test helper — "is this link's icon in FRONT of its label?"
 *
 * ⚠️ THE OBVIOUS VERSION OF THIS CHECK IS BLIND, AND IT LOOKS EXACTLY
 * LIKE IT WORKS. Four guards were written on 2026-08-29 as
 *
 *     expect(link.firstElementChild).toBe(svg)
 *
 * and mutation testing showed the assertion cannot fail for the reason
 * it is written for: the label beside the icon is a TEXT node, and
 * `firstElementChild` skips text nodes by definition. Moving the mark
 * behind the label left every one of those guards green.
 *
 * This walks `childNodes` instead — whitespace-only text ignored,
 * because JSX indentation produces plenty of it — and asks whether the
 * first MEANINGFUL node is the icon. Confirmed by mutation in both
 * directions.
 *
 * Lives in src/test/ rather than being copied into four files: it is
 * the assertion itself that is subtle, so one place to read the reason
 * is worth more than the repo's usual per-file helper duplication.
 */
export function leadsWithIcon(link, icon = link.querySelector('svg')) {
  const first = [...link.childNodes]
    .find((n) => n.nodeType !== Node.TEXT_NODE || n.textContent.trim() !== '');
  return first === icon;
}
