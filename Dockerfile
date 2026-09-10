# ==========================================
# Etap 1: Budowanie aplikacji Next.js (Standalone)
# ==========================================
FROM node:22-bookworm-slim AS next-builder

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /home/vane-community

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000 && \
    yarn playwright install --only-shell chromium && \
    chmod -R 755 /ms-playwright && \
    yarn cache clean

COPY tsconfig.json next.config.mjs next-env.d.ts postcss.config.js drizzle.config.ts tailwind.config.ts .eslintrc.json ./
COPY src ./src
COPY public ./public
COPY drizzle ./drizzle

RUN mkdir -p /home/vane-community/data
RUN yarn build

# ==========================================
# Etap 2: Przygotowanie środowiska SearXNG
# ==========================================
FROM node:22-bookworm-slim AS searxng-builder

ARG SEARXNG_GIT_URL=https://github.com/searxng/searxng.git
ARG SEARXNG_REF=master

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-dev \
    python3-venv \
    python3-pip \
    git \
    ca-certificates \
    curl \
    build-essential \
    libxslt1-dev \
    zlib1g-dev \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/local/searxng

ENV GIT_TERMINAL_PROMPT=0

RUN git clone --depth 1 --branch ${SEARXNG_REF} ${SEARXNG_GIT_URL} /usr/local/searxng/searxng-src || \
    (git clone --depth 1 ${SEARXNG_GIT_URL} /usr/local/searxng/searxng-src && cd /usr/local/searxng/searxng-src && git checkout ${SEARXNG_REF}) || \
    (mkdir -p /usr/local/searxng/searxng-src && curl -sSL https://github.com/searxng/searxng/archive/refs/heads/${SEARXNG_REF}.tar.gz | tar -xz --strip-components=1 -C /usr/local/searxng/searxng-src)

RUN python3 -m venv /usr/local/searxng/searx-pyenv && \
    /usr/local/searxng/searx-pyenv/bin/pip install --no-cache-dir --upgrade pip setuptools wheel pyyaml msgspec typing_extensions uwsgi && \
    /usr/local/searxng/searx-pyenv/bin/pip install --no-cache-dir --use-pep517 --no-build-isolation -e /usr/local/searxng/searxng-src && \
    (cd /usr/local/searxng/searxng-src && /usr/local/searxng/searx-pyenv/bin/python -c "import os; from searx.version import get_information; v = get_information(); open('searx/version_frozen.py', 'w').write(f'VERSION_STRING = \"{v[0]}\"\nVERSION_TAG = \"{v[1]}\"\nDOCKER_TAG = \"{v[2]}\"\nGIT_URL = \"{v[3]}\"\nGIT_BRANCH = \"{v[4]}\"\n')" || true)

RUN rm -rf /usr/local/searxng/searxng-src/.git \
           /usr/local/searxng/searxng-src/tests \
           /usr/local/searxng/searxng-src/docs \
           /usr/local/searxng/searx-pyenv/share \
           /root/.cache

# ==========================================
# Etap 3: Obraz produkcyjny (Runtime)
# ==========================================
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV SEARXNG_API_URL=http://127.0.0.1:8080
ENV SEARXNG_SETTINGS_PATH=/etc/searxng/settings.yml

# Instalacja wyłącznie bibliotek dynamicznych (bez kompilatorów i nagłówków *-dev)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-minimal \
    python3 \
    libpython3.11 \
    git \
    sqlite3 \
    libxslt1.1 \
    libxml2 \
    zlib1g \
    libffi8 \
    libssl3 \
    ca-certificates \
    curl \
    gosu \
    fonts-liberation \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Utworzenie dedykowanych użytkowników systemowych
RUN groupadd -g 1001 vane-community && \
    useradd -u 1001 -g vane-community -m -s /bin/bash vane-community && \
    groupadd -g 1002 searxng && \
    useradd -u 1002 -g searxng -d /usr/local/searxng -s /bin/bash searxng

# Kopiowanie przeglądarki Playwright z etapu buildera
COPY --from=next-builder --chown=vane-community:vane-community /ms-playwright /ms-playwright

# Kopiowanie przygotowanego środowiska SearXNG
COPY --from=searxng-builder --chown=searxng:searxng /usr/local/searxng /usr/local/searxng

# Konfiguracja SearXNG
RUN mkdir -p /etc/searxng
COPY searxng/settings.yml /etc/searxng/settings.yml
COPY searxng/limiter.toml /etc/searxng/limiter.toml
COPY searxng/uwsgi.ini /etc/searxng/uwsgi.ini
RUN chown -R searxng:searxng /etc/searxng

# Przygotowanie katalogu roboczego Vane-Community
WORKDIR /home/vane-community

RUN mkdir -p uploads data && \
    chown -R vane-community:vane-community /home/vane-community

# Kopiowanie artefaktów Next.js Standalone z zachowaniem prawidłowych ścieżek
COPY --from=next-builder --chown=vane-community:vane-community /home/vane-community/public ./public
COPY --from=next-builder --chown=vane-community:vane-community /home/vane-community/.next/static ./.next/static
COPY --from=next-builder --chown=vane-community:vane-community /home/vane-community/.next/standalone ./
COPY --from=next-builder --chown=vane-community:vane-community /home/vane-community/data ./data
COPY --chown=vane-community:vane-community drizzle ./drizzle

# Konfiguracja skryptu startowego
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && \
    sed -i 's/\r$//' ./entrypoint.sh

EXPOSE 3000 8080

CMD ["/home/vane-community/entrypoint.sh"]
