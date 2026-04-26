import { Router, Request, Response } from 'express'
import { authenticateToken, requireRole } from '../middleware/auth'
import { z } from 'zod'
import { DeliveryNote, PurchaseOrder, Site, SiteRecord } from '../models'
import { UserRole } from '../types'

const router = Router()

// Validation schemas
const deliveryNoteItemSchema = z.object({
  materialName: z.string().min(1, 'Material name is required'),
  material_id: z.string().optional(),
  quantityOrdered: z.number().min(0, 'Quantity ordered must be >= 0'),
  quantityDelivered: z.number().min(0, 'Quantity delivered must be >= 0'),
  unit: z.string().min(1, 'Unit is required'),
  unitPrice: z.number().min(0, 'Unit price must be >= 0'),
  condition: z.enum(['good', 'damaged', 'partial']).optional(),
  notes: z.string().optional(),
})

const deliveryNoteSchema = z.object({
  poId: z.string().min(1, 'PO ID is required'),
  items: z.array(deliveryNoteItemSchema).min(1, 'At least one item is required'),
  deliveryDate: z.string().min(1, 'Delivery date is required'),
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  condition: z.enum(['good', 'damaged', 'partial'], {
    required_error: 'Overall condition is required',
  }),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
})

// Generate DN number
async function generateDNNumber(company_id: string): Promise<string> {
  const year = new Date().getFullYear()
  const count = await DeliveryNote.countDocuments({
    company_id,
    createdAt: {
      $gte: new Date(year, 0, 1),
      $lt: new Date(year + 1, 0, 1),
    },
  })
  return `DN-${year}-${String(count + 1).padStart(4, '0')}`
}

// Get all delivery notes for company
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { company_id } = req.user!
    const { page = '1', limit = '10', poId, search } = req.query

    const query: any = { company_id }
    if (poId) query.poId = poId
    if (search) {
      query.$or = [
        { dnNumber: { $regex: search, $options: 'i' } },
        { poNumber: { $regex: search, $options: 'i' } },
        { 'supplier.name': { $regex: search, $options: 'i' } },
      ]
    }

    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const skip = (pageNum - 1) * limitNum

    const [deliveryNotes, total] = await Promise.all([
      DeliveryNote.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      DeliveryNote.countDocuments(query),
    ])

    res.json({
      records: deliveryNotes.map((dn: any) => ({
        id: dn._id,
        dnNumber: dn.dnNumber,
        poId: dn.poId,
        poNumber: dn.poNumber,
        supplier: dn.supplier,
        site: dn.site,
        items: dn.items,
        deliveryDate: dn.deliveryDate,
        receivedBy: dn.receivedBy,
        receivedByName: dn.receivedByName,
        carrier: dn.carrier,
        trackingNumber: dn.trackingNumber,
        condition: dn.condition,
        notes: dn.notes,
        attachments: dn.attachments,
        company_id: dn.company_id,
        createdAt: dn.createdAt,
        updatedAt: dn.updatedAt,
      })),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    })
  } catch (error) {
    console.error('Error fetching delivery notes:', error)
    res.status(500).json({ message: 'Failed to fetch delivery notes' })
  }
})

// Get delivery note by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { company_id } = req.user!
    const { id } = req.params

    const deliveryNote = await DeliveryNote.findOne({ _id: id, company_id }).lean()

    if (!deliveryNote) {
      res.status(404).json({ message: 'Delivery note not found' })
      return
    }

    res.json({
      id: deliveryNote._id,
      dnNumber: deliveryNote.dnNumber,
      poId: deliveryNote.poId,
      poNumber: deliveryNote.poNumber,
      supplier: deliveryNote.supplier,
      site: deliveryNote.site,
      items: deliveryNote.items,
      deliveryDate: deliveryNote.deliveryDate,
      receivedBy: deliveryNote.receivedBy,
      receivedByName: deliveryNote.receivedByName,
      carrier: deliveryNote.carrier,
      trackingNumber: deliveryNote.trackingNumber,
      condition: deliveryNote.condition,
      notes: deliveryNote.notes,
      attachments: deliveryNote.attachments,
      company_id: deliveryNote.company_id,
      createdAt: deliveryNote.createdAt,
      updatedAt: deliveryNote.updatedAt,
    })
  } catch (error) {
    console.error('Error fetching delivery note:', error)
    res.status(500).json({ message: 'Failed to fetch delivery note' })
  }
})

