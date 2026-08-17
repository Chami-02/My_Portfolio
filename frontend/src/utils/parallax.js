// frontend/src/utils/parallax.js

/**
 * Prototype: bindScroll()'s data-para transform, extracted as a pure
 * function (Portfolio Revolution.dc.html lines 1062-1067).
 *
 * PF-80 and PF-81 each wire this into their own independent scroll
 * listener rather than sharing one — the same call Reveal made in
 * PF-75. Two elements on the whole page carry data-para, so a shared
 * singleton would buy nothing and cost a lifetime subscription. What is
 * worth sharing is the arithmetic, so both sections drift at identical
 * rates without either importing the other's effect.
 *
 * `mid` is the element's distance from the viewport's vertical centre,
 * so the transform is zero as the element passes mid-screen and grows in
 * both directions from there. Negated, so the element lags the scroll
 * rather than leading it.
 *
 * @param {Element} el      the [data-para] element
 * @param {number}  factor  the prototype's data-para value (0.12 hero,
 *                          0.05 about)
 * @returns {string} a transform value, ready to assign to el.style
 */
export function computeParallaxTransform(el, factor) {
  const r = el.getBoundingClientRect();
  const mid = r.top + r.height / 2 - window.innerHeight / 2;
  const translate = `translate3d(0,${(-mid * factor).toFixed(1)}px,0)`;

  // The scale is not decoration: an <img> translated inside a fixed box
  // would expose its own edges at the extremes of the drift. Overscaling
  // gives it the bleed to move within. A <div> painting a background
  // (hero's grid) has no edge to expose and gets no scale.
  return el.tagName === 'IMG' ? `${translate} scale(1.1)` : translate;
}
