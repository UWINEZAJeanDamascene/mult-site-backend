import { Router } from 'express';
import { generateToken } from '../utils/auth';
import { config } from '../config';
import { authenticateToken } from '../middleware/auth';
import { User, UserRole, ActionType, ResourceType } from '../models';
import { Company } from '../models/Company';
import mongoose from 'mongoose';
import { ActionLogService } from '../services/actionLogService';

const router = Router();

// Helper to get or create default company
async function getOrCreateDefaultCompany(companyId?: string) {
  // If valid ObjectId, try to find by ID
  if (companyId && mongoose.Types.ObjectId.isValid(companyId)) {
    const company = await Company.findById(companyId);
    if (company) return company;
  }
  
  // Try to find by company_id directly (for string IDs like 'default-company')
  if (companyId) {
    const company = await Company.findOne({ company_id: companyId });
    if (company) return company;
    
    // Also check by name
    const byName = await Company.findOne({ name: 'Lilstock' });
    if (byName) return byName;
    
    // Create new company with this company_id
    const newCompany = await Company.create({
      name: 'Lilstock',
      company_id: companyId,
      description: 'Multi-Site Stock Management System',
    });
    console.log('[Auth] Created company with company_id:', companyId, newCompany._id.toString());
    return newCompany;
  }
  
  // Try to find by name 'Lilstock'
  let company = await Company.findOne({ name: 'Lilstock' });
  if (company) return company;
  
  // Create default company without company_id
  company = await Company.create({
    name: 'Lilstock',
    description: 'Multi-Site Stock Management System',
  });
  console.log('[Auth] Created default company:', company._id.toString());
  return company;
}

