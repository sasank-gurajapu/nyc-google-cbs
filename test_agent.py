"""Quick test script for the agent endpoint."""
import json
import subprocess
import sys

question = sys.argv[1] if len(sys.argv) > 1 else "Best pizza in Manhattan?"

result = subprocess.run(
    ["curl", "-s", "-X", "POST", "http://localhost:8000/api/ask",
     "-H", "Content-Type: application/json",
     "-d", json.dumps({"question": question}),
     "--max-time", "120"],
    capture_output=True, text=True
)

if not result.stdout.strip():
    print("ERROR: Empty response. Is the server running?")
    sys.exit(1)

d = json.loads(result.stdout)
print("Tools:", [t["name"] for t in d["tools_used"]])
print()
print(d["answer"])
