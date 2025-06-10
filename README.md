# Confetti - AI-Powered Event Planning Platform

## Project Overview
Confetti is a comprehensive event planning platform that leverages AI to help users plan events, connect with vendors, and optimize budgets. The platform serves three main user types: individual users, professional event planners, and vendors.

## Development Modules

### 1. Core User Management
- User registration and authentication
- Profile management
- Role-based access control
- User preferences and settings
- Account management

### 2. Event Simulation & Planning
- Event creation and management
- Budget simulation tools
- Venue selection and management
- Guest list management
- Timeline creation
- Task management
- Basic cost estimation

### 3. AI/ML Integration
- Budget optimization algorithms
- Price prediction models
- Vendor matching system
- Recommendation engine
- Event simulation models
- Natural language processing

### 4. Vendor Management
- Vendor registration and profiles
- Portfolio management
- Service catalog
- Pricing management
- Availability calendar
- Rating and review system

### 5. Marketplace & Booking
- Vendor search and filtering
- Booking management
- Payment processing
- Contract management
- Communication system
- Review and feedback system

### 6. Analytics & Reporting
- User analytics
- Vendor performance metrics
- Event statistics
- Financial reporting
- Market trends analysis
- Custom reports generation

### 7. Communication & Notifications
- Real-time messaging
- Email notifications
- Push notifications
- Calendar integration
- Reminder system
- Announcement system

### 8. Admin & Management
- User management
- Content management
- System configuration
- Moderation tools
- Support ticket system
- Audit logging

## Technology Stack

### Backend Services
- Node.js/Express (Main API)
- Python/Flask (AI/ML Services)
- MongoDB (Document Storage)
- PostgreSQL (Relational Data)
- Redis (Caching)

### Development Tools
- Docker
- Git
- ESLint/Prettier
- Jest/Pytest
- Swagger/OpenAPI

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Node.js 18+
- Python 3.9+
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/confetti-server.git
cd confetti-server
```

2. Create environment files:
```bash
cp .env.example .env
```

3. Start the development environment:
```bash
docker-compose up -d
```

4. Install dependencies:
```bash
# Node.js dependencies
cd src/node
npm install

# Python dependencies
cd ../python
pip install -r requirements.txt
```

### Development

1. Start the Node.js service:
```bash
cd src/node
npm run dev
```

2. Start the Python service:
```bash
cd src/python
python run.py
```

### Testing

1. Node.js tests:
```bash
cd src/node
npm test
```

2. Python tests:
```bash
cd src/python
pytest
```

## API Documentation
API documentation is available at:
- Node.js API: http://localhost:3000/api-docs
- Python API: http://localhost:5000/api-docs

## Contributing
Please read CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.

## License
This project is licensed under the MIT License - see the LICENSE file for details. 