// Register - Main stock manager can create users
router.post('/register', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { email, password, name, role, siteIds } = req.body;
    const company_id = req.user!.company_id;

    // Only management roles can register new users
    if (![UserRole.MAIN_MANAGER, UserRole.ACCOUNTANT, UserRole.MANAGER].includes(req.user!.role)) {
      res.status(403).json({ error: 'Only managers can create users' });
      return;
    }

    // Validate required fields
    if (!email || !password || !name || !role) {
      res.status(400).json({ error: 'Email, password, name, and role are required' });
      return;
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    // Create user (password hashed automatically via pre-save hook)
    const user = await User.create({
      email,
      password, // Will be hashed automatically
      name,
      role,
      company_id,
      assignedSites: siteIds?.map((id: string) => new mongoose.Types.ObjectId(id)) || [],
      isActive: true,
    });

    // Log user creation
    await ActionLogService.logUserCreate(req, user._id.toString(), user.name, user.email);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Login
router.post('/login', async (req, res): Promise<void> => {
  try {
    const { email, password, company_id } = req.body;

    if (!email || !password || !company_id) {
      res.status(400).json({ error: 'Email, password, and company_id are required' });
      return;
    }

    // Find user
    const user = await User.findOne({ email, company_id });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password using the model method
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Get assigned sites for site managers
    let assignedSitesData: { id: string; name: string }[] = [];
    if (user.role === UserRole.SITE_MANAGER && user.assignedSites) {
      assignedSitesData = user.assignedSites.map((id: any) => ({ id: id.toString(), name: '' }));
    }

    // Generate token
    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      company_id: user.company_id,
      isActive: user.isActive,
      assignedSites: assignedSitesData,
    });

    // Log the login action
    await ActionLogService.logLogin(req, user._id.toString(), user.name, user.email, user.role, user.company_id);

    // Fetch or create company data
    const company = await getOrCreateDefaultCompany(user.company_id);

    // Set httpOnly cookie for session persistence (backend stores the token)
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.company_id,
        assignedSites: assignedSitesData,
        // Profile fields
        profilePicture: user.profilePicture,
        phone: user.phone,
        department: user.department,
        jobTitle: user.jobTitle,
        bio: user.bio,
        location: user.location,
        // Company data
        company: company ? {
          id: company._id.toString(),
          name: company.name,
          logo: company.logo,
          address: company.address,
          phone: company.phone,
          email: company.email,
          website: company.website,
          taxId: company.taxId,
          industry: company.industry,
          description: company.description,
        } : null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Logout - clear cookie
router.post('/logout', authenticateToken, async (req, res): Promise<void> => {
  try {
    res.clearCookie('access_token');
    res.json({ message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).select('-password').populate('assignedSites', 'name');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Fetch or create company data
    const company = await getOrCreateDefaultCompany(user.company_id);

    res.json({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      company_id: user.company_id,
      assignedSites: user.assignedSites,
      // Profile fields
      profilePicture: user.profilePicture,
      phone: user.phone,
      department: user.department,
      jobTitle: user.jobTitle,
      bio: user.bio,
      location: user.location,
      // Company data
      company: company ? {
        id: company._id.toString(),
        name: company.name,
        logo: company.logo,
        address: company.address,
        phone: company.phone,
        email: company.email,
        website: company.website,
        taxId: company.taxId,
        industry: company.industry,
        description: company.description,
      } : null,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required' });
      return;
    }

    const user = await User.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verify current password
    const isValidPassword = await user.comparePassword(currentPassword);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Update password (will be hashed automatically via pre-save hook)
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Get all users (main manager only)
router.get('/users', authenticateToken, async (req, res): Promise<void> => {
  try {
    const company_id = req.user!.company_id;

    // Management roles can view all users
    if (![UserRole.MAIN_MANAGER, UserRole.ACCOUNTANT, UserRole.MANAGER].includes(req.user!.role)) {
      res.status(403).json({ error: 'Only managers can view all users' });
      return;
    }

    const users = await User.find({ company_id })
      .select('-password')
      .populate('assignedSites', 'name')
      .sort({ createdAt: -1 });

    res.json(users.map(user => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      company_id: user.company_id,
      isActive: user.isActive,
      assignedSites: user.assignedSites,
      createdAt: user.createdAt,
    })));
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user (main manager only)
router.put('/users/:id', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, role, assignedSiteIds, isActive } = req.body;
    const company_id = req.user!.company_id;

    // Management roles can update users
    if (![UserRole.MAIN_MANAGER, UserRole.ACCOUNTANT, UserRole.MANAGER].includes(req.user!.role)) {
      res.status(403).json({ error: 'Only managers can update users' });
      return;
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (assignedSiteIds) {
      updateData.assignedSites = assignedSiteIds.map((id: string) => new mongoose.Types.ObjectId(id));
    }

    const user = await User.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), company_id },
      { $set: updateData },
      { returnDocument: 'after' }
    ).select('-password').populate('assignedSites', 'name');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Log user update
    await ActionLogService.logUserUpdate(req, user._id.toString(), user.name);

    res.json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      company_id: user.company_id,
      isActive: user.isActive,
      assignedSites: user.assignedSites,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Toggle user active status (main manager only)
router.patch('/users/:id/active', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const company_id = req.user!.company_id;

    // Management roles can toggle user status
    if (![UserRole.MAIN_MANAGER, UserRole.ACCOUNTANT, UserRole.MANAGER].includes(req.user!.role)) {
      res.status(403).json({ error: 'Only managers can toggle user status' });
      return;
    }

    const user = await User.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), company_id },
      { $set: { isActive } },
      { returnDocument: 'after' }
    ).select('-password').populate('assignedSites', 'name');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Log user status change (treated as update)
    await ActionLogService.logUserUpdate(req, user._id.toString(), user.name);

    res.json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      company_id: user.company_id,
      isActive: user.isActive,
      assignedSites: user.assignedSites,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Toggle user active error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Assign sites to user (main manager only)
router.post('/users/:id/sites', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { siteIds } = req.body;
    const company_id = req.user!.company_id;

    // Management roles can assign sites
    if (![UserRole.MAIN_MANAGER, UserRole.ACCOUNTANT, UserRole.MANAGER].includes(req.user!.role)) {
      res.status(403).json({ error: 'Only managers can assign sites' });
      return;
    }

    if (!Array.isArray(siteIds)) {
      res.status(400).json({ error: 'siteIds must be an array' });
      return;
    }

    const user = await User.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), company_id },
      { $set: { assignedSites: siteIds.map((id: string) => new mongoose.Types.ObjectId(id)) } },
      { returnDocument: 'after' }
    ).select('-password').populate('assignedSites', 'name');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Log site assignment (manager assigned to sites)
    await ActionLogService.logFromRequest(
      req,
      ActionType.ASSIGN,
      ResourceType.SITE,
      `Assigned manager ${user.name} to sites: ${siteIds.join(', ')}`,
      {
        details: { managerId: id, siteIds },
      }
    );

    res.json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      company_id: user.company_id,
      isActive: user.isActive,
      assignedSites: user.assignedSites,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Assign sites error:', error);
    res.status(500).json({ error: 'Failed to assign sites' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).select('-password');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.patch('/profile', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { name, phone, department, jobTitle, bio, location, profilePicture } = req.body;
    
    const user = await User.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Update allowed fields
    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (department !== undefined) user.department = department;
    if (jobTitle !== undefined) user.jobTitle = jobTitle;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (profilePicture !== undefined) user.profilePicture = profilePicture;

    await user.save();

    // Log user profile update
    await ActionLogService.logFromRequest(
      req,
      ActionType.UPDATE,
      ResourceType.USER,
      `User updated profile: ${user.name}`,
      {
        resourceId: user._id.toString(),
        resourceName: user.name,
        details: { name, phone, department, jobTitle, bio, location },
      }
    );

    // Return user without password
    const updatedUser = await User.findById(req.user!.id).select('-password');
    res.json(updatedUser);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload profile picture (base64)
router.post('/profile/picture', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { image } = req.body;
    
    if (!image || !image.startsWith('data:image')) {
      res.status(400).json({ error: 'Invalid image format. Must be base64 data URL' });
      return;
    }

    // Validate image size (max 5MB)
    const base64Size = image.length * 0.75; // Approximate bytes
    if (base64Size > 5 * 1024 * 1024) {
      res.status(400).json({ error: 'Image too large. Max 5MB' });
      return;
    }

    const user = await User.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    user.profilePicture = image;
    await user.save();

    // Log profile picture update
    await ActionLogService.logFromRequest(
      req,
      ActionType.UPDATE,
      ResourceType.USER,
      `User updated profile picture: ${user.name}`,
      {
        resourceId: user._id.toString(),
        resourceName: user.name,
      }
    );

    res.json({ profilePicture: image });
  } catch (error) {
    console.error('Upload picture error:', error);
    res.status(500).json({ error: 'Failed to upload picture' });
  }
});

export default router;
