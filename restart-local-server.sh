#!/bin/bash

echo "=========================================="
echo "Restarting Local Server"
echo "=========================================="
echo ""

# Find and kill process on port 9600
echo "Step 1: Stopping server on port 9600..."
PID=$(lsof -ti:9600)
if [ ! -z "$PID" ]; then
    echo "Found process $PID, stopping..."
    kill -9 $PID
    sleep 2
    echo "✓ Server stopped"
else
    echo "No server running on port 9600"
fi

echo ""
echo "Step 2: Starting server..."
echo "Please run this command in a separate terminal:"
echo ""
echo "  cd /Users/Apple/projects/confetti_server"
echo "  npm start"
echo ""
echo "OR"
echo ""
echo "  node src/node/server.js"
echo ""
echo "=========================================="
echo "After server starts, run this to test:"
echo "=========================================="
echo ""
echo "curl -X POST http://localhost:9600/api/v1/auth/signin \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\": \"power.admin@confetti.com\", \"password\": \"Ginger@123A\"}'"
echo ""
