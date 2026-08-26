# 가비아 서버에서 실행. nginx 설정에 해미 API 프록시를 넣습니다.
set -euo pipefail
SNIPPET=/etc/nginx/snippets/haemi-api.conf
SITE=/etc/nginx/sites-available/influencer
sudo cp /tmp/haemi-api.location.conf "$SNIPPET"
if grep -q 'haemi-api' "$SITE"; then
  echo "nginx: haemi-api already present"
else
  sudo python3 - "$SITE" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
text = path.read_text()
include = "    include /etc/nginx/snippets/haemi-api.conf;\n\n"
needle = "    location / {\n        try_files"
if needle not in text:
    needle = "    location / {"
idx = text.rfind(needle)
if idx < 0:
    raise SystemExit("could not find location / in nginx site")
path.write_text(text[:idx] + include + text[idx:])
print("nginx: inserted haemi-api include")
PY
fi
sudo nginx -t
sudo systemctl reload nginx
echo "nginx reloaded"