// Create delivery note
router.post(
  '/',
  authenticateToken,
  requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER, UserRole.SITE_MANAGER]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { company_id, id: userId, name: userName } = req.user!

      const validation = deliveryNoteSchema.safeParse(req.body)
      if (!validation.success) {
        res.status(400).json({
          message: 'Invalid data',
          errors: validation.error.flatten().fieldErrors,
        })
        return
      }

      const data = validation.data

      // Get the PO to copy supplier/site info
      const po = await PurchaseOrder.findOne({ _id: data.poId, company_id }).lean()
      if (!po) {
        res.status(404).json({ message: 'Purchase order not found' })
        return
      }

      // Check if PO status allows delivery
      if (po.status === 'draft' || po.status === 'cancelled') {
        res.status(400).json({
          message: `Cannot create delivery note for PO with status: ${po.status}`,
        })
        return
      }

      // Get site info
      const site = await Site.findById(po.site_id).lean()
      if (!site) {
        res.status(404).json({ message: 'Site not found' })
        return
      }

      // Generate DN number
      const dnNumber = await generateDNNumber(company_id)

      // Calculate totals with tax from PO
      const itemsWithTotals = data.items.map((item) => ({
        ...item,
        totalPrice: item.quantityDelivered * item.unitPrice,
      }))
      const subTotal = itemsWithTotals.reduce((sum, item) => sum + item.totalPrice, 0)
      const taxRate = po.taxRate || 0
      const taxAmount = subTotal * (taxRate / 100)
      const totalAmount = subTotal + taxAmount

      const deliveryNote = await DeliveryNote.create({
        dnNumber,
        poId: data.poId,
        poNumber: po.poNumber,
        supplier: po.supplier,
        site_id: po.site_id,
        site: {
          _id: site._id.toString(),
          name: site.name,
          location: site.location,
        },
        items: itemsWithTotals,
        deliveryDate: new Date(data.deliveryDate),
        receivedBy: userId,
        receivedByName: userName,
        carrier: data.carrier,
        trackingNumber: data.trackingNumber,
        condition: data.condition,
        notes: data.notes,
        attachments: data.attachments,
        subTotal,
        taxRate,
        taxAmount,
        totalAmount,
        company_id,
      } as any)

      const savedDN = deliveryNote.toObject()

      // Update PO with received quantities
      const updatedItems = po.items.map((poItem: any) => {
        const deliveredItem = data.items.find(
          (dItem) => dItem.materialName === poItem.materialName
        )
        if (deliveredItem) {
          return {
            ...poItem,
            quantityReceived: (poItem.quantityReceived || 0) + deliveredItem.quantityDelivered,
          }
        }
        return poItem
      })

      // Determine new PO status
      const allReceived = updatedItems.every(
        (item: any) => item.quantityReceived >= item.quantityOrdered
      )
      const someReceived = updatedItems.some(
        (item: any) => item.quantityReceived > 0
      )
      let newStatus = po.status
      if (allReceived) {
        newStatus = 'received'
      } else if (someReceived) {
        newStatus = 'partial'
      }

      await PurchaseOrder.updateOne(
        { _id: data.poId },
        {
          $set: {
            items: updatedItems,
            status: newStatus,
          },
        }
      )

      // Create SiteRecord entries for delivered items (auto-syncs to MainStock)
      const siteRecordPromises = data.items
        .filter((item) => item.quantityDelivered > 0)
        .map((item) =>
          SiteRecord.create({
            site_id: po.site_id,
            material_id: item.material_id || undefined,
            materialName: item.materialName,
            quantityReceived: item.quantityDelivered,
            quantityUsed: 0,
            date: new Date(data.deliveryDate),
            notes: `Delivered via ${savedDN.dnNumber}. ${item.notes || ''}`,
            recordedBy: userId,
            company_id,
            syncedToMainStock: false,
          } as any)
        )

      await Promise.all(siteRecordPromises)

      res.status(201).json({
        id: savedDN._id,
        dnNumber: savedDN.dnNumber,
        poId: savedDN.poId,
        poNumber: savedDN.poNumber,
        supplier: savedDN.supplier,
        site: savedDN.site,
        items: savedDN.items,
        deliveryDate: savedDN.deliveryDate,
        receivedBy: savedDN.receivedBy,
        receivedByName: savedDN.receivedByName,
        carrier: savedDN.carrier,
        trackingNumber: savedDN.trackingNumber,
        condition: savedDN.condition,
        notes: savedDN.notes,
        attachments: savedDN.attachments,
        company_id: savedDN.company_id,
        createdAt: savedDN.createdAt,
        updatedAt: savedDN.updatedAt,
      })
    } catch (error) {
      console.error('Error creating delivery note:', error)
      res.status(500).json({ message: 'Failed to create delivery note' })
    }
  }
)

