#!/bin/sh
set -e

echo "🚀 Starting Social Monitor Backend..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
sleep 5

# Run database migrations (if you have any)
# npm run migration:run

# Run seed data
echo "🌱 Running seed data..."
npm run seed || echo "⚠️  Seed failed or already run"

# Start the application
echo "✅ Starting NestJS application..."
exec npm run start:prod
