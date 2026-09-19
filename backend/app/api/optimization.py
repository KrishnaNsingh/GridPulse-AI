"""Optimization API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.optimization import OptimizationRequest, OptimizationResult
from app.services.optimization_service import run_optimization, get_optimization_result

router = APIRouter(prefix="/api/optimization", tags=["optimization"])


@router.post("/run", response_model=OptimizationResult)
def run_optimization_endpoint(
    request: OptimizationRequest,
    db: Session = Depends(get_db),
):
    """
    Run MILP battery dispatch optimization.

    Uses PuLP + HiGHS to solve the optimization problem.
    All dispatch decisions come from the solver, not from heuristics or ML.
    """
    try:
        result = run_optimization(db, request)
        if result.status == "error":
            raise HTTPException(500, result.error_message or "Optimization error")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Optimization failed: {str(e)}")


@router.get("/{run_id}", response_model=OptimizationResult)
def get_optimization(run_id: int, db: Session = Depends(get_db)):
    """Retrieve a stored optimization result by ID."""
    result = get_optimization_result(db, run_id)
    if not result:
        raise HTTPException(404, f"Optimization run {run_id} not found")
    return result
