
const { list } = require("@vercel/blob");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "GET method required" });
  }

  try {
    const result = await list({
      prefix: "videos/",
      limit: 1000,
      access: "private"
    });

    const videos = result.blobs
      .filter(blob => /\.(mp4|webm|mov|m4v|ogv)$/i.test(blob.pathname))
      .map(blob => ({
        pathname: blob.pathname,
        title: blob.pathname
          .split("/")
          .pop()
          .replace(/-[a-zA-Z0-9]{16,}(?=\.)/, "")
          .replace(/\.[^.]+$/, ""),
        uploadedAt: blob.uploadedAt
      }));

    return res.status(200).json({ videos });
  } catch (error) {
    console.error("Video listing error:", error);
    return res.status(500).json({
      error: "Could not load videos."
    });
  }
};
