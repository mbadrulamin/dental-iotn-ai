"""
Admin router for dataset management.
"""

import os
import uuid
from typing import Annotated, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import BaseModel

from app.config import get_settings
from app.database import get_db
from app.models.user import User, UserRole
from app.models.dataset import Dataset
from app.models.image import Image, ImageType
from app.routers.auth import require_role

router = APIRouter()
settings = get_settings()


class DatasetCreate(BaseModel):
    """Schema for creating a dataset."""
    name: str
    description: str = None
    is_validation_set: bool = True


class DatasetResponse(BaseModel):
    """Schema for dataset response."""
    id: UUID
    name: str
    description: str = None
    is_validation_set: bool
    image_count: int = 0
    
    model_config = {"from_attributes": True}


@router.post("/datasets", response_model=DatasetResponse)
async def create_dataset(
    dataset_data: DatasetCreate,
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    db: AsyncSession = Depends(get_db),
):
    """Create a new dataset for validation."""
    dataset = Dataset(
        name=dataset_data.name,
        description=dataset_data.description,
        created_by=current_user.id,
        is_validation_set=dataset_data.is_validation_set,
    )
    db.add(dataset)
    await db.flush()
    await db.refresh(dataset)
    
    return DatasetResponse(
        id=dataset.id,
        name=dataset.name,
        description=dataset.description,
        is_validation_set=dataset.is_validation_set,
        image_count=0,
    )


@router.get("/datasets", response_model=List[DatasetResponse])
async def list_datasets(
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    db: AsyncSession = Depends(get_db),
):
    """List all datasets."""
    result = await db.execute(
        select(Dataset).where(Dataset.is_active == True)
    )
    datasets = result.scalars().all()
    
    response = []
    for dataset in datasets:
        # Count images
        img_result = await db.execute(
            select(Image).where(Image.dataset_id == dataset.id)
        )
        image_count = len(img_result.scalars().all())
        
        response.append(DatasetResponse(
            id=dataset.id,
            name=dataset.name,
            description=dataset.description,
            is_validation_set=dataset.is_validation_set,
            image_count=image_count,
        ))
    
    return response


@router.post("/datasets/{dataset_id}/images")
async def upload_images(
    dataset_id: UUID,
    files: List[UploadFile] = File(...),
    image_type: str = Form(None),
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))] = None,
    db: AsyncSession = Depends(get_db),
):
    """Upload images to a dataset for validation."""
    # Verify dataset exists
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id)
    )
    dataset = result.scalar_one_or_none()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found",
        )
    
    # Parse image type
    parsed_image_type = None
    if image_type:
        try:
            parsed_image_type = ImageType(image_type.lower())
        except ValueError:
            pass
    
    uploaded = []
    errors = []
    
    for file in files:
        # Validate file type
        allowed_types = ["image/jpeg", "image/png", "image/webp"]
        if file.content_type not in allowed_types:
            errors.append(f"{file.filename}: Invalid file type")
            continue
        
        try:
            # Generate unique filename
            file_ext = file.filename.split(".")[-1] if file.filename else "jpg"
            unique_filename = f"{uuid.uuid4()}.{file_ext}"
            file_path = os.path.join(settings.upload_dir, "images", unique_filename)
            
            # Save file
            contents = await file.read()
            with open(file_path, "wb") as f:
                f.write(contents)
            
            # Create image record
            image = Image(
                dataset_id=dataset_id,
                uploaded_by=current_user.id,
                filename=unique_filename,
                original_filename=file.filename or "unknown",
                file_path=file_path,
                file_size=len(contents),
                mime_type=file.content_type,
                image_type=parsed_image_type,
                is_validation_image=dataset.is_validation_set,
            )
            db.add(image)
            uploaded.append(file.filename)
            
        except Exception as e:
            errors.append(f"{file.filename}: {str(e)}")
    
    await db.flush()
    
    return {
        "uploaded": len(uploaded),
        "errors": errors,
        "uploaded_files": uploaded,
    }


@router.get("/datasets/{dataset_id}/images")
async def list_dataset_images(
    dataset_id: UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List images in a dataset."""
    result = await db.execute(
        select(Image)
        .where(Image.dataset_id == dataset_id)
        .order_by(Image.uploaded_at)
        .limit(limit)
        .offset(offset)
    )
    images = result.scalars().all()
    
    return {
        "images": [
            {
                "id": str(img.id),
                "filename": img.original_filename,
                "image_url": f"/uploads/images/{img.filename}",
                "image_type": img.image_type.value if img.image_type else None,
                "is_processed": img.is_processed,
                "uploaded_at": img.uploaded_at.isoformat(),
            }
            for img in images
        ],
        "total": len(images),
        "limit": limit,
        "offset": offset,
    }


@router.delete("/datasets/{dataset_id}")
async def delete_dataset(
    dataset_id: UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    db: AsyncSession = Depends(get_db),
):
    """Soft delete a dataset."""
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id)
    )
    dataset = result.scalar_one_or_none()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found",
        )
    
    dataset.is_active = False
    
    return {"message": "Dataset deleted"}


@router.get("/users")
async def list_users(
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    db: AsyncSession = Depends(get_db),
):
    """List all users (admin only)."""
    from app.models.user import User as UserModel
    
    result = await db.execute(select(UserModel))
    users = result.scalars().all()
    
    return [
        {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat(),
        }
        for user in users
    ]


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: UUID,
    role: str,
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    db: AsyncSession = Depends(get_db),
):
    """Update a user's role (admin only)."""
    from app.models.user import User as UserModel
    
    result = await db.execute(
        select(UserModel).where(UserModel.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    try:
        user.role = UserRole(role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(r.value for r in UserRole)}",
        )
    
    return {"message": f"User role updated to {role}"}
