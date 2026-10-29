
const {
  S3Client,
  GetObjectCommand
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "GET method required"
    });
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
    return res.status(400).json({
      error: "የቪዲዮው አድራሻ ትክክል አይደለም።"
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: "የSupabase የአገልጋይ ቅንብር ጎድሏል።"
    });
  }

  try {
    const baseUrl = supabaseUrl.replace(/\/+$/, "");

    const headers = {
      apikey: supabaseKey,
      Authorization: "Bearer " + supabaseKey
    };

    const select =
      "pathname,storage_path,category,video_url,is_published,mime_type";

    async function findVideo(column) {
      const url = new URL(baseUrl + "/rest/v1/videos");

      url.searchParams.set("select", select);
      url.searchParams.set(column, "eq." + pathname);
      url.searchParams.set("limit", "1");

      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        console.error(
          "Supabase video lookup failed:",
          response.status,
          await response.text()
        );
        throw new Error("Supabase video lookup failed");
      }

      const rows = await response.json();
      return rows[0] || null;
    }

    // በSupabase ውስጥ ቪዲዮውን ፈልግ።
    let video = await findVideo("pathname");

    if (!video) {
      video = await findVideo("storage_path");
    }

    if (!video || video.is_published !== true) {
      return res.status(404).json({
        error: "የታተመው ቪዲዮ አልተገኘም።"
      });
    }

    // ነፃ Short Videos ብቻ ይፈቀዳሉ።
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
        error: "ይህ ቪዲዮ በነፃ አይጫወትም። Premium VIP አባልነት ያስፈልጋል።"
      });
    }

    const objectKey =
      typeof video.pathname === "string" &&
      video.pathname.startsWith("videos/")
        ? video.pathname
        : video.storage_path;

    if (
      typeof objectKey !== "string" ||
      !objectKey.startsWith("videos/") ||
      objectKey.startsWith("/") ||
      objectKey.includes("..") ||
      objectKey.includes("\\")
    ) {
      return res.status(404).json({
        error: "የቪዲዮው Storage Path ትክክል አይደለም።"
      });
    }

    const bucket = process.env.STORJ_BUCKET;
    const endpoint =
      process.env.STORJ_ENDPOINT ||
      "https://gateway.storjshare.io";
    const region = process.env.STORJ_REGION || "global";
    const accessKeyId = process.env.STORJ_ACCESS_KEY_ID;
    const secretAccessKey = process.env.STORJ_SECRET_ACCESS_KEY;

    if (bucket && accessKeyId && secretAccessKey) {
      const s3 = new S3Client({
        endpoint,
        region,
        credentials: {
          accessKeyId,
          secretAccessKey
        },
        forcePathStyle: true
      });

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey
      });

      // የቪዲዮው የጊዜያዊ አድራሻ 5 ደቂቃ ብቻ ይሠራል።
      const signedUrl = await getSignedUrl(s3, command, {
        expiresIn: 300
      });

      res.setHeader("Referrer-Policy", "no-referrer");
      return res.redirect(302, signedUrl);
    }

    // ቀድሞ በSupabase Storage የተቀመጡ ቪዲዮዎችን ይደግፋል።
    const videoUrl =
      typeof video.video_url === "string"
        ? video.video_url
        : "";

    const expectedPrefix =
      baseUrl + "/storage/v1/object/public/videos/";

    if (
      videoUrl &&
      videoUrl.startsWith(expectedPrefix)
    ) {
      res.setHeader("Referrer-Policy", "no-referrer");
      return res.redirect(302, videoUrl);
    }

    return res.status(500).json({
      error: "የStorj ቅንብር ጎድሏል። Vercel Environment Variables አረጋግጥ።"
    });
  } catch (error) {
    console.error("Video playback error:", error);

    return res.status(500).json({
      error: "ቪዲዮውን ማጫወት አልተቻለም። የStorj እና Supabase ቅንብሮችን አረጋግጥ።"
    });
  }
};
