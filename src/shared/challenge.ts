/** Detect rendered verification UI, not references in ordinary wiki articles or script bundles. */
export function isChallengeDocument(doc: Document): boolean {
  const visible = (el: Element): boolean => {
    const style = doc.defaultView?.getComputedStyle(el);
    return !!el.getClientRects().length && style?.display !== "none" && style?.visibility !== "hidden";
  };
  const widgets = doc.querySelectorAll('iframe[src*="/recaptcha/"], iframe[src*="hcaptcha.com"], .g-recaptcha, .h-captcha, .cf-turnstile, #challenge-running, #challenge-stage');
  if (Array.from(widgets).some(visible)) return true;
  const heading = doc.querySelector("h1")?.textContent?.trim() ?? "";
  const title = doc.title;
  const text = doc.body?.innerText ?? "";
  const marker = /부적절한\s*요청|비정상적인\s*요청|자동화된\s*요청|로봇이\s*아닙니다|사람인지\s*확인|verify you are human|checking your browser|just a moment|보안\s*확인/i;
  // Body text alone is only a fallback on short pages without normal document links.
  return marker.test(heading) || marker.test(title) ||
    (text.length < 5000 && !doc.querySelector('a[href^="/w/"]') && marker.test(text));
}
