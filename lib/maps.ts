export function kakaoMapUrl(place: string) {
  return `https://map.kakao.com/link/search/${encodeURIComponent(place.trim())}`;
}

export function shouldOpenInMapView(url: string) {
  if (!url) {
    return false;
  }
  const lower = url.toLowerCase();
  if (lower.startsWith('intent:') || lower.startsWith('kakaomap:') || lower.startsWith('daummaps:') || lower.startsWith('nmap:') || lower.startsWith('tmap:') || lower.startsWith('geo:') || lower.startsWith('market:')) {
    return false;
  }
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return !lower.includes('play.google.com') && !lower.includes('apps.apple.com') && !lower.includes('market.android.com');
  }
  return false;
}

export const KAKAO_MAP_WEB_HEADERS = {
  'Accept-Language': 'ko-KR,ko;q=1.0,en;q=0.1',
};

export const KAKAO_MAP_DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const BLOCK_MAP_APP_SCHEMES_JS = `
(function() {
  try {
    Object.defineProperty(Navigator.prototype, 'language', { get: function() { return 'ko-KR'; } });
    Object.defineProperty(Navigator.prototype, 'languages', { get: function() { return ['ko-KR', 'ko']; } });
  } catch (e) {}
  try {
    var expire = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = 'lang=ko; path=/; expires=' + expire;
    document.cookie = 'language=ko; path=/; expires=' + expire;
    document.cookie = 'locale=ko; path=/; expires=' + expire;
    localStorage.setItem('lang', 'ko');
    localStorage.setItem('language', 'ko');
    localStorage.setItem('locale', 'ko-KR');
  } catch (e) {}
  function isApp(url) {
    return /^(intent|kakaomap|daummaps|nmap|tmap|geo|market):/i.test(String(url || ''));
  }
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (el && isApp(el.getAttribute('href') || el.href)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
})();
true;
`;

export type PlaceHit = {
  id: string;
  name: string;
  address: string;
};
