#!/usr/bin/env bash
set -Eeuo pipefail

NODE_MAJOR=22

if [[ ! -f package.json || ! -f package-lock.json ]]; then
  printf 'Errore: esegui questo script dalla cartella del progetto.\n' >&2
  exit 1
fi

if [[ ! -r /etc/os-release ]]; then
  printf 'Errore: impossibile identificare il sistema operativo.\n' >&2
  exit 1
fi

# shellcheck disable=SC1091
source /etc/os-release
if [[ "${ID:-}" != "ubuntu" ]]; then
  printf 'Errore: questo script supporta Ubuntu, non %s.\n' "${PRETTY_NAME:-questo sistema}" >&2
  exit 1
fi

if (( EUID == 0 )); then
  SUDO=
elif command -v sudo >/dev/null 2>&1; then
  SUDO=sudo
else
  printf 'Errore: servono i permessi amministrativi (root o sudo).\n' >&2
  exit 1
fi

${SUDO:+$SUDO }apt-get update
${SUDO:+$SUDO }apt-get install -y ca-certificates curl gnupg git

${SUDO:+$SUDO }install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |
  ${SUDO:+$SUDO }gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
${SUDO:+$SUDO }chmod 0644 /etc/apt/keyrings/nodesource.gpg
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_%s.x nodistro main\n' \
  "$(dpkg --print-architecture)" "$NODE_MAJOR" |
  ${SUDO:+$SUDO }tee /etc/apt/sources.list.d/nodesource.list >/dev/null

curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key |
  ${SUDO:+$SUDO }gpg --dearmor --yes -o /etc/apt/keyrings/caddy-stable-archive-keyring.gpg
${SUDO:+$SUDO }chmod 0644 /etc/apt/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt |
  ${SUDO:+$SUDO }tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null

${SUDO:+$SUDO }apt-get update
${SUDO:+$SUDO }apt-get install -y nodejs caddy

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if (( node_major < 20 )); then
  printf 'Errore: Node.js %s is installed, but the project requires Node.js 20 or newer.\n' "$node_major" >&2
  exit 1
fi

npm ci --omit=dev

printf '\nInstallazione completata.\n'
printf 'Node.js: %s\n' "$(node --version)"
printf 'npm: %s\n' "$(npm --version)"
printf 'Caddy: installato\n'
printf 'Dipendenze Node.js del progetto: installate con npm ci --omit=dev\n'
