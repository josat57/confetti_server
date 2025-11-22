#!/bin/bash

# Test the signout endpoint
echo "Testing /auth/signout endpoint..."
echo ""

# Test POST request to signout
curl -X POST http://localhost:9600/api/v1/auth/signout \
  -H "Content-Type: application/json" \
  -v

echo ""
echo ""
echo "Test complete!"
