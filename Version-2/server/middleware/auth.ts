import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

// Middleware to check if user can configure a restaurant
export const canConfigureRestaurant = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  const { restaurantId } = req.params;
  
  if (!authReq.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Admins can configure any restaurant
  if (authReq.user.role === 'ADMIN') {
    return next();
  }
  
  // Check if user has canConfigure permission for this restaurant
  const access = await prisma.restaurantAccess.findFirst({
    where: {
      userId: authReq.user.id,
      restaurantId: restaurantId,
      canConfigure: true
    }
  });
  
  if (!access) {
    return res.status(403).json({ error: 'Permission denied. Configure access required for this restaurant.' });
  }
  
  next();
};

// Middleware to check if user can manage plannings for a restaurant
// For routes where restaurantId is in params
export const canManagePlanningByParam = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  const { restaurantId } = req.params;
  
  if (!authReq.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Admins can manage any restaurant
  if (authReq.user.role === 'ADMIN') {
    return next();
  }
  
  // Check if user has canConfigure permission for this restaurant
  const access = await prisma.restaurantAccess.findFirst({
    where: {
      userId: authReq.user.id,
      restaurantId: restaurantId,
      canConfigure: true
    }
  });
  
  if (!access) {
    return res.status(403).json({ error: 'Permission denied. Configure access required for this restaurant.' });
  }
  
  next();
};

// Middleware to check if user can manage plannings for a restaurant
// For routes where restaurantId is in body
export const canManagePlanningByBody = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  const { restaurantId } = req.body;
  
  if (!authReq.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (!restaurantId) {
    return res.status(400).json({ error: 'restaurantId is required' });
  }
  
  // Admins can manage any restaurant
  if (authReq.user.role === 'ADMIN') {
    return next();
  }
  
  // Check if user has canConfigure permission for this restaurant
  const access = await prisma.restaurantAccess.findFirst({
    where: {
      userId: authReq.user.id,
      restaurantId: restaurantId,
      canConfigure: true
    }
  });
  
  if (!access) {
    return res.status(403).json({ error: 'Permission denied. Configure access required for this restaurant.' });
  }
  
  next();
};

// Middleware to check if user can manage a planning by its ID
// For routes where we need to fetch the planning first to get restaurantId
export const canManagePlanningById = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  const { id } = req.params;
  
  if (!authReq.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Admins can manage any restaurant
  if (authReq.user.role === 'ADMIN') {
    return next();
  }
  
  // Fetch the planning to get its restaurantId
  const planning = await prisma.planning.findUnique({
    where: { id },
    select: { restaurantId: true }
  });
  
  if (!planning) {
    return res.status(404).json({ error: 'Planning not found' });
  }
  
  // Check if user has canConfigure permission for this restaurant
  const access = await prisma.restaurantAccess.findFirst({
    where: {
      userId: authReq.user.id,
      restaurantId: planning.restaurantId,
      canConfigure: true
    }
  });
  
  if (!access) {
    return res.status(403).json({ error: 'You do not have permission to configure this restaurant' });
  }
  
  next();
};
