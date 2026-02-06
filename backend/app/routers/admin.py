"""
Admin router for dataset management.
"""

import os
import uuid
from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy import select, and_
from sqlalchemy import delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from pydantic import BaseModel

from app.config import get_settings
from app.database import get_db
from app.models.user import User, UserRole
from app.models.sus_questionnaire import SUSQuestionnaire
from app.models.dataset import Dataset, dataset_experts
from app.models.image import Image, ImageType
from app.routers.auth import require_role
from app.models.assessment import ExpertAssessment
from app.models.inference import AIInference

router = APIRouter()
settings = get_settings()


class DatasetCreate(BaseModel):
    """Schema for creating a dataset."""
    name: str
    description: Optional[str] = None
    is_validation_set: bool = True


class DatasetResponse(BaseModel):
    """Schema for dataset response."""
    id: UUID
    name: str
    description: Optional[str] = None
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


@router.post("/datasets/{dataset_id}/process")
async def run_inference_on_dataset(
    dataset_id: UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    db: AsyncSession = Depends(get_db),
):
    """
    Run AI models on all unprocessed images in a dataset.
    This is necessary before viewing Analytics.
    """
    from app.services.model_service import ModelService
    from app.models.inference import AIInference, ModelType, PredictionClass
    
    model_service = ModelService()
    
    # Find all unprocessed images in this dataset
    result = await db.execute(
        select(Image).where(
            and_(
                Image.dataset_id == dataset_id,
                Image.is_processed == False
            )
        )
    )
    images = result.scalars().all()
    
    if not images:
        return {"message": "No new images to process.", "processed_count": 0}
    
    processed_count = 0
    
    for image in images:
        try:
            # 1. Run all classifications
            file_path = image.file_path
            if os.path.exists(file_path):
                results = await model_service.run_all_classifications(file_path)
                
                # 2. Save results to DB
                for model_name, result in results.items():
                    if result.get("predicted_class"):
                        inference = AIInference(
                            image_id=image.id,
                            model_name=ModelType(model_name),
                            predicted_class=result.get("predicted_class"),
                            confidence_score=result.get("confidence", 0.0),
                            inference_time_ms=result.get("inference_time_ms", 0),
                        )
                        db.add(inference)
                
                # 3. Mark as processed
                image.is_processed = True
                processed_count += 1
            else:
                print(f"File not found: {file_path}")
                
        except Exception as e:
            print(f"Error processing image {image.id}: {e}")
            # Continue processing other images even if one fails
            continue
            
    await db.commit()
    
    return {
        "message": f"Successfully processed {processed_count} images with AI models.",
        "processed_count": processed_count
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


class AdminUserCreate(BaseModel):
    """Schema for admin creating a user."""
    email: str
    password: str
    full_name: Optional[str] = None
    role: str = "guest"


@router.post("/users")
async def create_user_admin(
    user_data: AdminUserCreate,
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    db: AsyncSession = Depends(get_db),
):
    """Create a new user (admin only)."""
    from app.models.user import User as UserModel
    from app.services.auth_service import AuthService
    
    # Check if email exists
    result = await db.execute(
        select(UserModel).where(UserModel.email == user_data.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    # Validate role
    try:
        role = UserRole(user_data.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(r.value for r in UserRole)}",
        )
    
    # Create user
    hashed_password = AuthService.hash_password(user_data.password)
    new_user = UserModel(
        email=user_data.email,
        password_hash=hashed_password,
        full_name=user_data.full_name,
        role=role,
    )
    db.add(new_user)
    await db.flush()
    
    return {"message": "User created", "id": str(new_user.id)}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    db: AsyncSession = Depends(get_db),
):
    """Delete a user (admin only)."""
    from app.models.user import User as UserModel
    
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself",
        )
    
    result = await db.execute(
        select(UserModel).where(UserModel.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    await db.delete(user)
    return {"message": "User deleted"}


class DatasetUpdate(BaseModel):
    """Schema for updating a dataset."""
    name: Optional[str] = None
    description: Optional[str] = None


@router.put("/datasets/{dataset_id}")
async def update_dataset(
    dataset_id: UUID,
    update_data: DatasetUpdate,
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    db: AsyncSession = Depends(get_db),
):
    """Update a dataset."""
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id)
    )
    dataset = result.scalar_one_or_none()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found",
        )
    
    if update_data.name is not None:
        dataset.name = update_data.name
    if update_data.description is not None:
        dataset.description = update_data.description
    
    return {"message": "Dataset updated"}


