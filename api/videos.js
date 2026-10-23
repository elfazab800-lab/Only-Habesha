
const { list } = require("@vercel/blob");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "GET method required" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: "Supabase environment variables are missing."
    });
  }

  const baseUrl = supabaseUrl.replace(/\/+$/, "");
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json"
  };

  try {
    // 1. Find existing videos in private Vercel Blob storage.
    const result = await list({
      prefix: "videos/",
      limit: 1000,
      access: "private"
    });

    const blobs = result.blobs.filter(blob =>
      /\.(mp4|webm|mov|m4v|ogv)$/i.test(blob.pathname)
    );

    // 2. Read paths already registered in Supabase.
    const existingResponse = await fetch(
      `${baseUrl}/rest/v1/videos?select=pathname`,
      { headers }
    );

    if (!existingResponse.ok) {
      throw new Error("Could not read Supabase video records.");
    }

    const existingRows = await existingResponse.json();
    const existingPaths = new Set(
      existingRows.map(row => row.pathname)
    );

    // 3. Register only missing videos; preserve existing categories.
    const missingRows = blobs
      .filter(blob => !existingPaths.has(blob.pathname))
      .map(blob => {
        const filename = blob.pathname.split("/").pop();

        const title = filename
          .replace(/-[a-zA-Z0-9]{16,}(?=\.)/, "")
          .replace(/\.[^.]+$/, "")
          .replace(/[_-]+/g, " ")
          .trim();

        return {
          title: title || "Premium Video",
          pathname: blob.pathname,
          category: "premium",
          uploaded_at: blob.uploadedAt
            ? new Date(blob.uploadedAt).toISOString()
            : new Date().toISOString()
        };
      });

    if (missingRows.length > 0) {
      const insertResponse = await fetch(
        `${baseUrl}/rest/v1/videos`,
        {
          method: "POST",
          headers: {
            ...headers,
            Prefer: "return=minimal"
          },
          body: JSON.stringify(missingRows)
        }
      );

      if (!insertResponse.ok) {
        const details = await insertResponse.text();
        console.error("Supabase insert error:", details);
        throw new Error("Could not register videos in Supabase.");
      }
    }

    // 4. Return the public listing metadata only.
    const videosResponse = await fetch(
      `${baseUrl}/rest/v1/videos?select=id,title,pathname,thumbnail_path,category,uploaded_at&order=uploaded_at.desc`,
      { headers }
    );

    if (!videosResponse.ok) {
      throw new Error("Could not load videos from Supabase.");
    }

    const rows = await videosResponse.json();

    return res.status(200).json({
      videos: rows.map(row => ({
        id: row.id,
        title: row.title,
        pathname: row.pathname,
        thumbnail_path: row.thumbnail_path,
        category: row.category,
        uploadedAt: row.uploaded_at
      }))
    });
  } catch (error) {
    console.error("Video database error:", error);

    return res.status(500).json({
      error: "Could not load video database."
    });
  }
};
