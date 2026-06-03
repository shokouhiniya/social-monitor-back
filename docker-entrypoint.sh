#!/bin/sh
set -e

echo "🚀 Starting Social Monitor Backend..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
sleep 5

# Run database migrations (schema changes are applied ONLY via migrations —
# synchronize is always false). This runs the compiled migrations against the
# production DB so new tables/columns (e.g. pages.profile_url, users.username,
# prompt/ai/jobs/analytics tables) exist before the app boots.
echo "🧱 Running database migrations..."
npm run migration:run:prod

# Run seed data
echo "🌱 Running seed data..."
npm run seed || echo "⚠️  Seed failed or already run"

# Start the application
echo "✅ Starting NestJS application..."
exec npm run start:prod
