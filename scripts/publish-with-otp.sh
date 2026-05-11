#!/usr/bin/env bash
set -e
if [ -z "${NPM_OTP}" ]; then
  echo "Usage: NPM_OTP=123456 npm run publish:otp"
  echo "Get 6-digit code from your authenticator app (Google Authenticator, Authy, etc.)"
  exit 1
fi
npm publish --access public --otp="${NPM_OTP}"
