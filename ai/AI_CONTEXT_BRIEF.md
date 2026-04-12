# AI CONTEXT BRIEF — IVEP

## Project Type

Multi-role virtual exhibition platform with AI, payments, and real-time features.

## Stack Summary

* Backend: FastAPI + MongoDB + Redis
* Frontend: Next.js + TypeScript
* Payments: Stripe
* Video: Daily.co
* Storage: Cloudflare R2
* AI: RAG (ChromaDB), Whisper, Transformers

## Key Concepts

* Event lifecycle automation (background worker)
* Multi-role system (admin, organizer, enterprise, visitor)
* Modular backend architecture
* Marketplace + stands + analytics

## Critical Systems

* Auth (JWT)
* Payments (Stripe webhook)
* Lifecycle worker
* Real-time (WebSocket + Daily)

## Priority Rule

👉 Stability > Features
