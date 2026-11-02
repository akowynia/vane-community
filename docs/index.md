# Vane-Community Documentation 🔍

Welcome to the official documentation for **Vane-Community**, a privacy-focused, local-first AI answering engine and deep research platform designed to run directly on your own hardware or private infrastructure.

---

## 🌟 Key Highlights

- **Local-First & Multi-Provider AI**: Native integration with local model runners (Ollama, LM Studio, Transformers.js) alongside cloud AI providers (OpenAI, Anthropic Claude, Google Gemini, Groq, Mistral).
- **Private Meta Search via SearXNG**: Aggregates web, academic, and news results without tracking or telemetry leaks.
- **Deep Research & Autonomous Agents**: Multi-step recursive search, intelligent citation synthesis, and comprehensive research reports.
- **Model Context Protocol (MCP)**: Dynamic client and server architecture connecting custom tools, headless scrapers, and external APIs directly to the LLM runtime.
- **AI Scratchpad & Presentation Engine**: Interactive canvas for collaborative writing, revision history, and automated research-to-presentation slide generation.
- **Enterprise-Grade Governance**: Role-based access control (Admin / Member), token budgets, encrypted credential vaults, and robust SSRF defenses.

---

## 🚀 Quick Start with Docker

The fastest way to deploy Vane-Community is using the official pre-built multi-architecture container images:

```yaml
services:
  vane:
    image: akowynia/vane-community:latest
    container_name: vane-community
    ports:
      - '3000:3000'
    volumes:
      - data:/home/vane-community/data
    extra_hosts:
      - 'host.docker.internal:host-gateway'
    restart: unless-stopped

volumes:
  data:
```

Run the container:

```bash
docker compose up -d
```

Open your browser and navigate to `http://localhost:3000` to begin initial setup.

---

## 📖 Documentation Structure

Explore the dedicated sections to learn more about Vane-Community's design and features:

| Section | Focus |
| :--- | :--- |
| **Getting Started** | Setup instructions, container updating guidelines, and contribution workflows. |
| **Search & Research Engine** | Deep research workflows, batch search processing, query resilience, and scraper architectures. |
| **Tooling & MCP** | Dedicated MCP container bridges, Presenton slide generation, and custom tool extensions. |
| **Models & Scheduling** | Local model scheduling, VRAM memory optimization queues, and token usage analytics. |
| **Workspaces & Collaboration** | Persistent Waypoint spaces, scheduled cron webhooks, and the Scratchpad canvas. |
| **Security & Administration** | Role-based authentication, encrypted vaults, SSRF mitigation, and the API playground. |
| **API Reference** | Specifications and examples for programmatic search endpoints. |

---

## 🤝 Community & Support

Vane-Community is an open-source project actively maintained by Artur Kowynia and the community. Contributions, bug reports, and suggestions are welcome.

