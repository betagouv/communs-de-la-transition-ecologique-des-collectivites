#!/bin/bash
set -e  # Exit on error

echo "Starting API server..."

# Start the development server in the background
pnpm run build
pnpm run start &
DEV_SERVER_PID=$!

# Wait for the server to start
echo "Waiting for API to be ready..."
sleep 5

echo "Generating types..."
pnpm openapi-typescript http://localhost:3000/openapi.json -o test/generated-types.ts

# Kill the development server
echo "Cleaning up..."
kill -9 $DEV_SERVER_PID
kill -9 $(lsof -t -i :3000)

echo "Types generated successfully!" 