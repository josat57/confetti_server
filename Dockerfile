# Use Node.js 18 with Python 3.9 as the base image
# Use linux/amd64 platform for better compatibility
FROM --platform=linux/amd64 node:18-bullseye

# Install Python3 and required build dependencies including sharp dependencies
RUN apt-get update && apt-get install -y \
    python3.9 \
    python3.9-dev \
    python3.9-venv \
    python3-pip \
    build-essential \
    libopenblas-dev \
    gfortran \
    liblapack-dev \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/app

# Copy package files and install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Rebuild sharp for the correct platform after copying files
RUN npm rebuild sharp

# Create and activate Python virtual environment
RUN python3.9 -m venv /usr/src/app/venv
ENV PATH="/usr/src/app/venv/bin:$PATH"

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r src/python/requirements.txt

# Debug: Confirm Flask is installed
RUN . /usr/src/app/venv/bin/activate && python -m pip show flask

# Expose the port the app runs on
EXPOSE 9600

# Command to run the application
CMD ["npm", "start"] 