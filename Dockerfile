# Use an official Node.js runtime as base image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package.json and lock file first (to cache dependencies)
COPY package*.json ./

# Install dependencies (use `--legacy-peer-deps` if needed)
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the project (if needed)
RUN npm run build

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Expose the port your Nest app uses (default: 3000)
EXPOSE 3000

# Set Node.js memory limit as environment variable
ENV NODE_OPTIONS="--max-old-space-size=160192"

# Use entrypoint script to run seed before starting app
ENTRYPOINT ["/app/docker-entrypoint.sh"]
