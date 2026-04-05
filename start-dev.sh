#!/bin/bash
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
cd /Users/magnusnordmo/LIN_eiendom
exec node node_modules/next/dist/bin/next start --port 3000
