import Client from "../models/client.model.js";
import Event from "../models/event.model.js";

export const createClient = async (req, res) => {
  try {
    const { name, email, phone, company, address, preferences } = req.body;
    
    const existingClient = await Client.findOne({
      email,
      planner: req.user._id,
    });
    
    if (existingClient) {
      return res.status(400).json({
        success: false,
        message: "Client with this email already exists",
      });
    }
    
    const client = await Client.create({
      name,
      email,
      phone,
      company,
      address,
      preferences,
      planner: req.user._id,
    });
    
    res.status(201).json({
      success: true,
      message: "Client created successfully",
      data: client,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating client",
      error: error.message,
    });
  }
};

export const getClients = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    
    const query = { planner: req.user._id };
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$text = { $search: search };
    }
    
    const skip = (page - 1) * limit;
    
    const clients = await Client.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await Client.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: clients,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching clients",
      error: error.message,
    });
  }
};

export const getClientById = async (req, res) => {
  try {
    const client = await Client.findOne({
      _id: req.params.id,
      planner: req.user._id,
    });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }
    
    const events = await Event.find({ client: client._id })
      .select("title startDate status budget")
      .sort({ startDate: -1 });
    
    res.status(200).json({
      success: true,
      data: {
        ...client.toObject(),
        events,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching client",
      error: error.message,
    });
  }
};

export const updateClient = async (req, res) => {
  try {
    const { name, email, phone, company, address, preferences, status } = req.body;
    
    const client = await Client.findOne({
      _id: req.params.id,
      planner: req.user._id,
    });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }
    
    if (email && email !== client.email) {
      const existingClient = await Client.findOne({
        email,
        planner: req.user._id,
        _id: { $ne: client._id },
      });
      
      if (existingClient) {
        return res.status(400).json({
          success: false,
          message: "Client with this email already exists",
        });
      }
    }
    
    if (name) client.name = name;
    if (email) client.email = email;
    if (phone) client.phone = phone;
    if (company !== undefined) client.company = company;
    if (address) client.address = { ...client.address, ...address };
    if (preferences) client.preferences = { ...client.preferences, ...preferences };
    if (status) client.status = status;
    
    await client.save();
    
    res.status(200).json({
      success: true,
      message: "Client updated successfully",
      data: client,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating client",
      error: error.message,
    });
  }
};

export const deleteClient = async (req, res) => {
  try {
    const client = await Client.findOne({
      _id: req.params.id,
      planner: req.user._id,
    });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }
    
    const eventCount = await Event.countDocuments({ client: client._id });
    
    if (eventCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete client with associated events",
      });
    }
    
    await client.deleteOne();
    
    res.status(200).json({
      success: true,
      message: "Client deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting client",
      error: error.message,
    });
  }
};

export const addClientNote = async (req, res) => {
  try {
    const { content } = req.body;
    
    const client = await Client.findOne({
      _id: req.params.id,
      planner: req.user._id,
    });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }
    
    client.notes.push({
      content,
      createdBy: req.user._id,
    });
    
    await client.save();
    
    res.status(201).json({
      success: true,
      message: "Note added successfully",
      data: client,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding note",
      error: error.message,
    });
  }
};

export const addClientFeedback = async (req, res) => {
  try {
    const { rating, comment, eventId } = req.body;
    
    const client = await Client.findOne({
      _id: req.params.id,
      planner: req.user._id,
    });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }
    
    client.feedback.push({
      rating,
      comment,
      eventId,
    });
    
    await client.save();
    
    res.status(201).json({
      success: true,
      message: "Feedback added successfully",
      data: client,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding feedback",
      error: error.message,
    });
  }
};
