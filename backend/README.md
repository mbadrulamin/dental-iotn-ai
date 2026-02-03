# Dental IOTN AI Platform - Backend

FastAPI backend for the Dental AI Research & Diagnostic Platform.

## Quick Start (Local Development)

```bash
# 1. Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows

# 2. Install dependencies (with CUDA support)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install ultralytics
pip install -r requirements.txt

# 3. Set up environment
copy .env.example .env
# Edit .env with your DATABASE_URL

# 4. Run database migrations
alembic upgrade head

# 5. Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
