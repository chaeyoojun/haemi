#!/bin/bash
set -euo pipefail
SITE=/etc/nginx/sites-available/haemi-web
sudo mkdir -p /var/www/haemi-web
sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

if sudo test -f /etc/letsencrypt/live/hm.if.io.kr/fullchain.pem; then
  sudo cp /tmp/haemi-web.conf "$SITE"
  sudo ln -sfn "$SITE" /etc/nginx/sites-enabled/haemi-web
  sudo nginx -t
  sudo systemctl reload nginx
  echo "nginx: haemi-web HTTPS installed"
else
  echo "nginx: certificate missing for hm.if.io.kr, keeping current site"
  if [ ! -f "$SITE" ]; then
    sudo cp /tmp/haemi-web.conf "$SITE"
    sudo ln -sfn "$SITE" /etc/nginx/sites-enabled/haemi-web
    sudo nginx -t
    sudo systemctl reload nginx
    echo "nginx: haemi-web HTTP installed"
  fi
  echo "nginx: add DNS A record hm.if.io.kr -> 1.201.117.26 then install certbot."
fi
