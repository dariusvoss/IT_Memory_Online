#!/bin/bash
# Memory Game - Full Stack Starter Script
# Starts both Backend and Frontend servers

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Memory Game - Full Stack Development Server${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Backend check and start
echo -e "${YELLOW}[1/2] Starting Backend (FastAPI)...${NC}"
if [ ! -d "backend" ]; then
  echo -e "${RED}✗ Backend folder not found${NC}"
  exit 1
fi

cd backend

# Check if venv exists
if [ ! -d "venv" ]; then
  echo -e "${YELLOW}Creating virtual environment...${NC}"
  python -m venv venv
fi

# Activate venv (platform specific)
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
  source venv/Scripts/activate
else
  source venv/bin/activate
fi

# Install dependencies
pip install -q -r requirements.txt

echo -e "${GREEN}✓ Backend dependencies installed${NC}"

# Start backend in background
python -m uvicorn main:app --reload &
BACKEND_PID=$!

echo -e "${GREEN}✓ Backend started on http://localhost:8000${NC}"
echo -e "${GREEN}  Swagger UI: http://localhost:8000/docs${NC}"
sleep 2

# Frontend check and start
echo ""
echo -e "${YELLOW}[2/2] Starting Frontend (Angular)...${NC}"

cd ../frontend

if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing Frontend dependencies...${NC}"
  npm install
fi

echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

# Start frontend in background
npm start &
FRONTEND_PID=$!

echo -e "${GREEN}✓ Frontend started on http://localhost:4200${NC}"
sleep 3

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Both servers are running!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Frontend:  http://localhost:4200"
echo "Backend:   http://localhost:8000"
echo "API Docs:  http://localhost:8000/docs"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Wait for both processes
wait
