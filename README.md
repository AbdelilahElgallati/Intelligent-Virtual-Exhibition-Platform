# Intelligent Virtual Exhibition Platform (IVEP)

Welcome to the Intelligent Virtual Exhibition Platform (IVEP)! IVEP is a comprehensive, multi-role virtual event ecosystem designed to seamlessly connect organizers, enterprises, and visitors through interactive, AI-enhanced digital exhibitions.

## 🌟 Key Features

- **Multi-Role Portals:** Dedicated experiences for **Admins**, **Organizers**, **Enterprises**, and **Visitors**.
- **Virtual Stands & Marketplaces:** Interactive digital booths for enterprises to showcase products, gather leads, and accept requests.
- **Real-Time Communication:** Integrated live video conferences and 1-on-1 meeting rooms powered by **Daily.co**, alongside real-time chat.
- **AI-Powered Capabilities:**
  - **AI Assistant (RAG):** Context-aware chatbot for navigating events and stands.
  - **Live Translation & Transcription:** Overcome language barriers instantly.
- **Monetization & Ticketing:** Integrated **Stripe** payments for paid event tickets and marketplace checkouts.
- **Governance & Operations:** Built-in audit logs, active monitoring, and incident management.

## 🛠️ Technology Stack

### Frontend
- **Framework:** Next.js (App Router) with React and TypeScript
- **Styling:** Tailwind CSS + Radix UI / custom components
- **Hosting:** Vercel (Edge Network)

### Backend
- **Framework:** FastAPI (Python 3.10+)
- **Database:** MongoDB Atlas (M10 Dedicated Cluster) with async motor driver
- **Vector DB:** ChromaDB (Local Embeddings for RAG)
- **Object Storage:** Cloudflare R2
- **Real-Time Video:** Daily.co REST APIs
- **Payments:** Stripe
- **Hosting:** Hetzner Cloud VPS (Ubuntu), PM2, Nginx, Certbot SSL

## 📂 Project Structure

- `/frontend` - The Next.js application containing the UI, routing, and client services.
- `/backend` - The FastAPI server modularized by domain (auth, events, stands, AI, admin, etc.).
- `/docs` - API specifications, Postman collections, and system documentation.
- `/deploy` - Docker configurations and deployment helpers.

## 🚀 Getting Started Locally

### 1. Backend Setup
1. Navigate to the `backend/` directory: `cd backend`
2. Create and activate a virtual environment: `python -m venv venv && source venv/bin/activate` (or `venv\Scripts\activate` on Windows)
3. Install dependencies: `pip install -r requirements.txt`
4. Copy `.env.example` to `.env` and fill in your connection strings (MongoDB, Stripe, Daily, Cloudflare).
5. Run the server: `uvicorn app.main:app --reload`
   *(The API will be available at http://localhost:8000/docs)*

### 2. Frontend Setup
1. Navigate to the `frontend/` directory: `cd frontend`
2. Install dependencies: `npm install` (or `yarn / pnpm`)
3. Copy `.env.example` to `.env.local` and configure your environment variables (especially `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`).
4. Run the development server: `npm run dev`
   *(The app will be available at http://localhost:3000)*

## 🌐 Production Deployment

- **Frontend:** Continously deployed via Vercel. Attach your GitHub repository, assign the Root Directory to `frontend/`, select the Next.js preset, and supply the environment variables.
- **Backend:** Hosted on a VPS using PM2 to manage the Uvicorn process, with Nginx acting as a reverse proxy over HTTPS.

## 📄 License & Acknowledgements
Developed as a next-generation solution for global virtual exhibitions. All rights reserved.
