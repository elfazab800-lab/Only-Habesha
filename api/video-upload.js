
const { put } = require("@vercel/blob");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST method required"
    });
  }

  const token = req.headers["x-admin-upload-key"];
  const adminKey = process.env.ADMIN_UPLOAD_KEY;

  if (!adminKey || token !== adminKey) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  const { filename, contentType, data } = req.body || {};

  if (
    !filename ||
    !contentType ||
    !data ||
    !contentType.startsWith("video/")
  ) {
    return res.status(400).json({
      error: "Valid video data is required"
    });
  }

  try {
    const buffer = Buffer.from(data, "base64");

    if (buffer.length > 4 * 1024 * 1024) {
      return res.status(413).json({
        error: "Video exceeds 4 MB. Use direct client uploads for larger videos."
      });
    }

    const blob = await put(
      `videos/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      buffer,
      {
        access: "public",
        contentType,
        addRandomSuffix: true
      }
    );

    return res.status(200).json({
      success: true,
      url: blob.url
    });
  } catch (error) {
    return res.status(500).json({
      error: "Upload failed"
    });
  }
};
