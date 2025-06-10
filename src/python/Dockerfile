# Use Python 3.9 slim as the base image
FROM python:3.9-slim

# Set the working directory
WORKDIR ./

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the Python application
COPY . .

# Expose the port the app runs on
EXPOSE 5600

# Command to run the application
CMD ["python", "run.py"] 