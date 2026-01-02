#!/bin/bash

ENV_BEFORE=$(export -p | sort)

source ~/.nvm/nvm.sh
nvm use  # This will automatically read from .nvmrc
npm install

if [ -n "$CLAUDE_ENV_FILE" ]; then
  ENV_AFTER=$(export -p | sort)
  comm -13 <(echo "$ENV_BEFORE") <(echo "$ENV_AFTER") >> "$CLAUDE_ENV_FILE"
fi

exit 0
