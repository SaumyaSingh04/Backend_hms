# Hotel Management API

Backend API for hotel management system with authentication, room booking, and category management.

## Deployment

This project is configured for deployment on Vercel as serverless functions.

### Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file based on `.env.example`
4. Run the development server: `npm run dev`

### Vercel Deployment

1. Install Vercel CLI: `npm i -g vercel`
2. Login to Vercel: `vercel login`
3. Deploy to Vercel: `npm run deploy`

## Environment Variables

- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT token generation

## API Routes

- Authentication: `/api/auth`
- Categories: `/api/categories`
- Bookings: `/api/bookings`
- Rooms: `/api/rooms`