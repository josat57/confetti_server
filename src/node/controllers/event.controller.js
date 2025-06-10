import Event from '../models/event.model.js';
import { handleError } from '../utils/error.js';

export const createEvent = async (req, res) => {
  try {
    const event = new Event({
      ...req.body,
      createdBy: req.user.id
    });
    await event.save();
    res.status(201).json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const getEvents = async (req, res) => {
  try {
    const {
      type,
      status,
      startDate,
      endDate,
      location,
      page = 1,
      limit = 10
    } = req.query;

    const query = {};
    
    if (type) query.type = type;
    if (status) query.status = status;
    if (startDate && endDate) {
      query.startDate = { $gte: new Date(startDate) };
      query.endDate = { $lte: new Date(endDate) };
    }
    if (location) {
      query['location.city'] = new RegExp(location, 'i');
    }

    const events = await Event.find(query)
      .populate('createdBy', 'name email')
      .populate('planner', 'name email')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ startDate: 1 });

    const total = await Event.countDocuments(query);

    res.json({
      events,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('planner', 'name email')
      .populate('vendors.vendor', 'name category rating');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user has access to the event
    if (!event.createdBy.equals(req.user.id) && 
        !event.planner?.equals(req.user.id) &&
        !event.vendors.some(v => v.vendor.equals(req.user.id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user has permission to update
    if (!event.createdBy.equals(req.user.id) && 
        !event.planner?.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    Object.assign(event, req.body);
    await event.save();

    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Only creator can delete the event
    if (!event.createdBy.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await event.remove();
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    handleError(res, error);
  }
};

export const addVendor = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user has permission to add vendors
    if (!event.createdBy.equals(req.user.id) && 
        !event.planner?.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { vendorId, category } = req.body;
    await event.addVendor(vendorId, category);

    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const updateVendorStatus = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user has permission to update vendor status
    if (!event.createdBy.equals(req.user.id) && 
        !event.planner?.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { status } = req.body;
    await event.updateVendorStatus(req.params.vendorId, status);

    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const addTimelineItem = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user has permission to add timeline items
    if (!event.createdBy.equals(req.user.id) && 
        !event.planner?.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await event.addTimelineItem(req.body);
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const addChecklistItem = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user has permission to add checklist items
    if (!event.createdBy.equals(req.user.id) && 
        !event.planner?.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { category, item } = req.body;
    await event.addChecklistItem(category, item);
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const addDocument = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user has permission to add documents
    if (!event.createdBy.equals(req.user.id) && 
        !event.planner?.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await event.addDocument({
      ...req.body,
      uploadedBy: req.user.id
    });
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const addNote = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user has permission to add notes
    if (!event.createdBy.equals(req.user.id) && 
        !event.planner?.equals(req.user.id) &&
        !event.vendors.some(v => v.vendor.equals(req.user.id))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await event.addNote(req.body.content, req.user.id);
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const removeVendor = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user has permission to remove vendors
    if (!event.createdBy.equals(req.user.id) && 
        !event.planner?.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await event.removeVendor(req.params.vendorId);
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const removeGuest = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user has permission to remove guests
    if (!event.createdBy.equals(req.user.id) && 
        !event.planner?.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await event.removeGuest(req.params.guestId);
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const addGuest = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user has permission to add guests
    if (!event.createdBy.equals(req.user.id) && 
        !event.planner?.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { userId, plusOne } = req.body;
    await event.addGuest(userId, plusOne);
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const updateBudget = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user has permission to update budget
    if (!event.createdBy.equals(req.user.id) && 
        !event.planner?.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { amount, currency } = req.body;
    event.budget = { amount, currency };
    await event.save();
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const updateSchedule = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user has permission to update schedule
    if (!event.createdBy.equals(req.user.id) && 
        !event.planner?.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { timeline } = req.body;
    event.timeline = timeline;
    await event.save();
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
}; 