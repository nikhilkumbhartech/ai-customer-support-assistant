import time
import logging

import httpx
from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger("uvicorn.error")

SYSTEM_PROMPT = """You are a customer support assistant for a company.
Answer ONLY using the information in the provided Context.
If the Context does not contain the answer, reply with exactly: NOT_FOUND
Never guess or invent facts.
Reply in the same language the customer used (English, Hindi or Hinglish).
Keep answers clear, short and polite."""

_client = None

# ---------------- Tuning ----------------

# 503 par same model ko dobara try karne ka fayda kam hai, seedha fallback
MAX_RETRIES = 0

# Itni der (ms) tak model se kuch na aaye to us model ko chhodo aur next par jao.
# Agar lambe jawab beech mein cut ho jaye to isse badha do (jaise 20_000).
REQUEST_TIMEOUT_MS = 12_000

# Gemini 3.x ka default thinking "medium" hai, jo first token slow karta hai.
# Support bot ke liye "low" kaafi hai. Aur tez chahiye to "minimal" try karo.
THINKING_LEVEL = "low"

# Fail hua model itni der skip hoga
SERVER_COOLDOWN = 60        # 5xx / timeout
QUOTA_COOLDOWN = 5 * 60     # 429

# Quota / rate limit: same model pe retry bekaar, seedha next model pe jao
SWITCH_MODEL_STATUS_CODES = {429}

# Temporary server errors
RETRYABLE_STATUS_CODES = {500, 502, 503, 504}

_down_until: dict[str, float] = {}


def get_client() -> genai.Client:
    global _client

    if _client is None:
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is missing in ai-service/.env")

        _client = genai.Client(api_key=settings.gemini_api_key)

    return _client


def build_contents(
    question: str,
    chunks: list[dict],
    history: list[dict],
) -> list[types.Content]:
    context = "\n\n".join(
        f"[{i}] ({c['doc']}, page {c['page']})\n{c['content']}"
        for i, c in enumerate(chunks, start=1)
    )

    contents = []

    for m in history[-6:]:
        role = "user" if m["role"] == "user" else "model"
        contents.append(
            types.Content(
                role=role,
                parts=[types.Part(text=m["content"])],
            )
        )

    contents.append(
        types.Content(
            role="user",
            parts=[types.Part(text=f"Context:\n{context}\n\nQuestion: {question}")],
        )
    )

    return contents


def build_config(model: str) -> types.GenerateContentConfig:
    extra = {}

    # thinking_level sirf Gemini 3.x models ke liye (2.5 mein thinking_budget hota hai)
    if model.startswith("gemini-3"):
        extra["thinking_config"] = types.ThinkingConfig(thinking_level=THINKING_LEVEL)

    return types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        temperature=0.2,
        http_options=types.HttpOptions(timeout=REQUEST_TIMEOUT_MS),
        # AFC warning band karne ke liye (tools use nahi ho rahe)
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        **extra,
    )


def get_status_code(error: Exception) -> int | None:
    """SDK exception se HTTP status code nikalta hai."""
    code = getattr(error, "code", None)

    if code is None:
        code = getattr(error, "status_code", None)

    try:
        return int(code) if code is not None else None
    except (TypeError, ValueError):
        return None


def is_timeout(error: Exception) -> bool:
    return isinstance(error, httpx.TimeoutException) or "timeout" in type(error).__name__.lower()


def mark_down(model: str, seconds: int) -> None:
    _down_until[model] = time.time() + seconds
    logger.warning("[LLM] model=%s skipped for next %ds", model, seconds)


def stream_answer(question: str, chunks: list[dict], history: list[dict]):
    client = get_client()
    contents = build_contents(question, chunks, history)
    models = [settings.gemini_model, *settings.gemini_fallback_models]
    last_error = None
    t_start = time.time()

    # Jo models abhi cooldown mein hain unhe skip karo.
    # Agar saare cooldown mein hain to sabko dobara try karo.
    now = time.time()
    available = [m for m in models if _down_until.get(m, 0) <= now]
    if not available:
        logger.warning("[LLM] all models in cooldown, trying all again")
        available = models

    for model in available:
        for attempt in range(MAX_RETRIES + 1):
            emitted_text = False
            t_try = time.time()
            logger.info("[LLM] try model=%s attempt=%d", model, attempt + 1)
            try:
                stream = client.models.generate_content_stream(
                    model=model,
                    contents=contents,
                    config=build_config(model),
                )
                for part in stream:
                    if part.text:
                        if not emitted_text:
                            logger.info(
                                "[LLM] first token model=%s after %.1fs (total %.1fs)",
                                model,
                                time.time() - t_try,
                                time.time() - t_start,
                            )
                        emitted_text = True
                        yield part.text
                logger.info("[LLM] DONE model=%s total %.1fs", model, time.time() - t_start)
                return

            except Exception as error:
                status_code = get_status_code(error)
                logger.warning(
                    "[LLM] FAIL model=%s status=%s type=%s took=%.1fs msg=%s",
                    model,
                    status_code,
                    type(error).__name__,
                    time.time() - t_try,
                    str(error)[:200],
                )

                # Beech stream mein fail hua: fallback se jawab duplicate/garbled hoga
                if emitted_text:
                    raise

                last_error = error

                # 429: quota khatam, seedha next model
                if status_code in SWITCH_MODEL_STATUS_CODES:
                    mark_down(model, QUOTA_COOLDOWN)
                    break

                # Timeout: model hang ho raha hai, next model
                if is_timeout(error):
                    mark_down(model, SERVER_COOLDOWN)
                    break

                # 4xx jaise bugs/config errors: fallback se bhi theek nahi honge
                if status_code not in RETRYABLE_STATUS_CODES:
                    raise

                # 5xx (503 high demand etc.)
                if attempt >= MAX_RETRIES:
                    mark_down(model, SERVER_COOLDOWN)
                    break

                time.sleep(1)

    logger.error("[LLM] ALL MODELS FAILED after %.1fs", time.time() - t_start)
    raise last_error or RuntimeError("All Gemini models are unavailable or over quota")