# Use a lightweight Python base image
FROM python:3.10-slim-buster

# RUN apt-get update && apt-get install -y \
#     supervisor \
#     && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# moving required files
COPY requirements.txt .
# COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN pip install --no-cache-dir -r requirements.txt


COPY . /app


EXPOSE 8000

# Define the command to run the FastAPI application with Uvicorn
# Replace 'main:app' with the actual path to your FastAPI application instance
CMD ["uvicorn", "app.app:app", "--host", "0.0.0.0", "--port", "8000"]

# Using supervisor
# CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]