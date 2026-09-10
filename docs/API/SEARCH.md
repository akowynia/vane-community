# Vane-Community Search API Documentation

## Overview

Vane-Community's Search API makes it easy to use our AI-powered search engine. You can run different types of searches, pick the models you want to use, and get the most recent info. Follow the following headings to learn more about Vane-Community's search API.

## Endpoints

### Get Available Providers and Models

Before making search requests, you'll need to get the available providers and their models.

#### **GET** `/api/providers`

**Full URL**: `http://localhost:3000/api/providers`

Returns a list of all active providers with their available chat and embedding models.

**Response Example:**

```json
{
  "providers": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "OpenAI",
      "chatModels": [
        {
          "name": "GPT 4 Omni Mini",
          "key": "gpt-4o-mini"
        },
        {
          "name": "GPT 4 Omni",
          "key": "gpt-4o"
        }
      ],
      "embeddingModels": [
        {
          "name": "Text Embedding 3 Large",
          "key": "text-embedding-3-large"
        }
      ]
    }
  ]
}
```

Use the `id` field as the `providerId` and the `key` field from the models arrays when making search requests.

### Search Query

#### **POST** `/api/search`

**Full URL**: `http://localhost:3000/api/search`

**Note**: Replace `localhost:3000` with your Vane-Community instance URL if running on a different host or port

### Request

The API accepts a JSON object in the request body, where you define the enabled search `sources`, chat models, embedding models, and your query.

#### Request Body Structure

##### 1. Standard (Nested format - Recommended)

```json
{
  "chatModel": {
    "providerId": "550e8400-e29b-41d4-a716-446655440000",
    "key": "gpt-4o-mini"
  },
  "embeddingModel": {
    "providerId": "550e8400-e29b-41d4-a716-446655440000",
    "key": "text-embedding-3-large"
  },
  "optimizationMode": "speed",
  "sources": ["web"],
  "query": "What is Vane",
  "history": [
    ["human", "Hi, how are you?"],
    ["assistant", "I am doing well, how can I help you today?"]
  ],
  "systemInstructions": "Focus on providing technical details about Vane's architecture.",
  "stream": false
}
```

##### 2. Flat format (Supported for direct integrations)

```json
{
  "chatModelProviderId": "550e8400-e29b-41d4-a716-446655440000",
  "chatModelKey": "gpt-4o-mini",
  "embeddingModelProviderId": "550e8400-e29b-41d4-a716-446655440000",
  "embeddingModelKey": "text-embedding-3-large",
  "sources": ["web"],
  "query": "What is Vane"
}
```

*Note: If `chatModel` or `embeddingModel` is omitted or model keys are provided without providerId, Vane automatically resolves active configured providers.*

### Request Parameters

- **`query`** (string, required): The search query or question.

- **`chatModel`** (object, optional): Defines the chat model to be used for the query. To get available providers and models, send a GET request to `http://localhost:3000/api/providers`.
  - `providerId` (string): The UUID of the provider.
  - `key` (string): The model key/identifier (e.g., `gpt-4o-mini`, `llama3.1:latest`).

- **`embeddingModel`** (object, optional): Defines the embedding model for similarity-based searching.
  - `providerId` (string): The UUID of the embedding provider.
  - `key` (string): The embedding model key (e.g., `text-embedding-3-large`, `nomic-embed-text`).

- **`chatModelKey`** / **`chatModelProviderId`** (string, optional): Flat alternatives for chat model configuration.

- **`embeddingModelKey`** / **`embeddingModelProviderId`** (string, optional): Flat alternatives for embedding model configuration.

- **`sources`** (array, optional): Which search sources to enable. Defaults to `["web"]`. Available values:
  - `web`, `academic`, `discussions`.

- **`optimizationMode`** (string, optional): Specifies the optimization mode to control the balance between performance and quality. Available modes:
  - `speed` (default): Prioritize speed and return the fastest answer.
  - `balanced`: Provide a balanced answer with good speed and reasonable quality.
  - `quality`: Prioritize answer quality (may be slower).

- **`query`** (string, required): The search query or question.

- **`systemInstructions`** (string, optional): Custom instructions provided by the user to guide the AI's response. These instructions are treated as user preferences and have lower priority than the system's core instructions. For example, you can specify a particular writing style, format, or focus area.

- **`history`** (array, optional): An array of message pairs representing the conversation history. Each pair consists of a role (either 'human' or 'assistant') and the message content. This allows the system to use the context of the conversation to refine results. Example:

  ```json
  [
    ["human", "What is Vane?"],
    ["assistant", "Vane is an AI-powered search engine..."]
  ]
  ```

