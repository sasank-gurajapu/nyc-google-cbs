"""
Gemini Agent — the orchestrating brain of the application (text mode).

Uses shared tool declarations from tools.py.
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Optional, List, Dict

from google import genai
from google.genai import types

from app.config import SETTINGS
from app.services.tools import SYSTEM_INSTRUCTION, TOOLS, execute_tool

# ── Configure Gemini client ─────────────────────────────────────────
client = genai.Client(api_key=SETTINGS["GEMINI_API_KEY"])

MODEL_NAME = "gemini-2.5-flash"


# ── Main agent entry point ─────────────────────────────────────────

async def ask(question: str, chat_history: Optional[List[Dict]] = None) -> dict:
    """
    Process a user question through the Gemini agent.

    Returns:
      {
        "answer": "...",          # Gemini's final natural-language answer
        "structured_data": [...], # Raw API results for frontend rendering
        "tools_used": [...]       # Which tools the agent decided to call
      }
    """
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        tools=TOOLS,
    )

    # Build conversation history for the chat
    history = []
    if chat_history:
        for msg in chat_history:
            role = "user" if msg["role"] == "user" else "model"
            history.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg["content"])],
                )
            )

    chat = client.chats.create(
        model=MODEL_NAME,
        config=config,
        history=history,
    )

    # Send the user's question
    response = chat.send_message(question)

    structured_data = []
    tools_used = []

    # Loop: Gemini may request tool calls; we execute them and feed results back
    MAX_ITERATIONS = 10
    for _ in range(MAX_ITERATIONS):
        # Check if there are function calls in the response
        function_calls = []
        if response.candidates and response.candidates[0].content:
            for part in response.candidates[0].content.parts:
                if part.function_call:
                    function_calls.append(part.function_call)

        if not function_calls:
            break

        # Execute each function call and build function responses
        function_response_parts = []
        for fc in function_calls:
            tool_name = fc.name
            tool_args = dict(fc.args) if fc.args else {}
            tools_used.append({"name": tool_name, "args": tool_args})

            try:
                result = await execute_tool(tool_name, tool_args)
                structured_data.append({
                    "tool": tool_name,
                    "args": tool_args,
                    "result": result,
                })
                function_response_parts.append(
                    types.Part.from_function_response(
                        name=tool_name,
                        response={"result": json.dumps(result, default=str)},
                    )
                )
            except Exception as e:
                error_msg = f"Error calling {tool_name}: {str(e)}"
                function_response_parts.append(
                    types.Part.from_function_response(
                        name=tool_name,
                        response={"error": error_msg},
                    )
                )

        # Send tool results back to Gemini
        response = chat.send_message(function_response_parts)

    # Extract the final text answer
    answer = ""
    if response.candidates and response.candidates[0].content:
        for part in response.candidates[0].content.parts:
            if part.text:
                answer += part.text

    result = {
        "answer": answer,
        "structured_data": structured_data,
        "tools_used": tools_used,
    }

    # ── Write API output to file (overwritten on every call) ────────
    output_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "API_OUTPUT.json")
    output_path = os.path.normpath(output_path)
    log = {
        "timestamp": datetime.now().isoformat(),
        "question": question,
        "model": MODEL_NAME,
        "tools_called": [{"tool": t["name"], "args": t["args"]} for t in tools_used],
        "api_responses": [{"tool": sd["tool"], "args": sd["args"], "response": sd["result"]} for sd in structured_data],
        "final_answer": answer,
    }
    with open(output_path, "w") as f:
        json.dump(log, f, indent=2, default=str)

    return result
