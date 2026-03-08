"""
Core API routes.
"""

from typing import List, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.gemini_agent import ask

router = APIRouter(tags=["api"])


class AskRequest(BaseModel):
    question: str
    chat_history: Optional[List[Dict]] = None


class AskResponse(BaseModel):
    answer: str
    structured_data: List = []
    tools_used: List = []


@router.post("/ask", response_model=AskResponse)
async def ask_agent(req: AskRequest):
    """
    Send a natural-language question to the Gemini agent.
    The agent decides which Google Maps APIs to call, fetches the data,
    and returns a human-friendly answer plus structured data.
    """
    try:
        result = await ask(
            question=req.question,
            chat_history=req.chat_history,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/hello")
async def hello():
    return {"message": "Hello from the NYC Google CBS API!"}
