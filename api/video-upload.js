
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { randomUUID } = require("node:crypto");
const { valid, getCookie } = require("./_auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST method required" });
  }

  if (!valid(getCookie(req, "oh_admin"))) {
    return res.status(401).json({ error: "Admin login required" });
  }

  const bucket = process.env.STORJ_BUCKET;
  const endpoint = process.env.STORJ_ENDPOINT;
  const region = process.env.STORJ_REGION || "global";
  const accessKeyId = process.env.STORJ_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORJ_SECRET_ACCESS_KEY;

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    return res.status(500).json({
      error: "Storj server configuration is missing"
    });
  }

  const body = req.body || {};
  const contentType =
    typeof body.contentType === "string" ? body.contentType.trim() : "";
  const filename =
    typeof body.filename === "string" ? body.filename.trim() : "";
  const size = Number(body.size);

  if (!contentType.startsWith("video/")) {
    return res.status(400).json({ error: "A video file is required" });
  }

  if (!Number.isSafeInteger(size) || size < 1 || size > 500 * 1024 * 1024) {
    return res.status(400).json({
      error: "Video size must be between 1 byte and 500 MB"
    });
  }

  const safeName = filename
    .split(/[\\/]/)
    .pop()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-100) || "video.mp4";

  const pathname = `videos/${randomUUID()}-${safeName}`;

  try {
    const s3 = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      },
      forcePathStyle: true
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: pathname,
      ContentType: contentType
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 600
    });

    return res.status(200).json({
      uploadUrl,
      pathname,
      contentType,
      expiresIn: 600
    });
  } catch (error) {
    console.error("Storj upload URL error:", error);
    return res.status(500).json({
      error: "Could not prepare Storj upload"
    });
  }
};
