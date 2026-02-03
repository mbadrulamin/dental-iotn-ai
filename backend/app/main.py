"""
FastAPI Application Entry Point.
"""

from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import init_db
from app.routers import auth, diagnostic, validation, admin, analytics

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    print(f"🚀 Starting {settings.app_name}...")
    
    # Create upload directory if not exists
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "images"), exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "masks"), exist_ok=True)
    
    # Initialize database tables (for development)
    if settings.is_development:
        await init_db()
        print("✅ Database tables initialized")
    
    # Load AI models
    from app.services.model_service import ModelService
    model_service = ModelService()
    await model_service.load_models()
    print(f"✅ AI models loaded (device: {settings.device})")
    
    yield
    
    # Shutdown
    print("👋 Shutting down...")


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="Dental AI Research & Diagnostic Platform with IOTN DHC grading",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploads
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(diagnostic.router, prefix="/api/diagnostic", tags=["Diagnostic"])
app.include_router(validation.router, prefix="/api/validation", tags=["Validation"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])


@app.get("/", tags=["Health"])
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": "1.0.0",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "database": "connected",
        "models_loaded": True,
        "device": settings.device,
    }
