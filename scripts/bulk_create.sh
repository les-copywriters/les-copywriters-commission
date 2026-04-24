#!/bin/bash

# ==============================================================================
# Bulk User Creation Script
# ==============================================================================
# INSTRUCTIONS:
# 1. Replace 'YOUR_SERVICE_ROLE_KEY' with your actual Supabase Service Role Key.
# 2. Run this script: bash scripts/bulk_create.sh
# ==============================================================================

SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyemVpaWFteHdjY2p3YmpxbnphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE1MzA4MywiZXhwIjoyMDkwNzI5MDgzfQ.FidegwaUvaXYyOVA3O_oVxKTVnaCP7cHqInaRWXIlA4"
PROJECT_URL="https://irzeiiamxwccjwbjqnza.supabase.co"

curl -i -X POST "$PROJECT_URL/functions/v1/bulk-create-profiles" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer $SERVICE_ROLE_KEY" \
-d '{
  "users": [
    { "email": "BenoitMichaud63@gmail.com", "role": "admin", "name": "Benoit", "password": "Admin@Benoit1" },
    { "email": "joseph.atallah3@gmail.com", "role": "admin", "name": "Joseph", "password": "Admin@Joseph1" },
    { "email": "support@les-copywriters.com", "role": "admin", "name": "Support", "password": "Admin@Support1" },
    { "email": "jr@les-copywriters.com", "role": "closer", "name": "JR", "password": "Closer@Jr1" },
    { "email": "yoann@les-copywriters.com", "role": "closer", "name": "Yoann", "password": "Closer@Yoann1" },
    { "email": "rachid@les-copywriters.com", "role": "closer", "name": "Rachid", "password": "Closer@Rachid1" },
    { "email": "philippechatre67@gmail.com", "role": "setter", "name": "Philippe", "password": "Setter@Philippe1" },
    { "email": "celine.scotton@gmail.com", "role": "setter", "name": "Celine", "password": "Setter@Celine1" },
    { "email": "andy@les-copywriters.com", "role": "setter", "name": "Andy", "password": "Setter@Andy1" },
    { "email": "jessica.oustry.copywriter@gmail.com", "role": "setter", "name": "Jessica", "password": "Setter@Jessica1" }
  ]
}'
