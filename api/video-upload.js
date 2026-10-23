
const { handleUpload } = require("@vercel/blob/client");
const { valid, getCookie } = require("./_auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST method required" });
  }

  try {
    const session = getCookie(req, "oh_admin");

    if (!valid(session)) {
      return res.status(401).json({ error: "Admin login required" });
    }

    const result = await handleUpload({
      body: req.body,
      request: req,

      onBeforeGenerateToken: async (pathname) => {
        const currentSession = getCookie(req, "oh_admin");

        if (!valid(currentSession)) {
          throw new Error("Unauthorized");
        }

        if (
          typeof pathname !== "string" ||
          !pathname.startsWith("videos/") ||
          pathname.includes("..")
        ) {
          throw new Error("Invalid video path");
        }

        return {
          access: "private",
          allowedContentTypes: ["video/*"],
          addRandomSuffix: true,
          maximumSizeInBytes: 500 * 1024 * 1024
        };
      },

      onUploadCompleted: async ({ blob }) => {
        console.log("Private video uploaded:", blob.pathname);
      }
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Video upload error:", error.message);

    return res.status(400).json({
      error: "Upload failed. Check login and Blob configuration."
    });
  }
};
