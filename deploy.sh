#!/bin/bash
set -e
SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

hugo --gc --minify

if [ -n "$(git status --porcelain=v1 2>/dev/null)" ]; then
  cowsay "you have untracked files bro"
  exit 1
fi

cowsay fetching
git fetch

BEHIND=$(git rev-list @..@{u} --count)
if ! echo -n $BEHIND | grep '^0$' > /dev/null; then
  cowsay "${BEHIND} behind remote, plz pull!"
  exit 1
fi

UNPUSHED=$(git rev-list @{u}..@ --count)
if ! echo -n $UNPUSHED | grep '^0$' > /dev/null; then
  cowsay "${UNPUSHED} infront of remote, plz push!"
  exit 1
fi

if ! git status --porcelain; then
  cowsay "uncommited  changes!"
  exit 1
fi

cowsay syncing site
rclone sync --verbose "$SCRIPTPATH"/public vps:/var/www/root
