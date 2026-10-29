
const {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand
} = require("@aws-sdk/client-s3");

const { get } = require("@vercel/blob");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { Readable } = require("node:stream");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "GET method required" });
  }

  const pathname =
    typeof req.query.pathname === "string"
      ? req.query.pathname
      : "";

  if (
    !pathname ||
    pathname.startsWith("/") ||
    pathname.includes("..") ||
    pathname.includes("\\") ||
    !pathname.startsWith("videos/")
  ) {
    return res.status(400).json({ error: "Invalid video pathname" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: "Supabase configuration is missing"
    });
  }

  try {
    const baseUrl = supabaseUrl.replace(/\/+$/, "");
    const headers = {
      apikey: supabaseKey,
      Authorization: "Bearer " + supabaseKey
    };

    async function findVideo(column, value) {
      const url = new URL(baseUrl + "/rest/v1/videos");
      url.searchParams.set(
        "select",
        "pathname,storage_path,category,video_url,is_published"
      );
      url.searchParams.set(column, "eq." + value);
      url.searchParams.set("limit", "1");

      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        console.error(
          "Video lookup failed:",
          response.status,
          await response.text()
        );
        throw new Error("Could not verify video");
      }

      const rows = await response.json();
      return rows[0] || null;
    }

    let video = await findVideo("pathname", pathname);

    if (!video) {
      video = await findVideo("storage_path", pathname);
    }

    if (!video || video.is_published !== true) {
      return res.status(404).json({
        error: "Published video not found"
      });
    }

    const category = String(video.category || "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");

    const isShortVideo = [
      "short",
      "short video",
      "short videos"
    ].includes(category);

    if (!isShortVideo) {
      return res.status(403).json({
        error: "This video is not available for free playback"
      });
    }

    const bucket = process.env.STORJ_BUCKET;
    const endpoint =
      process.env.STORJ_ENDPOINT ||
      "https://gateway.storjshare.io";
    const region = process.env.STORJ_REGION || "global";
    const accessKeyId = process.env.STORJ_ACCESS_KEY_ID;
    const secretAccessKey = process.env.STORJ_SECRET_ACCESS_KEY;

    const storagePath =
      typeof video.storage_path === "string"
        ? video.storage_path
        : "";

    const storjKey = storagePath.startsWith("videos/")
      ? storagePath
      : pathname;

    // First, try Storj.
    if (
      bucket &&
      accessKeyId &&
      secretAccessKey &&
      storjKey.startsWith("videos/") &&
      !storjKey.includes("..") &&
      !storjKey.includes("\\")
    ) {
      const s3 = new S3Client({
        endpoint,
        region,
        credentials: {
          accessKeyId,
          secretAccessKey
        },
        forcePathStyle: true
      });

      try {
        await s3.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: storjKey
          })
        );

        const signedUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: bucket,
            Key: storjKey
          }),
          { expiresIn: 300 }
        );

        return res.redirect(302, signedUrl);
      } catch (storjError) {
        console.warn(
          "Storj object unavailable; trying legacy Blob:",
          storjError.name || storjError.message
        );
      }
    }

    // If the file is not in Storj, try the old private Vercel Blob.
    try {
      const blob = await get(pathname, {
        access: "private"
      });

      if (blob && blob.statusCode === 200 && blob.stream) {
        res.statusCode = 200;
        res.setHeader(
          "Content-Type",
          blob.blob?.contentType || "video/mp4"
        );
        res.setHeader("Content-Disposition", "inline");

        if (blob.blob?.size != null) {
          res.setHeader(
            "Content-Length",
            String(blob.blob.size)
          );
        }

        return Readable.fromWeb(blob.stream).pipe(res);
      }
    } catch (blobError) {
      console.warn(
        "Legacy Blob playback unavailable:",
        blobError.message
      );
    }

    // Last fallback: older public Supabase video files.
    const videoUrl =
      typeof video.video_url === "string"
        ? video.video_url
        : "";

    const expectedPrefix =
      baseUrl + "/storage/v1/object/public/videos/";

    if (videoUrl.startsWith(expectedPrefix)) {
      const response = await fetch(videoUrl);

      if (response.ok && response.body) {
        res.statusCode = 200;
        res.setHeader(
          "Content-Type",
          response.headers.get("content-type") || "video/mp4"
        );
        res.setHeader("Content-Disposition", "inline");

        const length = response.headers.get("content-length");
        if (length) {
          res.setHeader("Content-Length", length);
        }

        return Readable.fromWeb(response.body).pipe(res);
      }
    }

    return res.status(404).json({
      error:
        "Video file was not found in Storj, Vercel Blob, or legacy Supabase storage"
    });
  } catch (error) {
    console.error("Video playback error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: "Could not play video. Check storage configuration."
      });
    }

    return res.end();
  }
};
