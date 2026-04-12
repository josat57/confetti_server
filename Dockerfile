# Node.js API service (Python AI runs in a separate container via docker-compose)
FROM node:18-bullseye-slim

# Install build tools needed for native npm modules (sharp, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/app

# Copy package files and install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Rebuild sharp for the correct platform
RUN npm rebuild sharp

# Expose the port the app runs on
EXPOSE 9600

# Start the Node.js server
CMD ["npm", "start"]
