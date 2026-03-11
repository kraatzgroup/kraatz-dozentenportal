#!/bin/bash

# Test send-welcome-email function
echo "Testing send-welcome-email function..."

SUPABASE_URL="https://gkkveloqajxghhflkfru.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdra3ZlbG9xYWp4Z2hoZmxrZnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDY4ODI0NjAsImV4cCI6MjAyMjQ1ODQ2MH0.QLhXxJqH4Ot9vJxQxO0KxGxO0KxGxO0KxGxO0KxGxO0"

curl -X POST "${SUPABASE_URL}/functions/v1/send-welcome-email" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d '{
    "email": "francene2870@dollicons.com",
    "fullName": "Bärbel Buchhaltung Test",
    "magicLink": "https://gkkveloqajxghhflkfru.supabase.co/auth/v1/verify?token=test123&type=magiclink"
  }' \
  -v

echo ""
echo "Test completed!"
