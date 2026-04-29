"""
backend/api/main.py
===================
FastAPI application entry point for Phase 1 MVP.

RESPONSIBILITY:
  Serve the processed transaction data as a JSON REST API for the frontend.
  Handles file upload, triggers the parsing/classification pipeline, and
  returns categorized data for dashboard display.

RUN:
  uvicorn backend.api.main:app --reload --port 8000
"""

import logging
import os
import shutil
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from backend.config.settings import settings
from backend.modules.classifier.src import ClassificationAgent
from backend.modules.excel_parser.src import ExcelParserAgent
from backend.modules.planner.src import PlannerAgent

logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Spendo API",
    description="Personal finance analysis — Phase 1 MVP",
    version="0.1.0",
)

# Allow frontend dev server (Vite runs on 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory state for Phase 1 (no database yet)
# ---------------------------------------------------------------------------

_state = {
    "classified_transactions": [],
    "parse_result": None,
}


# ---------------------------------------------------------------------------
# Helper: serialize dataclasses to dicts for JSON response
# ---------------------------------------------------------------------------

def _serialize_classified(ct) -> dict:
    """Convert a ClassifiedTransaction to a JSON-friendly dict."""
    return {
        "transaction_id": ct.transaction.transaction_id,
        "date": ct.transaction.transaction_date.isoformat(),
        "merchant_name": ct.transaction.merchant_name,
        "amount": ct.transaction.amount,
        "currency": ct.transaction.currency,
        "description": ct.transaction.description,
        "category": ct.category.name,
        "group": ct.category.group,
        "icon": ct.category.icon,
        "confidence": ct.confidence,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/v1/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "version": "0.1.0"}


@app.post("/api/v1/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a credit card Excel/CSV file for parsing and classification.

    The file is saved to the uploads directory, then processed through
    the full pipeline: parse → classify → analyze.
    """
    # Validate file extension
    filename = file.filename or "upload"
    ext = Path(filename).suffix.lower()
    if ext not in (".xlsx", ".xls", ".csv"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format: {ext}. Use .xlsx, .xls, or .csv",
        )

    # Save uploaded file
    settings.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    save_path = settings.UPLOADS_DIR / filename
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    logger.info("File saved to %s", save_path)

    # --- Pipeline: Parse → Classify → Store in memory ---
    try:
        # Step 1: Parse
        parser = ExcelParserAgent(file_path=str(save_path))
        parse_result = parser.parse()

        if not parse_result.transactions:
            raise HTTPException(
                status_code=422,
                detail=f"No transactions found. Errors: {parse_result.errors}",
            )

        # Step 2: Classify
        use_ai = settings.USE_AI_CLASSIFICATION
        classifier = ClassificationAgent(use_ai_fallback=use_ai)
        classified = classifier.classify_all(parse_result.transactions)

        # Step 3: Store in memory
        _state["classified_transactions"] = classified
        _state["parse_result"] = parse_result

        return {
            "message": "File processed successfully",
            "filename": filename,
            "total_transactions": len(classified),
            "skipped_rows": parse_result.skipped_rows,
            "errors": parse_result.errors[:5],  # Return first 5 errors max
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Pipeline failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/v1/transactions")
async def get_transactions(category: str | None = None):
    """
    Return all classified transactions, optionally filtered by category.

    Query params:
      category: Filter to a specific category name (e.g., "Groceries")
    """
    classified = _state["classified_transactions"]
    if not classified:
        return {"transactions": [], "total": 0}

    items = [_serialize_classified(ct) for ct in classified]

    if category:
        items = [t for t in items if t["category"] == category]

    return {"transactions": items, "total": len(items)}


@app.get("/api/v1/summary")
async def get_summary():
    """
    Return monthly category summaries and top merchants for dashboard display.
    """
    classified = _state["classified_transactions"]
    if not classified:
        return {"summaries": [], "top_merchants": []}

    planner = PlannerAgent()
    summaries = planner.monthly_summaries(classified)
    top = planner.top_merchants(classified, top_n=10)

    return {
        "summaries": [
            {
                "label": s.label,
                "year": s.year,
                "month": s.month,
                "total_spent": s.total_spent,
                "categories": [
                    {
                        "name": c.category_name,
                        "group": c.group,
                        "total_spent": c.total_spent,
                        "transaction_count": c.transaction_count,
                        "icon": c.icon,
                    }
                    for c in s.categories
                ],
            }
            for s in summaries
        ],
        "top_merchants": [
            {"name": name, "total_spent": round(amount, 2)}
            for name, amount in top
        ],
    }


@app.get("/api/v1/categories")
async def get_categories():
    """Return list of all categories found in the current data."""
    classified = _state["classified_transactions"]
    if not classified:
        return {"categories": []}

    seen = {}
    for ct in classified:
        name = ct.category.name
        if name not in seen:
            seen[name] = {
                "name": name,
                "group": ct.category.group,
                "icon": ct.category.icon,
                "count": 0,
                "total_spent": 0.0,
            }
        seen[name]["count"] += 1
        seen[name]["total_spent"] = round(
            seen[name]["total_spent"] + ct.transaction.amount, 2
        )

    categories = sorted(seen.values(), key=lambda c: c["total_spent"], reverse=True)
    return {"categories": categories}
