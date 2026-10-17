import json
import logging
import uuid
from typing import Literal

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.db import get_conn
from app.services.llm_service import stream_answer
from app.services.search_service import search_chunks

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

NO_ANSWER = (
    "Finished server process"
)
SENTINEL = "NOT_FOUND"


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    history: list[Message] = []
    user_id: str | None = None
    conversation_id: str | None = None


def sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def valid_uuid(value: str | None) -> str | None:
    try:
        return str(uuid.UUID(value)) if value else None
    except ValueError:
        return None


def save_unanswered(question: str, user_id: str | None, conversation_id: str | None):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO unanswered_questions (question, user_id, conversation_id) VALUES (%s, %s, %s)",
            (question, valid_uuid(user_id), valid_uuid(conversation_id)),
        )


def build_search_query(question: str, history: list[Message]) -> str:
    """Follow-up sawal ke liye pichla user message jod do."""
    prev_user = [m.content for m in history if m.role == "user"][-1:]
    return " ".join([*prev_user, question])


@router.post("/search")
def search_only(req: ChatRequest):
    """Test ke liye: Gemini ke bina sirf search ka result dikhata hai."""
    return {"results": search_chunks(build_search_query(req.question, req.history), settings.top_k)}


@router.post("/stream")
def chat_stream(req: ChatRequest):
    def events():
        try:

             
            query = build_search_query(req.question, req.history)
            chunks = search_chunks(query, settings.top_k)
            relevant = [c for c in chunks if c["score"] >= settings.min_score]

            def not_answered():
                save_unanswered(req.question, req.user_id, req.conversation_id)
                yield sse({"type": "token", "text": NO_ANSWER})
                yield sse({"type": "sources", "sources": []})
                yield sse({"type": "done", "answered": False})

            # Retrieval mein kuch relevant nahi mila
            if not relevant:
                yield from not_answered()
                return

            history = [m.model_dump() for m in req.history]

            # Pehle kuch characters buffer karo: NOT_FOUND hai ya asli jawab?
            buf, decided, not_found = "", False, False

            for text in stream_answer(req.question, relevant, history):
                if decided:
                    yield sse({"type": "token", "text": text})
                    continue

                buf += text
                if buf.strip().startswith(SENTINEL):
                    not_found = True
                    break
                if not SENTINEL.startswith(buf.strip()):
                    decided = True
                    yield sse({"type": "token", "text": buf})

            # Stream chhoti thi aur abhi tak flush nahi hui
            if not decided and not not_found and buf:
                yield sse({"type": "token", "text": buf})

            # Model ne bola jawab nahi hai
            if not_found:
                yield from not_answered()
                return

            seen, sources = set(), []
            for c in relevant:
                key = (c["doc"], c["page"])
                if key not in seen:
                    seen.add(key)
                    sources.append({"doc": c["doc"], "page": c["page"]})

            yield sse({"type": "sources", "sources": sources})
            yield sse({"type": "done", "answered": True})

        except Exception:
            logger.exception("chat_stream failed")
            yield sse({
                "type": "error",
                "message": "Server abhi busy hai, thodi der baad dobara try karein.",
            })

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )