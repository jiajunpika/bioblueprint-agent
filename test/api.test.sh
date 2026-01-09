#!/bin/bash

# Test BioBlueprint API Server

echo "Testing API server..."
echo ""

# 1. Health check
echo "1. Testing health endpoint..."
HEALTH=$(curl -s http://localhost:3000/health)
echo "Response: $HEALTH"
echo ""

# 2. Upload images and get task ID
echo "2. Uploading test images..."
TASK_RESPONSE=$(curl -s -X POST http://localhost:3000/api/analyze \
  -F "images=@datasets/jiajun_album_samples/IMG_3498.JPG" \
  -F "images=@datasets/jiajun_album_samples/IMG_3499.JPG")

echo "Response: $TASK_RESPONSE"
TASK_ID=$(echo $TASK_RESPONSE | grep -o '"taskId":"[^"]*"' | cut -d'"' -f4)
echo "Task ID: $TASK_ID"
echo ""

# 3. Check task status immediately
echo "3. Checking task status (should be processing)..."
curl -s http://localhost:3000/api/task/$TASK_ID | jq '.'
echo ""

# 4. Wait and check again
echo "4. Waiting 30 seconds for analysis..."
sleep 30

echo "5. Checking final status..."
curl -s http://localhost:3000/api/task/$TASK_ID | jq '.'
