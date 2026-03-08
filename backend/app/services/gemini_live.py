"""
Gemini Live API service — real-time bidirectional audio with function calling.

This module manages a Gemini Live session over WebSocket, handling:
- Incoming audio from the browser (PCM 16kHz 16-bit mono)
- Outgoing audio from Gemini (PCM 24kHz 16-bit mono)
- Function calls for Google Maps APIs mid-conversation
- Structured data extraction for the frontend UI
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
from typing import Any, Callable, Coroutine

from google import genai
from google.genai import types

from app.config import SETTINGS
from app.services.tools import SYSTEM_INSTRUCTION, TOOLS, execute_tool

logger = logging.getLogger(__name__)

# The Live API model
LIVE_MODEL = "gemini-2.5-flash-native-audio-latest"

# Audio batching: accumulate small chunks to reduce WebSocket overhead,
# but keep it low for real-time responsiveness.
# 2400 bytes = 100ms of 24kHz 16-bit mono audio
AUDIO_BATCH_MIN_BYTES = 2400
AUDIO_BATCH_MAX_WAIT = 0.05  # seconds — flush very quickly for lower latency


def _summarize_for_gemini(result: dict, tool_name: str) -> dict:
    """
    Create a compact summary of a tool result for Gemini to speak about.
    Strips photos, long reviews, and verbose fields to keep payload small.
    The FULL result is still sent to the frontend for rendering.
    """
    if not isinstance(result, dict):
        return result

    # For place-related results that return a list of places
    if "places" in result and isinstance(result["places"], list):
        compact_places = []
        for place in result["places"][:8]:  # Limit to 8 places
            compact = {}
            # Keep only the fields Gemini needs to talk about
            for key in [
                "name", "formatted_address", "rating", "user_rating_count",
                "price_level", "types", "opening_hours", "phone",
                "website", "editorial_summary",
            ]:
                if key in place and place[key] is not None:
                    val = place[key]
                    # Truncate very long strings
                    if isinstance(val, str) and len(val) > 200:
                        val = val[:200] + "..."
                    compact[key] = val
            # Include just the first review snippet if available
            if "reviews" in place and place["reviews"]:
                first = place["reviews"][0]
                if isinstance(first, dict):
                    compact["top_review"] = (first.get("text") or "")[:150]
            compact_places.append(compact)
        return {"places": compact_places, "total_count": len(result["places"])}

    # For single place details
    if "name" in result and "formatted_address" in result:
        compact = {}
        for key in [
            "name", "formatted_address", "rating", "user_rating_count",
            "price_level", "types", "opening_hours", "phone",
            "website", "editorial_summary",
        ]:
            if key in result and result[key] is not None:
                val = result[key]
                if isinstance(val, str) and len(val) > 200:
                    val = val[:200] + "..."
                compact[key] = val
        if "reviews" in result and result["reviews"]:
            compact["top_reviews"] = []
            for r in result["reviews"][:3]:
                if isinstance(r, dict):
                    compact["top_reviews"].append({
                        "rating": r.get("rating"),
                        "text": (r.get("text") or "")[:150],
                    })
        return compact

    # For route results
    if "routes" in result:
        compact_routes = []
        for route in result.get("routes", [])[:3]:
            if isinstance(route, dict):
                compact = {}
                for key in ["duration", "distance", "summary", "legs"]:
                    if key in route:
                        if key == "legs" and isinstance(route[key], list):
                            # Simplify legs — just start/end and steps summary
                            compact["legs_count"] = len(route[key])
                            if route[key]:
                                leg = route[key][0]
                                compact["start"] = leg.get("start_address", "")
                                compact["end"] = leg.get("end_address", "")
                                compact["steps_count"] = len(leg.get("steps", []))
                        else:
                            compact[key] = route[key]
                compact_routes.append(compact)
        return {"routes": compact_routes}

    # For geocode results — already small, pass through
    # For aggregate results — already small, pass through
    # Fallback: truncate the JSON if it's still too big
    result_str = json.dumps(result, default=str)
    if len(result_str) > 8000:
        # Just truncate and add a note
        return json.loads(result_str[:8000] + '"}')
    return result


async def run_live_session(
    send_to_client: Callable[[dict], Coroutine[Any, Any, None]],
    audio_queue: asyncio.Queue,
    stop_event: asyncio.Event,
):
    """
    Run a Gemini Live session.

    Args:
        send_to_client: async callback to send JSON messages to the browser WebSocket
        audio_queue: queue of incoming audio chunks (base64 PCM) from the browser
        stop_event: set when the WebSocket disconnects to shut down the session
    """
    client = genai.Client(api_key=SETTINGS["GEMINI_API_KEY"])

    # Wait for location message before starting the session (with timeout)
    user_location = None
    try:
        # Give the client 3 seconds to send location
        for _ in range(30):  # 30 * 0.1s = 3s timeout
            if stop_event.is_set():
                return
            try:
                msg = await asyncio.wait_for(audio_queue.get(), timeout=0.1)
                if msg.get("type") == "location":
                    user_location = {
                        "latitude": msg.get("latitude", 0),
                        "longitude": msg.get("longitude", 0),
                    }
                    logger.info(f"Received user location: {user_location}")
                    break
                else:
                    # Put non-location messages back (shouldn't happen, but just in case)
                    await audio_queue.put(msg)
            except asyncio.TimeoutError:
                continue
    except Exception as e:
        logger.warning(f"Error waiting for location: {e}")

    # Build system instruction with user location
    if user_location:
        location_context = (
            f"\n\nUSER LOCATION: The user is currently at latitude {user_location['latitude']}, "
            f"longitude {user_location['longitude']}. Use these coordinates when calling "
            f"location-based tools like nearby_search or text_search to provide relevant local results."
        )
        system_instruction = SYSTEM_INSTRUCTION + location_context
    else:
        system_instruction = SYSTEM_INSTRUCTION
        logger.warning("No location received, using default system instruction")

    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=system_instruction,
        tools=TOOLS,
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Kore"
                )
            )
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
    )

    try:
        async with client.aio.live.connect(model=LIVE_MODEL, config=config) as session:
            logger.info("Gemini Live session connected")
            await send_to_client({"type": "session_started"})

            # Run sender and receiver concurrently
            sender_task = asyncio.create_task(
                _audio_sender(session, audio_queue, stop_event)
            )
            receiver_task = asyncio.create_task(
                _response_receiver(session, send_to_client, stop_event)
            )

            # Wait until stop is signaled or either task finishes
            done, pending = await asyncio.wait(
                [sender_task, receiver_task],
                return_when=asyncio.FIRST_COMPLETED,
            )

            # Cancel remaining tasks
            for task in pending:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

            # Check for errors
            for task in done:
                if task.exception():
                    logger.error(f"Live session task error: {task.exception()}")

    except Exception as e:
        logger.error(f"Gemini Live session error: {e}")
        await send_to_client({"type": "error", "message": str(e)})
    finally:
        await send_to_client({"type": "session_ended"})
        logger.info("Gemini Live session ended")


async def _audio_sender(
    session,
    audio_queue: asyncio.Queue,
    stop_event: asyncio.Event,
):
    """Wait for audio from the browser and send it to Gemini Live."""
    while not stop_event.is_set():
        msg = await audio_queue.get()
        if msg is None or msg.get("type") == "stop":
            break

        if msg.get("type") == "audio" and "data" in msg:
            # Decode base64 PCM audio and send to Gemini
            audio_bytes = base64.b64decode(msg["data"])
            await session.send_realtime_input(
                audio=types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
            )
        elif msg.get("type") == "location":
            # Location is handled before session starts, ignore if received later
            logger.debug("Ignoring late location message")
        elif msg.get("type") == "end_turn":
            # User finished speaking (silence detected on client)
            pass  # VAD in Gemini Live handles turn detection automatically


async def _response_receiver(
    session,
    send_to_client: Callable[[dict], Coroutine[Any, Any, None]],
    stop_event: asyncio.Event,
):
    """Receive responses from Gemini Live and forward to the browser."""

    # Audio batching state
    audio_buffer = bytearray()
    last_flush_time = time.monotonic()

    async def flush_audio():
        """Send accumulated audio to the browser."""
        nonlocal audio_buffer, last_flush_time
        if len(audio_buffer) > 0:
            audio_b64 = base64.b64encode(bytes(audio_buffer)).decode("utf-8")
            await send_to_client({"type": "audio", "data": audio_b64})
            logger.info(f"Flushed audio batch: {len(audio_buffer)} bytes")
            audio_buffer = bytearray()
            last_flush_time = time.monotonic()

    while not stop_event.is_set():
        try:
            async for response in session.receive():
                if stop_event.is_set():
                    break

                # Log all response types for debugging
                resp_types = []
                if response.data:
                    resp_types.append(f"audio({len(response.data)})")
                if response.server_content:
                    if response.server_content.input_transcription:
                        resp_types.append("input_transcript")
                    if response.server_content.output_transcription:
                        resp_types.append("output_transcript")
                    if response.server_content.turn_complete:
                        resp_types.append("turn_complete")
                if response.tool_call:
                    resp_types.append(f"tool_call({len(response.tool_call.function_calls)})")
                if resp_types:
                    logger.debug(f"Response: {', '.join(resp_types)}")

                # ── Audio data from Gemini (it's speaking) ──
                if response.data is not None and len(response.data) > 0:
                    logger.debug(f"Received audio chunk: {len(response.data)} bytes")

                    # Accumulate audio into a batch
                    audio_buffer.extend(response.data)

                    # Flush if we have enough data or enough time has passed
                    now = time.monotonic()
                    if (
                        len(audio_buffer) >= AUDIO_BATCH_MIN_BYTES
                        or (now - last_flush_time) >= AUDIO_BATCH_MAX_WAIT
                    ):
                        await flush_audio()

                # ── Input audio transcription (what the user said) ──
                if (
                    response.server_content
                    and response.server_content.input_transcription
                    and response.server_content.input_transcription.text
                ):
                    await send_to_client({
                        "type": "user_transcript",
                        "text": response.server_content.input_transcription.text,
                    })

                # ── Output audio transcription (what Gemini said as text) ──
                if (
                    response.server_content
                    and response.server_content.output_transcription
                    and response.server_content.output_transcription.text
                ):
                    logger.debug(f"Output transcription: {response.server_content.output_transcription.text[:100]}...")
                    await send_to_client({
                        "type": "transcript",
                        "text": response.server_content.output_transcription.text,
                    })

                # ── Turn complete ──
                if response.server_content and response.server_content.turn_complete:
                    # Flush any remaining audio before signaling turn complete
                    await flush_audio()
                    await send_to_client({"type": "turn_complete"})
                    logger.info("Turn complete")

                # ── Interrupted (barge-in) ──
                if response.server_content and response.server_content.interrupted:
                    logger.info("Bot was interrupted by user!")
                    await send_to_client({"type": "interrupted"})

                # ── Tool calls (Gemini wants to call a Maps API) ──
                if response.tool_call:
                    # Flush any pending audio before handling tool calls
                    await flush_audio()
                    
                    await _handle_tool_calls(
                        session, response.tool_call, send_to_client
                    )
                    # After tool call, Gemini will continue with audio response
                    # The loop continues and will receive the follow-up audio
                    logger.info("Tool call handled — continuing to wait for Gemini's follow-up response")
                    # Don't break - let the async for continue to receive follow-up responses

        except StopAsyncIteration:
            # Normal end of receive generator - restart it
            logger.info("Receive generator exhausted, restarting...")
            continue
        except Exception as e:
            if not stop_event.is_set():
                logger.error(f"Receiver error: {e}")
                await send_to_client({"type": "error", "message": str(e)})
            break


async def _handle_tool_calls(session, tool_call, send_to_client):
    """Execute tool calls from Gemini and send results back to the session."""
    function_responses = []

    for fc in tool_call.function_calls:
        tool_name = fc.name
        tool_args = dict(fc.args) if fc.args else {}

        logger.info(f"Tool call: {tool_name}({tool_args}) id={fc.id}")

        # Notify the frontend about the tool call
        await send_to_client({
            "type": "tool_call",
            "name": tool_name,
            "args": tool_args,
        })

        try:
            result = await execute_tool(tool_name, tool_args)

            # Send FULL structured data to the frontend for rendering (cards, map, etc.)
            await send_to_client({
                "type": "structured_data",
                "tool": tool_name,
                "args": tool_args,
                "result": result,
            })

            # Send COMPACT summary to Gemini so it can speak about the results
            # without choking on 100KB+ of JSON
            compact_result = _summarize_for_gemini(result, tool_name)
            logger.info(
                f"Tool result: full={len(json.dumps(result, default=str))} chars, "
                f"compact={len(json.dumps(compact_result, default=str))} chars"
            )

            # Pass the dict directly (not JSON string) to FunctionResponse
            function_responses.append(
                types.FunctionResponse(
                    id=fc.id,
                    name=tool_name,
                    response=compact_result,
                )
            )
        except Exception as e:
            error_msg = f"Error calling {tool_name}: {str(e)}"
            logger.error(error_msg)
            function_responses.append(
                types.FunctionResponse(
                    id=fc.id,
                    name=tool_name,
                    response={"error": error_msg},
                )
            )

    # Send tool responses back to Gemini Live so it can continue speaking
    await session.send_tool_response(function_responses=function_responses)
    logger.info("Tool responses sent back to Gemini — waiting for audio response")
