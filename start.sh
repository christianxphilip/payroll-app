#!/bin/bash

echo "🚀 Starting Payroll Timesheet System..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Rancher Desktop/Docker and try again."
    exit 1
fi

echo "✓ Docker is running"
echo ""

# Check if Docker Compose is available (v2 compose plugin or v1 standalone)
if docker compose version > /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose > /dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo "❌ Docker Compose is not installed. Please install Docker or Rancher Desktop first."
    exit 1
fi

echo "✓ Using compose tool: $COMPOSE_CMD"
echo ""

# Check if .env file exists in backend
if [ ! -f backend/.env ]; then
    echo "⚠️  No .env file found in backend/"
    echo "📝 Creating .env from .env.example..."
    cp backend/.env.example backend/.env
    echo "✓ Created backend/.env"
    echo ""
fi

echo "🔨 Building Docker images..."
$COMPOSE_CMD build

echo ""
echo "🐳 Starting containers..."
$COMPOSE_CMD up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

echo ""
echo "✅ Payroll Timesheet System is running!"
echo ""
echo "📍 Access the application:"
echo "   Frontend: http://localhost:5174"
echo "   Backend API: http://localhost:9001"
echo ""
echo "🔐 Default Password: admin123"
echo ""
echo "📋 Useful commands:"
echo "   View logs: $COMPOSE_CMD logs -f"
echo "   Stop: $COMPOSE_CMD down"
echo "   Restart: $COMPOSE_CMD restart"
echo ""

