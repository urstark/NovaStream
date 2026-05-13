# NovaStream
# Developed by: urstarkz
# Telegram: t.me/urstarkz
# Instagram: urstarkz
# Website: urstark.is-a.dev

# Use an official Node.js runtime as a parent image
FROM node:20-bullseye-slim

# Install FFmpeg and required dependencies
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the frontend (Vite)
RUN npm run build

# Expose the port the app runs on (Hugging Face Spaces uses port 7860 by default)
EXPOSE 7860

# Define environment variable for the port
ENV PORT=7860

# Start the Node.js server
CMD ["npm", "start"]
