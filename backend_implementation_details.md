# IVEP Backend Implementation Details (Exhaustive Guide)

This document provides a deep dive into the backend architecture of the Intelligent Virtual Exhibition Platform (IVEP). It lists every implemented file, its primary goal, and the role of its internal functions and classes.

---

## 🏗 Core Layer (`app/core/`)

### `config.py`
- **Goal**: Centralized management of application settings and environment variables.
- **Key Components**:
    - `Settings` (class): Defines all configuration keys (MongoDB URI, JWT Secret, AI service URLs) with default values and validation.
    - `Config` (inner class): Configures Pydantic to read from `.env` files.

### `security.py`
- **Goal**: Handle authentication security, password hashing, and token generation.
- **Key Functions**:
    - `create_access_token`: Generates a JWT given a user "subject" (ID) and an optional expiry time.
    - `verify_password`: Compares a plain-text password with a hashed version using bcrypt.
    - `get_password_hash`: Hashes a plain-text password for secure storage.

### `dependencies.py`
- **Goal**: Provide FastAPI dependency injection tools, primarily for user authentication.
- **Key Functions**:
    - `get_current_user`: Extracts the JWT from the request header, validates it, and retrieves the corresponding user from MongoDB. Includes a "test-token" bypass for development.

### `logging.py`
- **Goal**: Configure centralized logging for the platform.
- **Key Components**: Standardized logging initialization to ensure consistent output format across all modules.

---

## 🗄 Database Layer (`app/db/`)

### `mongo.py`
- **Goal**: Manage the asynchronous MongoDB connection lifecycle.
- **Key Functions**:
    - `connect_to_mongo`: Creates the `AsyncIOMotorClient` and connects to the database specified in settings.
    - `close_mongo_connection`: Gracefully shuts down the MongoDB client.
    - `get_database`: Helper function to return the active database instance.

### `indexes.py`
- **Goal**: Define and initialize database indexes for optimal query performance. (Currently a placeholder for production scale-up).

---

## 🧩 AI & Interaction Modules (`app/modules/`)

### `ai_rag/` (Retrieval-Augmented Generation)
- **Goal**: Power the AI Assistant with real-time knowledge retrieval and streaming responses.
- **Key Components**:
    - `service.py` (`RAGService`): Main orchestrator for semantic search and LLM generation via Ollama (Llama 3).
    - `vector_store.py`: Interface for ChromaDB to store and query high-dimensional text embeddings.
    - `chunker.py`: Logic for splitting large documents into semantic segments for ingestion.
    - `router.py`: API endpoints for streaming queries ([SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)) and document ingestion.

### `ai_translation/`
- **Goal**: High-fidelity automated translation and language detection.
- **Key Components**:
    - `service.py`: High-level service combining detection and translation logic.
    - `translation_model.py` (`MarianTranslator`): Manages Helsinki-NLP/opus-mt models for various language pairs.
    - `language_detector.py`: Uses `langdetect` to identify source languages with confidence scores.
    - `router.py`: Endpoints for individual text translation and detection.

### `analytics/`
- **Goal**: Process and serve real-time metrics for stands and events.
- **Key Components**:
    - `repository.py`: Handles data aggregation (KPIs, time-series charts) from MongoDB.
    - `router.py`: Endpoints for stand and event-level analytics data.

### `chat/`
- **Goal**: Real-time messaging and room management via WebSockets.
- **Key Components**:
    - `repository.py`: CRUD operations for chat rooms and messages in MongoDB.
    - `service.py` (`ConnectionManager`): Manages active WebSocket connections and broadcasting.
    - `router.py`: WebSocket endpoint and REST endpoints for chat history.

### `leads/`
- **Goal**: Capture visitor interactions and manage exhibitor networking (CRM).
- **Key Components**:
    - `repository.py`: Records lead interactions and calculates engagement scores.
    - `router.py`: Endpoints for tracking activity and retrieving lead lists.

### `meetings/`
- **Goal**: Schedule and manage virtual appointments between visitors and exhibitors.
- **Key Components**:
    - `repository.py`: Manages meeting lifecycle (request, approve, cancel) in the database.
    - `router.py`: Endpoints for submitting and updating appointment requests.

### `resources/`
- **Goal**: Secure file storage and media catalog management.
- **Key Components**:
    - `repository.py`: Metadata management for uploaded files and download tracking.
    - `router.py`: File upload/download endpoints and catalog retrieval.

### `recommendations/`
- **Goal**: Personalized content discovery using a hybrid filtering engine.
- **Key Components**:
    - `recommendation_engine.py` (`HybridRecommender`): Core logic combining content-based and collaborative filtering.
    - `embedding_service.py`: Generates user/item embeddings for similarity calculations.
    - `router.py`: Personalized suggestion endpoints for users.

### `transcripts/`
- **Goal**: Real-time and batch speech-to-text transcription for webinars.
- **Key Components**:
    - `whisper_service.py` (`WhisperService`): Interface for OpenAI Whisper models (tiny to large).
    - `router.py`: WebSocket for live audio streaming and REST endpoints for batch processing.

---

## 🚀 Main Entry (`app/main.py`)
- **Goal**: Assemble and launch the FastAPI application.
- **Key Functions**:
    - `startup_event`: Triggers MongoDB connection on server start.
    - `shutdown_event`: Ensures clean database disconnection.
    - `read_root`: Health-check endpoint.
    - **Router Inclusion**: Aggregates all modular sub-routers into the `/api/v1` namespace.

---

## 🛠 Background Tasks (`app/workers/tasks/`)
- **Goal**: Offload heavy AI processing and analytics to background threads.
- **Key Tasks**:
    - `embeddings.py`: Batch processing of content embeddings for RAG and search.
    - `recommendations.py`: Scheduled updates for the recommendation interaction matrix.
    - `transcripts.py`: Async processing of long audio files for full webinar transcription.
