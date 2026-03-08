"""Quick WebSocket test for the Gemini Live pipeline."""
import asyncio
import json
import websockets

async def test():
    uri = "ws://localhost:8000/ws/live"
    print(f"Connecting to {uri}...")
    async with websockets.connect(uri) as ws:
        msg = json.loads(await ws.recv())
        print(f"Received: {msg['type']}")
        
        await ws.send(json.dumps({"type": "text", "text": "Say hello in one sentence"}))
        print("Sent text, waiting for responses...")
        
        audio_msgs = 0
        transcript_msgs = 0
        total_audio_chars = 0
        all_types = []
        
        while True:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=15)
                msg = json.loads(raw)
                mtype = msg["type"]
                
                if mtype == "audio":
                    audio_msgs += 1
                    total_audio_chars += len(msg.get("data", ""))
                    if audio_msgs <= 3:
                        print(f"  audio msg #{audio_msgs}: {len(msg.get('data',''))} b64 chars")
                elif mtype == "transcript":
                    transcript_msgs += 1
                    print(f'  transcript: "{msg.get("text","")}"')
                elif mtype == "turn_complete":
                    print("  TURN_COMPLETE")
                    all_types.append(mtype)
                    break
                elif mtype == "session_ended":
                    print("  SESSION_ENDED")
                    break
                else:
                    print(f"  {mtype}: {str(msg)[:100]}")
                all_types.append(mtype)
            except asyncio.TimeoutError:
                print("TIMEOUT after 15s")
                break
        
        print()
        print("=== SUMMARY ===")
        print(f"Audio messages: {audio_msgs} ({total_audio_chars} b64 chars total)")
        print(f"Transcript messages: {transcript_msgs}")
        print(f"Message types: {dict((t, all_types.count(t)) for t in set(all_types))}")
        await ws.send(json.dumps({"type": "close"}))

asyncio.run(test())