@router.get("/datasets/{dataset_id}/experts")
async def get_dataset_experts(
    dataset_id: UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    db: AsyncSession = Depends(get_db),
):
    """Get the list of expert IDs assigned to a dataset."""
    # Use selectinload to avoid "MissingGreenlet" async lazy loading errors
    result = await db.execute(
        select(Dataset).options(selectinload(Dataset.assigned_experts)).where(Dataset.id == dataset_id)
    )
    dataset = result.scalar_one_or_none()
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    # Return list of expert IDs
    return [expert.id for expert in dataset.assigned_experts]


@router.delete("/images/{image_id}")
async def delete_image(
    image_id: UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    db: AsyncSession = Depends(get_db),
):
    """Delete an image and all its related data (assessments, inferences)."""
    
    # 1. Delete Expert Assessments related to this image
    await db.execute(
        sql_delete(ExpertAssessment).where(ExpertAssessment.image_id == image_id)
    )
    
    # 2. Delete AI Inferences related to this image
    await db.execute(
        sql_delete(AIInference).where(AIInference.image_id == image_id)
    )
    
    # 3. Finally, delete the Image
    result = await db.execute(select(Image).where(Image.id == image_id))
    image = result.scalar_one_or_none()
    
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Delete file from disk
    if image.file_path and os.path.exists(image.file_path):
        try:
            os.remove(image.file_path)
        except OSError:
            pass
            
    await db.delete(image)
    await db.commit()
    
    return {"message": "Image and all related data deleted"}


class DatasetUpdateExperts(BaseModel):
    """Schema for updating dataset experts."""
    expert_ids: List[UUID]

@router.put("/datasets/{dataset_id}/experts")
async def update_dataset_experts(
    dataset_id: UUID,
    experts_data: DatasetUpdateExperts,
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    db: AsyncSession = Depends(get_db),
):
    """Assign specific experts to a dataset."""
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id)
    )
    dataset = result.scalar_one_or_none()
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Verify all IDs are valid experts
    expert_result = await db.execute(
        select(User).where(User.id.in_(experts_data.expert_ids))
    )
    valid_experts = expert_result.scalars().all()
    
    if len(valid_experts) != len(experts_data.expert_ids):
        raise HTTPException(status_code=400, detail="One or more expert IDs are invalid")
    
    # Clear existing assignments
    await db.execute(
        dataset_experts.delete().where(dataset_experts.c.dataset_id == dataset_id)
    )
    
    # Add new assignments
    for expert in valid_experts:
        if expert.role != UserRole.EXPERT:
            # Optional: Allow admins too? Usually strictly experts for validation.
            continue 
        await db.execute(
            dataset_experts.insert().values(
                dataset_id=dataset_id,
                expert_id=expert.id
            )
        )
    
    await db.commit()
    return {"message": "Experts assigned successfully"}

# SUS Management Endpoints

@router.get("/settings/sus")
async def get_sus_questions(
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    db: AsyncSession = Depends(get_db),
):
    """
    Get current SUS questionnaire questions.
    Creates a default set if none exists in the database.
    """
    result = await db.execute(select(SUSQuestionnaire).limit(1))
    config = result.scalar_one_or_none()
    
    if config:
        return config.questions
    
    # If config is None (DB is empty), create a default one automatically
    default_config = SUSQuestionnaire(
        questions={
            "q1": "I think that I would like to use this system frequently.",
            "q2": "I found the system unnecessarily complex.",
            "q3": "I thought the system was easy to use.",
            "q4": "I think that I would need the support of a technical person.",
            "q5": "I found the various functions in this system were well integrated.",
            "q6": "I thought there was too much inconsistency in this system.",
            "q7": "I would imagine that most people would learn to use this system very quickly.",
            "q8": "I found the system very cumbersome to use.",
            "q9": "I felt very confident using the system.",
            "q10": "I needed to learn a lot of things before I could get going with this system.",
        }
    )
    
    db.add(default_config)
    await db.commit()
    await db.refresh(default_config)
    
    return default_config.questions

@router.put("/settings/sus")
async def update_sus_questions(
    questions: dict,
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    db: AsyncSession = Depends(get_db),
):
    """Update SUS questionnaire questions."""
    # Validate keys q1-q10 exist
    required_keys = [f"q{i}" for i in range(1, 11)]
    if not all(k in questions for k in required_keys):
        raise HTTPException(status_code=400, detail="Missing required questions (q1-q10)")
    
    # Get or create config
    result = await db.execute(select(SUSQuestionnaire).limit(1))
    config = result.scalar_one_or_none()
    
    if config:
        config.questions = questions
    else:
        config = SUSQuestionnaire(questions=questions)
        db.add(config)
    
    await db.commit()
    return {"message": "SUS questions updated"}


