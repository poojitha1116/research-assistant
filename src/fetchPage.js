import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';

const MAX_CHARS = 6000; // per page, to keep the LLM prompt a sane size
const MAX_HTML = 2_000_000;

export async function fetchPage(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (research-assistant student project)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return { ok: false, url, error: `HTTP ${res.status}` };

    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('text/html')) {
      return { ok: false, url, error: `not HTML (${type || 'unknown type'})` };
    }

    const html = (await res.text()).slice(0, MAX_HTML);
    const dom = new JSDOM(html, { url, virtualConsole: new VirtualConsole() });
    const article = new Readability(dom.window.document).parse();
    const text = (article?.textContent ?? '').replace(/\s+/g, ' ').trim();

    if (text.length < 200) return { ok: false, url, error: 'too little text extracted' };

    return {
      ok: true,
      url,
      title: article.title,
      text: text.slice(0, MAX_CHARS),
      chars: text.length,
    };
  } catch (e) {
    return { ok: false, url, error: e.name === 'TimeoutError' ? 'timeout' : e.message };
  }
}