- **`stream`** (boolean, optional): When set to `true`, enables streaming responses. Default is `false`.

### Response

The response from the API includes both the final message and the sources used to generate that message.

#### Standard Response (stream: false)

```json
{
  "message": "Vane is an innovative, open-source AI-powered search engine designed to enhance the way users search for information online. Here are some key features and characteristics of Vane:\n\n- **AI-Powered Technology**: It utilizes advanced machine learning algorithms to not only retrieve information but also to understand the context and intent behind user queries, providing more relevant results [1][5].\n\n- **Open-Source**: Being open-source, Vane offers flexibility and transparency, allowing users to explore its functionalities without the constraints of proprietary software [3][10].",
  "sources": [
    {
      "content": "Vane is an innovative, open-source AI-powered search engine designed to enhance the way users search for information online.",
      "metadata": {
        "title": "What is Vane, and how does it function as an AI-powered search ...",
        "url": "https://askai.glarity.app/search/What-is-Vane--and-how-does-it-function-as-an-AI-powered-search-engine"
      }
    },
    {
      "content": "Vane is an open-source AI-powered search tool that dives deep into the internet to find precise answers.",
      "metadata": {
        "title": "Sahar Mor's Post",
        "url": "https://www.linkedin.com/posts/sahar-mor_a-new-open-source-project-called-vane-activity-7204489745668694016-ncja"
      }
    }
        ....
  ]
}
```

#### Streaming Response (stream: true)

When streaming is enabled, the API returns a stream of newline-delimited JSON objects using Server-Sent Events (SSE). Each line contains a complete, valid JSON object. The response has `Content-Type: text/event-stream`.

Example of streamed response objects:

```
{"type":"init","data":"Stream connected"}
{"type":"sources","data":[{"content":"...","metadata":{"title":"...","url":"..."}},...]}
{"type":"response","data":"Vane is an "}
{"type":"response","data":"innovative, open-source "}
{"type":"response","data":"AI-powered search engine..."}
{"type":"done"}
```

Clients should process each line as a separate JSON object. The different message types include:

- **`init`**: Initial connection message
- **`sources`**: All sources used for the response
- **`response`**: Chunks of the generated answer text
- **`done`**: Indicates the stream is complete

### Fields in the Response

- **`message`** (string): The search result, generated based on the query and enabled `sources`.
- **`sources`** (array): A list of sources that were used to generate the search result. Each source includes:
  - `content`: A snippet of the relevant content from the source.
  - `metadata`: Metadata about the source, including:
    - `title`: The title of the webpage.
    - `url`: The URL of the webpage.

### Error Handling

- **400**: If the request is malformed or missing required fields (e.g., no `query`).
- **401**: If `API_KEY` is configured on the server and no valid Bearer token or `x-api-key` header was supplied.
- **500**: If an internal server error occurs during the search.

---

## Integrations (n8n, Docker, Webhooks & Automation)

### Connecting from Dockerized Services (e.g. n8n, Flowise)

When running automation tools like **n8n** in Docker, calling `http://localhost:3000/api/search` from inside the n8n container fails with:
`ECONNREFUSED 127.0.0.1:3000 (Connection refused)`
This is because `localhost` inside a Docker container refers to the container itself, not the host machine or other containers.

#### Recommended URLs:
- **Docker Desktop (macOS / Windows)**:
  `http://host.docker.internal:3000/api/search`
- **Shared Docker Network (Docker Compose)**:
  If Vane and n8n are in the same `docker-compose.yaml` or on the same network:
  `http://vane-community:3000/api/search`
- **Linux Host**:
  `http://172.17.0.1:3000/api/search` or your machine's LAN IP: `http://192.168.x.x:3000/api/search`

### Simplified Payload for n8n HTTP Request Node

Vane automatically resolves models if you provide only the query, simple model names, or provider names:

```json
{
  "query": "Explain quantum computing simply",
  "chatModel": "gpt-4o-mini"
}
```

Or using provider names without knowing internal UUIDs:
```json
{
  "query": "Explain quantum computing simply",
  "chatModel": {
    "provider": "ollama",
    "name": "mistral:latest"
  }
}
```

Or omit `chatModel` entirely to use the default active provider configured in Settings:
```json
{
  "query": "Latest AI news",
  "sources": ["web"]
}
```

### CORS & OPTIONS Preflight
Cross-Origin Resource Sharing (CORS) is enabled with automatic preflight `OPTIONS` handling on all `/api/*` endpoints. You can trigger requests from browser web apps, n8n webhook nodes, or third-party frontends.

