#!/bin/bash
set -e
SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
cd "$SCRIPTPATH"

trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

cowsay "Starting dev image server"
$(cd /home/martin/Pictures && python2 -m SimpleHTTPServer 9000)&

HUGO_PARAMS_assetsBase="http://localhost:9000" hugo server -FD
