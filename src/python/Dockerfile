# Use Python 3.9 slim as the base image
FROM python:3.9-slim

# Set the working directory
WORKDIR /usr/src/app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install dependencies (add higher timeout and retries to avoid network flakiness)
ENV PIP_DEFAULT_TIMEOUT=120
RUN pip install --no-cache-dir --retries=5 -r requirements.txt

# Pre-download required NLTK data to avoid runtime failures
ENV NLTK_DATA=/usr/local/share/nltk_data
RUN python - <<'PY'
import nltk
for pkg in ["punkt", "stopwords"]:
    nltk.download(pkg)
PY

# Copy the Python application
COPY . .

# Expose the port the app runs on
EXPOSE 5600

# Command to run the application
CMD ["python", "run.py"] 