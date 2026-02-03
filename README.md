# Dental IOTN AI Platform

An AI-powered dental diagnostic platform with IOTN DHC grading capabilities.

## Features

- 🦷 **Public Diagnostic Tool** - Upload dental images and input clinical measurements for IOTN grade calculation
- 🔬 **5 AI Classification Models** - Crossbite, Overbite, Openbite, Displacement, Overjet detection
- 🎯 **Teeth Segmentation** - Pixel-wise segmentation for occlusal view images
- 👨‍⚕️ **Expert Validation** - Blind review interface for thesis validation
- 📊 **Analytics Dashboard** - Performance metrics, Cohen's Kappa, CSV export for SPSS
- 📏 **IOTN DHC Grading** - Complete Grade 1-5 calculation based on clinical measurements

## Tech Stack

- **Frontend:** Next.js 14, React 18, TypeScript
- **Backend:** FastAPI, Python 3.11
- **Database:** PostgreSQL 15
- **AI:** YOLOv11 (Ultralytics), PyTorch with CUDA
- **Auth:** JWT

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 15+
- NVIDIA GPU with CUDA (optional, for faster inference)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd dental-iotn-ai
   ```

2. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate  # Windows
   
   pip install -r requirements.txt
   
   # Copy environment file
   copy .env.example .env
   # Edit .env with your database credentials
   
   # Run migrations
   alembic upgrade head
   
   # Start server
   uvicorn app.main:app --reload
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   
   copy .env.example .env.local
   
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d --build

# With Cloudflare Tunnel (for public access)
# 1. Install cloudflared
# 2. Run: cloudflared tunnel run dental-iotn
```

## Project Structure

```
dental-iotn-ai/
├── backend/
│   ├── app/
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── routers/       # API endpoints
│   │   ├── services/      # Business logic
│   │   ├── main.py        # FastAPI app
│   │   ├── config.py      # Settings
│   │   └── database.py    # DB connection
│   ├── alembic/           # Migrations
│   ├── models/            # YOLOv11 .pt files
│   └── uploads/           # Uploaded images
├── frontend/
│   ├── src/
│   │   ├── app/           # Next.js pages
│   │   ├── lib/           # API client, auth
│   │   └── types/         # TypeScript types
│   └── public/
└── docker-compose.yml
```

## Model Files

Place your 6 YOLOv11 model files in `backend/models/`:
- `crossbite.pt`
- `overbite.pt`
- `openbite.pt`
- `displacement.pt`
- `overjet.pt`
- `segmentation.pt`

## IOTN DHC Grading

The system implements the complete IOTN DHC grading system:

| Grade | Need | Description |
|-------|------|-------------|
| 1 | None | Minor variations, displacement ≤1mm |
| 2 | Little | Overjet 3.5-6mm (competent lips), mild issues |
| 3 | Borderline | Overjet 3.5-6mm (incompetent lips), moderate issues |
| 4 | Treatment Needed | Overjet 6-9mm, severe displacement, crossbite |
| 5 | Very Great Need | Cleft lip/palate, overjet >9mm, impeded eruption |

## License

MIT License
