#!/usr/bin/env bash
set -euo pipefail
read -r -s -p "npm OTP: " OTP
echo
npm publish --otp="$OTP"
