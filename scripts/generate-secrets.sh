#!/bin/bash
# ===================================================
# Genera secrets seguros para .env.production
# ===================================================
# Uso: bash scripts/generate-secrets.sh
# Luego pega los valores en .env.production
# ===================================================

echo "==================================="
echo " Secrets para Open API Facturación SRI"
echo "==================================="
echo ""

ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_SALT=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
DB_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(16).toString('base64'))")
REDIS_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(16).toString('base64'))")

echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo "ENCRYPTION_SALT=$ENCRYPTION_SALT"
echo "JWT_SECRET=$JWT_SECRET"
echo "DB_PASSWORD=$DB_PASSWORD"
echo "REDIS_PASSWORD=$REDIS_PASSWORD"

echo ""
echo "==================================="
echo " Pega los valores en .env.production"
echo "==================================="
