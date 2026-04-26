import { Router, Request, Response } from 'express'
import { authenticateToken, requireRole } from '../middleware/auth'
import { z } from 'zod'
import { Supplier } from '../models/Supplier'
import { UserRole } from '../types'

const router = Router()

// Validation schemas
const supplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  contactPerson: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
})

// Get all suppliers for company
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { company_id } = req.user!

    const suppliers = await Supplier.find({ company_id }).sort({ name: 1 }).lean()

    res.json(
      suppliers.map((s: any) => ({
        id: s._id,
        name: s.name,
        contactPerson: s.contactPerson,
        email: s.email,
        phone: s.phone,
        address: s.address,
        company_id: s.company_id,
        isActive: s.isActive,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }))
    )
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    res.status(500).json({ message: 'Failed to fetch suppliers' })
  }
})

// Get supplier by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { company_id } = req.user!
    const { id } = req.params

    const supplier = await Supplier.findOne({ _id: id, company_id }).lean()

    if (!supplier) {
      res.status(404).json({ message: 'Supplier not found' })
      return
    }

    res.json({
      id: supplier._id,
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      company_id: supplier.company_id,
      isActive: supplier.isActive,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
    })
  } catch (error) {
    console.error('Error fetching supplier:', error)
    res.status(500).json({ message: 'Failed to fetch supplier' })
  }
})

// Create supplier
router.post(
  '/',
  authenticateToken,
  requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { company_id } = req.user!

      const validation = supplierSchema.safeParse(req.body)
      if (!validation.success) {
        res.status(400).json({
          message: 'Invalid data',
          errors: validation.error.flatten().fieldErrors,
        })
        return
      }

      const data = validation.data

      // Check for duplicate name
      const existing = await Supplier.findOne({
        name: data.name,
        company_id,
      })

      if (existing) {
        res.status(400).json({
          message: 'A supplier with this name already exists',
        })
        return
      }

      const supplier = await Supplier.create({
        ...data,
        company_id,
        isActive: true,
      })

      res.status(201).json({
        id: supplier._id,
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        company_id: supplier.company_id,
        isActive: supplier.isActive,
        createdAt: supplier.createdAt,
        updatedAt: supplier.updatedAt,
      })
    } catch (error) {
      console.error('Error creating supplier:', error)
      res.status(500).json({ message: 'Failed to create supplier' })
    }
  }
)

// Update supplier
router.put(
  '/:id',
  authenticateToken,
  requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { company_id } = req.user!
      const { id } = req.params

      const validation = supplierSchema.partial().safeParse(req.body)
      if (!validation.success) {
        res.status(400).json({
          message: 'Invalid data',
          errors: validation.error.flatten().fieldErrors,
        })
        return
      }

      const data = validation.data

      // Check for duplicate name if name is being updated
      if (data.name) {
        const existing = await Supplier.findOne({
          name: data.name,
          company_id,
          _id: { $ne: id },
        })

        if (existing) {
          res.status(400).json({
            message: 'A supplier with this name already exists',
          })
          return
        }
      }

      const supplier = await Supplier.findOneAndUpdate(
        { _id: id, company_id },
        { $set: data },
        { new: true }
      ).lean()

      if (!supplier) {
        res.status(404).json({ message: 'Supplier not found' })
        return
      }

      res.json({
        id: supplier._id,
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        company_id: supplier.company_id,
        isActive: supplier.isActive,
        createdAt: supplier.createdAt,
        updatedAt: supplier.updatedAt,
      })
    } catch (error) {
      console.error('Error updating supplier:', error)
      res.status(500).json({ message: 'Failed to update supplier' })
    }
  }
)

// Delete supplier
router.delete(
  '/:id',
  authenticateToken,
  requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { company_id } = req.user!
      const { id } = req.params

      const supplier = await Supplier.findOneAndDelete({
        _id: id,
        company_id,
      }).lean()

      if (!supplier) {
        res.status(404).json({ message: 'Supplier not found' })
        return
      }

      res.json({ message: 'Supplier deleted successfully' })
    } catch (error) {
      console.error('Error deleting supplier:', error)
      res.status(500).json({ message: 'Failed to delete supplier' })
    }
  }
)

// Toggle supplier active status
router.patch(
  '/:id/active',
  authenticateToken,
  requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { company_id } = req.user!
      const { id } = req.params
      const { isActive } = req.body

      if (typeof isActive !== 'boolean') {
        res.status(400).json({ message: 'isActive must be a boolean' })
        return
      }

      const supplier = await Supplier.findOneAndUpdate(
        { _id: id, company_id },
        { $set: { isActive } },
        { new: true }
      ).lean()

      if (!supplier) {
        res.status(404).json({ message: 'Supplier not found' })
        return
      }

      res.json({
        id: supplier._id,
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        company_id: supplier.company_id,
        isActive: supplier.isActive,
        createdAt: supplier.createdAt,
        updatedAt: supplier.updatedAt,
      })
    } catch (error) {
      console.error('Error toggling supplier status:', error)
      res.status(500).json({ message: 'Failed to update supplier status' })
    }
  }
)

export default router
