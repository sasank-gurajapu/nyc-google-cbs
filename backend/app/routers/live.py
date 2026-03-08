"""
WebSocket endpoint for Gemini Live real-time audio sessions.

Protocol (browser → server):
  {"type": "audio", "data": "<base64 PCM 16kHz 16-bit mono>"}
  {"type": "text", "text": "optional typed message"}
  {"type": "end_turn"}
  {"type": "close"}

Protocol (server → browser):
  {"type": "session_started"}
  {"type": "audio", "data": "<base64 PCM 24kHz 16-bit mono>"}
  {"type": "transcript", "text": "what Gemini said"}
  {"type": "user_transcript", "text": "what user said"}
  {"type": "tool_call", "name": "...", "args": {...}}
  {"type": "structured_data", "tool": "...", "args": {...}, "result": {...}}
  {"type": "turn_complete"}
  {"type": "error", "message": "..."}
  {"type": "session_ended"}
"""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.gemini_live import run_live_session

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/live")
async def live_websocket(websocket: WebSocket):
    """Handle a single real-time voice session over WebSocket."""
    await websocket.accept()
    logger.info("WebSocket client connected")

    audio_queue: asyncio.Queue = asyncio.Queue()
    stop_event = asyncio.Event()

    async def send_to_client(msg: dict):
        """Send a JSON message to the browser, ignoring closed connection errors."""
        try:
            await websocket.send_text(json.dumps(msg, default=str))
        except Exception:
            stop_event.set()

    # Start the Gemini Live session in a background task
    session_task = asyncio.create_task(
        run_live_session(send_to_client, audio_queue, stop_event)
    )

    try:
        while not stop_event.is_set():
            # Receive messages from the browser
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            if msg.get("type") == "close":
                logger.info("Client requested close")
                break

            # Forward to the audio queue for the sender task
            await audio_queue.put(msg)

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        stop_event.set()
        session_task.cancel()
        try:
            await session_task
        except asyncio.CancelledError:
            pass
        logger.info("WebSocket session cleaned up")
