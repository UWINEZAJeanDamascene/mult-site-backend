import { Router } from 'express';
import mongoose from 'mongoose';
import { Company } from '../models/Company';
import { authenticateToken, requireRole } from '../middleware/auth';
import { UserRole } from '../models/User';
import { ActionLogService } from '../services/actionLogService';
import { ActionType, ResourceType } from '../models/ActionLog';

const router = Router();

// Get company details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if id is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      // If not valid ObjectId, return default company or create one
      let company = await Company.findOne({ name: 'Lilstock' });
      if (!company) {
        // Create default company
        company = await Company.create({
          name: 'Lilstock',
          description: 'Multi-Site Stock Management System',
        });
      }
      res.json(company);
      return;
    }

    const company = await Company.findById(id);
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }
    res.json(company);
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Failed to get company' });
  }
});

// Update company (main managers only)
router.patch(
  '/:id',
  authenticateToken,
  requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER]),
  async (req, res) => {
    try {
      const { name, address, phone, email, website, taxId, industry, description, logo } = req.body;
      const { id } = req.params;

      let company;

      // Check if id is a valid MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(id)) {
        company = await Company.findById(id);
        if (!company) {
          res.status(404).json({ error: 'Company not found' });
          return;
        }
      } else {
        // Try to find by company_id field
        company = await Company.findOne({ company_id: id });
        if (!company) {
          // Try by name 'Lilstock'
          company = await Company.findOne({ name: 'Lilstock' });
        }
        if (!company) {
          // Create new company with this id as company_id
          company = await Company.create({
            name: name || 'Lilstock',
            company_id: id,
            address: address || '',
            phone: phone || '',
            email: email || '',
            website: website || '',
            taxId: taxId || '',
            industry: industry || '',
            description: description || '',
            logo: logo || null,
          });
          res.json(company);
          return;
        }
      }

      // Update fields
      if (name !== undefined) {
        const trimmedName = String(name).trim();
        if (trimmedName.length === 0) {
          res.status(400).json({ error: 'Company name is required' });
          return;
        }
        company.name = trimmedName;
      }
      if (address !== undefined) company.address = address;
      if (phone !== undefined) company.phone = phone;
      if (email !== undefined) company.email = email;
      if (website !== undefined) company.website = website;
      if (taxId !== undefined) company.taxId = taxId;
      if (industry !== undefined) company.industry = industry;
      if (description !== undefined) company.description = description;
      if (logo !== undefined) company.logo = logo;

      await company.save();

      // Log action
      await ActionLogService.logFromRequest(
        req,
        ActionType.UPDATE,
        ResourceType.COMPANY,
        `Company profile updated: ${company.name}`,
        { resourceId: company._id.toString(), resourceName: company.name }
      );

      res.json(company);
    } catch (error) {
      console.error('Update company error:', error);
      res.status(500).json({ error: 'Failed to update company' });
    }
  }
);

// Upload company logo
router.post(
  '/:id/logo',
  authenticateToken,
  requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER]),
  async (req, res) => {
    try {
      const { image } = req.body;
      const { id } = req.params;

      if (!image || typeof image !== 'string') {
        res.status(400).json({ error: 'Image is required' });
        return;
      }

      // Validate base64 image
      if (!image.startsWith('data:image/')) {
        res.status(400).json({ error: 'Invalid image format' });
        return;
      }

      let company;

      // Check if id is a valid MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(id)) {
        company = await Company.findById(id);
        if (!company) {
          res.status(404).json({ error: 'Company not found' });
          return;
        }
      } else {
        // Try to find by company_id field
        company = await Company.findOne({ company_id: id });
        if (!company) {
          // Try by name
          company = await Company.findOne({ name: 'Lilstock' });
        }
        if (!company) {
          // Create new company
          company = await Company.create({
            name: 'Lilstock',
            company_id: id,
            logo: image,
          });
          res.json({ logo: image });
          return;
        }
      }

      company.logo = image;
      await company.save();

      // Log action
      await ActionLogService.logFromRequest(
        req,
        ActionType.UPDATE,
        ResourceType.COMPANY,
        `Company logo updated: ${company.name}`,
        { resourceId: company._id.toString(), resourceName: company.name }
      );

      res.json({ logo: image });
    } catch (error) {
      console.error('Upload logo error:', error);
      res.status(500).json({ error: 'Failed to upload logo' });
    }
  }
);

export default router;