// Get delivery notes for a specific PO
router.get('/po/:poId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { company_id } = req.user!
    const { poId } = req.params

    const deliveryNotes = await DeliveryNote.find({ poId, company_id })
      .sort({ createdAt: -1 })
      .lean()

    res.json(
      deliveryNotes.map((dn: any) => ({
        id: dn._id,
        dnNumber: dn.dnNumber,
        poId: dn.poId,
        poNumber: dn.poNumber,
        supplier: dn.supplier,
        site: dn.site,
        items: dn.items,
        deliveryDate: dn.deliveryDate,
        receivedBy: dn.receivedBy,
        receivedByName: dn.receivedByName,
        carrier: dn.carrier,
        trackingNumber: dn.trackingNumber,
        condition: dn.condition,
        notes: dn.notes,
        attachments: dn.attachments,
        company_id: dn.company_id,
        createdAt: dn.createdAt,
        updatedAt: dn.updatedAt,
      }))
    )
  } catch (error) {
    console.error('Error fetching PO delivery notes:', error)
    res.status(500).json({ message: 'Failed to fetch delivery notes' })
  }
})

// Delete delivery note
router.delete(
  '/:id',
  authenticateToken,
  requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { company_id } = req.user!
      const { id } = req.params

      const deliveryNote = await DeliveryNote.findOne({
        _id: id,
        company_id,
      }).lean()

      if (!deliveryNote) {
        res.status(404).json({ message: 'Delivery note not found' })
        return
      }

      // Revert PO received quantities
      const po = await PurchaseOrder.findOne({
        _id: deliveryNote.poId,
        company_id,
      }).lean()

      if (po) {
        const updatedItems = po.items.map((poItem: any) => {
          const deliveredItem = deliveryNote.items.find(
            (dItem: any) => dItem.materialName === poItem.materialName
          )
          if (deliveredItem) {
            return {
              ...poItem,
              quantityReceived: Math.max(
                0,
                (poItem.quantityReceived || 0) - deliveredItem.quantityDelivered
              ),
            }
          }
          return poItem
        })

        // Recalculate PO status
        const someReceived = updatedItems.some(
          (item: any) => (item.quantityReceived || 0) > 0
        )
        const newStatus = someReceived ? 'partial' : 'sent'

        await PurchaseOrder.updateOne(
          { _id: po._id },
          {
            $set: {
              items: updatedItems,
              status: newStatus,
            },
          }
        )
      }

      // Delete associated site records created from this delivery note
      await SiteRecord.deleteMany({
        site_id: deliveryNote.site_id,
        company_id,
        notes: { $regex: `Delivered via ${deliveryNote.dnNumber}` },
      })

      // Delete the delivery note
      await DeliveryNote.deleteOne({ _id: id, company_id })

      res.json({ message: 'Delivery note deleted successfully' })
    } catch (error) {
      console.error('Error deleting delivery note:', error)
      res.status(500).json({ message: 'Failed to delete delivery note' })
    }
  }
)

export default router
