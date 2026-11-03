import Testimonial from "../models/Testimonial.js";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination.js";

export const getTestimonials = async (req, res) => {
  try {
    const testimonials = await Testimonial.find({ isActive: true }).sort({
      order: 1,
      createdAt: -1,
    });
    res.status(200).json({ success: true, data: testimonials });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllTestimonials = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const filter = {};
    const [total, testimonials] = await Promise.all([
      Testimonial.countDocuments(filter),
      Testimonial.find(filter).sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit),
    ]);

    res.status(200).json(buildPaginatedResponse(testimonials, total, page, limit));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTestimonialById = async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);
    if (!testimonial) {
      return res
        .status(404)
        .json({ success: false, message: "Testimonial not found" });
    }
    res.status(200).json({ success: true, data: testimonial });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addTestimonial = async (req, res) => {
  try {
    const { text, name, role, order, isActive } = req.body;

    if (!text?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Testimonial text is required" });
    }
    if (!name?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Client name is required" });
    }

    const testimonial = await Testimonial.create({
      text: text.trim(),
      name: name.trim(),
      role: role?.trim() || "",
      order: order ?? 0,
      isActive: isActive ?? true,
    });

    res.status(201).json({ success: true, data: testimonial });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTestimonial = async (req, res) => {
  try {
    const { text, name, role, order, isActive } = req.body;
    const updates = {};

    if (text !== undefined) updates.text = text.trim();
    if (name !== undefined) updates.name = name.trim();
    if (role !== undefined) updates.role = role.trim();
    if (order !== undefined) updates.order = order;
    if (isActive !== undefined) updates.isActive = isActive;

    const testimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      updates,
      { returnDocument: 'after', runValidators: true }
    );

    if (!testimonial) {
      return res
        .status(404)
        .json({ success: false, message: "Testimonial not found" });
    }

    res.status(200).json({ success: true, data: testimonial });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTestimonial = async (req, res) => {
  try {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);

    if (!testimonial) {
      return res
        .status(404)
        .json({ success: false, message: "Testimonial not found" });
    }

    res.status(200).json({ success: true, message: "Testimonial deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
