"""Analytics API endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any
from app.database.database import get_db
from app.services.analytics_service import get_analytics_summary

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary", response_model=Dict[str, Any])
def get_summary(db: Session = Depends(get_db)):
    """Get comprehensive analytics summary from all stored runs."""
    return get_analytics_summary(db)
