script: |
  set -e

  cd /var/www/yydsxwh.com

  git fetch origin
  git checkout Andyyyds20260901independentpackage
  git reset --hard origin/Andyyyds20260901independentpackage

  npm ci

  npx prisma generate
  npx prisma db push

  npm run build

  pm2 restart yydsxwh --update-env
  pm2 save

  sleep 3
  curl -f https://www.yydsxwh.com/ || exit 1
