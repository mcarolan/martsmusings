#!/bin/bash
set -e
SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

hugo --gc --minify

cowsay syncing site
rclone sync --verbose "$SCRIPTPATH"/public vps:/var/www/vps
