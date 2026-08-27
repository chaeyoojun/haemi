#!/bin/bash
set -euo pipefail
SITE=/etc/nginx/sites-available/haemi-web
sudo mkdir -p /var/www/haemi-web

if [ -f /etc/letsencrypt/live/hm.if.io.kr/fullchain.pem ] && [ -f "$SITE" ] && grep -q "ssl_certificate" "$SITE"; then
  echo "nginx: hm.if.io.kr already has HTTPS, keeping existing site"
else
  sudo cp /tmp/haemi-web.conf "$SITE"
  sudo ln -sfn "$SITE" /etc/nginx/sites-enabled/haemi-web
  sudo nginx -t
  sudo systemctl reload nginx
  echo "nginx: haemi-web installed"
  if [ ! -f /etc/letsencrypt/live/hm.if.io.kr/fullchain.pem ]; then
    if sudo certbot --nginx -d hm.if.io.kr --non-interactive --agree-tos --redirect --register-unsafely-without-email; then
      echo "nginx: hm.if.io.kr certificate issued"
    else
      echo "nginx: certificate skipped. Add DNS A record hm.if.io.kr -> 121.78.183.225 then rerun certbot."
    fi
  fi
fi
