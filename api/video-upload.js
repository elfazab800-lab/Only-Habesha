
const { handleUpload } = require("@vercel/blob/client");
const { valid, getCookie } = require("./_auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "POST method required"
    });
  }

  try {
    const body = req.body;

    const result = await handleUpload({
      body,
      request: req,

      onBeforeGenerateToken: async (pathname) => {
        const session = getCookie(req, "oh_admin");

        if (!valid(session)) {
          throw new Error("Unauthorized: Admin login required");
        }

        if (
          typeof pathname !== "string" ||
          !pathname.startsWith("videos/") ||
          pathname.includes("..")
        ) {
          throw new Error("Invalid video path");
        }

        return {
          allowedContentTypes: ["video/*"],
          addRandomSuffix: true
        };
      },

      onUploadCompleted: async ({ blob }) => {
        console.log("Video uploaded:", blob.pathname);
      }
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Video upload error:", error.message);

    return res.status(400).json({
      error: "Upload request failed. Check Admin login and Blob configuration."
    });
  }
};
