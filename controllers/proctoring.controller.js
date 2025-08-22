import cloudinary from "../config/cloudinary.js";
import Proctoring from "../models/ProctoringScreenshot.model.js";

export const createProctoringScreenshot = async (req, res, next) => {
  try {
    const { sessionId, testSlug, takenAt } = req.body;
    if (!req.file)
      return res.status(400).json({ success: false, message: "File missing" });
    if (!sessionId || !testSlug || !takenAt) {
      return res
        .status(400)
        .json({ success: false, message: "Required fields are missing" });
    }

    const folder = process.env.CLOUDINARY_FOLDER || "proctoring-screenshots";
    const publicId = `${sessionId}/${Date.now()}`;

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            public_id: publicId,
            resource_type: "image",
            overwrite: false,
          },
          (err, res) => (err ? reject(err) : resolve(res))
        )
        .end(req.file.buffer);
    });

    const doc = await Proctoring.create({
      sessionId,
      testSlug,
      takenAt: new Date(takenAt),
      public_id: result.public_id,
      secure_url: result.secure_url,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      format: result.format,
      created_at: result.created_at,
    });
    res.status(201).json({
      success: true,
      status: 201,
      data: doc,
    });
  } catch (error) {
    next(error);
  }
};
