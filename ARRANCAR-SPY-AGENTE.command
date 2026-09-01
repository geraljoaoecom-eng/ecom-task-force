#!/bin/bash
cd "$(dirname "$0")"
SPY_API_URL=https://ecoomtaskforce.site/api \
SPY_MOBILE_AGENT_SECRET=cff6f95d380a99f8c99a8f5e0f3b42b7cc439776e594bf01757679678a3c5d49 \
node scripts/spy-mobile-agent.js
