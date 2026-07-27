# Environment Setup Guide

## Backend Environment Variables

The `start.sh` script will automatically create the `.env` file in the backend directory. However, if you need to set it up manually, create a file at `backend/.env` with the following content:

```env
PORT=9001
MONGODB_URI=mongodb+srv://esprocoffee_db_user:fx3ncTyhtbPoYE0a@cluster0.xktsy7b.mongodb.net/espro?appName=Cluster0
JWT_SECRET=your-super-secret-jwt-key-change-in-production
AUTH_PASSWORD=admin123
NODE_ENV=development
```

## Frontend Environment Variables (Optional)

Create `frontend/.env` if your backend is at a non-default location:

```env
VITE_API_URL=http://localhost:9001/api
```

## Configuration Details

### Backend Configuration

#### PORT
- **Default**: `9001`
- **Description**: Port where the Express server runs
- **Docker**: Must match the port in docker-compose.yml

#### MONGODB_URI
- **Default**: `mongodb+srv://esprocoffee_db_user:fx3ncTyhtbPoYE0a@cluster0.xktsy7b.mongodb.net/espro?appName=Cluster0`
- **Docker/Local**: Use the MongoDB Atlas connection string: `mongodb+srv://esprocoffee_db_user:fx3ncTyhtbPoYE0a@cluster0.xktsy7b.mongodb.net/espro?appName=Cluster0`
- **Description**: MongoDB connection string

#### JWT_SECRET
- **Default**: `your-super-secret-jwt-key-change-in-production`
- **Production**: Generate a random string (32+ characters)
- **Description**: Secret key for JWT token signing
- **Security**: Never commit real secret to version control

#### AUTH_PASSWORD
- **Default**: `admin123`
- **Production**: Change to a strong password
- **Description**: Single password for system access
- **Note**: All users use this same password

#### NODE_ENV
- **Default**: `development`
- **Options**: `development` or `production`
- **Description**: Environment mode (affects error messages, logging)

### Frontend Configuration

#### VITE_API_URL
- **Default**: Not set (uses `http://localhost:9001/api`)
- **Description**: Backend API base URL
- **When to set**: 
  - Backend is on different port
  - Backend is on different domain
  - Production deployment

## Docker vs Local Development

### Using Docker (Recommended)
```bash
# Uses default configuration from docker-compose.yml
./start.sh
```

Environment variables are set in `docker-compose.yml`:
```yaml
environment:
  - PORT=9001
  - MONGODB_URI=mongodb+srv://esprocoffee_db_user:fx3ncTyhtbPoYE0a@cluster0.xktsy7b.mongodb.net/espro?appName=Cluster0
  - JWT_SECRET=your-super-secret-jwt-key-change-in-production
  - AUTH_PASSWORD=admin123
  - NODE_ENV=development
```

### Local Development
```bash
# Backend
cd backend
npm install
# Create .env file with variables above
npm start

# Frontend
cd frontend
npm install
# Create .env if needed
npm run dev
```

## Production Deployment Checklist

### Security
- [ ] Change `AUTH_PASSWORD` to strong password
- [ ] Generate random `JWT_SECRET` (use: `openssl rand -base64 32`)
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS
- [ ] Restrict MongoDB access

### Database
- [ ] Set up MongoDB backups
- [ ] Configure MongoDB authentication
- [ ] Use connection string with credentials
- [ ] Set up replication (if needed)

### Application
- [ ] Update CORS settings if needed
- [ ] Set proper `VITE_API_URL` in frontend
- [ ] Build frontend for production: `npm run build`
- [ ] Set up process manager (PM2, systemd)
- [ ] Configure reverse proxy (nginx, Apache)

### Monitoring
- [ ] Set up logging
- [ ] Configure error tracking
- [ ] Set up uptime monitoring
- [ ] Configure alerts

## Environment Variable Priority

1. **Docker Compose**: Variables in `docker-compose.yml` override `.env`
2. **System Environment**: System env vars override both
3. **.env File**: Loaded if no other source

## Troubleshooting

### Backend can't connect to MongoDB
- Check `MONGODB_URI` is correct
- Verify MongoDB is running
- For Docker: Use service name `mongodb`
- For Local: Use `localhost`

### Frontend can't reach backend
- Check `VITE_API_URL` (if set)
- Verify backend is running on expected port
- Check CORS configuration
- Open browser console for error messages

### Authentication fails
- Verify `AUTH_PASSWORD` matches in .env
- Check `JWT_SECRET` is set
- Clear browser localStorage and try again
- Check browser console for errors

### Port already in use
- Change `PORT` in backend .env
- Update docker-compose.yml port mappings
- Update frontend API URL if needed

## Generating Secure Secrets

### JWT Secret
```bash
# Generate 32-byte base64 string
openssl rand -base64 32

# Or generate 64 hex characters
openssl rand -hex 32
```

### Strong Password
```bash
# Generate 20-character password
openssl rand -base64 20

# Or use a password manager
```

## Default Configuration Summary

| Variable | Default Value | Used In |
|----------|--------------|---------|
| PORT | 9001 | Backend |
| MONGODB_URI | mongodb+srv://esprocoffee_db_user:fx3ncTyhtbPoYE0a@cluster0.xktsy7b.mongodb.net/espro?appName=Cluster0 | Backend |
| JWT_SECRET | your-super-secret-jwt-key-change-in-production | Backend |
| AUTH_PASSWORD | admin123 | Backend |
| NODE_ENV | development | Backend |
| VITE_API_URL | (not set) | Frontend |

## Quick Setup Commands

### Docker Setup
```bash
cd payroll-app
./start.sh
# That's it! Uses default configuration
```

### Manual Setup
```bash
# Backend
cd backend
cat > .env << EOF
PORT=9001
MONGODB_URI=mongodb+srv://esprocoffee_db_user:fx3ncTyhtbPoYE0a@cluster0.xktsy7b.mongodb.net/espro?appName=Cluster0
JWT_SECRET=$(openssl rand -base64 32)
AUTH_PASSWORD=admin123
NODE_ENV=development
EOF
npm install
npm start

# Frontend (in new terminal)
cd frontend
npm install
npm run dev
```

---

**Note**: The `start.sh` script handles environment setup automatically for Docker deployment.

