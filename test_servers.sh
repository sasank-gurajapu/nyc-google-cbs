#!/bin/bash
# Quick test: verify both servers start and all endpoints work
echo "=== Backend Health ==="
curl -s http://localhost:8000/health 2>&1 || echo "Backend not running"

echo ""
echo "=== Registered Routes ==="
curl -s http://localhost:8000/openapi.json 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    for p in d['paths'].keys():
        print(f'  {p}')
except:
    print('  Could not parse routes')
" 2>&1

echo ""
echo "=== Frontend Status ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3000 2>&1 || echo "Frontend not running"

echo ""
echo "=== WebSocket Test ==="
# Just check that the upgrade request gets a proper WS response
curl -s -o /dev/null -w "HTTP %{http_code}" -H "Upgrade: websocket" -H "Connection: Upgrade" http://localhost:8000/ws/live 2>&1

echo ""
echo "Done."
